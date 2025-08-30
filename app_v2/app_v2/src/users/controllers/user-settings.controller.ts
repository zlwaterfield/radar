import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserSettingsService } from '../services/user-settings.service';
import {
  UpdateUserSettingsDto,
  UserSettingsResponseDto,
  NotificationPreferencesDto,
  NotificationScheduleDto,
} from '../dto/user-settings.dto';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { GetUser } from '@/auth/decorators/user.decorator';
import type { User } from '@prisma/client';
import {
  validateNotificationPreferences,
  validateNotificationSchedule,
  createDefaultNotificationPreferences,
  createDefaultNotificationSchedule,
} from '@/common/utils/json-validation.util';

@ApiTags('user-settings')
@ApiBearerAuth()
@Controller('users/me/settings')
@UseGuards(AuthGuard)
export class UserSettingsController {
  private readonly logger = new Logger(UserSettingsController.name);

  constructor(private readonly userSettingsService: UserSettingsService) {}

  /**
   * Get current user settings
   */
  @Get()
  @ApiOperation({ summary: 'Get current user settings' })
  @ApiResponse({ status: 200, description: 'User settings', type: UserSettingsResponseDto })
  async getUserSettings(@GetUser() user: User): Promise<UserSettingsResponseDto> {
    const settings = await this.userSettingsService.getUserSettings(user.id);
    
    if (!settings) {
      // Create default settings if they don't exist
      const defaultSettings = await this.userSettingsService.createUserSettings(user.id, {
        notificationPreferences: createDefaultNotificationPreferences(),
        notificationSchedule: createDefaultNotificationSchedule(),
        statsTimeWindow: 14,
        keywords: [],
      });

      return {
        id: defaultSettings.id,
        userId: defaultSettings.userId,
        notificationPreferences: validateNotificationPreferences(defaultSettings.notificationPreferences),
        notificationSchedule: validateNotificationSchedule(defaultSettings.notificationSchedule),
        statsTimeWindow: defaultSettings.statsTimeWindow,
        keywords: defaultSettings.keywords as string[],
        createdAt: defaultSettings.createdAt,
        updatedAt: defaultSettings.updatedAt,
      };
    }

    return {
      id: settings.id,
      userId: settings.userId,
      notificationPreferences: validateNotificationPreferences(settings.notificationPreferences),
      notificationSchedule: validateNotificationSchedule(settings.notificationSchedule),
      statsTimeWindow: settings.statsTimeWindow,
      keywords: settings.keywords as string[],
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Update user settings
   */
  @Put()
  @ApiOperation({ summary: 'Update user settings' })
  @ApiResponse({ status: 200, description: 'Settings updated', type: UserSettingsResponseDto })
  async updateUserSettings(
    @GetUser() user: User,
    @Body() updateData: UpdateUserSettingsDto,
  ): Promise<UserSettingsResponseDto> {
    const settings = await this.userSettingsService.upsertUserSettings(user.id, {
      notificationPreferences: updateData.notificationPreferences || {},
      notificationSchedule: updateData.notificationSchedule || {},
      statsTimeWindow: updateData.statsTimeWindow || 14,
      keywords: updateData.keywords || [],
    });

    return {
      id: settings.id,
      userId: settings.userId,
      notificationPreferences: validateNotificationPreferences(settings.notificationPreferences),
      notificationSchedule: validateNotificationSchedule(settings.notificationSchedule),
      statsTimeWindow: settings.statsTimeWindow,
      keywords: settings.keywords as string[],
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Get notification preferences
   */
  @Get('notifications')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiResponse({ status: 200, description: 'Notification preferences', type: NotificationPreferencesDto })
  async getNotificationPreferences(@GetUser() user: User) {
    return this.userSettingsService.getNotificationPreferences(user.id);
  }

  /**
   * Update notification preferences
   */
  @Put('notifications')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  async updateNotificationPreferences(
    @GetUser() user: User,
    @Body() preferences: NotificationPreferencesDto,
  ) {
    const settings = await this.userSettingsService.updateNotificationPreferences(user.id, preferences);

    return {
      preferences: settings.notificationPreferences,
      message: 'Notification preferences updated successfully',
    };
  }

  /**
   * Get notification schedule
   */
  @Get('schedule')
  @ApiOperation({ summary: 'Get notification schedule' })
  @ApiResponse({ status: 200, description: 'Notification schedule', type: NotificationScheduleDto })
  async getNotificationSchedule(@GetUser() user: User) {
    return this.userSettingsService.getNotificationSchedule(user.id);
  }

  /**
   * Update notification schedule
   */
  @Put('schedule')
  @ApiOperation({ summary: 'Update notification schedule' })
  @ApiResponse({ status: 200, description: 'Schedule updated' })
  async updateNotificationSchedule(
    @GetUser() user: User,
    @Body() schedule: NotificationScheduleDto,
  ) {
    // Validate digest time format
    if (schedule.digest_time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(schedule.digest_time)) {
      throw new BadRequestException('Invalid digest time format. Use HH:mm format.');
    }

    if (schedule.second_digest_time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(schedule.second_digest_time)) {
      throw new BadRequestException('Invalid second digest time format. Use HH:mm format.');
    }

    // Validate digest days
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const invalidDays = schedule.digest_days.filter(day => !validDays.includes(day));
    
    if (invalidDays.length > 0) {
      throw new BadRequestException(`Invalid digest days: ${invalidDays.join(', ')}`);
    }

    const settings = await this.userSettingsService.updateNotificationSchedule(user.id, schedule);

    return {
      schedule: settings.notificationSchedule,
      message: 'Notification schedule updated successfully',
    };
  }

  /**
   * Get keywords
   */
  @Get('keywords')
  @ApiOperation({ summary: 'Get notification keywords' })
  @ApiResponse({ status: 200, description: 'Keywords for filtering notifications' })
  async getKeywords(@GetUser() user: User) {
    const keywords = await this.userSettingsService.getKeywords(user.id);
    return { keywords };
  }

  /**
   * Update keywords
   */
  @Put('keywords')
  @ApiOperation({ summary: 'Update notification keywords' })
  @ApiResponse({ status: 200, description: 'Keywords updated' })
  async updateKeywords(
    @GetUser() user: User,
    @Body() body: { keywords: string[] },
  ) {
    if (!Array.isArray(body.keywords)) {
      throw new BadRequestException('Keywords must be an array of strings');
    }

    // Filter out empty strings and limit to reasonable number
    const validKeywords = body.keywords
      .filter(keyword => typeof keyword === 'string' && keyword.trim().length > 0)
      .slice(0, 50); // Limit to 50 keywords

    const settings = await this.userSettingsService.updateKeywords(user.id, validKeywords);

    return {
      keywords: settings.keywords,
      message: 'Keywords updated successfully',
    };
  }

  /**
   * Update stats time window
   */
  @Put('stats-window')
  @ApiOperation({ summary: 'Update statistics time window' })
  @ApiResponse({ status: 200, description: 'Stats window updated' })
  async updateStatsTimeWindow(
    @GetUser() user: User,
    @Body() body: { timeWindow: number },
  ) {
    const { timeWindow } = body;
    
    if (!Number.isInteger(timeWindow) || timeWindow < 1 || timeWindow > 90) {
      throw new BadRequestException('Time window must be an integer between 1 and 90 days');
    }

    const settings = await this.userSettingsService.updateStatsTimeWindow(user.id, timeWindow);

    return {
      statsTimeWindow: settings.statsTimeWindow,
      message: 'Statistics time window updated successfully',
    };
  }
}