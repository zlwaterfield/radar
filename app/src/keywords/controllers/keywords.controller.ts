import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { CurrentUser } from '../../auth/decorators/user.decorator';
import { KeywordService } from '../services/keyword.service';
import { CreateKeywordDto, UpdateKeywordDto } from '../../common/dtos/keyword.dto';

@Controller('keywords')
@UseGuards(AuthGuard)
export class KeywordsController {
  constructor(private readonly keywordService: KeywordService) {}

  @Get()
  async getUserKeywords(@CurrentUser('id') userId: string) {
    return this.keywordService.getKeywordsByUser(userId);
  }

  @Get(':id')
  async getKeyword(
    @CurrentUser('id') userId: string,
    @Param('id') keywordId: string,
  ) {
    return this.keywordService.getKeywordById(userId, keywordId);
  }

  @Post()
  async createKeyword(
    @CurrentUser('id') userId: string,
    @Body() createKeywordDto: CreateKeywordDto,
  ) {
    return this.keywordService.createKeyword(userId, createKeywordDto);
  }

  @Patch(':id')
  async updateKeyword(
    @CurrentUser('id') userId: string,
    @Param('id') keywordId: string,
    @Body() updateKeywordDto: UpdateKeywordDto,
  ) {
    return this.keywordService.updateKeyword(userId, keywordId, updateKeywordDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteKeyword(
    @CurrentUser('id') userId: string,
    @Param('id') keywordId: string,
  ) {
    await this.keywordService.deleteKeyword(userId, keywordId);
  }

  @Post(':id/toggle')
  async toggleKeyword(
    @CurrentUser('id') userId: string,
    @Param('id') keywordId: string,
    @Body('enabled') enabled: boolean,
  ) {
    return this.keywordService.toggleKeywordEnabled(userId, keywordId, enabled);
  }
}
