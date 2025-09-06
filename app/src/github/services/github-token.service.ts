import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class GitHubTokenService {
  private readonly logger = new Logger(GitHubTokenService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

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
        this.logger.warn(
          `Failed to refresh GitHub token for user ${userId}: ${tokens.error_description || tokens.error}`,
        );
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
      this.logger.error(
        `Error refreshing GitHub token for user ${userId}:`,
        error,
      );
      return null;
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
    try {
      // Get current user with access token
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
        select: {
          githubAccessToken: true,
          githubRefreshToken: true,
        },
      });

      if (!user?.githubAccessToken) {
        this.logger.log(
          `No GitHub access token found for user ${userId}, redirecting to auth`,
        );
        const authUrl = this.generateAuthUrl(userId, reconnect);
        response.redirect(authUrl);
        return null;
      }

      // First, try to use the existing token
      try {
        // Test if current token is valid by creating an Octokit client and making a simple API call
        // This uses the same authentication method as the rest of the application
        const { Octokit } = await import('@octokit/rest');
        const testClient = new Octokit({
          auth: user.githubAccessToken,
        });
        
        await testClient.users.getAuthenticated();
        
        // Current token is valid
        return user.githubAccessToken;
      } catch (testError) {
        this.logger.debug(
          `Current token test failed for user ${userId}, attempting refresh`,
        );
      }

      // Current token failed, try to refresh
      const newAccessToken = await this.refreshAccessToken(userId);

      if (newAccessToken) {
        this.logger.log(`Successfully refreshed token for user ${userId}`);
        return newAccessToken;
      }

      // Refresh failed, redirect to GitHub for re-authentication
      this.logger.log(
        `Token refresh failed for user ${userId}, redirecting to GitHub auth`,
      );
      const authUrl = this.generateAuthUrl(userId, true);
      response.redirect(authUrl);
      return null;
    } catch (error) {
      this.logger.error(
        `Error ensuring valid token for user ${userId}:`,
        error,
      );
      const authUrl = this.generateAuthUrl(userId, reconnect);
      response.redirect(authUrl);
      return null;
    }
  }

  /**
   * Gets a valid GitHub access token for API calls without HTTP redirects.
   * This is useful for background jobs and services that don't have access to HTTP response objects.
   *
   * @param userId - The user ID
   * @returns The valid access token, or null if user needs to re-authenticate
   */
  async getValidTokenForApiCall(userId: string): Promise<string | null> {
    try {
      // Get current user with access token
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
        select: {
          githubAccessToken: true,
          githubRefreshToken: true,
        },
      });

      if (!user?.githubAccessToken) {
        this.logger.warn(`No GitHub access token found for user ${userId}`);
        return null;
      }

      // First, try to use the existing token
      try {
        // Test if current token is valid by creating an Octokit client and making a simple API call
        // This uses the same authentication method as the rest of the application
        const { Octokit } = await import('@octokit/rest');
        const testClient = new Octokit({
          auth: user.githubAccessToken,
        });
        
        await testClient.users.getAuthenticated();
        
        // Current token is valid
        return user.githubAccessToken;
      } catch (testError) {
        this.logger.debug(
          `Current token test failed for user ${userId}, attempting refresh`,
        );
      }

      // Current token failed, try to refresh
      const newAccessToken = await this.refreshAccessToken(userId);

      if (newAccessToken) {
        this.logger.log(`Successfully refreshed token for user ${userId}`);
        return newAccessToken;
      }

      // Refresh failed, user needs to re-authenticate
      this.logger.warn(
        `Token refresh failed for user ${userId}, user needs to re-authenticate`,
      );
      return null;
    } catch (error) {
      this.logger.error(`Error getting valid token for user ${userId}:`, error);
      return null;
    }
  }

  private generateAuthUrl(userId: string, reconnect?: boolean): string {
    const state = JSON.stringify({ userId, reconnect: !!reconnect });

    const params = new URLSearchParams({
      client_id: this.configService.get('github.clientId')!,
      redirect_uri: `${this.configService.get('app.callbackHost')}/api/integrations/github/callback`,
      state: Buffer.from(state).toString('base64'),
      scope: 'user:email read:user repo read:org',
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }
}
