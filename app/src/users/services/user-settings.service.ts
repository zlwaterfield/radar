import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import {
  CreateUserSettingsDto,
  UpdateUserSettingsDto,
} from '../dto/user-settings.dto';
import type { UserSettings } from '@prisma/client';

@Injectable()
export class UserSettingsService {
  private readonly logger = new Logger(UserSettingsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Get user settings by user ID
   */
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    try {
      return await this.databaseService.userSettings.findUnique({
        where: { userId },
      });
    } catch (error) {
      this.logger.error(`Error getting settings for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Create user settings
   */
  async createUserSettings(
    userId: string,
    data: CreateUserSettingsDto,
  ): Promise<UserSettings> {
    try {
      const keywordPrefs = (data as any).keywords ? {
        enabled: (data as any).keywords.length > 0,
        keywords: (data as any).keywords,
        threshold: 0.7
      } : (data.keywordPreferences || {});
      
      const settings = await this.databaseService.userSettings.create({
        data: {
          userId,
          notificationPreferences: data.notificationPreferences ? { ...data.notificationPreferences } : {},
          notificationSchedule: data.notificationSchedule ? { ...data.notificationSchedule } : {},
          statsTimeWindow: data.statsTimeWindow,
          keywordPreferences: keywordPrefs,
        },
      });

      this.logger.log(`Created settings for user ${userId}`);
      return settings;
    } catch (error) {
      this.logger.error(`Error creating settings for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update user settings
   */
  async updateUserSettings(
    userId: string,
    data: UpdateUserSettingsDto,
  ): Promise<UserSettings> {
    try {
      const updateData: any = {
        updatedAt: new Date(),
      };
      
      if (data.notificationPreferences) {
        updateData.notificationPreferences = { ...data.notificationPreferences };
      }
      if (data.notificationSchedule) {
        updateData.notificationSchedule = { ...data.notificationSchedule };
      }
      if (data.statsTimeWindow !== undefined) {
        updateData.statsTimeWindow = data.statsTimeWindow;
      }
      if ((data as any).keywords !== undefined) {
        // Map keywords array to keywordPreferences object structure
        updateData.keywordPreferences = {
          enabled: (data as any).keywords.length > 0,
          keywords: (data as any).keywords,
          threshold: 0.7
        };
      }

      const settings = await this.databaseService.userSettings.update({
        where: { userId },
        data: updateData,
      });

      this.logger.log(`Updated settings for user ${userId}`);
      return settings;
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as any).code === 'P2025'
      ) {
        throw new NotFoundException('User settings not found');
      }
      this.logger.error(
        `Error updating settings for user ${userId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Create or update user settings
   */
  async upsertUserSettings(
    userId: string,
    data: CreateUserSettingsDto,
  ): Promise<UserSettings> {
    try {
      const updateData: any = {
        updatedAt: new Date(),
      };
      const createData: any = {
        userId,
      };
      
      if (data.notificationPreferences) {
        updateData.notificationPreferences = { ...data.notificationPreferences };
        createData.notificationPreferences = { ...data.notificationPreferences };
      }
      if (data.notificationSchedule) {
        updateData.notificationSchedule = { ...data.notificationSchedule };
        createData.notificationSchedule = { ...data.notificationSchedule };
      }
      if (data.statsTimeWindow !== undefined) {
        updateData.statsTimeWindow = data.statsTimeWindow;
        createData.statsTimeWindow = data.statsTimeWindow;
      }
      if ((data as any).keywords !== undefined) {
        // Map keywords array to keywordPreferences object structure
        const keywordPrefs = {
          enabled: (data as any).keywords.length > 0,
          keywords: (data as any).keywords,
          threshold: 0.7
        };
        updateData.keywordPreferences = keywordPrefs;
        createData.keywordPreferences = keywordPrefs;
      }

      const settings = await this.databaseService.userSettings.upsert({
        where: { userId },
        update: updateData,
        create: createData,
      });

      this.logger.log(`Upserted settings for user ${userId}`);
      return settings;
    } catch (error) {
      this.logger.error(`Error upserting settings for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Delete user settings
   */
  async deleteUserSettings(userId: string): Promise<boolean> {
    try {
      await this.databaseService.userSettings.delete({
        where: { userId },
      });

      this.logger.log(`Deleted settings for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting settings for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get default notification preferences
   */
  getDefaultNotificationPreferences(): any {
    return {
      pull_request_opened: true,
      pull_request_closed: true,
      pull_request_merged: true,
      pull_request_reviewed: true,
      pull_request_commented: true,
      pull_request_assigned: true,
      issue_opened: true,
      issue_closed: true,
      issue_commented: true,
      issue_assigned: true,
    };
  }

  /**
   * Get default notification schedule
   */
  getDefaultNotificationSchedule(): any {
    return {
      real_time: true,
      digest_time: '09:00',
      digest_enabled: true,
      digest_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      second_digest_time: null,
      second_digest_enabled: false,
    };
  }

  /**
   * Get default keyword preferences
   */
  getDefaultKeywordPreferences(): any {
    return {
      enabled: false,
      keywords: [],
      threshold: 0.3,
    };
  }
}
