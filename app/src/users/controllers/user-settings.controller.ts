import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserSettingsService } from '../services/user-settings.service';
import {
  UpdateUserSettingsDto,
  UserSettingsResponseDto,
} from '../dto/user-settings.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { GetUser } from '../../auth/decorators/user.decorator';
import type { User } from '@prisma/client';
import {
  validateNotificationPreferences,
  validateNotificationSchedule,
  createDefaultNotificationPreferences,
  createDefaultNotificationSchedule,
} from '../../common/utils/json-validation.util';

@ApiTags('user-settings')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthGuard)
export class UserSettingsController {
  private readonly logger = new Logger(UserSettingsController.name);

  constructor(private readonly userSettingsService: UserSettingsService) {}

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
          keywordPreferences: { enabled: false, keywords: [], threshold: 0.3 },
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
        keywordPreferences: defaultSettings.keywordPreferences,
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
      keywordPreferences: settings.keywordPreferences,
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
    // Only update fields that are provided in the request
    const updateFields: any = {};

    if (updateData.notificationPreferences !== undefined) {
      updateFields.notificationPreferences = updateData.notificationPreferences;
    }

    if (updateData.notificationSchedule !== undefined) {
      updateFields.notificationSchedule = updateData.notificationSchedule;
    }

    if (updateData.statsTimeWindow !== undefined) {
      updateFields.statsTimeWindow = updateData.statsTimeWindow;
    }

    if (updateData.keywordPreferences !== undefined) {
      updateFields.keywordPreferences = updateData.keywordPreferences;
    }

    const settings = await this.userSettingsService.upsertUserSettings(
      user.id,
      updateFields,
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
      keywordPreferences: settings.keywordPreferences,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Create/update user settings (POST endpoint for compatibility)
   */
  @Post('users/me/settings')
  @ApiOperation({ summary: 'Create or update user settings' })
  @ApiResponse({
    status: 200,
    description: 'Settings created/updated',
    type: UserSettingsResponseDto,
  })
  async createOrUpdateUserSettings(
    @GetUser() user: User,
    @Body() updateData: UpdateUserSettingsDto,
  ): Promise<UserSettingsResponseDto> {
    // Delegate to the PUT method
    return this.updateUserSettings(user, updateData);
  }
}
