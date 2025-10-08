import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebClient } from '@slack/web-api';
import { DatabaseService } from '../../database/database.service';
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
    accessToken?: string,
  ): Promise<SlackMessageResponse | null> {
    try {
      const client = accessToken
        ? this.createUserClient(accessToken)
        : this.botClient;

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
    accessToken?: string,
  ): Promise<SlackMessageResponse | null> {
    try {
      const client = accessToken
        ? this.createUserClient(accessToken)
        : this.botClient;

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
    accessToken?: string,
  ): Promise<boolean> {
    try {
      const client = accessToken
        ? this.createUserClient(accessToken)
        : this.botClient;

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
    accessToken?: string,
  ): Promise<SlackUser | null> {
    try {
      const client = accessToken
        ? this.createUserClient(accessToken)
        : this.botClient;

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
  async getTeamInfo(accessToken?: string): Promise<SlackTeam | null> {
    try {
      const client = accessToken
        ? this.createUserClient(accessToken)
        : this.botClient;

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
    accessToken?: string,
  ): Promise<string | null> {
    try {
      const client = accessToken
        ? this.createUserClient(accessToken)
        : this.botClient;

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
  async testConnection(accessToken?: string): Promise<boolean> {
    try {
      const client = accessToken
        ? this.createUserClient(accessToken)
        : this.botClient;

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
  async publishHomeView(userId: string, blocks: any[]): Promise<boolean> {
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

      this.logger.log(`[publishHomeView] Publishing home view for user: ${userId}`);
      this.logger.log(`[publishHomeView] Blocks count: ${blocks?.length}`);

      const response = await this.botClient.views.publish({
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
  async handleAppHomeOpened(userId: string): Promise<void> {
    try {
      this.logger.log(`[handleAppHomeOpened] Called with userId: ${JSON.stringify(userId)}, type: ${typeof userId}`);

      // Check if user exists in our database
      const user = await this.databaseService.user.findUnique({
        where: { slackId: userId },
      });

      this.logger.log(`[handleAppHomeOpened] User found in DB: ${!!user}, user slackId: ${user?.slackId}`);

      const blocks = user
        ? this.createAuthenticatedHomeView(user)
        : this.createUnauthenticatedHomeView();

      this.logger.log(`[handleAppHomeOpened] Created ${user ? 'authenticated' : 'unauthenticated'} view with ${blocks?.length} blocks`);

      await this.publishHomeView(userId, blocks);
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
  private createAuthenticatedHomeView(user: any): any[] {
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
          text: `*Hello, ${user.name || 'there'}!* Your Radar account is connected and active.`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '⚙️ Manage Settings',
            },
            url: `${this.configService.get('app.frontendUrl')}/settings`,
            action_id: 'manage_settings',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔗 Manage Repositories',
            },
            url: `${this.configService.get('app.frontendUrl')}/settings/repositories`,
            action_id: 'connect_repos',
          },
        ],
      },
    ];
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
