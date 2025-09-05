import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { GitHubTokenService } from '../../github/services/github-token.service';
import { UserTeamsSyncService } from '../../users/services/user-teams-sync.service';

@Injectable()
export class GitHubIntegrationService {
  private readonly logger = new Logger(GitHubIntegrationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly githubTokenService: GitHubTokenService,
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

  /**
   * Ensures the user has a valid GitHub access token.
   * First attempts to refresh the token in the background, then falls back to user authentication.
   *
   * @param userId - The user ID
   * @param response - Express response object for redirects
   * @param reconnect - Whether this is a reconnect attempt
   * @returns The valid access token, or null if redirect was performed
   */
  async ensureValidToken(
    userId: string,
    response: any,
    reconnect = false,
  ): Promise<string | null> {
    return this.githubTokenService.ensureValidToken(
      userId,
      response,
      reconnect,
    );
  }

  /**
   * Gets a valid GitHub access token for API calls without HTTP redirects.
   * This is useful for background jobs and services that don't have access to HTTP response objects.
   *
   * @param userId - The user ID
   * @returns The valid access token, or null if user needs to re-authenticate
   */
  async getValidTokenForApiCall(userId: string): Promise<string | null> {
    return this.githubTokenService.getValidTokenForApiCall(userId);
  }

  async refreshAccessToken(userId: string): Promise<string | null> {
    return this.githubTokenService.refreshAccessToken(userId);
  }
}
