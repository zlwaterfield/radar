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
  RepositoryFilter,
} from '../types/digest.types';
import type { NotificationPreferences } from '../types/user.types';

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
  @IsEnum(['user', 'team'])
  scopeType: DigestScopeType;

  @IsOptional()
  @IsString()
  scopeValue?: string; // null for user, teamId for team

  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  repositoryFilter: RepositoryFilter;

  @IsString()
  @IsEnum(['dm', 'channel'])
  deliveryType: DigestDeliveryType;

  @IsOptional()
  @IsString()
  deliveryTarget?: string; // null for DM, channelId for channel

  @IsObject()
  notificationPreferences: NotificationPreferences;

  @IsArray()
  @IsString({ each: true })
  keywords: string[];

  @IsBoolean()
  keywordLLMEnabled: boolean;

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
  @IsEnum(['user', 'team'])
  scopeType?: DigestScopeType;

  @IsOptional()
  @IsString()
  scopeValue?: string; // null for user, teamId for team

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  repositoryFilter?: RepositoryFilter;

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
  keywords?: string[];

  @IsOptional()
  @IsBoolean()
  keywordLLMEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;
}