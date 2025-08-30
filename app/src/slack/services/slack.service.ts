import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebClient } from '@slack/web-api';
import { App as SlackApp } from '@slack/bolt';
import { DatabaseService } from '@/database/database.service';
import type {
  SlackMessage,
  SlackUser,
  SlackTeam,
  SlackOAuthResponse,
  SlackMessageResponse,
  SlackApiResponse,
} from '@/common/types/slack.types';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly botClient: WebClient;
  private readonly slackApp: SlackApp;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    const botToken = this.configService.get('slack.botToken');
    this.botClient = new WebClient(botToken);

    this.slackApp = new SlackApp({
      token: botToken,
      signingSecret: this.configService.get('slack.signingSecret'),
      socketMode: false,
    });

    this.setupSlackEventHandlers();
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
      const response = await this.botClient.views.publish({
        user_id: userId,
        view: {
          type: 'home',
          blocks,
        },
      });

      if (response.ok) {
        this.logger.log(`Home view published for user ${userId}`);
        return true;
      } else {
        this.logger.error(`Failed to publish home view: ${response.error}`);
        return false;
      }
    } catch (error) {
      this.logger.error('Error publishing home view:', error);
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
   * Get Slack app instance for event handling
   */
  getSlackApp(): SlackApp {
    return this.slackApp;
  }


  /**
   * Setup Slack event handlers
   */
  private setupSlackEventHandlers(): void {
    // Handle app home opened
    this.slackApp.event('app_home_opened', async ({ event, logger }: any) => {
      try {
        await this.handleAppHomeOpened(event.user);
      } catch (error) {
        logger.error('Error handling app_home_opened:', error);
      }
    });

    // Handle app mentions
    this.slackApp.event('app_mention', async ({ event, say }: any) => {
      try {
        await say({
          text: `Hello <@${event.user}>! I'm Radar. I help you track GitHub activity. Use the Home tab to get started.`,
          thread_ts: event.ts,
        });
      } catch (error) {
        this.logger.error('Error handling app mention:', error);
      }
    });

    // Handle direct messages
    this.slackApp.event('message', async ({ message, say }: any) => {
      try {
        if (message.subtype) return; // Ignore bot messages and other subtypes

        // Only respond to DMs
        if (message.channel_type === 'im') {
          await say({
            text: "Hello! I'm Radar. I help you track GitHub activity. Use my Home tab to manage your settings and connect repositories.",
          });
        }
      } catch (error) {
        this.logger.error('Error handling direct message:', error);
      }
    });

    // Handle slash commands
    this.slackApp.command('/radar', async ({ command, ack, respond }: any) => {
      await ack();

      try {
        await respond({
          text: `Hello <@${command.user_id}>! Radar helps you track GitHub activity.\n\nAvailable commands:\n• Use the Home tab to manage settings\n• Connect your GitHub repositories\n• Set up notification preferences`,
          response_type: 'ephemeral',
        });
      } catch (error) {
        this.logger.error('Error handling /radar command:', error);
      }
    });
  }

  /**
   * Handle app home opened event
   */
  async handleAppHomeOpened(userId: string): Promise<void> {
    try {
      // Check if user exists in our database
      const user = await this.databaseService.user.findUnique({
        where: { slackId: userId },
        include: { settings: true },
      });

      const blocks = user
        ? this.createAuthenticatedHomeView(user)
        : this.createUnauthenticatedHomeView();

      await this.publishHomeView(userId, blocks);
    } catch (error) {
      this.logger.error(
        `Error handling app home opened for user ${userId}:`,
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
