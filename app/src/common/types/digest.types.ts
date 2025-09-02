import type { GitHubPullRequest } from './github.types';

export interface DigestPRCategory {
  waitingOnUser: GitHubPullRequest[];
  approvedReadyToMerge: GitHubPullRequest[];
  userOpenPRs: GitHubPullRequest[];
}

export interface UserDigestData {
  userId: string;
  userGithubLogin: string;
  repositories: Array<{
    owner: string;
    repo: string;
    githubId: string;
  }>;
  digestTime: string;
  slackId?: string;
  slackAccessToken?: string;
}

export interface DigestSettings {
  digest_enabled: boolean;
  digest_time: string;
}

export interface DigestStats {
  totalUsers: number;
  successful: number;
  errors: number;
}
