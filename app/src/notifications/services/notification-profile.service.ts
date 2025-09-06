import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  CreateNotificationProfileDto,
  UpdateNotificationProfileDto,
} from '../../common/dtos/notification-profile.dto';
import type {
  NotificationProfileData,
  NotificationProfileWithMeta,
} from '../../common/types/notification-profile.types';
import type { RepositoryFilter } from '../../common/types/digest.types';
import type { NotificationPreferences } from '../../common/types/user.types';

@Injectable()
export class NotificationProfileService {
  private readonly logger = new Logger(NotificationProfileService.name);

  constructor(private readonly databaseService: DatabaseService) {}

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
      // Validate scope and delivery settings
      await this.validateScopeAndDelivery(userId, data);

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
   * Create a default notification profile from existing user settings
   */
  async createDefaultProfileFromSettings(
    userId: string,
  ): Promise<NotificationProfileWithMeta | null> {
    try {
      // Check if user already has profiles
      const existingProfiles = await this.getUserNotificationProfiles(userId);
      if (existingProfiles.length > 0) {
        return null; // User already has profiles
      }

      // Get existing user settings
      const settings = await this.databaseService.userSettings.findUnique({
        where: { userId },
      });

      if (!settings) {
        return null; // No settings to migrate
      }

      const notificationPreferences =
        settings.notificationPreferences as NotificationPreferences;
      const keywordPrefs = (settings.keywordPreferences as any) || {};

      // Create default profile
      const defaultProfile = await this.createNotificationProfile(userId, {
        name: 'Default Notifications',
        description: 'Migrated from your previous notification settings',
        isEnabled: true,
        scopeType: 'user',
        repositoryFilter: { type: 'all' },
        deliveryType: 'dm',
        notificationPreferences:
          notificationPreferences || this.getDefaultNotificationPreferences(),
        keywords: keywordPrefs.keywords || [],
        keywordLLMEnabled: keywordPrefs.enabled || false,
        priority: 0,
      });

      this.logger.log(
        `Created default notification profile for user ${userId}`,
      );
      return defaultProfile;
    } catch (error) {
      this.logger.error(
        `Error creating default profile for user ${userId}:`,
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

  /**
   * Get default notification preferences
   */
  private getDefaultNotificationPreferences(): NotificationPreferences {
    return {
      // PR Activity
      pull_request_opened: true,
      pull_request_closed: true,
      pull_request_merged: true,
      pull_request_reviewed: true,
      pull_request_commented: true,
      pull_request_assigned: true,

      // Issue Activity
      issue_opened: true,
      issue_closed: true,
      issue_commented: true,
      issue_assigned: true,

      // CI/CD
      check_failures: false,
      check_successes: false,

      // Mentions
      mention_in_comment: true,
      mention_in_pull_request: true,
      mention_in_issue: true,

      // Noise Control
      mute_own_activity: true,
      mute_bot_comments: true,
      mute_draft_pull_requests: true,
    };
  }
}
