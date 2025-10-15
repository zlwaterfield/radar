import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { EntitlementsService } from '../../stripe/services/entitlements.service';
import {
  CreateNotificationProfileDto,
  UpdateNotificationProfileDto,
} from '../../common/dtos/notification-profile.dto';
import type {
  NotificationProfileData,
  NotificationProfileWithMeta,
} from '../../common/types/notification-profile.types';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../../common/constants/notification-preferences.constants';
import type { RepositoryFilter } from '../../common/types/digest.types';
import type { NotificationPreferences } from '../../common/types/user.types';

@Injectable()
export class NotificationProfileService {
  private readonly logger = new Logger(NotificationProfileService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly analyticsService: AnalyticsService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  /**
   * Get all notification profiles for a user
   */
  async getUserNotificationProfiles(
    userId: string,
  ): Promise<NotificationProfileWithMeta[]> {
    try {
      const profiles = await this.databaseService.notificationProfile.findMany({
        where: { userId },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });

      return profiles.map((profile) => ({
        ...profile,
        repositoryFilter:
          profile.repositoryFilter as unknown as RepositoryFilter,
        scopeType: profile.scopeType as any,
        deliveryType: profile.deliveryType as any,
        notificationPreferences:
          profile.notificationPreferences as NotificationPreferences,
        description: profile.description,
      }));
    } catch (error) {
      this.logger.error(
        `Error fetching notification profiles for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get all enabled notification profiles for a user (for processing)
   */
  async getEnabledNotificationProfiles(
    userId: string,
  ): Promise<NotificationProfileWithMeta[]> {
    try {
      const profiles = await this.databaseService.notificationProfile.findMany({
        where: {
          userId,
          isEnabled: true,
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });

      return profiles.map((profile) => ({
        ...profile,
        repositoryFilter:
          profile.repositoryFilter as unknown as RepositoryFilter,
        scopeType: profile.scopeType as any,
        deliveryType: profile.deliveryType as any,
        notificationPreferences:
          profile.notificationPreferences as NotificationPreferences,
        description: profile.description,
      }));
    } catch (error) {
      this.logger.error(
        `Error fetching enabled notification profiles for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get a specific notification profile
   */
  async getNotificationProfile(
    profileId: string,
    userId: string,
  ): Promise<NotificationProfileWithMeta> {
    try {
      const profile = await this.databaseService.notificationProfile.findUnique(
        {
          where: {
            id: profileId,
            userId, // Ensure user can only access their own profiles
          },
        },
      );

      if (!profile) {
        throw new NotFoundException('Notification profile not found');
      }

      return {
        ...profile,
        repositoryFilter:
          profile.repositoryFilter as unknown as RepositoryFilter,
        scopeType: profile.scopeType as any,
        deliveryType: profile.deliveryType as any,
        notificationPreferences:
          profile.notificationPreferences as NotificationPreferences,
        description: profile.description,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching notification profile ${profileId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Create a new notification profile
   */
  async createNotificationProfile(
    userId: string,
    data: CreateNotificationProfileDto,
  ): Promise<NotificationProfileWithMeta> {
    try {
      // Check entitlement limits
      const currentCount = await this.databaseService.notificationProfile.count({
        where: { userId },
      });

      const limitCheck = await this.entitlementsService.checkLimit(
        userId,
        'notification_profiles',
        currentCount,
      );

      if (!limitCheck.allowed) {
        throw new ForbiddenException(
          `Profile limit reached (${limitCheck.limit}). Upgrade your plan to create more profiles.`,
        );
      }

      // Validate scope and delivery settings
      await this.validateScopeAndDelivery(userId, data);

      // Validate AI keyword matching entitlement
      if (data.keywordLLMEnabled) {
        const hasAiKeywords = await this.entitlementsService.getFeatureValue(
          userId,
          'ai_keyword_matching',
        );
        if (!hasAiKeywords) {
          throw new ForbiddenException(
            'AI keyword matching requires a Pro plan. Upgrade to use this feature.',
          );
        }
      }

      const profile = await this.databaseService.notificationProfile.create({
        data: {
          userId,
          name: data.name,
          description: data.description,
          isEnabled: data.isEnabled,
          scopeType: data.scopeType,
          scopeValue: data.scopeValue,
          repositoryFilter: data.repositoryFilter as any,
          deliveryType: data.deliveryType,
          deliveryTarget: data.deliveryTarget,
          notificationPreferences: data.notificationPreferences as any,
          keywords: data.keywords,
          keywordLLMEnabled: data.keywordLLMEnabled,
          priority: data.priority || 0,
        },
      });

      this.logger.log(
        `Created notification profile ${profile.id} for user ${userId}`,
      );

      // Track notification profile creation in PostHog
      await this.analyticsService.track(userId, 'notification_profile_created', {
        profileId: profile.id,
        profileName: profile.name,
        isEnabled: profile.isEnabled,
        scopeType: profile.scopeType,
        deliveryType: profile.deliveryType,
        hasKeywords: profile.keywords.length > 0,
        keywordCount: profile.keywords.length,
        keywordLLMEnabled: profile.keywordLLMEnabled,
        repositoryFilterType: (profile.repositoryFilter as any)?.type,
        priority: profile.priority,
      });

      return {
        ...profile,
        repositoryFilter:
          profile.repositoryFilter as unknown as RepositoryFilter,
        scopeType: profile.scopeType as any,
        deliveryType: profile.deliveryType as any,
        notificationPreferences:
          profile.notificationPreferences as NotificationPreferences,
        description: profile.description,
      };
    } catch (error) {
      this.logger.error(
        `Error creating notification profile for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update a notification profile
   */
  async updateNotificationProfile(
    profileId: string,
    userId: string,
    data: UpdateNotificationProfileDto,
  ): Promise<NotificationProfileWithMeta> {
    try {
      // Check if profile exists and belongs to user
      await this.getNotificationProfile(profileId, userId);

      // Validate scope and delivery settings if provided
      if (
        data.scopeType ||
        data.scopeValue ||
        data.deliveryType ||
        data.deliveryTarget
      ) {
        await this.validateScopeAndDelivery(userId, data as any);
      }

      // Validate AI keyword matching entitlement if trying to enable it
      if (data.keywordLLMEnabled === true) {
        const hasAiKeywords = await this.entitlementsService.getFeatureValue(
          userId,
          'ai_keyword_matching',
        );
        if (!hasAiKeywords) {
          throw new ForbiddenException(
            'AI keyword matching requires a Pro plan. Upgrade to use this feature.',
          );
        }
      }

      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
      if (data.scopeType !== undefined) updateData.scopeType = data.scopeType;
      if (data.scopeValue !== undefined)
        updateData.scopeValue = data.scopeValue;
      if (data.repositoryFilter !== undefined)
        updateData.repositoryFilter = data.repositoryFilter;
      if (data.deliveryType !== undefined)
        updateData.deliveryType = data.deliveryType;
      if (data.deliveryTarget !== undefined)
        updateData.deliveryTarget = data.deliveryTarget;
      if (data.notificationPreferences !== undefined)
        updateData.notificationPreferences = data.notificationPreferences;
      if (data.keywords !== undefined) updateData.keywords = data.keywords;
      if (data.keywordLLMEnabled !== undefined)
        updateData.keywordLLMEnabled = data.keywordLLMEnabled;
      if (data.priority !== undefined) updateData.priority = data.priority;

      const profile = await this.databaseService.notificationProfile.update({
        where: { id: profileId },
        data: updateData,
      });

      this.logger.log(
        `Updated notification profile ${profileId} for user ${userId}`,
      );

      return {
        ...profile,
        repositoryFilter:
          profile.repositoryFilter as unknown as RepositoryFilter,
        scopeType: profile.scopeType as any,
        deliveryType: profile.deliveryType as any,
        notificationPreferences:
          profile.notificationPreferences as NotificationPreferences,
        description: profile.description,
      };
    } catch (error) {
      this.logger.error(
        `Error updating notification profile ${profileId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Delete a notification profile
   */
  async deleteNotificationProfile(
    profileId: string,
    userId: string,
  ): Promise<void> {
    try {
      // Check if profile exists and belongs to user
      await this.getNotificationProfile(profileId, userId);

      await this.databaseService.notificationProfile.delete({
        where: { id: profileId },
      });

      this.logger.log(
        `Deleted notification profile ${profileId} for user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error deleting notification profile ${profileId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Validate scope and delivery settings
   */
  private async validateScopeAndDelivery(
    userId: string,
    data: Partial<CreateNotificationProfileDto>,
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
