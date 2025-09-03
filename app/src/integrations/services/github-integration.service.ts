import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { UserTeamsSyncService } from '../../users/services/user-teams-sync.service';

@Injectable()
export class GitHubIntegrationService {
  private readonly logger = new Logger(GitHubIntegrationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly userTeamsSyncService: UserTeamsSyncService,
  ) {}

  async exchangeCodeForTokens(code: string): Promise<any> {
    try {
      const tokenResponse = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: this.configService.get('github.clientId')!,
            client_secret: this.configService.get('github.clientSecret')!,
            code,
          }),
        },
      );

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        throw new Error(tokens.error_description || tokens.error);
      }

      return tokens;
    } catch (error) {
      this.logger.error('Error exchanging code for tokens:', error);
      throw error;
    }
  }

  async getGitHubUser(accessToken: string): Promise<any> {
    try {
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch GitHub user');
      }

      return await userResponse.json();
    } catch (error) {
      this.logger.error('Error fetching GitHub user:', error);
      throw error;
    }
  }

  async connectGitHubForUser(
    userId: string,
    githubTokens: any,
    githubUser: any,
  ): Promise<void> {
    try {
      // Update user with GitHub connection info
      await this.databaseService.user.update({
        where: { id: userId },
        data: {
          githubId: githubUser.id.toString(),
          githubLogin: githubUser.login,
          githubAccessToken: githubTokens.access_token,
          githubRefreshToken: githubTokens.refresh_token,
        },
      });

      // Auto-sync repos and teams after connecting GitHub
      try {
        await this.userTeamsSyncService.syncUserGitHubData(userId);
        this.logger.log(
          `Auto-synced GitHub data for user ${userId} after connection`,
        );
      } catch (syncError) {
        this.logger.error(
          `Error auto-syncing data for user ${userId}:`,
          syncError,
        );
        // Don't fail the connection if sync fails
      }

      this.logger.log(`GitHub connected for user ${userId}`);
    } catch (error) {
      this.logger.error('Error connecting GitHub for user:', error);
      throw error;
    }
  }

  async disconnectGitHubForUser(userId: string): Promise<void> {
    try {
      await this.databaseService.user.update({
        where: { id: userId },
        data: {
          githubId: null,
          githubLogin: null,
          githubAccessToken: null,
          githubRefreshToken: null,
        },
      });

      this.logger.log(`GitHub disconnected for user ${userId}`);
    } catch (error) {
      this.logger.error('Error disconnecting GitHub for user:', error);
      throw error;
    }
  }

  generateAuthUrl(userId: string, reconnect?: boolean): string {
    const state = JSON.stringify({ userId, reconnect: !!reconnect });

    const params = new URLSearchParams({
      client_id: this.configService.get('github.clientId')!,
      redirect_uri: `${this.configService.get('app.callbackHost')}/api/integrations/github/callback`,
      state: Buffer.from(state).toString('base64'),
      scope: 'user:email read:user repo read:org',
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  generateInstallUrl(userId: string): string {
    const state = JSON.stringify({ userId, install: true });

    const params = new URLSearchParams({
      state: Buffer.from(state).toString('base64'),
    });

    const appName = this.configService.get('github.appName');
    return `https://github.com/apps/${appName}/installations/new?${params.toString()}`;
  }

  async handleAppInstallation(
    userId: string,
    installationId: string,
  ): Promise<void> {
    try {
      // Store the installation ID on the user record
      await this.databaseService.user.update({
        where: { id: userId },
        data: {
          githubInstallationId: installationId,
        },
      });

      // Auto-sync repos and teams after app installation
      try {
        await this.userTeamsSyncService.syncUserGitHubData(userId);
        this.logger.log(
          `Auto-synced GitHub data for user ${userId} after app installation`,
        );
      } catch (syncError) {
        this.logger.error(
          `Error auto-syncing data for user ${userId}:`,
          syncError,
        );
        // Don't fail the installation if sync fails
      }

      this.logger.log(
        `GitHub App installation ${installationId} processed for user ${userId}`,
      );
    } catch (error) {
      this.logger.error('Error handling GitHub App installation:', error);
      throw error;
    }
  }

  async refreshAccessToken(userId: string): Promise<string | null> {
    try {
      // Get current user with refresh token
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
        select: { githubRefreshToken: true },
      });

      if (!user?.githubRefreshToken) {
        this.logger.warn(`No GitHub refresh token found for user ${userId}`);
        return null;
      }

      // Attempt to refresh the token using GitHub's refresh token endpoint
      const refreshResponse = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: this.configService.get('github.clientId')!,
            client_secret: this.configService.get('github.clientSecret')!,
            grant_type: 'refresh_token',
            refresh_token: user.githubRefreshToken,
          }),
        },
      );

      const tokens = await refreshResponse.json();

      if (tokens.error) {
        this.logger.warn(`Failed to refresh GitHub token for user ${userId}: ${tokens.error_description || tokens.error}`);
        return null;
      }

      // Update user with new tokens
      await this.databaseService.user.update({
        where: { id: userId },
        data: {
          githubAccessToken: tokens.access_token,
          githubRefreshToken: tokens.refresh_token || user.githubRefreshToken, // Keep old refresh token if new one not provided
        },
      });

      this.logger.log(`Successfully refreshed GitHub token for user ${userId}`);
      return tokens.access_token;
    } catch (error) {
      this.logger.error(`Error refreshing GitHub token for user ${userId}:`, error);
      return null;
    }
  }
}
