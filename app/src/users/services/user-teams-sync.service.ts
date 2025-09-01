import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { GitHubService } from '../../github/services/github.service';
import { UserRepositoriesService } from './user-repositories.service';
import type { GitHubTeam } from '../../common/types/github.types';

@Injectable()
export class UserTeamsSyncService {
  private readonly logger = new Logger(UserTeamsSyncService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly githubService: GitHubService,
    private readonly userRepositoriesService: UserRepositoriesService,
  ) {}

  /**
   * Auto-sync repos and teams when user connects GitHub and installs app
   */
  async syncUserGitHubData(userId: string): Promise<void> {
    try {
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
      });

      if (!user?.githubAccessToken) {
        throw new Error('User not connected to GitHub');
      }

      this.logger.log(`Starting GitHub data sync for user ${userId}`);

      // Sync repositories (using existing service)
      await this.userRepositoriesService.syncUserRepositories(
        userId,
        user.githubAccessToken,
      );

      // Sync teams (new functionality)
      await this.syncUserTeams(userId);

      // Update sync timestamp
      await this.databaseService.user.update({
        where: { id: userId },
        data: { teamsLastSyncedAt: new Date() },
      });

      this.logger.log(`Completed GitHub data sync for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error syncing GitHub data for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Sync user's team memberships from GitHub API
   */
  async syncUserTeams(userId: string): Promise<void> {
    try {
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
      });

      if (!user?.githubAccessToken) {
        throw new Error('User not connected to GitHub');
      }

      this.logger.log(`Syncing teams for user ${userId}`);

      const teams = await this.githubService.getUserTeams(
        user.githubAccessToken,
      );

      // Clear existing team memberships for this user
      await this.databaseService.userTeam.deleteMany({
        where: { userId },
      });

      // Insert new team memberships
      for (const team of teams) {
        await this.databaseService.userTeam.create({
          data: {
            userId,
            teamId: team.id.toString(),
            teamSlug: team.slug,
            teamName: team.name,
            organization: team.organization.login,
            permission: team.permission || 'member',
          },
        });
      }

      this.logger.log(`Synced ${teams.length} teams for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error syncing teams for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Add a team membership via webhook
   */
  async addTeamMembership(
    userId: string,
    teamId: string,
    teamSlug: string,
    teamName: string,
    organization: string,
    permission: string = 'member',
  ): Promise<void> {
    try {
      await this.databaseService.userTeam.upsert({
        where: {
          userId_teamId: {
            userId,
            teamId,
          },
        },
        create: {
          userId,
          teamId,
          teamSlug,
          teamName,
          organization,
          permission,
        },
        update: {
          teamName,
          permission,
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `Added team membership: user ${userId} to team ${teamSlug} in ${organization}`,
      );
    } catch (error) {
      this.logger.error(`Error adding team membership:`, error);
      throw error;
    }
  }

  /**
   * Remove a team membership via webhook
   */
  async removeTeamMembership(userId: string, teamId: string): Promise<void> {
    try {
      await this.databaseService.userTeam.deleteMany({
        where: {
          userId,
          teamId,
        },
      });

      this.logger.log(
        `Removed team membership: user ${userId} from team ${teamId}`,
      );
    } catch (error) {
      this.logger.error(`Error removing team membership:`, error);
      throw error;
    }
  }

  /**
   * Get user's team memberships from database
   */
  async getUserTeams(userId: string): Promise<any[]> {
    try {
      return await this.databaseService.userTeam.findMany({
        where: { userId },
        orderBy: [{ organization: 'asc' }, { teamName: 'asc' }],
      });
    } catch (error) {
      this.logger.error(`Error getting teams for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Check if user is in a specific team
   */
  async isUserInTeam(
    userId: string,
    teamSlug: string,
    organization: string,
  ): Promise<boolean> {
    try {
      const team = await this.databaseService.userTeam.findFirst({
        where: {
          userId,
          teamSlug,
          organization,
        },
      });

      return !!team;
    } catch (error) {
      this.logger.error(`Error checking team membership:`, error);
      return false;
    }
  }
}
