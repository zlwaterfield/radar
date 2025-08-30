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
  pull_request_opened?: boolean;
  pull_request_closed?: boolean;
  pull_request_merged?: boolean;
  pull_request_reviewed?: boolean;
  pull_request_commented?: boolean;
  pull_request_assigned?: boolean;
  issue_opened?: boolean;
  issue_closed?: boolean;
  issue_commented?: boolean;
  issue_assigned?: boolean;
  discussion_created?: boolean;
  discussion_answered?: boolean;
  discussion_commented?: boolean;
  push_to_branch?: boolean;
  mention_in_comment?: boolean;
  mention_in_pr?: boolean;
  mention_in_issue?: boolean;
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
