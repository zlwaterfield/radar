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
import { GitHubIntegrationService } from '../services/github-integration.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { CurrentUser } from '../../auth/decorators/user.decorator';
import { DatabaseService } from '../../database/database.service';

@ApiTags('GitHub Integration')
@Controller('integrations/github')
export class GitHubIntegrationController {
  private readonly logger = new Logger(GitHubIntegrationController.name);

  constructor(
    private readonly githubIntegrationService: GitHubIntegrationService,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get('connect')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Initiate GitHub integration' })
  @ApiResponse({
    status: 302,
    description: 'Redirect to GitHub OAuth or success page',
  })
  async connectGitHub(
    @CurrentUser() user: any,
    @Query('reconnect') reconnect: boolean,
    @Res() res: Response,
  ) {
    try {
      // If this is a reconnect attempt, try to refresh the token first
      if (reconnect) {
        const validToken = await this.githubIntegrationService.ensureValidToken(
          user.id,
          res,
          reconnect,
        );

        if (validToken) {
          // Token refresh succeeded, redirect to success page instead of GitHub
          const frontendUrl = `${this.configService.get('app.frontendUrl')}/settings/github?refreshed=true`;
          return res.redirect(frontendUrl);
        }
        // If validToken is null, the ensureValidToken method has already redirected to GitHub
        return;
      }

      // For initial connections, go straight to GitHub
      const authUrl = this.githubIntegrationService.generateAuthUrl(
        user.id,
        reconnect,
      );
      return res.redirect(authUrl);
    } catch (error) {
      this.logger.error('GitHub connect error:', error);
      throw new InternalServerErrorException(
        'Failed to initiate GitHub connection',
      );
    }
  }

  @Get('install')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Install GitHub App' })
  @ApiResponse({
    status: 302,
    description: 'Redirect to GitHub App installation',
  })
  async installGitHubApp(@CurrentUser() user: any, @Res() res: Response) {
    try {
      const installUrl = this.githubIntegrationService.generateInstallUrl(
        user.id,
      );
      return res.redirect(installUrl);
    } catch (error) {
      this.logger.error('GitHub app install error:', error);
      throw new InternalServerErrorException(
        'Failed to initiate GitHub App installation',
      );
    }
  }

  @Get('callback')
  @ApiOperation({ summary: 'Handle GitHub OAuth callback' })
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
    @Res() res?: Response,
  ) {
    if (error) {
      this.logger.error(`GitHub OAuth error: ${error}`);
      return res?.redirect(
        `${this.configService.get('app.frontendUrl')}/onboarding?error=github_${error}`,
      );
    }

    if (!code || !state) {
      throw new BadRequestException(
        'Authorization code and state are required',
      );
    }

    try {
      // Decode state
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const { userId, reconnect, install } = stateData;

      if (!userId) {
        throw new BadRequestException('Invalid state parameter');
      }

      // Exchange code for tokens
      const tokens =
        await this.githubIntegrationService.exchangeCodeForTokens(code);

      // Get user info from GitHub
      const githubUser = await this.githubIntegrationService.getGitHubUser(
        tokens.access_token,
      );

      // Connect GitHub to the user
      await this.githubIntegrationService.connectGitHubForUser(
        userId,
        tokens,
        githubUser,
      );

      // Redirect back to onboarding flow
      let redirectPath = '/onboarding?github=connected';
      if (reconnect) {
        redirectPath = '/settings/github?updated=true';
      } else if (install) {
        redirectPath = '/onboarding?github=app_installed';
      }

      const frontendUrl = `${this.configService.get('app.frontendUrl')}${redirectPath}`;
      return res?.redirect(frontendUrl);
    } catch (error) {
      this.logger.error('GitHub callback error:', error);
      return res?.redirect(
        `${this.configService.get('app.frontendUrl')}/onboarding?error=github_connection_failed`,
      );
    }
  }

  @Get('app-callback')
  @ApiOperation({ summary: 'Handle GitHub App installation callback' })
  async githubAppCallback(
    @Query('installation_id') installationId: string,
    @Query('setup_action') setupAction: string,
    @Query('state') state: string,
    @Res() res?: Response,
  ) {
    try {
      // Decode state to get user ID
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const { userId } = stateData;

      if (!userId) {
        throw new BadRequestException('Invalid state parameter');
      }

      if (setupAction === 'install') {
        this.logger.log(
          `GitHub App installed for user ${userId}, installation ID: ${installationId}`,
        );

        // Store the installation ID and fetch repositories
        await this.githubIntegrationService.handleAppInstallation(
          userId,
          installationId,
        );

        const frontendUrl = `${this.configService.get('app.frontendUrl')}/onboarding?github=app_installed`;
        return res?.redirect(frontendUrl);
      } else {
        // Handle other setup actions if needed
        const frontendUrl = `${this.configService.get('app.frontendUrl')}/onboarding?error=github_app_setup_cancelled`;
        return res?.redirect(frontendUrl);
      }
    } catch (error) {
      this.logger.error('GitHub app callback error:', error);
      return res?.redirect(
        `${this.configService.get('app.frontendUrl')}/onboarding?error=github_app_installation_failed`,
      );
    }
  }

  @Post('disconnect')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Disconnect GitHub integration' })
  @ApiResponse({ status: 200, description: 'GitHub disconnected successfully' })
  async disconnectGitHub(@CurrentUser() user: any) {
    try {
      await this.githubIntegrationService.disconnectGitHubForUser(user.id);
      return { message: 'GitHub disconnected successfully' };
    } catch (error) {
      this.logger.error('GitHub disconnect error:', error);
      throw new InternalServerErrorException('Failed to disconnect GitHub');
    }
  }

  @Get('status')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get GitHub integration status' })
  @ApiResponse({ status: 200, description: 'GitHub integration status' })
  async getGitHubStatus(@CurrentUser() user: any) {
    try {
      // Fetch fresh user data from database to get latest GitHub connection status
      const freshUser = await this.databaseService.user.findUnique({
        where: { id: user.id },
        select: {
          githubId: true,
          githubLogin: true,
          githubInstallationId: true,
        },
      });

      if (!freshUser) {
        throw new InternalServerErrorException('User not found');
      }

      return {
        connected: !!freshUser.githubId,
        githubId: freshUser.githubId,
        githubLogin: freshUser.githubLogin,
        appInstalled: !!freshUser.githubInstallationId,
        githubInstallationId: freshUser.githubInstallationId,
      };
    } catch (error) {
      this.logger.error('Error getting GitHub status:', error);
      throw new InternalServerErrorException('Failed to get GitHub status');
    }
  }

  @Get('installations')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get GitHub App installations' })
  @ApiResponse({ status: 200, description: 'GitHub App installations' })
  async getInstallations(@CurrentUser() user: any) {
    try {
      // This would integrate with the existing GitHub service
      // For now, return a placeholder
      return {
        installations: [],
        message: 'GitHub App installations will be listed here',
      };
    } catch (error) {
      this.logger.error('Error getting GitHub installations:', error);
      throw new InternalServerErrorException(
        'Failed to get GitHub installations',
      );
    }
  }
}
