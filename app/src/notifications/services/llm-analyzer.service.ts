import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';

interface KeywordMatchResponse {
  matched_keywords: string[];
  match_details: Record<string, string>;
}

@Injectable()
export class LLMAnalyzerService {
  private readonly logger = new Logger(LLMAnalyzerService.name);
  private readonly llmApiKey: string;
  private readonly llmModel = 'gpt-4o-mini';
  private readonly llmApiUrl = 'https://api.openai.com/v1/chat/completions';

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    this.llmApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
  }

  /**
   * Match keywords using LLM API
   */
  async matchKeywordsWithLLM(
    content: string,
    keywords: string[],
  ): Promise<{
    matchedKeywords: string[];
    matchDetails: Record<string, string>;
  }> {
    this.logger.debug(
      `Matching keywords with LLM - Content length: ${content.length}, Keywords: ${keywords}`,
    );

    if (!this.llmApiKey) {
      this.logger.error('LLM API key not set, cannot perform keyword matching');
      return { matchedKeywords: [], matchDetails: {} };
    }

    if (!keywords.length) {
      this.logger.debug('No keywords provided, returning empty results');
      return { matchedKeywords: [], matchDetails: {} };
    }

    try {
      // Prepare the prompt for OpenAI
      const prompt = `I have a piece of content and a list of keywords. Please determine if any of the keywords are present or closely related to the content. Return ONLY the matched keywords.

Content: ${content}

Keywords: ${keywords.join(', ')}

Return your response as a JSON object with the following format:
{
  "matched_keywords": ["keyword1", "keyword2"],
  "match_details": {
    "keyword1": "Exact match found",
    "keyword2": "Related to content because..."
  }
}

If no keywords match, return an empty list for matched_keywords.`;

      this.logger.debug(
        `LLM request: content length ${content.length}, keywords: ${keywords}`,
      );

      const response = await fetch(this.llmApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.llmApiKey}`,
        },
        body: JSON.stringify({
          model: this.llmModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        this.logger.error(
          `LLM API ERROR: Status ${response.status}, Response: ${await response.text()}`,
        );
        return { matchedKeywords: [], matchDetails: {} };
      }

      const responseData = await response.json();
      const responseContent = responseData.choices?.[0]?.message?.content;

      this.logger.debug(
        `LLM response received: ${responseContent?.length || 0} characters`,
      );

      // Parse the JSON response
      try {
        const result: KeywordMatchResponse = JSON.parse(responseContent);
        const matchedKeywords = result.matched_keywords || [];
        const matchDetails = result.match_details || {};

        this.logger.log(
          `LLM keyword matching results - Matched: ${matchedKeywords}, Details: ${JSON.stringify(matchDetails)}`,
        );

        return { matchedKeywords, matchDetails };
      } catch (parseError) {
        this.logger.error(`Failed to parse LLM response: ${responseContent}`);
        return { matchedKeywords: [], matchDetails: {} };
      }
    } catch (error) {
      this.logger.error(`Error using LLM for keyword matching: ${error}`);
      return { matchedKeywords: [], matchDetails: {} };
    }
  }

  /**
   * Analyze content against user's keywords
   */
  async analyzeContent(
    content: string,
    userId: string,
  ): Promise<{
    shouldNotify: boolean;
    matchedKeywords: string[];
    matchDetails: Record<string, string>;
  }> {
    try {
      this.logger.debug(
        `Analyzing content for user ${userId} - Content length: ${content.length}`,
      );

      // Get user settings
      const settings = await this.databaseService.userSettings.findUnique({
        where: { userId },
      });

      if (!settings) {
        this.logger.debug(`No settings found for user ${userId}`);
        return { shouldNotify: false, matchedKeywords: [], matchDetails: {} };
      }

      // Get keyword preferences
      const keywordPrefs = (settings.keywordPreferences as any) || {};

      // Extract keyword settings
      const keywordNotificationsEnabled = keywordPrefs.enabled || false;
      const keywords = keywordPrefs.keywords || [];
      const threshold = keywordPrefs.threshold || 0.7;

      this.logger.log(
        `Keyword check for user ${userId}: enabled=${keywordNotificationsEnabled}, keywords=${keywords.length}, threshold=${threshold}`,
      );

      // Check if keyword notifications are enabled
      if (!keywordNotificationsEnabled) {
        this.logger.debug(`Keyword notifications disabled for user ${userId}`);
        return { shouldNotify: false, matchedKeywords: [], matchDetails: {} };
      }

      // Check if user has keywords
      if (!keywords.length) {
        this.logger.debug(`No keywords configured for user ${userId}`);
        return { shouldNotify: false, matchedKeywords: [], matchDetails: {} };
      }

      // Use LLM for keyword matching
      this.logger.debug(`Using LLM semantic matching for keyword analysis`);
      const { matchedKeywords, matchDetails } = await this.matchKeywordsWithLLM(
        content,
        keywords,
      );

      // Determine if notification should be sent
      const shouldNotify = matchedKeywords.length > 0;

      this.logger.log(
        `Content analysis complete for user ${userId} - Should notify: ${shouldNotify}, Matched keywords: ${matchedKeywords}`,
      );

      return { shouldNotify, matchedKeywords, matchDetails };
    } catch (error) {
      this.logger.error(`Error analyzing content: ${error}`);
      return { shouldNotify: false, matchedKeywords: [], matchDetails: {} };
    }
  }
}
