import type { GitHubPullRequest } from './github.types';

export interface DigestPRCategory {
  waitingOnUser: GitHubPullRequest[];
  approvedReadyToMerge: GitHubPullRequest[];
  userOpenPRs: GitHubPullRequest[];
  userDraftPRs: GitHubPullRequest[];
}

export interface DigestStats {
  totalUsers: number;
  successful: number;
  errors: number;
}

// New types for multiple digest configurations
export type DigestScopeType = 'user' | 'team';
export type DigestDeliveryType = 'dm' | 'channel';

export interface RepositoryFilter {
  type: 'all' | 'selected';
  repoIds?: string[];
}

export interface DigestConfigData {
  id?: string;
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
}

export interface DigestConfigWithMeta extends DigestConfigData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface MultipleDigestUserData {
  userId: string;
  userGithubLogin: string;
  slackId?: string;
  slackAccessToken?: string;
  digestConfigs: DigestConfigWithMeta[];
  repositories: Array<{
    owner: string;
    repo: string;
    githubId: string;
  }>;
  teams: Array<{
    teamId: string;
    teamSlug: string;
    teamName: string;
    organization: string;
  }>;
}

export interface DigestExecutionData {
  configId: string;
  userId: string;
  userGithubLogin: string;
  config: DigestConfigWithMeta;
  repositories: Array<{
    owner: string;
    repo: string;
    githubId: string;
  }>;
  deliveryInfo: {
    type: DigestDeliveryType;
    target?: string;
    slackAccessToken?: string;
    slackId?: string;
  };
}
