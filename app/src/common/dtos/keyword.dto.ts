import {
  IsString,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateKeywordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  term: string;

  @IsBoolean()
  @IsOptional()
  llmEnabled?: boolean = true;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean = true;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

export class UpdateKeywordDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  term?: string;

  @IsBoolean()
  @IsOptional()
  llmEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

export class KeywordResponseDto {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  term: string;
  llmEnabled: boolean;
  isEnabled: boolean;
  description?: string | null;
}
