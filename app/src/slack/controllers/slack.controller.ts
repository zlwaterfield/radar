import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { SlackService } from '../services/slack.service';
import { UsersService } from '@/users/services/users.service';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { GetUser } from '@/auth/decorators/user.decorator';
import type { User, UserRepository, UserSettings } from '@prisma/client';

type UserWithRelations = User & {
  repositories?: UserRepository[];
  settings?: UserSettings;
};

@ApiTags('slack')
@Controller('slack')
export class SlackController {
  private readonly logger = new Logger(SlackController.name);

  constructor(
    private readonly slackService: SlackService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Handle Slack OAuth callback
   */
  @Get('oauth/callback')
  @ApiOperation({ summary: 'Handle Slack OAuth callback' })
  @ApiResponse({
    status: 200,
    description: 'OAuth callback processed successfully',
  })
  async handleOAuthCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const { code, state } = req.query;

      if (!code) {
        this.logger.error('No code provided in OAuth callback');
        return res.redirect(
          `${process.env.FRONTEND_URL}/auth/error?error=no_code`,
        );
      }

      // Exchange code for tokens
      const oauthResponse = await this.slackService.handleOAuthCallback(
        code as string,
      );

      if (!oauthResponse) {
        this.logger.error('Failed to exchange code for tokens');
        return res.redirect(
          `${process.env.FRONTEND_URL}/auth/error?error=oauth_failed`,
        );
      }

      // Redirect to success page with tokens (to be handled by frontend)
      const redirectUrl = new URL(
        `${process.env.FRONTEND_URL}/auth/slack/success`,
      );
      redirectUrl.searchParams.set('access_token', oauthResponse.access_token);
      if (oauthResponse.team?.id) {
        redirectUrl.searchParams.set('team_id', oauthResponse.team.id);
      }
      if (oauthResponse.authed_user?.id) {
        redirectUrl.searchParams.set('user_id', oauthResponse.authed_user.id);
      }

      return res.redirect(redirectUrl.toString());
    } catch (error) {
      this.logger.error('Error in OAuth callback:', error);
      return res.redirect(
        `${process.env.FRONTEND_URL}/auth/error?error=server_error`,
      );
    }
  }

  /**
   * Handle Slack events and interactions
   */
  @Post('events')
  @ApiOperation({ summary: 'Handle Slack events' })
  @ApiResponse({ status: 200, description: 'Event processed successfully' })
  async handleEvents(@Req() req: Request, @Res() res: Response) {
    try {
      // For now, just acknowledge the event - the SlackService handles events internally
      this.logger.log('Received Slack event');
      res.status(200).json({ challenge: req.body?.challenge || 'ok' });
    } catch (error) {
      this.logger.error('Error handling Slack event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Slack slash commands
   */
  @Post('commands')
  @ApiOperation({ summary: 'Handle Slack slash commands' })
  @ApiResponse({ status: 200, description: 'Command processed successfully' })
  async handleCommands(@Req() req: Request, @Res() res: Response) {
    try {
      const {
        command,
        text = '',
        user_id,
        channel_id,
        response_url,
        trigger_id,
      } = req.body;

      this.logger.log(
        `Received Slack command: ${command} from user ${user_id}`,
      );

      console.log('command', command);
      console.log('text', text);
      console.log('user_id', user_id);
      console.log('channel_id', channel_id);
      console.log('response_url', response_url);
      console.log('trigger_id', trigger_id);

      if (command === '/radar') {
        const response = await this.processRadarCommand(
          text,
          user_id,
          channel_id,
          response_url,
          trigger_id,
        );
        return res.status(200).json(response);
      } else {
        this.logger.warn(`Unknown command: ${command}`);
        return res.status(200).json({
          response_type: 'ephemeral',
          text: `Unknown command: ${command}`,
        });
      }
    } catch (error) {
      this.logger.error('Error handling Slack command:', error);
      res.status(500).json({
        response_type: 'ephemeral',
        text: 'An error occurred while processing your command.',
      });
    }
  }

  /**
   * Test Slack connection for authenticated user
   */
  @Get('test')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Test Slack connection' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  async testConnection(@GetUser() user: User) {
    try {
      // Get user's Slack access token (would need to be decrypted)
      const isConnected = await this.slackService.testConnection();

      return {
        connected: isConnected,
        slackId: user.slackId,
        teamId: user.slackTeamId,
      };
    } catch (error) {
      this.logger.error('Error testing Slack connection:', error);
      return {
        connected: false,
        error: 'Failed to test connection',
      };
    }
  }

  /**
   * Send test message to user's DM
   */
  @Post('test-message')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Send test message to user' })
  @ApiResponse({ status: 200, description: 'Test message sent' })
  async sendTestMessage(@GetUser() user: User) {
    try {
      // Open DM channel with user
      if (!user.slackId) {
        return {
          success: false,
          error: 'User missing Slack ID',
        };
      }
      const channelId = await this.slackService.openDMChannel(user.slackId);

      if (!channelId) {
        return {
          success: false,
          error: 'Failed to open DM channel',
        };
      }

      // Send test message
      const result = await this.slackService.sendMessage({
        channel: channelId,
        text: '🎯 Test message from Radar! Your notifications are working correctly.',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: "*🎯 Test message from Radar!*\n\nYour notifications are working correctly. You'll receive GitHub activity updates here.",
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Next steps:*\n• Configure your notification preferences\n• Connect your GitHub repositories\n• Set up digest schedules',
            },
          },
        ],
      });

      return {
        success: !!result,
        channelId,
        messageTs: result?.ts,
      };
    } catch (error) {
      this.logger.error('Error sending test message:', error);
      return {
        success: false,
        error: 'Failed to send test message',
      };
    }
  }

  /**
   * Get user's Slack profile information
   */
  @Get('profile')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get user Slack profile' })
  @ApiResponse({ status: 200, description: 'User Slack profile' })
  async getUserProfile(@GetUser() user: User) {
    try {
      if (!user.slackId) {
        return {
          success: false,
          error: 'User missing Slack ID',
        };
      }
      const profile = await this.slackService.getUserInfo(user.slackId);
      const teamInfo = await this.slackService.getTeamInfo();

      return {
        user: profile,
        team: teamInfo,
        connected: !!profile,
      };
    } catch (error) {
      this.logger.error('Error getting Slack profile:', error);
      return {
        user: null,
        team: null,
        connected: false,
        error: 'Failed to get profile information',
      };
    }
  }

  /**
   * Process /radar command
   */
  private async processRadarCommand(
    text: string,
    userId: string,
    channelId: string,
    responseUrl: string,
    triggerId: string,
  ) {
    // Get user from database
    const user = await this.usersService.getUserBySlackId(userId) as UserWithRelations | null;

    if (!user) {
      return {
        response_type: 'ephemeral',
        text: 'You need to connect your GitHub account first. Please visit our app homepage to set up your account.',
      };
    }

    // Parse command
    const args = text
      .trim()
      .split(/\s+/)
      .filter((arg) => arg);
    const command = args[0] || 'help';

    switch (command) {
      case 'help':
        return {
          response_type: 'ephemeral',
          text:
            'Radar Commands:\n' +
            '• `/radar help` - Show this help message\n' +
            '• `/radar status` - Check your connection status\n' +
            '• `/radar settings` - Open settings page\n' +
            '• `/radar repos` - List your connected repositories\n' +
            '• `/radar connect` - Connect to GitHub\n'
        };

      case 'status':
        const githubConnected = !!user.githubAccessToken;
        let statusText = 'Your current status:\n';
        statusText += `• Slack: Connected as <@${userId}>\n`;
        statusText += `• GitHub: ${githubConnected ? 'Connected' : 'Not connected'}\n`;

        if (githubConnected && user.repositories) {
          statusText += `• Watching ${user.repositories.length} repositories\n`;
        }

        return {
          response_type: 'ephemeral',
          text: statusText,
        };

      case 'settings':
        const frontendUrl = this.configService.get<string>('app.frontendUrl');
        return {
          response_type: 'ephemeral',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Radar Settings*\nManage your notification preferences and account settings in the Radar web app.',
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Open Settings',
                    emoji: true,
                  },
                  style: 'primary',
                  url: `${frontendUrl}/settings/notifications`,
                },
              ],
            },
          ],
        };

      case 'repos':
        if (!user.githubAccessToken) {
          return {
            response_type: 'ephemeral',
            text: 'You need to connect your GitHub account first. Use `/radar connect` to connect.',
          };
        }

        if (!user.repositories || user.repositories.length === 0) {
          return {
            response_type: 'ephemeral',
            text: "You don't have any repositories connected. Use the settings page to add repositories.",
          };
        }

        let reposText = 'Your connected repositories:\n';
        for (const repo of user.repositories) {
          reposText += `• ${repo.name} (${repo.fullName})\n`;
        }

        return {
          response_type: 'ephemeral',
          text: reposText,
        };

      case 'connect':
        if (user.githubAccessToken) {
          return {
            response_type: 'ephemeral',
            text: 'You are already connected to GitHub. Use `/radar status` to check your status.',
          };
        }

        const callbackHost = this.configService.get<string>('app.callbackHost');
        const githubUrl = `${callbackHost}/api/auth/github/login?user_id=${user.id}`;

        return {
          response_type: 'ephemeral',
          text: 'Click the button below to connect your GitHub account.',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Connect your GitHub account to receive notifications.',
              },
              accessory: {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Connect GitHub',
                },
                url: githubUrl,
                action_id: 'connect_github',
              },
            },
          ],
        };
    }
  }
}
