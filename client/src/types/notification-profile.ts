import type { DigestScopeType, DigestDeliveryType, RepositoryFilter } from './digest';

export interface NotificationPreferences {
  // PR Activity
  pull_request_opened?: boolean;
  pull_request_closed?: boolean;
  pull_request_merged?: boolean;
  pull_request_reviewed?: boolean;
  pull_request_commented?: boolean;
  pull_request_assigned?: boolean;
  pull_request_review_requested?: boolean;

  // Issue Activity
  issue_opened?: boolean;
  issue_closed?: boolean;
  issue_commented?: boolean;
  issue_assigned?: boolean;

  // CI/CD
  check_failures?: boolean;
  check_successes?: boolean;

  // Mentions
  mention_in_comment?: boolean;
  mention_in_pull_request?: boolean;
  mention_in_issue?: boolean;

  // Noise Control
  mute_own_activity?: boolean;
  mute_bot_comments?: boolean;
  mute_draft_pull_requests?: boolean;
}

export interface NotificationProfile {
  id?: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  scopeType: DigestScopeType;
  scopeValue?: string;
  repositoryFilter: RepositoryFilter;
  deliveryType: DigestDeliveryType;
  deliveryTarget?: string;
  notificationPreferences: NotificationPreferences;
  keywords: string[];
  keywordLLMEnabled: boolean;
  priority: number;
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string;
}

export interface CreateNotificationProfileRequest {
  name: string;
  description?: string;
  isEnabled: boolean;
  scopeType: DigestScopeType;
  scopeValue?: string;
  repositoryFilter: RepositoryFilter;
  deliveryType: DigestDeliveryType;
  deliveryTarget?: string;
  notificationPreferences: NotificationPreferences;
  keywords: string[];
  keywordLLMEnabled: boolean;
  priority?: number;
}

export interface UpdateNotificationProfileRequest {
  name?: string;
  description?: string;
  isEnabled?: boolean;
  scopeType?: DigestScopeType;
  scopeValue?: string;
  repositoryFilter?: RepositoryFilter;
  deliveryType?: DigestDeliveryType;
  deliveryTarget?: string;
  notificationPreferences?: NotificationPreferences;
  keywords?: string[];
  keywordLLMEnabled?: boolean;
  priority?: number;
}

// Default notification preferences
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  // PR Activity
  pull_request_opened: true,
  pull_request_closed: true,
  pull_request_merged: true,
  pull_request_reviewed: true,
  pull_request_commented: true,
  pull_request_assigned: true,
  pull_request_review_requested: true,

  // Issue Activity
  issue_opened: true,
  issue_closed: true,
  issue_commented: true,
  issue_assigned: true,

  // CI/CD
  check_failures: false,
  check_successes: false,

  // Mentions
  mention_in_comment: true,
  mention_in_pull_request: true,
  mention_in_issue: true,

  // Noise Control
  mute_own_activity: true,
  mute_bot_comments: true,
  mute_draft_pull_requests: true,
};