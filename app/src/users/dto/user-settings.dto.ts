import {
  IsObject,
  IsNumber,
  IsArray,
  IsOptional,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  NotificationPreferencesDto,
  NotificationScheduleDto,
} from '../../common/dtos/update-user-settings.dto';

export class CreateUserSettingsDto {
  @ApiProperty({
    description: 'Notification preferences for different event types',
    type: NotificationPreferencesDto,
  })
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notificationPreferences: NotificationPreferencesDto;

  @ApiProperty({
    description: 'Notification schedule and timing preferences',
    type: NotificationScheduleDto,
  })
  @ValidateNested()
  @Type(() => NotificationScheduleDto)
  notificationSchedule: NotificationScheduleDto;

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
      threshold: 0.3,
    },
  })
  @IsOptional()
  keywordPreferences?: any;
}

export class UpdateUserSettingsDto {
  @ApiPropertyOptional({
    description: 'Notification preferences for different event types',
    type: NotificationPreferencesDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notificationPreferences?: NotificationPreferencesDto;

  @ApiPropertyOptional({
    description: 'Notification schedule and timing preferences',
    type: NotificationScheduleDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationScheduleDto)
  notificationSchedule?: NotificationScheduleDto;

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
      threshold: 0.3,
    },
  })
  @IsOptional()
  keywordPreferences?: any;
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
      threshold: 0.3,
    },
  })
  keywordPreferences!: any;

  @ApiProperty({ description: 'Settings creation date' })
  createdAt!: Date;

  @ApiProperty({ description: 'Settings last update date' })
  updatedAt!: Date;
}
