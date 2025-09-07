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
      // Prepare the prompt for OpenAI with structured output
      const prompt = `Analyze the following content and determine if any of the provided keywords are present, mentioned, or closely related to the content. Look for:
- Exact matches of the keyword
- Similar terms, synonyms, or related concepts
- Context where the keyword's meaning is implied or discussed
- Technical variations or abbreviations of the keyword

Content: ${content}

Keywords to check: ${keywords.join(', ')}

For each matched keyword, provide a brief explanation of why it matches (exact match, similar term, related concept, etc.).`;

      // Define the JSON schema for structured output
      const responseFormat = {
        type: "json_schema",
        json_schema: {
          name: "keyword_match_response",
          schema: {
            type: "object",
            properties: {
              matched_keywords: {
                type: "array",
                items: { type: "string" },
                description: "List of keywords that match or are closely related to the content"
              },
              match_details: {
                type: "object",
                additionalProperties: { type: "string" },
                description: "Details explaining why each keyword matched"
              }
            },
            required: ["matched_keywords", "match_details"],
            additionalProperties: false
          }
        }
      };

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
          response_format: responseFormat,
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

      // Parse the structured JSON response
      try {
        const result: KeywordMatchResponse = JSON.parse(responseContent);
        const matchedKeywords = result.matched_keywords || [];
        const matchDetails = result.match_details || {};

        this.logger.log(
          `LLM keyword matching results - Matched: ${matchedKeywords}, Details: ${JSON.stringify(matchDetails)}`,
        );

        return { matchedKeywords, matchDetails };
      } catch (parseError) {
        this.logger.error(`Failed to parse structured LLM response: ${responseContent}`, parseError);
        return { matchedKeywords: [], matchDetails: {} };
      }
    } catch (error) {
      this.logger.error(`Error using LLM for keyword matching: ${error}`);
      return { matchedKeywords: [], matchDetails: {} };
    }
  }
}
