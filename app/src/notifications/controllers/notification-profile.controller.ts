import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { GetUser } from '../../auth/decorators/user.decorator';
import { NotificationProfileService } from '../services/notification-profile.service';
import {
  CreateNotificationProfileDto,
  UpdateNotificationProfileDto,
} from '../../common/dtos/notification-profile.dto';
import type { NotificationProfileWithMeta } from '../../common/types/notification-profile.types';

@Controller('notification-profiles')
@UseGuards(AuthGuard)
export class NotificationProfileController {
  constructor(
    private readonly notificationProfileService: NotificationProfileService,
  ) {}

  /**
   * Get all notification profiles for the current user
   */
  @Get()
  async getUserNotificationProfiles(
    @GetUser('id') userId: string,
  ): Promise<NotificationProfileWithMeta[]> {
    return this.notificationProfileService.getUserNotificationProfiles(userId);
  }

  /**
   * Get a specific notification profile
   */
  @Get(':id')
  async getNotificationProfile(
    @Param('id') profileId: string,
    @GetUser('id') userId: string,
  ): Promise<NotificationProfileWithMeta> {
    return this.notificationProfileService.getNotificationProfile(
      profileId,
      userId,
    );
  }

  /**
   * Create a new notification profile
   */
  @Post()
  async createNotificationProfile(
    @Body() createDto: CreateNotificationProfileDto,
    @GetUser('id') userId: string,
  ): Promise<NotificationProfileWithMeta> {
    return this.notificationProfileService.createNotificationProfile(
      userId,
      createDto,
    );
  }

  /**
   * Update a notification profile
   */
  @Put(':id')
  async updateNotificationProfile(
    @Param('id') profileId: string,
    @Body() updateDto: UpdateNotificationProfileDto,
    @GetUser('id') userId: string,
  ): Promise<NotificationProfileWithMeta> {
    return this.notificationProfileService.updateNotificationProfile(
      profileId,
      userId,
      updateDto,
    );
  }

  /**
   * Delete a notification profile
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotificationProfile(
    @Param('id') profileId: string,
    @GetUser('id') userId: string,
  ): Promise<void> {
    return this.notificationProfileService.deleteNotificationProfile(
      profileId,
      userId,
    );
  }

  /**
   * Create default profile from existing settings (migration helper)
   */
  @Post('migrate-from-settings')
  async createDefaultFromSettings(
    @GetUser('id') userId: string,
  ): Promise<NotificationProfileWithMeta | null> {
    return this.notificationProfileService.createDefaultProfileFromSettings(
      userId,
    );
  }
}
