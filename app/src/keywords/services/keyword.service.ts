import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { EntitlementsService } from '../../stripe/services/entitlements.service';
import type { KeywordWithMeta } from '../../common/types/keyword.types';
import type { CreateKeywordDto, UpdateKeywordDto } from '../../common/dtos/keyword.dto';

@Injectable()
export class KeywordService {
  private readonly logger = new Logger(KeywordService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  /**
   * Get all keywords for a user
   */
  async getKeywordsByUser(userId: string): Promise<KeywordWithMeta[]> {
    const keywords = await this.databaseService.keyword.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return keywords;
  }

  /**
   * Get a specific keyword by ID
   */
  async getKeywordById(userId: string, keywordId: string): Promise<KeywordWithMeta> {
    const keyword = await this.databaseService.keyword.findFirst({
      where: {
        id: keywordId,
        userId,
      },
    });

    if (!keyword) {
      throw new NotFoundException(`Keyword ${keywordId} not found`);
    }

    return keyword;
  }

  /**
   * Create a new keyword
   */
  async createKeyword(
    userId: string,
    data: CreateKeywordDto,
  ): Promise<KeywordWithMeta> {
    // Check keyword limit
    const currentKeywordCount = await this.databaseService.keyword.count({
      where: { userId },
    });

    const limitCheck = await this.entitlementsService.checkLimit(
      userId,
      'keyword_limit',
      currentKeywordCount,
    );

    if (!limitCheck.allowed) {
      throw new BadRequestException(
        `Keyword limit reached. You have ${limitCheck.current} of ${limitCheck.limit} keywords. Upgrade your plan to add more.`,
      );
    }

    // If LLM is requested, check AI keyword matching entitlement
    if (data.llmEnabled) {
      const hasAIMatching = await this.entitlementsService.hasFeature(
        userId,
        'ai_keyword_matching',
      );

      if (!hasAIMatching) {
        throw new BadRequestException(
          'AI keyword matching not available in your plan. Try using regex matching instead.',
        );
      }
    }

    // Check if term already exists for this user
    const existingKeyword = await this.databaseService.keyword.findFirst({
      where: {
        userId,
        term: data.term,
      },
    });

    if (existingKeyword) {
      throw new BadRequestException(
        `Keyword "${data.term}" already exists`,
      );
    }

    const keyword = await this.databaseService.keyword.create({
      data: {
        userId,
        term: data.term,
        llmEnabled: data.llmEnabled ?? true,
        isEnabled: data.isEnabled ?? true,
        description: data.description,
      },
    });

    this.logger.log(`Created keyword ${keyword.id} for user ${userId}`);
    return keyword;
  }

  /**
   * Update a keyword
   */
  async updateKeyword(
    userId: string,
    keywordId: string,
    data: UpdateKeywordDto,
  ): Promise<KeywordWithMeta> {
    // Verify keyword exists and belongs to user
    await this.getKeywordById(userId, keywordId);

    // If enabling LLM, check entitlement
    if (data.llmEnabled === true) {
      const hasAIMatching = await this.entitlementsService.hasFeature(
        userId,
        'ai_keyword_matching',
      );

      if (!hasAIMatching) {
        throw new BadRequestException(
          'AI keyword matching not available in your plan',
        );
      }
    }

    // If changing term, check for duplicates
    if (data.term) {
      const existingKeyword = await this.databaseService.keyword.findFirst({
        where: {
          userId,
          term: data.term,
          id: { not: keywordId },
        },
      });

      if (existingKeyword) {
        throw new BadRequestException(
          `Keyword "${data.term}" already exists`,
        );
      }
    }

    const keyword = await this.databaseService.keyword.update({
      where: { id: keywordId },
      data: {
        term: data.term,
        llmEnabled: data.llmEnabled,
        isEnabled: data.isEnabled,
        description: data.description,
      },
    });

    this.logger.log(`Updated keyword ${keywordId} for user ${userId}`);
    return keyword;
  }

  /**
   * Delete a keyword
   */
  async deleteKeyword(userId: string, keywordId: string): Promise<void> {
    // Verify keyword exists and belongs to user
    await this.getKeywordById(userId, keywordId);

    await this.databaseService.keyword.delete({
      where: { id: keywordId },
    });

    this.logger.log(`Deleted keyword ${keywordId} for user ${userId}`);
  }

  /**
   * Toggle keyword enabled status
   */
  async toggleKeywordEnabled(
    userId: string,
    keywordId: string,
    enabled: boolean,
  ): Promise<KeywordWithMeta> {
    // Verify keyword exists and belongs to user
    await this.getKeywordById(userId, keywordId);

    const keyword = await this.databaseService.keyword.update({
      where: { id: keywordId },
      data: { isEnabled: enabled },
    });

    this.logger.log(
      `Toggled keyword ${keywordId} to ${enabled ? 'enabled' : 'disabled'} for user ${userId}`,
    );
    return keyword;
  }

  /**
   * Get keywords for a specific profile via junction table
   */
  async getKeywordsForProfile(profileId: string): Promise<KeywordWithMeta[]> {
    const profileKeywords = await this.databaseService.profileKeyword.findMany({
      where: { profileId },
      include: { keyword: true },
    });

    return profileKeywords.map((pk) => pk.keyword);
  }

  /**
   * Attach keyword to profile
   */
  async attachKeywordToProfile(
    userId: string,
    profileId: string,
    keywordId: string,
  ): Promise<void> {
    // Verify keyword belongs to user
    await this.getKeywordById(userId, keywordId);

    // Verify profile belongs to user
    const profile = await this.databaseService.notificationProfile.findFirst({
      where: {
        id: profileId,
        userId,
      },
    });

    if (!profile) {
      throw new NotFoundException(`Profile ${profileId} not found`);
    }

    // Check if already attached
    const existing = await this.databaseService.profileKeyword.findFirst({
      where: {
        profileId,
        keywordId,
      },
    });

    if (existing) {
      return; // Already attached, no-op
    }

    await this.databaseService.profileKeyword.create({
      data: {
        profileId,
        keywordId,
      },
    });

    this.logger.log(
      `Attached keyword ${keywordId} to profile ${profileId} for user ${userId}`,
    );
  }

  /**
   * Detach keyword from profile
   */
  async detachKeywordFromProfile(
    userId: string,
    profileId: string,
    keywordId: string,
  ): Promise<void> {
    // Verify profile belongs to user
    const profile = await this.databaseService.notificationProfile.findFirst({
      where: {
        id: profileId,
        userId,
      },
    });

    if (!profile) {
      throw new NotFoundException(`Profile ${profileId} not found`);
    }

    await this.databaseService.profileKeyword.deleteMany({
      where: {
        profileId,
        keywordId,
      },
    });

    this.logger.log(
      `Detached keyword ${keywordId} from profile ${profileId} for user ${userId}`,
    );
  }

  /**
   * Sync keywords for a profile - replaces all associations
   */
  async syncKeywordsForProfile(
    userId: string,
    profileId: string,
    keywordIds: string[],
  ): Promise<void> {
    // Verify profile belongs to user
    const profile = await this.databaseService.notificationProfile.findFirst({
      where: {
        id: profileId,
        userId,
      },
    });

    if (!profile) {
      throw new NotFoundException(`Profile ${profileId} not found`);
    }

    // Verify all keywords belong to user
    if (keywordIds.length > 0) {
      const keywords = await this.databaseService.keyword.findMany({
        where: {
          id: { in: keywordIds },
          userId,
        },
      });

      if (keywords.length !== keywordIds.length) {
        throw new BadRequestException('Some keywords do not belong to user');
      }
    }

    // Delete all existing associations
    await this.databaseService.profileKeyword.deleteMany({
      where: { profileId },
    });

    // Create new associations
    if (keywordIds.length > 0) {
      await this.databaseService.profileKeyword.createMany({
        data: keywordIds.map((keywordId) => ({
          profileId,
          keywordId,
        })),
      });
    }

    this.logger.log(
      `Synced ${keywordIds.length} keywords for profile ${profileId} for user ${userId}`,
    );
  }
}
