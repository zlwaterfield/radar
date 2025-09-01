import {
  IsOptional,
  IsObject,
  IsInt,
  IsArray,
  IsString,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import type {
  NotificationPreferences,
  NotificationSchedule,
} from '../types/user.types';

export class NotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'Notify on pull request opened' })
  @IsOptional()
  @IsBoolean()
  pull_request_opened?: boolean;

  @ApiPropertyOptional({ description: 'Notify on pull request closed' })
  @IsOptional()
  @IsBoolean()
  pull_request_closed?: boolean;

  @ApiPropertyOptional({ description: 'Notify on pull request merged' })
  @IsOptional()
  @IsBoolean()
  pull_request_merged?: boolean;

  @ApiPropertyOptional({ description: 'Notify on pull request reviewed' })
  @IsOptional()
  @IsBoolean()
  pull_request_reviewed?: boolean;

  @ApiPropertyOptional({ description: 'Notify on pull request commented' })
  @IsOptional()
  @IsBoolean()
  pull_request_commented?: boolean;

  @ApiPropertyOptional({ description: 'Notify on pull request assigned' })
  @IsOptional()
  @IsBoolean()
  pull_request_assigned?: boolean;

  @ApiPropertyOptional({ description: 'Notify on issue opened' })
  @IsOptional()
  @IsBoolean()
  issue_opened?: boolean;

  @ApiPropertyOptional({ description: 'Notify on issue closed' })
  @IsOptional()
  @IsBoolean()
  issue_closed?: boolean;

  @ApiPropertyOptional({ description: 'Notify on issue commented' })
  @IsOptional()
  @IsBoolean()
  issue_commented?: boolean;

  @ApiPropertyOptional({ description: 'Notify on issue assigned' })
  @IsOptional()
  @IsBoolean()
  issue_assigned?: boolean;

  @ApiPropertyOptional({ description: 'Notify on CI check failures' })
  @IsOptional()
  @IsBoolean()
  check_failures?: boolean;

  @ApiPropertyOptional({ description: 'Notify on CI check successes' })
  @IsOptional()
  @IsBoolean()
  check_successes?: boolean;

  @ApiPropertyOptional({ description: 'Notify when mentioned in comments' })
  @IsOptional()
  @IsBoolean()
  mention_in_comment?: boolean;

  @ApiPropertyOptional({
    description: 'Notify when mentioned in pull requests',
  })
  @IsOptional()
  @IsBoolean()
  mention_in_pull_request?: boolean;

  @ApiPropertyOptional({ description: 'Notify when mentioned in issues' })
  @IsOptional()
  @IsBoolean()
  mention_in_issue?: boolean;

  @ApiPropertyOptional({ description: 'General mention notifications' })
  @IsOptional()
  @IsBoolean()
  mentioned_in_comments?: boolean;

  @ApiPropertyOptional({ description: 'Mute notifications for own activity' })
  @IsOptional()
  @IsBoolean()
  mute_own_activity?: boolean;

  @ApiPropertyOptional({ description: 'Mute notifications from bot comments' })
  @IsOptional()
  @IsBoolean()
  mute_bot_comments?: boolean;

  @ApiPropertyOptional({
    description: 'Mute notifications for draft pull requests',
  })
  @IsOptional()
  @IsBoolean()
  mute_draft_pull_requests?: boolean;
}

export class NotificationScheduleDto {
  @ApiPropertyOptional({ description: 'Enable real-time notifications' })
  @IsOptional()
  @IsBoolean()
  real_time?: boolean;

  @ApiPropertyOptional({ description: 'Enable daily digest' })
  @IsOptional()
  @IsBoolean()
  digest_enabled?: boolean;

  @ApiPropertyOptional({ description: 'Time for daily digest (HH:mm format)' })
  @IsOptional()
  @IsString()
  digest_time?: string;

  @ApiPropertyOptional({
    description: 'Days of week for digest',
    example: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  digest_days?: string[];

  @ApiPropertyOptional({ description: 'Enable second daily digest' })
  @IsOptional()
  @IsBoolean()
  second_digest_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Time for second daily digest (HH:mm format)',
  })
  @IsOptional()
  @IsString()
  second_digest_time?: string;
}

export class UpdateUserSettingsDto {
  @ApiPropertyOptional({
    description: 'Notification preferences object',
    type: NotificationPreferencesDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notificationPreferences?: NotificationPreferencesDto;

  @ApiPropertyOptional({
    description: 'Notification schedule configuration',
    type: NotificationScheduleDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationScheduleDto)
  notificationSchedule?: NotificationScheduleDto;

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
