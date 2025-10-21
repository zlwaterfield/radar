import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebClient } from '@slack/web-api';
import { DatabaseService } from '../../database/database.service';
import { PullRequestService } from '../../pull-requests/services/pull-request.service';
import type {
  SlackMessage,
  SlackUser,
  SlackTeam,
  SlackOAuthResponse,
  SlackMessageResponse,
} from '@/common/types/slack.types';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly botClient: WebClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly pullRequestService: PullRequestService,
  ) {
    const botToken = this.configService.get('slack.botToken');
    const signingSecret = this.configService.get('slack.signingSecret');

    this.logger.log(
      `SlackService initialized with botToken: ${botToken ? 'present' : 'missing'}, signingSecret: ${signingSecret ? 'present' : 'missing'}`,
    );

    this.botClient = new WebClient(botToken);
  }

  /**
   * Create Slack client with user access token
   */
  createUserClient(accessToken: string): WebClient {
    return new WebClient(accessToken);
  }

  /**
   * Send message to Slack channel or DM
   */
  async sendMessage(
    message: SlackMessage,
    accessToken: string,
  ): Promise<SlackMessageResponse | null> {
    try {
      const client = this.createUserClient(accessToken);

      const messageParams: any = {
        channel: message.channel,
        text: message.text,
        blocks: message.blocks,
        thread_ts: message.thread_ts,
        mrkdwn: message.mrkdwn !== false, // Default to true
      };

      if (message.attachments) {
        messageParams.attachments = message.attachments;
      }

      const response = await client.chat.postMessage(messageParams);

      if (response.ok) {
        this.logger.log(`Message sent to channel ${message.channel}`);
        return response as SlackMessageResponse;
      } else {
        this.logger.error(`Failed to send message: ${response.error}`);
        return null;
      }
    } catch (error) {
      this.logger.error('Error sending Slack message:', error);
      return null;
    }
  }

  /**
   * Update existing Slack message
   */
  async updateMessage(
    channel: string,
    messageTs: string,
    message: SlackMessage,
    accessToken: string,
  ): Promise<SlackMessageResponse | null> {
    try {
      const client = this.createUserClient(accessToken);

      const updateParams: any = {
        channel,
        ts: messageTs,
        text: message.text,
        blocks: message.blocks,
      };

      if (message.attachments) {
        updateParams.attachments = message.attachments;
      }

      const response = await client.chat.update(updateParams);

      if (response.ok) {
        this.logger.log(`Message updated in channel ${channel}`);
        return response as SlackMessageResponse;
      } else {
        this.logger.error(`Failed to update message: ${response.error}`);
        return null;
      }
    } catch (error) {
      this.logger.error('Error updating Slack message:', error);
      return null;
    }
  }

  /**
   * Delete Slack message
   */
  async deleteMessage(
    channel: string,
    messageTs: string,
    accessToken: string,
  ): Promise<boolean> {
    try {
      const client = this.createUserClient(accessToken);

      const response = await client.chat.delete({
        channel,
        ts: messageTs,
      });

      if (response.ok) {
        this.logger.log(`Message deleted from channel ${channel}`);
        return true;
      } else {
        this.logger.error(`Failed to delete message: ${response.error}`);
        return false;
      }
    } catch (error) {
      this.logger.error('Error deleting Slack message:', error);
      return false;
    }
  }

  /**
   * Get Slack user info
   */
  async getUserInfo(
    userId: string,
    accessToken: string,
  ): Promise<SlackUser | null> {
    try {
      const client = this.createUserClient(accessToken);

      const response = await client.users.info({
        user: userId,
      });

      if (response.ok && response.user) {
        return {
          id: response.user.id!,
          name: response.user.name,
          real_name: response.user.real_name,
          email: response.user.profile?.email,
          image_original: response.user.profile?.image_original,
          team_id: response.user.team_id!,
        };
      } else {
        this.logger.error(`Failed to get user info: ${response.error}`);
        return null;
      }
    } catch (error) {
      this.logger.error('Error getting Slack user info:', error);
      return null;
    }
  }

  /**
   * Get Slack team info
   */
  async getTeamInfo(accessToken: string): Promise<SlackTeam | null> {
    try {
      const client = this.createUserClient(accessToken);

      const response = await client.team.info();

      if (response.ok && response.team) {
        return {
          id: response.team.id!,
          name: response.team.name!,
          domain: response.team.domain!,
          image_original: response.team.icon?.image_original,
        };
      } else {
        this.logger.error(`Failed to get team info: ${response.error}`);
        return null;
      }
    } catch (error) {
      this.logger.error('Error getting Slack team info:', error);
      return null;
    }
  }

  /**
   * Open DM channel with user
   */
  async openDMChannel(
    userId: string,
    accessToken: string,
  ): Promise<string | null> {
    try {
      const client = this.createUserClient(accessToken);

      const response = await client.conversations.open({
        users: userId,
      });

      if (response.ok && response.channel) {
        return response.channel.id!;
      } else {
        this.logger.error(`Failed to open DM channel: ${response.error}`);
        return null;
      }
    } catch (error) {
      this.logger.error('Error opening DM channel:', error);
      return null;
    }
  }

  /**
   * Send direct message to user
   */
  async sendDirectMessage(
    accessToken: string,
    userId: string,
    message: { blocks?: any[]; text?: string; attachments?: any[] },
  ): Promise<SlackMessageResponse | null> {
    try {
      const client = this.createUserClient(accessToken);

      // Open DM channel
      const dmResponse = await client.conversations.open({
        users: userId,
      });

      if (!dmResponse.ok || !dmResponse.channel?.id) {
        this.logger.error(`Failed to open DM channel: ${dmResponse.error}`);
        return null;
      }

      const channelId = dmResponse.channel.id;

      // Send message
      const messageParams: any = {
        channel: channelId,
        text: message.text || 'Daily Digest',
        blocks: message.blocks,
        attachments: message.attachments,
      };

      const messageResponse = await client.chat.postMessage(messageParams);

      if (messageResponse.ok) {
        this.logger.log(`Direct message sent to user ${userId}`);
        return messageResponse as SlackMessageResponse;
      } else {
        this.logger.error(
          `Failed to send direct message: ${messageResponse.error}`,
        );
        return null;
      }
    } catch (error) {
      this.logger.error('Error sending direct message:', error);
      return null;
    }
  }

  /**
   * Send message to a specific Slack channel
   */
  async sendChannelMessage(
    accessToken: string,
    channelId: string,
    message: { blocks?: any[]; text?: string; attachments?: any[] },
  ): Promise<SlackMessageResponse | null> {
    try {
      const client = this.createUserClient(accessToken);

      // Send message to channel
      const messageData: any = {
        channel: channelId,
        ...message,
      };

      // Remove undefined attachments to satisfy TypeScript
      if (messageData.attachments === undefined) {
        delete messageData.attachments;
      }

      const messageResponse = await client.chat.postMessage(messageData);

      if (messageResponse.ok) {
        this.logger.log(`Channel message sent to channel ${channelId}`);
        return {
          ok: true,
          ts: messageResponse.ts,
          channel: channelId,
        } as SlackMessageResponse;
      } else {
        this.logger.error(
          `Failed to send channel message: ${messageResponse.error}`,
        );
        return null;
      }
    } catch (error) {
      this.logger.error('Error sending channel message:', error);
      return null;
    }
  }

  /**
   * Test Slack connection
   */
  async testConnection(accessToken: string): Promise<boolean> {
    try {
      const client = this.createUserClient(accessToken);

      const response = await client.auth.test();
      return response.ok;
    } catch (error) {
      this.logger.debug(
        'Slack connection test failed:',
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Publish home tab view for user
   */
  async publishHomeView(userId: string, blocks: any[], botToken: string): Promise<boolean> {
    try {
      this.logger.log(`[publishHomeView] Called with userId: ${JSON.stringify(userId)}, type: ${typeof userId}`);
      this.logger.log(`[publishHomeView] userId length: ${userId?.length}, is empty: ${userId === ''}, is null: ${userId === null}, is undefined: ${userId === undefined}`);

      // Validate userId before making API call
      if (!userId || typeof userId !== 'string' || userId.trim() === '') {
        this.logger.error(
          `[publishHomeView] Invalid user_id - userId: ${JSON.stringify(userId)}, type: ${typeof userId}`,
        );
        return false;
      }

      if (!botToken) {
        this.logger.error(`[publishHomeView] No bot token provided for user ${userId}`);
        return false;
      }

      this.logger.log(`[publishHomeView] Publishing home view for user: ${userId}`);
      this.logger.log(`[publishHomeView] Blocks count: ${blocks?.length}`);

      // Use the workspace-specific bot token
      const client = new WebClient(botToken);

      const response = await client.views.publish({
        user_id: userId,
        view: {
          type: 'home',
          blocks,
        },
      });

      if (response.ok) {
        this.logger.log(`[publishHomeView] SUCCESS - Home view published for user ${userId}`);
        return true;
      } else {
        this.logger.error(`[publishHomeView] FAILED - Failed to publish home view: ${response.error}`);
        return false;
      }
    } catch (error) {
      this.logger.error('[publishHomeView] ERROR - Error publishing home view:', error);
      return false;
    }
  }

  /**
   * Handle Slack OAuth callback and exchange code for tokens
   */
  async handleOAuthCallback(code: string): Promise<SlackOAuthResponse | null> {
    try {
      const response = await this.botClient.oauth.v2.access({
        client_id: this.configService.get('slack.clientId')!,
        client_secret: this.configService.get('slack.clientSecret')!,
        code,
      });

      if (response.ok) {
        return response as SlackOAuthResponse;
      } else {
        this.logger.error(`OAuth callback failed: ${response.error}`);
        return null;
      }
    } catch (error) {
      this.logger.error('Error handling OAuth callback:', error);
      return null;
    }
  }

  /**
   * Handle app home opened event
   */
  async handleAppHomeOpened(userId: string, teamId?: string): Promise<void> {
    try {
      this.logger.log(`[handleAppHomeOpened] Called with userId: ${JSON.stringify(userId)}, teamId: ${teamId}, type: ${typeof userId}`);

      // Check if user exists in our database
      const user = await this.databaseService.user.findUnique({
        where: { slackId: userId },
      });

      this.logger.log(`[handleAppHomeOpened] User found in DB: ${!!user}, user slackId: ${user?.slackId}, has bot token: ${!!user?.slackBotToken}`);

      const blocks = user
        ? await this.createAuthenticatedHomeView(user)
        : this.createUnauthenticatedHomeView();

      this.logger.log(`[handleAppHomeOpened] Created ${user ? 'authenticated' : 'unauthenticated'} view with ${blocks?.length} blocks`);

      // Use the user's workspace-specific bot token
      const botToken = user?.slackBotToken;

      if (!botToken) {
        this.logger.warn(`[handleAppHomeOpened] No bot token found for user ${userId}. User needs to reconnect via OAuth.`);
        return;
      }

      this.logger.log(`[handleAppHomeOpened] Using user-specific bot token`);

      await this.publishHomeView(userId, blocks, botToken);
    } catch (error) {
      this.logger.error(
        `[handleAppHomeOpened] ERROR - Error handling app home opened for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Create home view for authenticated users
   */
  private async createAuthenticatedHomeView(user: any): Promise<any[]> {
    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Radar dashboard',
          emoji: true,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Hello ${user.name || 'there'}! Here's your Radar overview`,
          },
        ],
      },
    ];

    // Check if user has GitHub connected
    if (!user.githubId) {
      blocks.push(
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ' ',
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ' ',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Connect your GitHub account to see your pull requests.',
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🔗 Connect GitHub',
              },
              url: `${this.configService.get('app.frontendUrl')}/settings`,
              action_id: 'connect_github',
              style: 'primary',
            },
          ],
        },
      );
      return blocks;
    }

    try {
      // Fetch PR stats
      const stats = await this.pullRequestService.getPullRequestStats(user.githubId);

      // Add divider before stats
      blocks.push(
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ' ',
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ' ',
          },
        },
      );

      // Add stats cards section
      blocks.push(...this.createStatsBlocks(stats));

      // Fetch and add PR lists if there are any PRs
      if (stats.waitingOnMe > 0 || stats.myOpenPRs > 0) {
        // Fetch PRs waiting on me
        if (stats.waitingOnMe > 0) {
          blocks.push(
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: ' ',
              },
            },
            {
              type: 'divider',
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: ' ',
              },
            },
          );

          const waitingOnMe = await this.pullRequestService.listPullRequests({
            reviewerGithubId: user.githubId,
            state: 'open',
            limit: 3,
            includeReviewers: true,
            includeLabels: true,
            includeChecks: true,
          });

          blocks.push(...this.createPRListBlocks('Needs your review', waitingOnMe, stats.waitingOnMe, user.githubId, true));
        }

        // Fetch my open PRs
        if (stats.myOpenPRs > 0) {
          blocks.push(
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: ' ',
              },
            },
            {
              type: 'divider',
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: ' ',
              },
            },
          );

          const myOpenPRs = await this.pullRequestService.listPullRequests({
            authorGithubId: user.githubId,
            state: 'open',
            isDraft: false,
            limit: 3,
            includeReviewers: true,
            includeLabels: true,
            includeChecks: true,
          });

          if (myOpenPRs.length > 0) {
            blocks.push(...this.createPRListBlocks('My open PRs', myOpenPRs, stats.myOpenPRs, user.githubId, false));
          }
        }
      } else {
        // Empty state
        blocks.push(
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ' ',
            },
          },
          {
            type: 'divider',
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ' ',
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '✨ _No pull requests at the moment. You\'re all caught up!_',
            },
          },
        );
      }

      // Add action buttons at the bottom
      blocks.push(
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ' ',
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ' ',
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📊 View Full Dashboard',
              },
              url: `${this.configService.get('app.frontendUrl')}/dashboard`,
              action_id: 'view_dashboard',
              style: 'primary',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '⚙️ Settings',
              },
              url: `${this.configService.get('app.frontendUrl')}/settings`,
              action_id: 'manage_settings',
            },
          ],
        },
      );
    } catch (error) {
      this.logger.error('[createAuthenticatedHomeView] Error fetching PR data:', error);
      // Fallback to basic view
      blocks.push(
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ' ',
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ' ',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '⚠️ Unable to load PR data at the moment. Please try again later.',
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📊 View Dashboard',
              },
              url: `${this.configService.get('app.frontendUrl')}/dashboard`,
              action_id: 'view_dashboard',
            },
          ],
        },
      );
    }

    return blocks;
  }

  /**
   * Create stats blocks for Slack home view
   */
  private createStatsBlocks(stats: any): any[] {
    return [
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `🔴 *Needs your review*\n${stats.waitingOnMe} PRs`,
          },
          {
            type: 'mrkdwn',
            text: `🟢 *Ready to merge*\n${stats.approvedReadyToMerge} PRs`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `🔵 *My open PRs*\n${stats.myOpenPRs} PRs`,
          },
          {
            type: 'mrkdwn',
            text: `⚫ *My drafts*\n${stats.myDraftPRs} PRs`,
          },
        ],
      },
    ];
  }

  /**
   * Create PR list blocks for Slack home view
   */
  private createPRListBlocks(title: string, prs: any[], totalCount?: number, currentUserGithubId?: string, showAuthor?: boolean): any[] {
    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${title}*`,
        },
      },
    ];

    prs.slice(0, 3).forEach((pr) => {
      blocks.push(this.createPRCardBlock(pr, currentUserGithubId, showAuthor));
    });

    // Add "View all" link if there are more PRs
    if (totalCount && totalCount > prs.length) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `<${this.configService.get('app.frontendUrl')}/dashboard|View all ${totalCount} PRs →>`,
          },
        ],
      });
    }

    return blocks;
  }

  /**
   * Create a single PR card block
   */
  private createPRCardBlock(pr: any, currentUserGithubId?: string, showAuthor?: boolean): any {
    const reviewers = pr.reviewers || [];
    const checks = pr.checks || [];

    // Helper function to calculate relative time
    const getRelativeTime = (dateString: string) => {
      const date = new Date(dateString);
      const now = new Date();
      const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (seconds < 60) return 'just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
      return `${Math.floor(seconds / 604800)}w ago`;
    };

    // Calculate check status
    const passing = checks.filter((c: any) => c.status === 'completed' && c.conclusion === 'success').length;
    const failing = checks.filter((c: any) => c.status === 'completed' && c.conclusion === 'failure').length;
    const pending = checks.filter((c: any) => c.status !== 'completed').length;

    // Build status line with icons
    const statusParts: string[] = [];

    // Add reviewer status with names/teams
    if (reviewers.length > 0) {
      const approvedReviewers = reviewers.filter((r: any) => r.reviewState === 'approved');
      const changesRequestedReviewers = reviewers.filter((r: any) => r.reviewState === 'changes_requested');
      const pendingReviewers = reviewers.filter((r: any) =>
        r.reviewState === 'pending' || (!r.reviewState || r.reviewState === 'commented')
      );

      if (approvedReviewers.length > 0) {
        const names = approvedReviewers
          .slice(0, 2)
          .map((r: any) => r.isTeamReview ? `@${r.teamSlug}` : r.login)
          .join(', ');
        const extra = approvedReviewers.length > 2 ? ` +${approvedReviewers.length - 2}` : '';
        statusParts.push(`✅ ${names}${extra}`);
      }
      if (changesRequestedReviewers.length > 0) {
        const names = changesRequestedReviewers
          .slice(0, 2)
          .map((r: any) => r.isTeamReview ? `@${r.teamSlug}` : r.login)
          .join(', ');
        const extra = changesRequestedReviewers.length > 2 ? ` +${changesRequestedReviewers.length - 2}` : '';
        statusParts.push(`❌ ${names}${extra}`);
      }
      if (pendingReviewers.length > 0) {
        const names = pendingReviewers
          .slice(0, 2)
          .map((r: any) => r.isTeamReview ? `@${r.teamSlug}` : r.login)
          .join(', ');
        const extra = pendingReviewers.length > 2 ? ` +${pendingReviewers.length - 2}` : '';
        statusParts.push(`⏳ ${names}${extra}`);
      }
    }

    // Add check status (compact)
    if (checks.length > 0) {
      if (failing > 0) {
        statusParts.push(`🔴 ${failing} failing`);
      } else if (pending > 0) {
        statusParts.push(`🟡 ${pending} pending`);
      } else if (passing > 0) {
        statusParts.push(`🟢 ${passing} passing`);
      }
    }

    // Add change stats (aligned with notification messages)
    statusParts.push(`${pr.additions > 0 ? `+${pr.additions}` : 'No'} additions • ${pr.deletions > 0 ? `-${pr.deletions}` : 'No'} deletions`);

    const statusLine = statusParts.length > 0 ? `\n${statusParts.join(' • ')}` : '';

    // Build labels (compact, max 2)
    const labels = pr.labels || [];
    const labelText = labels.length > 0
      ? `\n🏷 ${labels.slice(0, 2).map((l: any) => `\`${l.name}\``).join(' ')}${labels.length > 2 ? ` +${labels.length - 2}` : ''}`
      : '';

    // Capitalize first character of title, lowercase rest
    const formattedTitle = pr.title.charAt(0).toUpperCase() + pr.title.slice(1).toLowerCase();

    // Build dates line
    const openedTime = getRelativeTime(pr.openedAt);
    const updatedTime = getRelativeTime(pr.updatedAt);
    const datesLine = `\nOpened ${openedTime} • Updated ${updatedTime}`;

    // Build metadata line: repository • [author] • PR number
    // Only show author if showAuthor is true OR if it's not the current user's PR
    const shouldShowAuthor = showAuthor === true || (showAuthor !== false && pr.authorGithubId !== currentUserGithubId);
    const metadataLine = shouldShowAuthor
      ? `${pr.repositoryName} • ${pr.authorLogin} • #${pr.number}`
      : `${pr.repositoryName} • #${pr.number}`;

    const block: any = {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${pr.url}|*${formattedTitle}*>\n${metadataLine}${datesLine}${statusLine}${labelText}`,
      },
    };

    // Add profile image as accessory only if showing author
    if (shouldShowAuthor && pr.authorAvatarUrl) {
      block.accessory = {
        type: 'image',
        image_url: pr.authorAvatarUrl,
        alt_text: pr.authorLogin,
      };
    }

    return block;
  }

  /**
   * Create home view for unauthenticated users
   */
  private createUnauthenticatedHomeView(): any[] {
    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎯 Welcome to Radar!',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Track GitHub activity directly in Slack*\n\nRadar helps you stay on top of pull requests, issues, and discussions across your GitHub repositories with intelligent notifications.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*✨ Features:*\n• Real-time notifications for PRs and issues\n• Keyword-based filtering\n• Customizable digest summaries\n• Multi-repository support',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🚀 Get Started',
            },
            url: `${this.configService.get('app.frontendUrl')}/auth/slack/login`,
            action_id: 'get_started',
            style: 'primary',
          },
        ],
      },
    ];
  }
}
