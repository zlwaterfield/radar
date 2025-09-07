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
  mention_in_pull_request?: boolean;

  // Issue Activity
  issue_opened?: boolean;
  issue_closed?: boolean;
  issue_commented?: boolean;
  issue_assigned?: boolean;
  mention_in_issue?: boolean;

  // CI/CD
  check_failures?: boolean;
  check_successes?: boolean;

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

// Re-export from constants for backward compatibility
export { DEFAULT_NOTIFICATION_PREFERENCES } from '../constants/notification-preferences.constants';