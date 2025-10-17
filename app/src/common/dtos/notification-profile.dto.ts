import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsObject,
  ValidateNested,
  IsArray,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type {
  DigestScopeType,
  DigestDeliveryType,
} from '../types/digest.types';
import type { NotificationPreferences } from '../types/user.types';

export class RepositoryFilterDto {
  @IsString()
  @IsEnum(['all', 'selected'])
  type: 'all' | 'selected';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  repoIds?: string[];
}

export class CreateNotificationProfileDto {
  @IsString()
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsBoolean()
  isEnabled: boolean;

  @IsString()
  @IsEnum(['user', 'team', 'user_and_teams'])
  scopeType: DigestScopeType;

  @IsOptional()
  @IsString()
  scopeValue?: string; // null for user, teamId for team

  @IsObject()
  @ValidateNested()
  @Type(() => RepositoryFilterDto)
  repositoryFilter: RepositoryFilterDto;

  @IsString()
  @IsEnum(['dm', 'channel'])
  deliveryType: DigestDeliveryType;

  @IsOptional()
  @IsString()
  deliveryTarget?: string; // null for DM, channelId for channel

  @IsObject()
  notificationPreferences: NotificationPreferences;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywordIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;
}

export class UpdateNotificationProfileDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsString()
  @IsEnum(['user', 'team', 'user_and_teams'])
  scopeType?: DigestScopeType;

  @IsOptional()
  @IsString()
  scopeValue?: string; // null for user, teamId for team

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RepositoryFilterDto)
  repositoryFilter?: RepositoryFilterDto;

  @IsOptional()
  @IsString()
  @IsEnum(['dm', 'channel'])
  deliveryType?: DigestDeliveryType;

  @IsOptional()
  @IsString()
  deliveryTarget?: string; // null for DM, channelId for channel

  @IsOptional()
  @IsObject()
  notificationPreferences?: NotificationPreferences;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywordIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;
}
