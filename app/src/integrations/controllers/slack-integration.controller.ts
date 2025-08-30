import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { SlackIntegrationService } from '../services/slack-integration.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { CurrentUser } from '../../auth/decorators/user.decorator';
import { DatabaseService } from '../../database/database.service';

@ApiTags('Slack Integration')
@Controller('integrations/slack')
export class SlackIntegrationController {
  private readonly logger = new Logger(SlackIntegrationController.name);

  constructor(
    private readonly slackIntegrationService: SlackIntegrationService,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get('connect')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Initiate Slack integration' })
  @ApiResponse({ status: 302, description: 'Redirect to Slack OAuth' })
  async connectSlack(@CurrentUser() user: any, @Res() res: Response) {
    try {
      const authUrl = this.slackIntegrationService.generateAuthUrl(user.id);
      return res.redirect(authUrl);
    } catch (error) {
      this.logger.error('Slack connect error:', error);
      throw new InternalServerErrorException(
        'Failed to initiate Slack connection',
      );
    }
  }

  @Get('callback')
  @ApiOperation({ summary: 'Handle Slack OAuth callback' })
  async slackCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
    @Res() res?: Response,
  ) {
    if (error) {
      this.logger.error(`Slack OAuth error: ${error}`);
      return res?.redirect(
        `${this.configService.get('app.frontendUrl')}/onboarding?error=slack_${error}`,
      );
    }

    if (!code || !state) {
      throw new BadRequestException(
        'Authorization code and state are required',
      );
    }

    try {
      // Exchange code for tokens
      const tokens =
        await this.slackIntegrationService.exchangeCodeForTokens(code);

      // Connect Slack to the user (state contains userId)
      await this.slackIntegrationService.connectSlackForUser(state, tokens);

      // Redirect back to onboarding flow
      const frontendUrl = `${this.configService.get('app.frontendUrl')}/onboarding?slack=connected`;
      return res?.redirect(frontendUrl);
    } catch (error) {
      this.logger.error('Slack callback error:', error);
      return res?.redirect(
        `${this.configService.get('app.frontendUrl')}/onboarding?error=slack_connection_failed`,
      );
    }
  }

  @Post('disconnect')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Disconnect Slack integration' })
  @ApiResponse({ status: 200, description: 'Slack disconnected successfully' })
  async disconnectSlack(@CurrentUser() user: any) {
    try {
      await this.slackIntegrationService.disconnectSlackForUser(user.id);
      return { message: 'Slack disconnected successfully' };
    } catch (error) {
      this.logger.error('Slack disconnect error:', error);
      throw new InternalServerErrorException('Failed to disconnect Slack');
    }
  }

  @Get('status')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get Slack integration status' })
  @ApiResponse({ status: 200, description: 'Slack integration status' })
  async getSlackStatus(@CurrentUser() user: any) {
    try {
      // Fetch fresh user data from database to get latest Slack connection status
      const freshUser = await this.databaseService.user.findUnique({
        where: { id: user.id },
        select: {
          slackId: true,
          slackTeamId: true,
        },
      });

      if (!freshUser) {
        throw new InternalServerErrorException('User not found');
      }

      return {
        connected: !!freshUser.slackId,
        slackId: freshUser.slackId,
        teamName: freshUser.slackTeamId, // Note: This should be teamName but we're using slackTeamId from DB
      };
    } catch (error) {
      this.logger.error('Error getting Slack status:', error);
      throw new InternalServerErrorException('Failed to get Slack status');
    }
  }
}
