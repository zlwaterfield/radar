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

export class RepositoryFilterDto {
  @IsString()
  @IsEnum(['all', 'selected'])
  type: 'all' | 'selected';

  @IsOptional()
  @IsString({ each: true })
  repoIds?: string[];
}

export class CreateDigestConfigDto {
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
  digestTime: string; // HH:MM format

  @IsString()
  timezone: string;

  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek: number[]; // 0=Sunday, 6=Saturday

  @IsString()
  @IsEnum(['user', 'team'])
  scopeType: DigestScopeType;

  @IsOptional()
  @IsString()
  scopeValue?: string; // null for user, teamId for team

  @IsObject()
  @ValidateNested()
  @Type(() => RepositoryFilterDto)
  repositoryFilter: RepositoryFilter;

  @IsString()
  @IsEnum(['dm', 'channel', 'email'])
  deliveryType: DigestDeliveryType;

  @IsOptional()
  @IsString()
  deliveryTarget?: string; // null for DM/email, channelId for channel
}

export class UpdateDigestConfigDto {
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
  digestTime?: string; // HH:MM format

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[]; // 0=Sunday, 6=Saturday

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
  @Type(() => RepositoryFilterDto)
  repositoryFilter?: RepositoryFilter;

  @IsOptional()
  @IsString()
  @IsEnum(['dm', 'channel', 'email'])
  deliveryType?: DigestDeliveryType;

  @IsOptional()
  @IsString()
  deliveryTarget?: string; // null for DM/email, channelId for channel
}
