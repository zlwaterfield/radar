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
import type { Request, Response } from 'express';
import { SlackService } from '../services/slack.service';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { GetUser } from '@/auth/decorators/user.decorator';
import type { User } from '@prisma/client';

@ApiTags('slack')
@Controller('slack')
export class SlackController {
  private readonly logger = new Logger(SlackController.name);

  constructor(private readonly slackService: SlackService) {}

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
      // For now, just acknowledge the command - can be expanded later
      this.logger.log('Received Slack command');
      res.status(200).json({
        response_type: 'ephemeral',
        text: 'Hello! Use the Home tab to manage your Radar settings.',
      });
    } catch (error) {
      this.logger.error('Error handling Slack command:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Slack interactive components (buttons, modals, etc.)
   */
  @Post('interactive')
  @ApiOperation({ summary: 'Handle Slack interactive components' })
  @ApiResponse({
    status: 200,
    description: 'Interaction processed successfully',
  })
  async handleInteractive(@Req() req: Request, @Res() res: Response) {
    try {
      // For now, just acknowledge the interaction
      this.logger.log('Received Slack interactive component');
      res.status(200).json({ ok: true });
    } catch (error) {
      this.logger.error('Error handling Slack interaction:', error);
      res.status(500).json({ error: 'Internal server error' });
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
}
