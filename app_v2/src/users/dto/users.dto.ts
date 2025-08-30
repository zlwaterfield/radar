import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'User name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'User profile image URL' })
  @IsUrl()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({ description: 'Slack user ID' })
  @IsString()
  @IsOptional()
  slackId?: string;

  @ApiPropertyOptional({ description: 'Slack team ID' })
  @IsString()
  @IsOptional()
  slackTeamId?: string;

  @ApiPropertyOptional({ description: 'Encrypted Slack access token' })
  @IsString()
  @IsOptional()
  slackAccessToken?: string;

  @ApiPropertyOptional({ description: 'Encrypted Slack refresh token' })
  @IsString()
  @IsOptional()
  slackRefreshToken?: string;

  @ApiPropertyOptional({ description: 'GitHub user ID' })
  @IsString()
  @IsOptional()
  githubId?: string;

  @ApiPropertyOptional({ description: 'GitHub username' })
  @IsString()
  @IsOptional()
  githubLogin?: string;

  @ApiPropertyOptional({ description: 'Encrypted GitHub access token' })
  @IsString()
  @IsOptional()
  githubAccessToken?: string;

  @ApiPropertyOptional({ description: 'Encrypted GitHub refresh token' })
  @IsString()
  @IsOptional()
  githubRefreshToken?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'User name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'User email address' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'User profile image URL' })
  @IsUrl()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({ description: 'Whether the user account is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Slack team ID' })
  @IsString()
  @IsOptional()
  slackTeamId?: string;

  @ApiPropertyOptional({ description: 'GitHub username' })
  @IsString()
  @IsOptional()
  githubLogin?: string;
}

export class UserResponseDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User name' })
  name?: string;

  @ApiProperty({ description: 'User email address' })
  email?: string;

  @ApiProperty({ description: 'User profile image URL' })
  image?: string;

  @ApiProperty({ description: 'Whether the user account is active' })
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Slack user ID' })
  slackId?: string;

  @ApiPropertyOptional({ description: 'Slack team ID' })
  slackTeamId?: string;

  @ApiProperty({ description: 'GitHub user ID' })
  githubId?: string;

  @ApiProperty({ description: 'GitHub username' })
  githubLogin?: string;

  @ApiProperty({ description: 'Account creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Account last update date' })
  updatedAt: Date;
}
