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
      const settings = await this.databaseService.userSettings.create({
        data: {
          userId,
          notificationPreferences: data.notificationPreferences,
          notificationSchedule: data.notificationSchedule,
          statsTimeWindow: data.statsTimeWindow,
          keywords: data.keywords,
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
      const settings = await this.databaseService.userSettings.update({
        where: { userId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Updated settings for user ${userId}`);
      return settings;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('User settings not found');
      }
      this.logger.error(`Error updating settings for user ${userId}:`, error);
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
      const settings = await this.databaseService.userSettings.upsert({
        where: { userId },
        update: {
          ...data,
          updatedAt: new Date(),
        },
        create: {
          userId,
          ...data,
        },
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
   * Get notification preferences for user
   */
  async getNotificationPreferences(userId: string): Promise<any> {
    const settings = await this.getUserSettings(userId);
    return (
      settings?.notificationPreferences ||
      this.getDefaultNotificationPreferences()
    );
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: any,
  ): Promise<UserSettings> {
    const existingSettings = await this.getUserSettings(userId);

    if (existingSettings) {
      return this.updateUserSettings(userId, {
        notificationPreferences: preferences,
      });
    } else {
      return this.createUserSettings(userId, {
        notificationPreferences: preferences,
        notificationSchedule: this.getDefaultNotificationSchedule(),
        statsTimeWindow: 14,
        keywords: [],
      });
    }
  }

  /**
   * Get notification schedule for user
   */
  async getNotificationSchedule(userId: string): Promise<any> {
    const settings = await this.getUserSettings(userId);
    return (
      settings?.notificationSchedule || this.getDefaultNotificationSchedule()
    );
  }

  /**
   * Update notification schedule
   */
  async updateNotificationSchedule(
    userId: string,
    schedule: any,
  ): Promise<UserSettings> {
    const existingSettings = await this.getUserSettings(userId);

    if (existingSettings) {
      return this.updateUserSettings(userId, {
        notificationSchedule: schedule,
      });
    } else {
      return this.createUserSettings(userId, {
        notificationPreferences: this.getDefaultNotificationPreferences(),
        notificationSchedule: schedule,
        statsTimeWindow: 14,
        keywords: [],
      });
    }
  }

  /**
   * Get keywords for user
   */
  async getKeywords(userId: string): Promise<string[]> {
    const settings = await this.getUserSettings(userId);
    return (settings?.keywords as string[]) || [];
  }

  /**
   * Update keywords
   */
  async updateKeywords(
    userId: string,
    keywords: string[],
  ): Promise<UserSettings> {
    const existingSettings = await this.getUserSettings(userId);

    if (existingSettings) {
      return this.updateUserSettings(userId, {
        keywords: keywords,
      });
    } else {
      return this.createUserSettings(userId, {
        notificationPreferences: this.getDefaultNotificationPreferences(),
        notificationSchedule: this.getDefaultNotificationSchedule(),
        statsTimeWindow: 14,
        keywords: keywords,
      });
    }
  }

  /**
   * Get stats time window for user
   */
  async getStatsTimeWindow(userId: string): Promise<number> {
    const settings = await this.getUserSettings(userId);
    return settings?.statsTimeWindow || 14;
  }

  /**
   * Update stats time window
   */
  async updateStatsTimeWindow(
    userId: string,
    timeWindow: number,
  ): Promise<UserSettings> {
    const existingSettings = await this.getUserSettings(userId);

    if (existingSettings) {
      return this.updateUserSettings(userId, {
        statsTimeWindow: timeWindow,
      });
    } else {
      return this.createUserSettings(userId, {
        notificationPreferences: this.getDefaultNotificationPreferences(),
        notificationSchedule: this.getDefaultNotificationSchedule(),
        statsTimeWindow: timeWindow,
        keywords: [],
      });
    }
  }

  /**
   * Get default notification preferences
   */
  private getDefaultNotificationPreferences(): any {
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
  private getDefaultNotificationSchedule(): any {
    return {
      real_time: true,
      digest_time: '09:00',
      digest_enabled: true,
      digest_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      second_digest_time: null,
      second_digest_enabled: false,
    };
  }
}
