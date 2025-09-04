import type {
  DigestScopeType,
  DigestDeliveryType,
  RepositoryFilter,
} from './digest.types';
import type { NotificationPreferences } from './user.types';

export interface NotificationProfileData {
  id?: string;
  name: string;
  description?: string | null;
  isEnabled: boolean;
  scopeType: DigestScopeType;
  scopeValue?: string | null; // null for user, teamId for team
  repositoryFilter: RepositoryFilter;
  deliveryType: DigestDeliveryType;
  deliveryTarget?: string | null; // null for DM, channelId for channel
  notificationPreferences: NotificationPreferences;
  keywords: string[];
  keywordLLMEnabled: boolean;
  priority: number;
}

export interface NotificationProfileWithMeta extends NotificationProfileData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface NotificationProfileMatch {
  profile: NotificationProfileWithMeta;
  matchedKeywords: string[];
  matchDetails: Record<string, string>;
  reason: string;
  context?: any;
}

export interface NotificationDecision {
  shouldNotify: boolean;
  matchedProfiles: NotificationProfileMatch[];
  primaryProfile?: NotificationProfileMatch;
  reason: string;
  context?: any;
}
