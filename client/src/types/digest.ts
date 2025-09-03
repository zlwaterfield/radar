// Frontend types for multiple digest configurations
export type DigestScopeType = 'user' | 'team';
export type DigestDeliveryType = 'dm' | 'channel';

export interface RepositoryFilter {
  type: 'all' | 'selected';
  repoIds?: string[];
}

export interface DigestConfig {
  id: string;
  name: string;
  description?: string | null;
  isEnabled: boolean;
  digestTime: string; // HH:MM format
  timezone: string;
  scopeType: DigestScopeType;
  scopeValue?: string | null; // null for user, teamId for team
  repositoryFilter: RepositoryFilter;
  deliveryType: DigestDeliveryType;
  deliveryTarget?: string | null; // null for DM, channelId for channel
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface CreateDigestConfig {
  name: string;
  description?: string;
  isEnabled: boolean;
  digestTime: string;
  timezone: string;
  scopeType: DigestScopeType;
  scopeValue?: string;
  repositoryFilter: RepositoryFilter;
  deliveryType: DigestDeliveryType;
  deliveryTarget?: string;
}

export interface DigestPreview {
  waitingOnUser: number;
  approvedReadyToMerge: number;
  userOpenPRs: number;
  details?: {
    waitingOnUser: Array<{ title: string; url: string; repo: string }>;
    approvedReadyToMerge: Array<{ title: string; url: string; repo: string }>;
    userOpenPRs: Array<{ title: string; url: string; repo: string }>;
  };
}

export interface DigestHistory {
  id: string;
  sentAt: string;
  pullRequestCount: number;
  issueCount: number;
  deliveryType: DigestDeliveryType;
  deliveryTarget?: string | null;
  digestConfig?: {
    id: string;
    name: string;
  };
}

export interface Repository {
  githubId: string;
  name: string;
  fullName: string;
  description?: string;
  url: string;
  isPrivate: boolean;
  ownerName: string;
  enabled: boolean;
}

export interface Team {
  teamId: string;
  teamSlug: string;
  teamName: string;
  organization: string;
}