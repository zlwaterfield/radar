import {
  IsOptional,
  IsObject,
  IsInt,
  IsArray,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import type {
  NotificationPreferences,
  NotificationSchedule,
} from '../types/user.types';

export class UpdateUserSettingsDto {
  @ApiPropertyOptional({
    description: 'Notification preferences object',
    example: {
      pull_request_opened: true,
      pull_request_closed: true,
      issue_opened: true,
      issue_commented: false,
    },
  })
  @IsOptional()
  @IsObject()
  notificationPreferences?: NotificationPreferences;

  @ApiPropertyOptional({
    description: 'Notification schedule configuration',
    example: {
      real_time: true,
      digest_enabled: true,
      digest_time: '09:00',
      digest_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      second_digest_enabled: false,
    },
  })
  @IsOptional()
  @IsObject()
  notificationSchedule?: NotificationSchedule;

  @ApiPropertyOptional({
    description: 'Stats time window in days',
    example: 14,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  statsTimeWindow?: number;

  @ApiPropertyOptional({
    description: 'Keywords for filtering notifications',
    example: ['urgent', 'bug', 'feature'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : []))
  keywords?: string[];
}
