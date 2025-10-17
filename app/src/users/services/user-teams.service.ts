import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { GitHubService } from '../../github/services/github.service';
import { getPaginationSkip } from '../../common/utils/pagination.util';
import type { UserTeam } from '@prisma/client';

@Injectable()
export class UserTeamsService {
  private readonly logger = new Logger(UserTeamsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly githubService: GitHubService,
  ) {}

  /**
   * Get user teams
   */
  async getUserTeams(userId: string): Promise<UserTeam[]> {
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
   * Get user teams with pagination
   */
  async getUserTeamsPaginated(
    userId: string,
    page: number,
    per_page: number,
  ): Promise<{ teams: UserTeam[]; total: number }> {
    try {
      const skip = getPaginationSkip(page, per_page);

      const [teams, total] = await Promise.all([
        this.databaseService.userTeam.findMany({
          where: { userId },
          orderBy: [{ organization: 'asc' }, { teamName: 'asc' }],
          skip,
          take: per_page,
        }),
        this.databaseService.userTeam.count({
          where: { userId },
        }),
      ]);

      return { teams, total };
    } catch (error) {
      this.logger.error(
        `Error getting paginated teams for user ${userId}:`,
        error,
      );
      return { teams: [], total: 0 };
    }
  }

  /**
   * Sync user teams from GitHub
   */
  async syncUserTeams(
    userId: string,
    githubAccessToken: string,
  ): Promise<{
    added: number;
    updated: number;
    total: number;
  }> {
    try {
      // Get GitHub teams for the user
      const githubTeams =
        await this.githubService.getUserTeams(githubAccessToken);

      let added = 0;
      let updated = 0;

      for (const team of githubTeams) {
        const existingTeam = await this.databaseService.userTeam.findFirst({
          where: {
            userId,
            teamId: team.id.toString(),
          },
        });

        const teamData = {
          teamId: team.id.toString(),
          teamSlug: team.slug,
          teamName: team.name,
          organization: team.organization.login,
        };

        if (existingTeam) {
          // Update existing team
          await this.databaseService.userTeam.update({
            where: { id: existingTeam.id },
            data: {
              ...teamData,
              updatedAt: new Date(),
            },
          });
          updated++;
        } else {
          // Add new team
          await this.databaseService.userTeam.create({
            data: {
              userId,
              ...teamData,
            },
          });
          added++;
        }
      }

      this.logger.log(
        `Synced teams for user ${userId}: ${added} added, ${updated} updated`,
      );

      return {
        added,
        updated,
        total: githubTeams.length,
      };
    } catch (error) {
      this.logger.error(`Error syncing teams for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get team statistics for user
   */
  async getTeamStats(userId: string): Promise<{
    total: number;
    byOrganization: Record<string, number>;
  }> {
    try {
      const teams = await this.getUserTeams(userId);

      const stats = {
        total: teams.length,
        byOrganization: {} as Record<string, number>,
      };

      // Count by organization
      teams.forEach((team) => {
        const org = team.organization;
        stats.byOrganization[org] = (stats.byOrganization[org] || 0) + 1;
      });

      return stats;
    } catch (error) {
      this.logger.error(`Error getting team stats for user ${userId}:`, error);
      return {
        total: 0,
        byOrganization: {},
      };
    }
  }
}
