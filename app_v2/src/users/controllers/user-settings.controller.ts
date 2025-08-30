import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserSettingsService } from '../services/user-settings.service';
import { UserRepositoriesService } from '../services/user-repositories.service';
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
@Controller()
@UseGuards(AuthGuard)
export class UserSettingsController {
  private readonly logger = new Logger(UserSettingsController.name);

  constructor(
    private readonly userSettingsService: UserSettingsService,
    private readonly userRepositoriesService: UserRepositoriesService,
  ) {}

  /**
   * Get current user settings
   */
  @Get('users/me/settings')
  @ApiOperation({ summary: 'Get current user settings' })
  @ApiResponse({
    status: 200,
    description: 'User settings',
    type: UserSettingsResponseDto,
  })
  async getUserSettings(
    @GetUser() user: User,
  ): Promise<UserSettingsResponseDto> {
    const settings = await this.userSettingsService.getUserSettings(user.id);

    if (!settings) {
      // Create default settings if they don't exist
      const defaultSettings = await this.userSettingsService.createUserSettings(
        user.id,
        {
          notificationPreferences: createDefaultNotificationPreferences(),
          notificationSchedule: createDefaultNotificationSchedule(),
          statsTimeWindow: 14,
          keywords: [],
        },
      );

      return {
        id: defaultSettings.id,
        userId: defaultSettings.userId,
        notificationPreferences: validateNotificationPreferences(
          defaultSettings.notificationPreferences,
        ),
        notificationSchedule: validateNotificationSchedule(
          defaultSettings.notificationSchedule,
        ),
        statsTimeWindow: defaultSettings.statsTimeWindow,
        keywords: defaultSettings.keywords as string[],
        createdAt: defaultSettings.createdAt,
        updatedAt: defaultSettings.updatedAt,
      };
    }

    return {
      id: settings.id,
      userId: settings.userId,
      notificationPreferences: validateNotificationPreferences(
        settings.notificationPreferences,
      ),
      notificationSchedule: validateNotificationSchedule(
        settings.notificationSchedule,
      ),
      statsTimeWindow: settings.statsTimeWindow,
      keywords: settings.keywords as string[],
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Update user settings
   */
  @Put('users/me/settings')
  @ApiOperation({ summary: 'Update user settings' })
  @ApiResponse({
    status: 200,
    description: 'Settings updated',
    type: UserSettingsResponseDto,
  })
  async updateUserSettings(
    @GetUser() user: User,
    @Body() updateData: UpdateUserSettingsDto,
  ): Promise<UserSettingsResponseDto> {
    const settings = await this.userSettingsService.upsertUserSettings(
      user.id,
      {
        notificationPreferences: updateData.notificationPreferences || {},
        notificationSchedule: updateData.notificationSchedule || {},
        statsTimeWindow: updateData.statsTimeWindow || 14,
        keywords: updateData.keywords || [],
      },
    );

    return {
      id: settings.id,
      userId: settings.userId,
      notificationPreferences: validateNotificationPreferences(
        settings.notificationPreferences,
      ),
      notificationSchedule: validateNotificationSchedule(
        settings.notificationSchedule,
      ),
      statsTimeWindow: settings.statsTimeWindow,
      keywords: settings.keywords as string[],
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Get notification preferences
   */
  @Get('users/me/settings/notifications')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences',
    type: NotificationPreferencesDto,
  })
  async getNotificationPreferences(@GetUser() user: User) {
    return this.userSettingsService.getNotificationPreferences(user.id);
  }

  /**
   * Update notification preferences
   */
  @Put('users/me/settings/notifications')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  async updateNotificationPreferences(
    @GetUser() user: User,
    @Body() preferences: NotificationPreferencesDto,
  ) {
    const settings =
      await this.userSettingsService.updateNotificationPreferences(
        user.id,
        preferences,
      );

    return {
      preferences: settings.notificationPreferences,
      message: 'Notification preferences updated successfully',
    };
  }

  /**
   * Get notification schedule
   */
  @Get('users/me/settings/schedule')
  @ApiOperation({ summary: 'Get notification schedule' })
  @ApiResponse({
    status: 200,
    description: 'Notification schedule',
    type: NotificationScheduleDto,
  })
  async getNotificationSchedule(@GetUser() user: User) {
    return this.userSettingsService.getNotificationSchedule(user.id);
  }

  /**
   * Update notification schedule
   */
  @Put('users/me/settings/schedule')
  @ApiOperation({ summary: 'Update notification schedule' })
  @ApiResponse({ status: 200, description: 'Schedule updated' })
  async updateNotificationSchedule(
    @GetUser() user: User,
    @Body() schedule: NotificationScheduleDto,
  ) {
    // Validate digest time format
    if (
      schedule.digest_time &&
      !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(schedule.digest_time)
    ) {
      throw new BadRequestException(
        'Invalid digest time format. Use HH:mm format.',
      );
    }

    if (
      schedule.second_digest_time &&
      !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(schedule.second_digest_time)
    ) {
      throw new BadRequestException(
        'Invalid second digest time format. Use HH:mm format.',
      );
    }

    // Validate digest days
    const validDays = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    const invalidDays = schedule.digest_days.filter(
      (day) => !validDays.includes(day),
    );

    if (invalidDays.length > 0) {
      throw new BadRequestException(
        `Invalid digest days: ${invalidDays.join(', ')}`,
      );
    }

    const settings = await this.userSettingsService.updateNotificationSchedule(
      user.id,
      schedule,
    );

    return {
      schedule: settings.notificationSchedule,
      message: 'Notification schedule updated successfully',
    };
  }

  /**
   * Get keywords
   */
  @Get('users/me/settings/keywords')
  @ApiOperation({ summary: 'Get notification keywords' })
  @ApiResponse({
    status: 200,
    description: 'Keywords for filtering notifications',
  })
  async getKeywords(@GetUser() user: User) {
    const keywords = await this.userSettingsService.getKeywords(user.id);
    return { keywords };
  }

  /**
   * Update keywords
   */
  @Put('users/me/settings/keywords')
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
      .filter(
        (keyword) => typeof keyword === 'string' && keyword.trim().length > 0,
      )
      .slice(0, 50); // Limit to 50 keywords

    const settings = await this.userSettingsService.updateKeywords(
      user.id,
      validKeywords,
    );

    return {
      keywords: settings.keywords,
      message: 'Keywords updated successfully',
    };
  }

  /**
   * Update stats time window
   */
  @Put('users/me/settings/stats-window')
  @ApiOperation({ summary: 'Update statistics time window' })
  @ApiResponse({ status: 200, description: 'Stats window updated' })
  async updateStatsTimeWindow(
    @GetUser() user: User,
    @Body() body: { timeWindow: number },
  ) {
    const { timeWindow } = body;

    if (!Number.isInteger(timeWindow) || timeWindow < 1 || timeWindow > 90) {
      throw new BadRequestException(
        'Time window must be an integer between 1 and 90 days',
      );
    }

    const settings = await this.userSettingsService.updateStatsTimeWindow(
      user.id,
      timeWindow,
    );

    return {
      statsTimeWindow: settings.statsTimeWindow,
      message: 'Statistics time window updated successfully',
    };
  }

  /**
   * Get repositories for settings page using /me
   */
  @Get('users/me/repositories')
  @ApiOperation({ summary: 'Get repositories for current user' })
  @ApiResponse({ status: 200, description: 'User repositories' })
  async getRepositoriesForMe(
    @GetUser() user: User,
    @Query('page') page: string = '1',
    @Query('page_size') pageSize: string = '10',
  ) {
    const repositories = await this.userRepositoriesService.getUserRepositories(
      user.id,
    );

    // Simple pagination
    const pageNum = parseInt(page, 10) || 1;
    const pageSizeNum = parseInt(pageSize, 10) || 10;
    const startIndex = (pageNum - 1) * pageSizeNum;
    const endIndex = startIndex + pageSizeNum;
    const paginatedRepos = repositories.slice(startIndex, endIndex);

    return {
      repositories: paginatedRepos.map((repo) => ({
        id: repo.id,
        githubId: repo.githubId,
        name: repo.name,
        fullName: repo.fullName,
        description: repo.description,
        url: repo.url,
        isPrivate: repo.isPrivate,
        isFork: repo.isFork,
        enabled: repo.enabled,
        isActive: repo.isActive,
        ownerName: repo.ownerName,
        ownerAvatarUrl: repo.ownerAvatarUrl,
        organization: repo.organization,
        createdAt: repo.createdAt,
        updatedAt: repo.updatedAt,
      })),
      pagination: {
        page: pageNum,
        page_size: pageSizeNum,
        total: repositories.length,
        has_next: endIndex < repositories.length,
        has_prev: pageNum > 1,
      },
    };
  }

  /**
   * Refresh repositories for current user
   */
  @Post('users/me/repositories/refresh')
  @ApiOperation({
    summary: 'Refresh repositories from GitHub for current user',
  })
  @ApiResponse({ status: 200, description: 'Repositories refreshed' })
  async refreshRepositoriesForMe(@GetUser() user: User) {
    // Note: In a real implementation, you'd need to get the user's GitHub access token
    // For now, we'll return a placeholder response
    this.logger.log(`Repository refresh requested for user ${user.id}`);

    return {
      success: false,
      message: 'Repository refresh requires GitHub access token integration',
      added: 0,
      updated: 0,
      total: 0,
    };
  }

  /**
   * Toggle repository for current user
   */
  @Patch('users/me/repositories/:repoId/toggle')
  @ApiOperation({ summary: 'Toggle repository notifications for current user' })
  @ApiResponse({ status: 200, description: 'Repository toggled' })
  async toggleRepositoryForMe(
    @GetUser() user: User,
    @Param('repoId') repoId: string,
    @Body() body: { enabled: boolean },
  ) {
    const repository =
      await this.userRepositoriesService.toggleRepositoryNotifications(
        user.id,
        repoId,
        body.enabled,
      );

    return {
      repository: {
        id: repository.id,
        name: repository.name,
        fullName: repository.fullName,
        enabled: repository.enabled,
      },
      message: `Notifications ${body.enabled ? 'enabled' : 'disabled'} for ${repository.fullName}`,
    };
  }

  /**
   * Toggle all repositories for current user
   */
  @Patch('users/me/repositories/toggle-all')
  @ApiOperation({
    summary: 'Toggle all repositories notifications for current user',
  })
  @ApiResponse({ status: 200, description: 'All repositories toggled' })
  async toggleAllRepositoriesForMe(
    @GetUser() user: User,
    @Body() body: { enabled: boolean },
  ) {
    // Get all repositories and toggle them
    const repositories = await this.userRepositoriesService.getUserRepositories(
      user.id,
    );
    const updatePromises = repositories.map((repo) =>
      this.userRepositoriesService.toggleRepositoryNotifications(
        user.id,
        repo.id,
        body.enabled,
      ),
    );

    await Promise.all(updatePromises);

    return {
      message: `Notifications ${body.enabled ? 'enabled' : 'disabled'} for all repositories`,
      count: repositories.length,
    };
  }
}
