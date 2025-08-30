import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SlackService } from '@/slack/services/slack.service';
import { SlackMessageService } from '@/slack/services/slack-message.service';
import { NotificationsService } from './notifications.service';
import { AuthService } from '@/auth/services/auth.service';
import { DatabaseService } from '@/database/database.service';
import type {
  NotificationData,
  SlackMessage,
  SlackBlock,
} from '@/common/types';

@Injectable()
export class NotificationDistributionService {
  private readonly logger = new Logger(NotificationDistributionService.name);
  private isProcessing = false;

  constructor(
    private readonly slackService: SlackService,
    private readonly slackMessageService: SlackMessageService,
    private readonly notificationsService: NotificationsService,
    private readonly authService: AuthService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Process and send pending notifications every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processNotifications(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      this.logger.debug('Starting notification processing cycle');

      // Get all users with pending notifications
      const usersWithNotifications =
        await this.getUsersWithPendingNotifications();

      for (const userId of usersWithNotifications) {
        await this.processUserNotifications(userId);
      }

      this.logger.debug('Completed notification processing cycle');
    } catch (error) {
      this.logger.error('Error in notification processing cycle:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process notifications for a specific user
   */
  async processUserNotifications(userId: string): Promise<void> {
    try {
      // Get user with decrypted tokens
      const user = await this.authService.getUserWithTokens(userId, true);

      if (!user || !user.slackAccessToken) {
        this.logger.warn(`User ${userId} has no valid Slack token`);
        return;
      }

      // Get pending notifications
      const notifications =
        await this.notificationsService.getPendingNotifications(userId, 10);

      if (notifications.length === 0) {
        return;
      }

      this.logger.log(
        `Processing ${notifications.length} notifications for user ${userId}`,
      );

      // Open DM channel with user
      if (!user.slackId || !user.slackAccessToken) {
        this.logger.error(`User ${userId} missing Slack credentials`);
        return;
      }
      const channelId = await this.slackService.openDMChannel(
        user.slackId,
        user.slackAccessToken,
      );

      if (!channelId) {
        this.logger.error(`Failed to open DM channel for user ${userId}`);
        return;
      }

      // Send each notification
      for (const notification of notifications) {
        await this.sendNotification(user, notification, channelId);
      }
    } catch (error) {
      this.logger.error(
        `Error processing notifications for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Send individual notification to Slack
   */
  private async sendNotification(
    user: any,
    notification: any,
    channelId: string,
  ): Promise<void> {
    try {
      const notificationData = notification.payload as NotificationData;
      let slackMessage: SlackMessage;

      // Create appropriate Slack message based on notification type
      if (notificationData.type.startsWith('pull_request')) {
        slackMessage = this.createPRSlackMessage(notificationData);
      } else if (notificationData.type.startsWith('issues')) {
        slackMessage = this.createIssueSlackMessage(notificationData);
      } else {
        slackMessage = this.createGenericSlackMessage(notificationData);
      }

      slackMessage.channel = channelId;

      // Send message to Slack
      const result = await this.slackService.sendMessage(
        slackMessage,
        user.slackAccessToken,
      );

      if (result) {
        // Mark notification as sent
        await this.notificationsService.markNotificationSent(
          notification.id,
          channelId,
          result.ts!,
        );

        this.logger.log(
          `Sent notification ${notification.id} to user ${user.id}`,
        );
      } else {
        this.logger.error(
          `Failed to send notification ${notification.id} to user ${user.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error sending notification ${notification.id}:`,
        error,
      );
    }
  }

  /**
   * Create Slack message for pull request notifications
   */
  private createPRSlackMessage(data: NotificationData): SlackMessage {
    const action = this.getPRActionText(data.type);
    const color = this.getPRColor(data.type, data.metadata);

    return {
      channel: '',
      text: `${action} pull request in ${data.repository}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${action}* pull request in \`${data.repository}\``,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Title:*\n<${data.url}|${data.title}>`,
            },
            {
              type: 'mrkdwn',
              text: `*Author:*\n@${data.author}`,
            },
            {
              type: 'mrkdwn',
              text: `*PR #:*\n${data.metadata?.number || 'N/A'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Branch:*\n\`${data.metadata?.headBranch}\` → \`${data.metadata?.baseBranch}\``,
            },
          ],
        },
      ],
      attachments: data.description
        ? [
            {
              color,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*Description:*\n${this.truncateText(data.description, 300)}`,
                  },
                },
              ],
            },
          ]
        : [],
    };
  }

  /**
   * Create Slack message for issue notifications
   */
  private createIssueSlackMessage(data: NotificationData): SlackMessage {
    const action = this.getIssueActionText(data.type);
    const color = this.getIssueColor(data.type);

    return {
      channel: '',
      text: `${action} issue in ${data.repository}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${action}* issue in \`${data.repository}\``,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Title:*\n<${data.url}|${data.title}>`,
            },
            {
              type: 'mrkdwn',
              text: `*Author:*\n@${data.author}`,
            },
            {
              type: 'mrkdwn',
              text: `*Issue #:*\n${data.metadata?.number || 'N/A'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Labels:*\n${data.metadata?.labels?.join(', ') || 'None'}`,
            },
          ],
        },
      ],
      attachments: data.description
        ? [
            {
              color,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*Description:*\n${this.truncateText(data.description, 300)}`,
                  },
                },
              ],
            },
          ]
        : [],
    };
  }

  /**
   * Create generic Slack message for other notification types
   */
  private createGenericSlackMessage(data: NotificationData): SlackMessage {
    const blocks: SlackBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*<${data.url}|${data.title}>*\nby @${data.author} in \`${data.repository}\``,
        },
      },
    ];

    if (data.description) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: this.truncateText(data.description, 300),
        },
      });
    }

    return {
      channel: '',
      text: `${data.title} in ${data.repository}`,
      blocks,
    };
  }

  /**
   * Get users with pending notifications
   */
  private async getUsersWithPendingNotifications(): Promise<string[]> {
    try {
      const result = await this.databaseService.notification.findMany({
        where: {
          messageTs: null,
        },
        select: {
          userId: true,
        },
        distinct: ['userId'],
      });

      return result.map((r) => r.userId);
    } catch (error) {
      this.logger.error(
        'Error getting users with pending notifications:',
        error,
      );
      return [];
    }
  }

  /**
   * Get PR action text
   */
  private getPRActionText(type: string): string {
    const mapping: Record<string, string> = {
      'pull_request.opened': '🟢 Opened',
      'pull_request.closed': '🔴 Closed',
      'pull_request.merged': '🟣 Merged',
      'pull_request.reopened': '🟡 Reopened',
      'pull_request_review.submitted': '✅ Reviewed',
      'pull_request_review_comment.created': '💬 Commented',
    };

    return mapping[type] || '🔄 Updated';
  }

  /**
   * Get PR color
   */
  private getPRColor(type: string, metadata: any): string {
    if (metadata?.merged) return '#6f42c1';
    if (type === 'pull_request.closed') return '#d73a49';
    if (type === 'pull_request.opened') return '#28a745';
    return '#0366d6';
  }

  /**
   * Get issue action text
   */
  private getIssueActionText(type: string): string {
    const mapping: Record<string, string> = {
      'issues.opened': '🟢 Opened',
      'issues.closed': '🔴 Closed',
      'issues.reopened': '🟡 Reopened',
      'issues.assigned': '👤 Assigned',
      'issue_comment.created': '💬 Commented',
    };

    return mapping[type] || '🔄 Updated';
  }

  /**
   * Get issue color
   */
  private getIssueColor(type: string): string {
    if (type === 'issues.closed') return '#d73a49';
    if (type === 'issues.opened') return '#28a745';
    return '#0366d6';
  }

  /**
   * Truncate text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Manually trigger notification processing for a user
   */
  async processUserNotificationsManually(userId: string): Promise<{
    success: boolean;
    processedCount: number;
    error?: string;
  }> {
    try {
      const pendingBefore =
        await this.notificationsService.getPendingNotifications(userId);
      await this.processUserNotifications(userId);
      const pendingAfter =
        await this.notificationsService.getPendingNotifications(userId);

      const processedCount = pendingBefore.length - pendingAfter.length;

      return {
        success: true,
        processedCount,
      };
    } catch (error) {
      this.logger.error(
        `Error manually processing notifications for user ${userId}:`,
        error,
      );
      return {
        success: false,
        processedCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<{
    totalNotifications: number;
    pendingNotifications: number;
    sentNotifications: number;
    recentNotifications: number;
  }> {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const [
        totalNotifications,
        pendingNotifications,
        sentNotifications,
        recentNotifications,
      ] = await Promise.all([
        this.databaseService.notification.count(),
        this.databaseService.notification.count({
          where: { messageTs: null },
        }),
        this.databaseService.notification.count({
          where: { messageTs: { not: null } },
        }),
        this.databaseService.notification.count({
          where: {
            createdAt: { gte: oneDayAgo },
          },
        }),
      ]);

      return {
        totalNotifications,
        pendingNotifications,
        sentNotifications,
        recentNotifications,
      };
    } catch (error) {
      this.logger.error('Error getting notification stats:', error);
      return {
        totalNotifications: 0,
        pendingNotifications: 0,
        sentNotifications: 0,
        recentNotifications: 0,
      };
    }
  }
}
