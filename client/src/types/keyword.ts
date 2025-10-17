export interface Keyword {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  term: string;
  llmEnabled: boolean;
  isEnabled: boolean;
  description?: string | null;
}

export interface CreateKeywordData {
  term: string;
  llmEnabled: boolean;
  isEnabled: boolean;
  description?: string;
}

export interface UpdateKeywordData {
  term?: string;
  llmEnabled: boolean;
  isEnabled: boolean;
  description?: string;
}
