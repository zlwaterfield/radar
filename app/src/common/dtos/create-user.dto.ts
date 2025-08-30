import { IsOptional, IsString, IsEmail, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiPropertyOptional({ description: 'User display name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'User email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'User profile image URL' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiProperty({ description: 'Slack user ID' })
  @IsString()
  slackId!: string;

  @ApiProperty({ description: 'Slack team ID' })
  @IsString()
  slackTeamId!: string;

  @ApiPropertyOptional({ description: 'GitHub user ID' })
  @IsOptional()
  @IsString()
  githubId?: string;

  @ApiPropertyOptional({ description: 'GitHub username' })
  @IsOptional()
  @IsString()
  githubLogin?: string;

  @ApiPropertyOptional({
    description: 'Whether user account is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
