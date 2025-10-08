import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CreateDigestConfigDto,
  UpdateDigestConfigDto,
} from '../common/dtos/digest-config.dto';
import type {
  DigestConfigData,
  DigestConfigWithMeta,
  MultipleDigestUserData,
  DigestExecutionData,
  RepositoryFilter,
} from '../common/types/digest.types';

@Injectable()
export class DigestConfigService {
  private readonly logger = new Logger(DigestConfigService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Get all digest configurations for a user
   */
  async getUserDigestConfigs(userId: string): Promise<DigestConfigWithMeta[]> {
    try {
      const configs = await this.databaseService.digestConfig.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return configs.map((config) => ({
        ...config,
        repositoryFilter:
          config.repositoryFilter as unknown as RepositoryFilter,
        scopeType: config.scopeType as any,
        deliveryType: config.deliveryType as any,
        description: config.description,
      }));
    } catch (error) {
      this.logger.error(
        `Error fetching digest configs for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get a specific digest configuration
   */
  async getDigestConfig(
    configId: string,
    userId: string,
  ): Promise<DigestConfigWithMeta> {
    try {
      const config = await this.databaseService.digestConfig.findUnique({
        where: {
          id: configId,
          userId, // Ensure user can only access their own configs
        },
      });

      if (!config) {
        throw new NotFoundException('Digest configuration not found');
      }

      return {
        ...config,
        repositoryFilter:
          config.repositoryFilter as unknown as RepositoryFilter,
        scopeType: config.scopeType as any,
        deliveryType: config.deliveryType as any,
        description: config.description,
      };
    } catch (error) {
      this.logger.error(`Error fetching digest config ${configId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new digest configuration
   */
  async createDigestConfig(
    userId: string,
    data: CreateDigestConfigDto,
  ): Promise<DigestConfigWithMeta> {
    try {
      // Validate digest time format
      this.validateDigestTime(data.digestTime);

      // Validate scope and delivery settings
      await this.validateScopeAndDelivery(userId, data);

      const config = await this.databaseService.digestConfig.create({
        data: {
          userId,
          name: data.name,
          description: data.description,
          isEnabled: data.isEnabled,
          digestTime: data.digestTime,
          timezone: data.timezone,
          daysOfWeek: data.daysOfWeek,
          scopeType: data.scopeType,
          scopeValue: data.scopeValue,
          repositoryFilter: data.repositoryFilter as any,
          deliveryType: data.deliveryType,
          deliveryTarget: data.deliveryTarget,
        },
      });

      this.logger.log(`Created digest config ${config.id} for user ${userId}`);

      return {
        ...config,
        repositoryFilter:
          config.repositoryFilter as unknown as RepositoryFilter,
        scopeType: config.scopeType as any,
        deliveryType: config.deliveryType as any,
        description: config.description,
      };
    } catch (error) {
      this.logger.error(
        `Error creating digest config for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update a digest configuration
   */
  async updateDigestConfig(
    configId: string,
    userId: string,
    data: UpdateDigestConfigDto,
  ): Promise<DigestConfigWithMeta> {
    try {
      // Check if config exists and belongs to user
      await this.getDigestConfig(configId, userId);

      // Validate digest time format if provided
      if (data.digestTime) {
        this.validateDigestTime(data.digestTime);
      }

      // Validate scope and delivery settings if provided
      if (
        data.scopeType ||
        data.scopeValue ||
        data.deliveryType ||
        data.deliveryTarget
      ) {
        await this.validateScopeAndDelivery(userId, data as any);
      }

      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
      if (data.digestTime !== undefined)
        updateData.digestTime = data.digestTime;
      if (data.timezone !== undefined) updateData.timezone = data.timezone;
      if (data.daysOfWeek !== undefined) updateData.daysOfWeek = data.daysOfWeek;
      if (data.scopeType !== undefined) updateData.scopeType = data.scopeType;
      if (data.scopeValue !== undefined)
        updateData.scopeValue = data.scopeValue;
      if (data.repositoryFilter !== undefined)
        updateData.repositoryFilter = data.repositoryFilter;
      if (data.deliveryType !== undefined)
        updateData.deliveryType = data.deliveryType;
      if (data.deliveryTarget !== undefined)
        updateData.deliveryTarget = data.deliveryTarget;

      const config = await this.databaseService.digestConfig.update({
        where: { id: configId },
        data: updateData,
      });

      this.logger.log(`Updated digest config ${configId} for user ${userId}`);

      return {
        ...config,
        repositoryFilter:
          config.repositoryFilter as unknown as RepositoryFilter,
        scopeType: config.scopeType as any,
        deliveryType: config.deliveryType as any,
        description: config.description,
      };
    } catch (error) {
      this.logger.error(`Error updating digest config ${configId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a digest configuration
   */
  async deleteDigestConfig(configId: string, userId: string): Promise<void> {
    try {
      // Check if config exists and belongs to user
      await this.getDigestConfig(configId, userId);

      await this.databaseService.digestConfig.delete({
        where: { id: configId },
      });

      this.logger.log(`Deleted digest config ${configId} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error deleting digest config ${configId}:`, error);
      throw error;
    }
  }

  /**
   * Get all users with enabled digest configurations
   */
  async getUsersWithEnabledDigests(): Promise<MultipleDigestUserData[]> {
    try {
      const users = await this.databaseService.user.findMany({
        where: {
          isActive: true,
          githubAccessToken: { not: null },
          githubLogin: { not: null },
          digestConfigs: {
            some: {
              isEnabled: true,
            },
          },
        },
        include: {
          digestConfigs: {
            where: { isEnabled: true },
          },
          repositories: {
            where: {
              enabled: true,
              isActive: true,
            },
          },
          teams: true,
        },
      });

      return users.map((user) => ({
        userId: user.id,
        userGithubLogin: user.githubLogin!,
        slackId: user.slackId || undefined,
        slackAccessToken: user.slackAccessToken || undefined,
        digestConfigs: user.digestConfigs.map((config) => ({
          ...config,
          repositoryFilter:
            config.repositoryFilter as unknown as RepositoryFilter,
          scopeType: config.scopeType as any,
          deliveryType: config.deliveryType as any,
          description: config.description,
        })),
        repositories: user.repositories.map((repo) => ({
          owner: repo.ownerName,
          repo: repo.name,
          githubId: repo.githubId,
        })),
        teams: user.teams.map((team) => ({
          teamId: team.teamId,
          teamSlug: team.teamSlug,
          teamName: team.teamName,
          organization: team.organization,
        })),
      }));
    } catch (error) {
      this.logger.error('Error fetching users with enabled digests:', error);
      throw error;
    }
  }

  /**
   * Get digest execution data for a specific configuration
   */
  async getDigestExecutionData(configId: string): Promise<DigestExecutionData> {
    try {
      const config = await this.databaseService.digestConfig.findUnique({
        where: { id: configId },
        include: {
          user: {
            include: {
              repositories: {
                where: {
                  enabled: true,
                  isActive: true,
                },
              },
              teams: true,
            },
          },
        },
      });

      if (!config || !config.isEnabled) {
        throw new NotFoundException('Enabled digest configuration not found');
      }

      const user = config.user;
      if (!user.githubAccessToken || !user.githubLogin) {
        throw new BadRequestException(
          'User missing required GitHub credentials',
        );
      }

      // Filter repositories based on config
      const repositoryFilter =
        config.repositoryFilter as unknown as RepositoryFilter;
      let repositories = user.repositories.map((repo) => ({
        owner: repo.ownerName,
        repo: repo.name,
        githubId: repo.githubId,
      }));

      if (repositoryFilter.type === 'selected' && repositoryFilter.repoIds) {
        repositories = repositories.filter((repo) =>
          repositoryFilter.repoIds!.includes(repo.githubId),
        );
      }

      // Setup delivery info
      const deliveryInfo: DigestExecutionData['deliveryInfo'] = {
        type: config.deliveryType as any,
        target: config.deliveryTarget || undefined,
      };

      if (config.deliveryType === 'dm') {
        if (!user.slackId || !user.slackAccessToken) {
          throw new BadRequestException(
            'User missing Slack credentials for DM delivery',
          );
        }
        deliveryInfo.slackId = user.slackId;
        deliveryInfo.slackAccessToken = user.slackAccessToken;
      } else if (config.deliveryType === 'channel') {
        if (!config.deliveryTarget || !user.slackAccessToken) {
          throw new BadRequestException(
            'Missing Slack channel or access token for channel delivery',
          );
        }
        deliveryInfo.slackAccessToken = user.slackAccessToken;
      }

      return {
        configId: config.id,
        userId: user.id,
        userGithubLogin: user.githubLogin,
        config: {
          ...config,
          repositoryFilter:
            config.repositoryFilter as unknown as RepositoryFilter,
          scopeType: config.scopeType as any,
          deliveryType: config.deliveryType as any,
        },
        repositories,
        deliveryInfo,
      };
    } catch (error) {
      this.logger.error(
        `Error getting digest execution data for config ${configId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Validate digest time format (HH:MM) and 15-minute increments
   */
  private validateDigestTime(digestTime: string): void {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(digestTime)) {
      throw new BadRequestException(
        'Invalid digest time format. Use HH:MM format.',
      );
    }

    const [, minutes] = digestTime.split(':').map(Number);
    if (minutes % 15 !== 0) {
      throw new BadRequestException(
        'Digest time minutes must be in 15-minute increments (00, 15, 30, 45).',
      );
    }
  }

  /**
   * Validate scope and delivery settings
   */
  private async validateScopeAndDelivery(
    userId: string,
    data: Partial<CreateDigestConfigDto>,
  ): Promise<void> {
    // Validate team scope
    if (data.scopeType === 'team' && data.scopeValue) {
      const userTeam = await this.databaseService.userTeam.findFirst({
        where: {
          userId,
          teamId: data.scopeValue,
        },
      });
      if (!userTeam) {
        throw new BadRequestException(
          'User is not a member of the specified team',
        );
      }
    }

    // Validate channel delivery
    if (data.deliveryType === 'channel' && !data.deliveryTarget) {
      throw new BadRequestException(
        'Channel ID is required for channel delivery',
      );
    }

    // Validate repository filter
    if (
      data.repositoryFilter?.type === 'selected' &&
      (!data.repositoryFilter.repoIds ||
        data.repositoryFilter.repoIds.length === 0)
    ) {
      throw new BadRequestException(
        'Repository IDs are required when using selected repository filter',
      );
    }
  }
}
