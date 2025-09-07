export interface UserProfile {
  id: string;
  name?: string;
  email?: string;
  image?: string;
  slackId: string;
  slackTeamId: string;
  githubId?: string;
  githubLogin?: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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

  // Discussions
  // discussion_created?: boolean;
  // discussion_answered?: boolean;
  // discussion_commented?: boolean;

  // CI/CD
  check_failures?: boolean; // CI checks fail
  check_successes?: boolean; // CI checks pass (usually too noisy)

  // Noise Control
  mute_own_activity?: boolean;
  mute_bot_comments?: boolean;
  mute_draft_pull_requests?: boolean; // Ignore draft PR activity
}

export interface UserRepository {
  id: string;
  userId: string;
  githubId: string;
  name: string;
  fullName: string;
  description?: string;
  url: string;
  isPrivate: boolean;
  isFork: boolean;
  ownerName: string;
  ownerAvatarUrl: string;
  ownerUrl: string;
  organization?: string;
  isActive: boolean;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
