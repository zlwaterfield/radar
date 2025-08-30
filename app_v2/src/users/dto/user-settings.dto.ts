import {
  IsObject,
  IsNumber,
  IsArray,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserSettingsDto {
  @ApiProperty({
    description: 'Notification preferences for different event types',
    example: {
      pull_request_opened: true,
      pull_request_closed: true,
      pull_request_merged: true,
      issue_opened: true,
    },
  })
  @IsObject()
  notificationPreferences: any;

  @ApiProperty({
    description: 'Notification schedule and timing preferences',
    example: {
      real_time: true,
      digest_time: '09:00',
      digest_enabled: true,
      digest_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
  })
  @IsObject()
  notificationSchedule: any;

  @ApiPropertyOptional({
    description: 'Time window for statistics in days (1-90)',
    example: 14,
    minimum: 1,
    maximum: 90,
  })
  @IsNumber()
  @Min(1)
  @Max(90)
  @IsOptional()
  statsTimeWindow?: number;

  @ApiPropertyOptional({
    description: 'Keyword preferences for filtering notifications',
    example: {
      enabled: true,
      keywords: ['enterprise'],
      threshold: 0.3
    },
  })
  @IsOptional()
  keywordPreferences?: any;
}

export class UpdateUserSettingsDto {
  @ApiPropertyOptional({
    description: 'Notification preferences for different event types',
    example: {
      pull_request_opened: true,
      pull_request_closed: true,
      pull_request_merged: true,
      issue_opened: true,
    },
  })
  @IsObject()
  @IsOptional()
  notificationPreferences?: any;

  @ApiPropertyOptional({
    description: 'Notification schedule and timing preferences',
    example: {
      real_time: true,
      digest_time: '09:00',
      digest_enabled: true,
      digest_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
  })
  @IsObject()
  @IsOptional()
  notificationSchedule?: any;

  @ApiPropertyOptional({
    description: 'Time window for statistics in days (1-90)',
    example: 14,
    minimum: 1,
    maximum: 90,
  })
  @IsNumber()
  @Min(1)
  @Max(90)
  @IsOptional()
  statsTimeWindow?: number;

  @ApiPropertyOptional({
    description: 'Keyword preferences for filtering notifications',
    example: {
      enabled: true,
      keywords: ['enterprise'],
      threshold: 0.3
    },
  })
  @IsOptional()
  keywordPreferences?: any;
}

export class NotificationPreferencesDto {
  @ApiProperty({ description: 'Notify on pull request opened' })
  pull_request_opened!: boolean;

  @ApiProperty({ description: 'Notify on pull request closed' })
  pull_request_closed!: boolean;

  @ApiProperty({ description: 'Notify on pull request merged' })
  pull_request_merged!: boolean;

  @ApiProperty({ description: 'Notify on pull request reviewed' })
  pull_request_reviewed!: boolean;

  @ApiProperty({ description: 'Notify on pull request commented' })
  pull_request_commented!: boolean;

  @ApiProperty({ description: 'Notify on pull request assigned' })
  pull_request_assigned!: boolean;

  @ApiProperty({ description: 'Notify on issue opened' })
  issue_opened!: boolean;

  @ApiProperty({ description: 'Notify on issue closed' })
  issue_closed!: boolean;

  @ApiProperty({ description: 'Notify on issue commented' })
  issue_commented!: boolean;

  @ApiProperty({ description: 'Notify on issue assigned' })
  issue_assigned!: boolean;
}

export class NotificationScheduleDto {
  @ApiProperty({ description: 'Enable real-time notifications' })
  real_time!: boolean;

  @ApiProperty({ description: 'Time for daily digest (HH:mm format)' })
  digest_time!: string;

  @ApiProperty({ description: 'Enable daily digest' })
  digest_enabled!: boolean;

  @ApiProperty({
    description: 'Days of week for digest',
    example: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  })
  digest_days!: string[];

  @ApiPropertyOptional({
    description: 'Time for second daily digest (HH:mm format)',
  })
  second_digest_time?: string;

  @ApiPropertyOptional({ description: 'Enable second daily digest' })
  second_digest_enabled?: boolean;
}

export class UserSettingsResponseDto {
  @ApiProperty({ description: 'Settings ID' })
  id!: string;

  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({
    description: 'Notification preferences',
    type: NotificationPreferencesDto,
  })
  notificationPreferences!: NotificationPreferencesDto;

  @ApiProperty({
    description: 'Notification schedule',
    type: NotificationScheduleDto,
  })
  notificationSchedule!: NotificationScheduleDto;

  @ApiProperty({ description: 'Statistics time window in days' })
  statsTimeWindow!: number;

  @ApiProperty({
    description: 'Keyword preferences for filtering',
    example: {
      enabled: true,
      keywords: ['enterprise'],
      threshold: 0.3
    },
  })
  keywordPreferences!: any;

  @ApiProperty({ description: 'Settings creation date' })
  createdAt!: Date;

  @ApiProperty({ description: 'Settings last update date' })
  updatedAt!: Date;
}
