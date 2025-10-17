export interface KeywordData {
  id?: string;
  term: string;
  llmEnabled: boolean;
  isEnabled: boolean;
  description?: string | null;
}

export interface KeywordWithMeta extends KeywordData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface KeywordMatchResult {
  matchedKeywords: string[];
  matchDetails: Record<string, string>;
  keywordIds: string[];
}
