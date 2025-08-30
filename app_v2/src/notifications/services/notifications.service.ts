import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { SlackMessageService } from '@/slack/services/slack-message.service';
import { UserSettingsService } from '@/users/services/user-settings.service';
import type {
  GitHubPullRequest,
  GitHubIssue,
  NotificationData,
  SlackMessage,
} from '@/common/types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly slackMessageService: SlackMessageService,
    private readonly userSettingsService: UserSettingsService,
  ) {}

  /**
   * Process a GitHub event and create notifications
   */
  async processEvent(event: any): Promise<boolean> {
    try {
      const { eventType, action, payload, repositoryName } = event;

      // Get users who should receive this notification
      const relevantUsers = await this.getRelevantUsers(
        repositoryName,
        payload,
      );

      if (relevantUsers.length === 0) {
        this.logger.debug(
          `No relevant users found for ${eventType} in ${repositoryName}`,
        );
        return true;
      }

      // Create notifications for each relevant user
      const notifications = [];
      for (const user of relevantUsers) {
        const shouldNotify = await this.shouldNotifyUser(
          user,
          eventType,
          action,
          payload,
        );

        if (shouldNotify) {
          const notification = await this.createNotification(
            user,
            event,
            eventType,
            action,
            payload,
            repositoryName,
          );

          if (notification) {
            notifications.push(notification);
          }
        }
      }

      this.logger.log(
        `Created ${notifications.length} notifications for ${eventType} in ${repositoryName}`,
      );
      return true;
    } catch (error) {
      this.logger.error('Error processing event:', error);
      return false;
    }
  }

  /**
   * Get users who should potentially receive notifications for this repository
   */
  private async getRelevantUsers(
    repositoryName: string,
    payload: any,
  ): Promise<any[]> {
    try {
      // Extract repository info from payload
      const repositoryId = payload.repository?.id?.toString();

      if (!repositoryId) {
        return [];
      }

      // Get users who have this repository tracked
      const users = await this.databaseService.user.findMany({
        where: {
          repositories: {
            some: {
              githubId: repositoryId,
              enabled: true,
            },
          },
          isActive: true,
        },
        include: {
          settings: true,
          repositories: {
            where: {
              githubId: repositoryId,
            },
          },
        },
      });

      return users;
    } catch (error) {
      this.logger.error('Error getting relevant users:', error);
      return [];
    }
  }

  /**
   * Check if user should be notified based on their preferences
   */
  private async shouldNotifyUser(
    user: any,
    eventType: string,
    action: string,
    payload: any,
  ): Promise<boolean> {
    try {
      const preferences =
        await this.userSettingsService.getNotificationPreferences(user.id);
      const schedule = await this.userSettingsService.getNotificationSchedule(
        user.id,
      );

      // Check if real-time notifications are enabled
      if (!schedule.real_time) {
        return false;
      }

      // Check specific event type preferences
      const eventKey = this.getEventPreferenceKey(eventType, action);
      if (eventKey && preferences[eventKey] === false) {
        return false;
      }

      // Check keywords filtering
      const keywords = await this.userSettingsService.getKeywords(user.id);
      if (keywords.length > 0 && !this.matchesKeywords(payload, keywords)) {
        return false;
      }

      // Don't notify users about their own actions
      if (payload.sender?.id?.toString() === user.githubId) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Error checking notification preferences for user ${user.id}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Create a notification record in the database
   */
  private async createNotification(
    user: any,
    event: any,
    eventType: string,
    action: string,
    payload: any,
    repositoryName: string,
  ): Promise<any> {
    try {
      // Generate notification message
      const messageData = this.createNotificationData(
        eventType,
        action,
        payload,
        repositoryName,
      );

      if (!messageData) {
        return null;
      }

      // Create notification record
      const notification = await this.databaseService.notification.create({
        data: {
          userId: user.id,
          eventId: event.id,
          messageType: eventType,
          payload: messageData as any,
        },
      });

      return notification;
    } catch (error) {
      this.logger.error('Error creating notification:', error);
      return null;
    }
  }

  /**
   * Create notification data for different event types
   */
  private createNotificationData(
    eventType: string,
    action: string,
    payload: any,
    repositoryName: string,
  ): NotificationData | null {
    try {
      switch (eventType) {
        case 'pull_request':
          return this.createPRNotificationData(action, payload, repositoryName);

        case 'pull_request_review':
          return this.createPRReviewNotificationData(
            action,
            payload,
            repositoryName,
          );

        case 'issues':
          return this.createIssueNotificationData(
            action,
            payload,
            repositoryName,
          );

        case 'issue_comment':
          return this.createIssueCommentNotificationData(
            action,
            payload,
            repositoryName,
          );

        case 'pull_request_review_comment':
          return this.createPRCommentNotificationData(
            action,
            payload,
            repositoryName,
          );

        default:
          return null;
      }
    } catch (error) {
      this.logger.error(
        `Error creating notification data for ${eventType}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Create pull request notification data
   */
  private createPRNotificationData(
    action: string,
    payload: any,
    repositoryName: string,
  ): NotificationData {
    const pr = payload.pull_request;

    return {
      type: `pull_request.${action}`,
      title: pr.title,
      url: pr.html_url,
      author: pr.user.login,
      repository: repositoryName,
      description: pr.body || '',
      timestamp: new Date().toISOString(),
      metadata: {
        number: pr.number,
        state: pr.state,
        merged: pr.merged,
        draft: pr.draft,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
      },
    };
  }

  /**
   * Create pull request review notification data
   */
  private createPRReviewNotificationData(
    action: string,
    payload: any,
    repositoryName: string,
  ): NotificationData {
    const review = payload.review;
    const pr = payload.pull_request;

    return {
      type: `pull_request_review.${action}`,
      title: `Review on "${pr.title}"`,
      url: review.html_url,
      author: review.user.login,
      repository: repositoryName,
      description: review.body || '',
      timestamp: new Date().toISOString(),
      metadata: {
        prNumber: pr.number,
        reviewState: review.state,
        reviewId: review.id,
      },
    };
  }

  /**
   * Create issue notification data
   */
  private createIssueNotificationData(
    action: string,
    payload: any,
    repositoryName: string,
  ): NotificationData {
    const issue = payload.issue;

    return {
      type: `issues.${action}`,
      title: issue.title,
      url: issue.html_url,
      author: issue.user.login,
      repository: repositoryName,
      description: issue.body || '',
      timestamp: new Date().toISOString(),
      metadata: {
        number: issue.number,
        state: issue.state,
        labels: issue.labels?.map((l: any) => l.name) || [],
      },
    };
  }

  /**
   * Create issue comment notification data
   */
  private createIssueCommentNotificationData(
    action: string,
    payload: any,
    repositoryName: string,
  ): NotificationData {
    const comment = payload.comment;
    const issue = payload.issue;

    return {
      type: `issue_comment.${action}`,
      title: `Comment on "${issue.title}"`,
      url: comment.html_url,
      author: comment.user.login,
      repository: repositoryName,
      description: comment.body || '',
      timestamp: new Date().toISOString(),
      metadata: {
        issueNumber: issue.number,
        commentId: comment.id,
      },
    };
  }

  /**
   * Create PR comment notification data
   */
  private createPRCommentNotificationData(
    action: string,
    payload: any,
    repositoryName: string,
  ): NotificationData {
    const comment = payload.comment;
    const pr = payload.pull_request;

    return {
      type: `pull_request_review_comment.${action}`,
      title: `Comment on "${pr.title}"`,
      url: comment.html_url,
      author: comment.user.login,
      repository: repositoryName,
      description: comment.body || '',
      timestamp: new Date().toISOString(),
      metadata: {
        prNumber: pr.number,
        commentId: comment.id,
      },
    };
  }

  /**
   * Map event types to user preference keys
   */
  private getEventPreferenceKey(
    eventType: string,
    action: string,
  ): string | null {
    const mapping: Record<string, string> = {
      'pull_request.opened': 'pull_request_opened',
      'pull_request.closed': 'pull_request_closed',
      'pull_request.merged': 'pull_request_merged',
      'pull_request_review.submitted': 'pull_request_reviewed',
      'pull_request_review_comment.created': 'pull_request_commented',
      'issues.opened': 'issue_opened',
      'issues.closed': 'issue_closed',
      'issue_comment.created': 'issue_commented',
      'issues.assigned': 'issue_assigned',
      'pull_request.assigned': 'pull_request_assigned',
    };

    const key = `${eventType}.${action}`;
    return mapping[key] || null;
  }

  /**
   * Check if payload matches user's keywords
   */
  private matchesKeywords(payload: any, keywords: string[]): boolean {
    if (keywords.length === 0) {
      return true;
    }

    const searchText = [
      payload.pull_request?.title,
      payload.pull_request?.body,
      payload.issue?.title,
      payload.issue?.body,
      payload.comment?.body,
      payload.review?.body,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return keywords.some((keyword) =>
      searchText.includes(keyword.toLowerCase()),
    );
  }

  /**
   * Get pending notifications for user
   */
  async getPendingNotifications(userId: string, limit = 50): Promise<any[]> {
    try {
      return await this.databaseService.notification.findMany({
        where: {
          userId,
          messageTs: null, // Not yet sent to Slack
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: limit,
        include: {
          event: true,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error getting pending notifications for user ${userId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Mark notification as sent
   */
  async markNotificationSent(
    notificationId: string,
    channel: string,
    messageTs: string,
  ): Promise<boolean> {
    try {
      await this.databaseService.notification.update({
        where: { id: notificationId },
        data: {
          channel,
          messageTs,
          updatedAt: new Date(),
        },
      });

      return true;
    } catch (error) {
      this.logger.error(
        `Error marking notification ${notificationId} as sent:`,
        error,
      );
      return false;
    }
  }
}
