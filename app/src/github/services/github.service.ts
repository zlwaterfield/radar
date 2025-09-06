import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import { DatabaseService } from '../../database/database.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { GitHubTokenService } from './github-token.service';
import type {
  GitHubRepository,
  GitHubPullRequest,
  GitHubIssue,
  GitHubUser,
  GitHubInstallation,
  GitHubTeam,
} from '@/common/types/github.types';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly analyticsService: AnalyticsService,
    private readonly githubTokenService: GitHubTokenService,
  ) {}

  /**
   * Create GitHub client with user access token
   */
  createUserClient(accessToken: string): Octokit {
    return new Octokit({
      auth: accessToken,
      userAgent: `${this.configService.get('app.name')}/2.0.0`,
    });
  }

  /**
   * Create GitHub App client with JWT authentication
   */
  createAppClient(): Octokit {
    const appId = this.configService.get('github.appId');
    const privateKey = this.getPrivateKey();

    if (!appId || !privateKey) {
      throw new Error('GitHub App credentials not configured');
    }

    const jwt = this.generateAppJWT(appId, privateKey);
    return new Octokit({
      auth: jwt,
      userAgent: `${this.configService.get('app.name')}/2.0.0`,
    });
  }

  /**
   * Create GitHub client for a specific installation
   */
  async createInstallationClient(installationId: number): Promise<Octokit> {
    const appClient = this.createAppClient();

    try {
      const { data: installation } =
        await appClient.apps.createInstallationAccessToken({
          installation_id: installationId,
        });

      return new Octokit({
        auth: installation.token,
        userAgent: `${this.configService.get('app.name')}/2.0.0`,
      });
    } catch (error) {
      this.logger.error(`Failed to create installation client: ${error}`);
      await this.analyticsService.trackError(
        `installation_${installationId}`,
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'github_installation_auth',
          installationId: installationId.toString(),
          category: 'github_critical',
        },
      );
      throw error;
    }
  }

  /**
   * Wrapper method to execute GitHub API calls with automatic token refresh on 401 errors
   * @param userId - The user ID for token refresh
   * @param apiCall - Function that takes a valid access token and returns a Promise
   * @returns Promise with the API call result
   */
  async withTokenRefresh<T>(
    userId: string,
    apiCall: (accessToken: string) => Promise<T>,
  ): Promise<T> {
    // Get current user token
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { githubAccessToken: true },
    });

    if (!user?.githubAccessToken) {
      throw new BadRequestException('User not connected to GitHub');
    }

    try {
      // Try with current token first
      return await apiCall(user.githubAccessToken);
    } catch (error: any) {
      // Check if it's a 401 Unauthorized error
      if (error?.status === 401 || error?.response?.status === 401) {
        this.logger.log(
          `Got 401 error for user ${userId}, attempting token refresh`,
        );

        // Try to refresh the token
        const newToken =
          await this.githubTokenService.getValidTokenForApiCall(userId);

        if (newToken) {
          this.logger.log(
            `Token refreshed for user ${userId}, retrying API call`,
          );
          // Retry with the new token
          return await apiCall(newToken);
        } else {
          this.logger.warn(
            `Failed to refresh token for user ${userId}, API call cannot continue`,
          );
          throw new BadRequestException(
            'GitHub token expired and refresh failed - user needs to re-authenticate',
          );
        }
      }

      // Re-throw non-401 errors
      throw error;
    }
  }

  /**
   * Get user repositories from GitHub API using access token
   */
  async getUserRepositories(
    accessToken: string,
    includePrivate?: boolean,
  ): Promise<GitHubRepository[]>;
  async getUserRepositories(
    userId: string,
    includePrivate?: boolean,
  ): Promise<GitHubRepository[]>;
  async getUserRepositories(
    userIdOrAccessToken: string,
    includePrivate = true,
  ): Promise<GitHubRepository[]> {
    let userId: string | null = null;

    try {
      let accessToken: string;
      let logContext: string;

      // Check if the parameter is a user ID or access token
      if (
        userIdOrAccessToken.startsWith('gho_') ||
        userIdOrAccessToken.startsWith('ghp_') ||
        userIdOrAccessToken.startsWith('ghu_') ||
        userIdOrAccessToken.length > 50
      ) {
        // It's likely an access token - use it directly without token refresh
        accessToken = userIdOrAccessToken;
        logContext = 'direct token';

        // For now, assume tokens are stored in plain text
        // TODO: Implement proper token encryption/decryption
        const octokit = this.createUserClient(accessToken);

        const { data: repositories } =
          await octokit.repos.listForAuthenticatedUser({
            sort: 'updated',
            per_page: 100,
            type: includePrivate ? 'all' : 'public',
          });

        this.logger.log(
          `Retrieved ${repositories.length} repositories for ${logContext}`,
        );
        return repositories as any[];
      } else {
        // It's a user ID - use token refresh wrapper
        userId = userIdOrAccessToken;
        logContext = `user ${userId}`;

        return await this.withTokenRefresh(
          userId,
          async (accessToken: string) => {
            const octokit = this.createUserClient(accessToken);

            const { data: repositories } =
              await octokit.repos.listForAuthenticatedUser({
                sort: 'updated',
                per_page: 100,
                type: includePrivate ? 'all' : 'public',
              });

            this.logger.log(
              `Retrieved ${repositories.length} repositories for ${logContext}`,
            );
            return repositories as any[];
          },
        );
      }
    } catch (error) {
      this.logger.error(`Error fetching repositories:`, error);
      await this.analyticsService.trackError(
        userId || 'direct_token',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'github_fetch_repositories',
          userId: userId || undefined,
          category: 'github_critical',
        },
      );
      throw error;
    }
  }

  /**
   * Get specific repository details
   */
  async getRepository(
    owner: string,
    repo: string,
    accessToken?: string,
  ): Promise<GitHubRepository> {
    try {
      let octokit: Octokit;

      if (accessToken) {
        octokit = this.createUserClient(accessToken);
      } else {
        octokit = this.createAppClient();
      }

      const { data: repository } = await octokit.repos.get({
        owner,
        repo,
      });

      return repository as any;
    } catch (error) {
      this.logger.error(`Error fetching repository ${owner}/${repo}:`, error);
      throw error;
    }
  }

  /**
   * Get pull requests for a repository
   */
  async getPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'all',
    accessToken?: string,
  ): Promise<GitHubPullRequest[]> {
    try {
      const octokit = accessToken
        ? this.createUserClient(accessToken)
        : this.createAppClient();

      const { data: pullRequests } = await octokit.pulls.list({
        owner,
        repo,
        state,
        sort: 'updated',
        per_page: 100,
      });

      return pullRequests as any[];
    } catch (error) {
      this.logger.error(
        `Error fetching pull requests for ${owner}/${repo}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get specific pull request details
   */
  async getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    accessToken?: string,
  ): Promise<GitHubPullRequest> {
    try {
      const octokit = accessToken
        ? this.createUserClient(accessToken)
        : this.createAppClient();

      const { data: pullRequest } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
      });

      return pullRequest as any;
    } catch (error) {
      this.logger.error(
        `Error fetching PR #${pullNumber} for ${owner}/${repo}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get issues for a repository
   */
  async getIssues(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'all',
    accessToken?: string,
  ): Promise<GitHubIssue[]> {
    try {
      const octokit = accessToken
        ? this.createUserClient(accessToken)
        : this.createAppClient();

      const { data: issues } = await octokit.issues.listForRepo({
        owner,
        repo,
        state,
        sort: 'updated',
        per_page: 100,
      });

      // Filter out pull requests (GitHub API includes PRs in issues endpoint)
      const filteredIssues = issues.filter((issue) => !issue.pull_request);

      return filteredIssues as any[];
    } catch (error) {
      this.logger.error(`Error fetching issues for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  /**
   * Get authenticated user info using access token
   */
  async getAuthenticatedUser(accessToken: string): Promise<GitHubUser>;
  /**
   * Get authenticated user info using user ID (with auto token refresh)
   */
  async getAuthenticatedUser(userId: string): Promise<GitHubUser>;
  async getAuthenticatedUser(userIdOrAccessToken: string): Promise<GitHubUser> {
    // Check if the parameter is a user ID or access token
    if (
      userIdOrAccessToken.startsWith('gho_') ||
      userIdOrAccessToken.startsWith('ghp_') ||
      userIdOrAccessToken.startsWith('ghu_') ||
      userIdOrAccessToken.length > 50
    ) {
      // It's likely an access token - use it directly without token refresh
      try {
        const octokit = this.createUserClient(userIdOrAccessToken);
        const { data: user } = await octokit.users.getAuthenticated();

        return user as any;
      } catch (error) {
        this.logger.error('Error fetching authenticated user:', error);
        throw error;
      }
    } else {
      // It's a user ID - use token refresh wrapper
      const userId = userIdOrAccessToken;

      return await this.withTokenRefresh(
        userId,
        async (accessToken: string) => {
          const octokit = this.createUserClient(accessToken);
          const { data: user } = await octokit.users.getAuthenticated();

          return user as any;
        },
      );
    }
  }

  /**
   * Get GitHub App installations for the authenticated user
   */
  async getUserInstallations(
    accessToken: string,
  ): Promise<GitHubInstallation[]> {
    try {
      const octokit = this.createUserClient(accessToken);
      const { data: installations } =
        await octokit.apps.listInstallationsForAuthenticatedUser();

      return installations.installations as any[];
    } catch (error) {
      this.logger.error('Error fetching user installations:', error);
      throw error;
    }
  }

  /**
   * Get repositories for a GitHub App installation
   */
  async getInstallationRepositories(
    installationId: number,
  ): Promise<GitHubRepository[]> {
    try {
      const octokit = await this.createInstallationClient(installationId);
      const { data } = await octokit.apps.listReposAccessibleToInstallation();

      return data.repositories as any[];
    } catch (error) {
      this.logger.error(
        `Error fetching repositories for installation ${installationId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Verify webhook signature from GitHub
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const webhookSecret = this.configService.get('github.webhookSecret');
    if (!webhookSecret) {
      this.logger.warn('GitHub webhook secret not configured');
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload, 'utf8')
        .digest('hex');

      const actualSignature = signature.replace('sha256=', '');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(actualSignature),
      );
    } catch (error) {
      this.logger.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Test GitHub connection with user token
   */
  async testConnection(accessToken: string): Promise<boolean> {
    try {
      await this.getAuthenticatedUser(accessToken);
      return true;
    } catch (error) {
      this.logger.debug(
        'GitHub connection test failed:',
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Generate GitHub App JWT
   */
  private generateAppJWT(appId: string, privateKey: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 30, // 30 seconds in the past to account for clock skew
      exp: now + 600, // 10 minutes from now
      iss: appId,
    };

    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  }

  /**
   * Get user's team memberships from GitHub API using access token
   */
  async getUserTeams(accessToken: string): Promise<GitHubTeam[]>;
  /**
   * Get user's team memberships from GitHub API using user ID (with auto token refresh)
   */
  async getUserTeams(userId: string): Promise<GitHubTeam[]>;
  async getUserTeams(userIdOrAccessToken: string): Promise<GitHubTeam[]> {
    // Check if the parameter is a user ID or access token
    if (
      userIdOrAccessToken.startsWith('gho_') ||
      userIdOrAccessToken.startsWith('ghp_') ||
      userIdOrAccessToken.startsWith('ghu_') ||
      userIdOrAccessToken.length > 50
    ) {
      // It's likely an access token - use it directly without token refresh
      try {
        const octokit = this.createUserClient(userIdOrAccessToken);

        const { data: teams } =
          await octokit.rest.teams.listForAuthenticatedUser({
            per_page: 100,
          });

        this.logger.log(`Retrieved ${teams.length} teams for user`);
        return this.mapTeamsResponse(teams);
      } catch (error) {
        this.logger.error('Error fetching user teams:', error);
        throw error;
      }
    } else {
      // It's a user ID - use token refresh wrapper
      const userId = userIdOrAccessToken;

      return await this.withTokenRefresh(
        userId,
        async (accessToken: string) => {
          const octokit = this.createUserClient(accessToken);

          const { data: teams } =
            await octokit.rest.teams.listForAuthenticatedUser({
              per_page: 100,
            });

          this.logger.log(`Retrieved ${teams.length} teams for user ${userId}`);
          return this.mapTeamsResponse(teams);
        },
      );
    }
  }

  /**
   * Helper method to map GitHub API teams response to GitHubTeam type
   */
  private mapTeamsResponse(teams: any[]): GitHubTeam[] {
    return teams.map((team) => ({
      id: team.id,
      slug: team.slug,
      name: team.name,
      description: team.description,
      permission: team.permission as
        | 'pull'
        | 'triage'
        | 'push'
        | 'maintain'
        | 'admin',
      privacy: (team.privacy as 'secret' | 'closed') || 'closed',
      organization: team.organization || {
        login: '',
        id: 0,
        avatar_url: '',
      },
      members_count: team.members_count,
      repos_count: team.repos_count,
      created_at: team.created_at || new Date().toISOString(),
      updated_at: team.updated_at || new Date().toISOString(),
    })) as GitHubTeam[];
  }

  /**
   * Get teams for a specific organization using installation token
   */
  async getOrgTeams(
    installationId: number,
    org: string,
  ): Promise<GitHubTeam[]> {
    try {
      const octokit = await this.createInstallationClient(installationId);

      const { data: teams } = await octokit.rest.teams.list({
        org,
        per_page: 100,
      });

      this.logger.log(`Retrieved ${teams.length} teams for org ${org}`);
      return teams.map((team) => ({
        id: team.id,
        slug: team.slug,
        name: team.name,
        description: team.description,
        permission: team.permission as
          | 'pull'
          | 'triage'
          | 'push'
          | 'maintain'
          | 'admin',
        privacy: (team.privacy as 'secret' | 'closed') || 'closed',
        organization: (team as any).organization || {
          login: org,
          id: 0,
          avatar_url: '',
        },
        members_count: (team as any).members_count,
        repos_count: (team as any).repos_count,
        created_at: (team as any).created_at || new Date().toISOString(),
        updated_at: (team as any).updated_at || new Date().toISOString(),
      })) as GitHubTeam[];
    } catch (error) {
      this.logger.error(`Error fetching teams for org ${org}:`, error);
      throw error;
    }
  }

  /**
   * Check if a user is a member of a specific team
   */
  async checkTeamMembership(
    installationId: number,
    org: string,
    teamSlug: string,
    username: string,
  ): Promise<boolean> {
    try {
      const octokit = await this.createInstallationClient(installationId);

      await octokit.rest.teams.getMembershipForUserInOrg({
        org,
        team_slug: teamSlug,
        username,
      });

      return true;
    } catch (error) {
      // 404 means user is not a team member
      if (error.status === 404) {
        return false;
      }
      this.logger.error(`Error checking team membership: ${error}`);
      throw error;
    }
  }

  /**
   * Get GitHub App private key from config
   */
  private getPrivateKey(): string {
    const privateKey = this.configService.get('github.privateKey');
    const privateKeyPath = this.configService.get('github.privateKeyPath');

    if (privateKey) {
      // Handle escaped newlines in environment variable
      return privateKey.replace(/\\n/g, '\n');
    }

    if (privateKeyPath) {
      const fs = require('fs');
      try {
        return fs.readFileSync(privateKeyPath, 'utf8');
      } catch (error) {
        this.logger.error(
          `Failed to read private key from ${privateKeyPath}:`,
          error,
        );
        throw error;
      }
    }

    throw new Error('GitHub App private key not configured');
  }
}
