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
   * Get enabled teams for user
   */
  async getEnabledTeams(userId: string): Promise<UserTeam[]> {
    try {
      return await this.databaseService.userTeam.findMany({
        where: {
          userId,
          enabled: true,
        },
        orderBy: [{ organization: 'asc' }, { teamName: 'asc' }],
      });
    } catch (error) {
      this.logger.error(
        `Error getting enabled teams for user ${userId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get enabled teams with pagination
   */
  async getEnabledTeamsPaginated(
    userId: string,
    page: number,
    per_page: number,
  ): Promise<{ teams: UserTeam[]; total: number }> {
    try {
      const skip = getPaginationSkip(page, per_page);

      const [teams, total] = await Promise.all([
        this.databaseService.userTeam.findMany({
          where: {
            userId,
            enabled: true,
          },
          orderBy: [{ organization: 'asc' }, { teamName: 'asc' }],
          skip,
          take: per_page,
        }),
        this.databaseService.userTeam.count({
          where: {
            userId,
            enabled: true,
          },
        }),
      ]);

      return { teams, total };
    } catch (error) {
      this.logger.error(
        `Error getting paginated enabled teams for user ${userId}:`,
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

        // Map GitHub permissions to simpler values
        const mapPermission = (githubPermission: string) => {
          switch (githubPermission) {
            case 'admin': return 'admin';
            case 'maintain': return 'maintainer';
            case 'push': return 'member';
            case 'pull': return 'member';
            default: return 'member';
          }
        };

        const teamData = {
          teamId: team.id.toString(),
          teamSlug: team.slug,
          teamName: team.name,
          organization: team.organization.login,
          permission: mapPermission(team.permission || 'pull'),
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
          // Add new team (enabled by default)
          await this.databaseService.userTeam.create({
            data: {
              userId,
              ...teamData,
              enabled: true,
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
   * Enable/disable team notifications
   */
  async toggleTeamNotifications(
    userId: string,
    teamId: string,
    enabled: boolean,
  ): Promise<UserTeam> {
    try {
      const team = await this.databaseService.userTeam.update({
        where: {
          id: teamId,
          userId, // Ensure user owns the team
        },
        data: {
          enabled,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Updated team ${teamId} for user ${userId}`);
      return team;
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException('Team not found');
      }
      this.logger.error(
        `Error updating team ${teamId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Get team statistics for user
   */
  async getTeamStats(userId: string): Promise<{
    total: number;
    enabled: number;
    byOrganization: Record<string, number>;
  }> {
    try {
      const teams = await this.getUserTeams(userId);

      const stats = {
        total: teams.length,
        enabled: teams.filter((t) => t.enabled).length,
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
        enabled: 0,
        byOrganization: {},
      };
    }
  }
}
