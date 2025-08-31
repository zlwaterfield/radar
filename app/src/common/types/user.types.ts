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

export interface UserWithSettings extends UserProfile {
  settings?: UserSettings;
}

export interface UserSettings {
  id: string;
  userId: string;
  notificationPreferences: NotificationPreferences;
  notificationSchedule: NotificationSchedule;
  statsTimeWindow: number;
  keywords: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  // PR & Issue Activity
  pull_request_opened?: boolean;
  pull_request_closed?: boolean;
  pull_request_merged?: boolean;
  pull_request_reviewed?: boolean;
  pull_request_commented?: boolean;
  pull_request_assigned?: boolean;
  
  // More granular PR notifications
  // pull_request_status_changes?: boolean;  // PR merged, closed, reopened
  // pull_request_assignments?: boolean;     // Assigned to PR, review requested
  
  issue_opened?: boolean;
  issue_closed?: boolean;
  issue_commented?: boolean;
  issue_assigned?: boolean;
  
  // More granular issue notifications  
  // issue_status_changes?: boolean;  // Issue opened, closed, reopened
  // issue_assignments?: boolean;     // Assigned to issue
  
  // Discussions
  // discussion_created?: boolean;
  // discussion_answered?: boolean;
  // discussion_commented?: boolean;
  
  // Mentions
  mention_in_comment?: boolean;
  mention_in_pull_request?: boolean;
  mention_in_issue?: boolean;
  mentioned_in_comments?: boolean;  // Someone mentions you in a comment
  
  // CI/CD
  check_failures?: boolean;   // CI checks fail
  check_successes?: boolean;  // CI checks pass (usually too noisy)
  
  // Noise Control
  mute_own_activity?: boolean;
  mute_bot_comments?: boolean;
  mute_draft_pull_requests?: boolean;  // Ignore draft PR activity
}

export interface NotificationSchedule {
  real_time: boolean;
  digest_enabled: boolean;
  digest_time: string; // HH:mm format
  digest_days: string[];
  second_digest_enabled: boolean;
  second_digest_time?: string;
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
