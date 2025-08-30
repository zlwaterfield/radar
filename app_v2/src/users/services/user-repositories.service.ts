import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { GitHubService } from '@/github/services/github.service';
import type { UserRepository } from '@prisma/client';

@Injectable()
export class UserRepositoriesService {
  private readonly logger = new Logger(UserRepositoriesService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly githubService: GitHubService,
  ) {}

  /**
   * Get user repositories
   */
  async getUserRepositories(userId: string): Promise<UserRepository[]> {
    try {
      return await this.databaseService.userRepository.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      this.logger.error(
        `Error getting repositories for user ${userId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Add repository for user
   */
  async addUserRepository(
    userId: string,
    repositoryData: {
      githubId: string;
      name: string;
      fullName: string;
      description?: string;
      url: string;
      isPrivate: boolean;
      isFork: boolean;
      ownerName: string;
      ownerAvatarUrl: string;
      ownerUrl: string;
      organization?: string;
    },
  ): Promise<UserRepository> {
    try {
      const repository = await this.databaseService.userRepository.create({
        data: {
          userId,
          ...repositoryData,
        },
      });

      this.logger.log(
        `Added repository ${repositoryData.fullName} for user ${userId}`,
      );
      return repository;
    } catch (error) {
      this.logger.error(`Error adding repository for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update repository settings
   */
  async updateRepository(
    userId: string,
    repositoryId: string,
    data: {
      enabled?: boolean;
      isActive?: boolean;
    },
  ): Promise<UserRepository> {
    try {
      const repository = await this.databaseService.userRepository.update({
        where: {
          id: repositoryId,
          userId, // Ensure user owns the repository
        },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Updated repository ${repositoryId} for user ${userId}`);
      return repository;
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === 'P2025') {
        throw new NotFoundException('Repository not found');
      }
      this.logger.error(`Error updating repository ${repositoryId}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Remove repository for user
   */
  async removeRepository(
    userId: string,
    repositoryId: string,
  ): Promise<boolean> {
    try {
      await this.databaseService.userRepository.delete({
        where: {
          id: repositoryId,
          userId,
        },
      });

      this.logger.log(`Removed repository ${repositoryId} for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error removing repository ${repositoryId}:`, error);
      return false;
    }
  }

  /**
   * Sync user repositories from GitHub
   */
  async syncUserRepositories(
    userId: string,
    githubAccessToken: string,
  ): Promise<{
    added: number;
    updated: number;
    total: number;
  }> {
    try {
      // Get repositories from GitHub
      const githubRepos =
        await this.githubService.getUserRepositories(githubAccessToken);

      let added = 0;
      let updated = 0;

      for (const repo of githubRepos) {
        const existingRepo =
          await this.databaseService.userRepository.findFirst({
            where: {
              userId,
              githubId: repo.id.toString(),
            },
          });

        const repoData = {
          githubId: repo.id.toString(),
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description || '',
          url: repo.html_url,
          isPrivate: repo.private,
          isFork: repo.fork,
          ownerName: repo.owner.login,
          ownerAvatarUrl: repo.owner.avatar_url,
          ownerUrl: repo.owner.html_url,
          organization:
            repo.owner.type === 'Organization' ? repo.owner.login : undefined,
        };

        if (existingRepo) {
          // Update existing repository
          await this.databaseService.userRepository.update({
            where: { id: existingRepo.id },
            data: {
              ...repoData,
              updatedAt: new Date(),
            },
          });
          updated++;
        } else {
          // Add new repository
          await this.addUserRepository(userId, repoData);
          added++;
        }
      }

      this.logger.log(
        `Synced repositories for user ${userId}: ${added} added, ${updated} updated`,
      );

      return {
        added,
        updated,
        total: githubRepos.length,
      };
    } catch (error) {
      this.logger.error(
        `Error syncing repositories for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get repository statistics for user
   */
  async getRepositoryStats(userId: string): Promise<{
    total: number;
    enabled: number;
    private: number;
    forks: number;
    byOrganization: Record<string, number>;
  }> {
    try {
      const repositories = await this.getUserRepositories(userId);

      const stats = {
        total: repositories.length,
        enabled: repositories.filter((r) => r.enabled).length,
        private: repositories.filter((r) => r.isPrivate).length,
        forks: repositories.filter((r) => r.isFork).length,
        byOrganization: {} as Record<string, number>,
      };

      // Count by organization
      repositories.forEach((repo) => {
        const org = repo.organization || 'Personal';
        stats.byOrganization[org] = (stats.byOrganization[org] || 0) + 1;
      });

      return stats;
    } catch (error) {
      this.logger.error(
        `Error getting repository stats for user ${userId}:`,
        error,
      );
      return {
        total: 0,
        enabled: 0,
        private: 0,
        forks: 0,
        byOrganization: {},
      };
    }
  }

  /**
   * Enable/disable repository notifications
   */
  async toggleRepositoryNotifications(
    userId: string,
    repositoryId: string,
    enabled: boolean,
  ): Promise<UserRepository> {
    return this.updateRepository(userId, repositoryId, { enabled });
  }

  /**
   * Get enabled repositories for user
   */
  async getEnabledRepositories(userId: string): Promise<UserRepository[]> {
    try {
      return await this.databaseService.userRepository.findMany({
        where: {
          userId,
          enabled: true,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      this.logger.error(
        `Error getting enabled repositories for user ${userId}:`,
        error,
      );
      return [];
    }
  }
}
