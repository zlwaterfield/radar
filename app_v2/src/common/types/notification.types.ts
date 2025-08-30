export interface NotificationData {
  type: string;
  title: string;
  url: string;
  author: string;
  repository: string;
  description: string;
  timestamp: string;
  metadata?: {
    number?: number;
    state?: string;
    merged?: boolean;
    draft?: boolean;
    baseBranch?: string;
    headBranch?: string;
    labels?: string[];
    reviewState?: string;
    reviewId?: number;
    commentId?: number;
    prNumber?: number;
    issueNumber?: number;
    [key: string]: any;
  };
}

export interface NotificationPreferences {
  pull_request_opened: boolean;
  pull_request_closed: boolean;
  pull_request_merged: boolean;
  pull_request_reviewed: boolean;
  pull_request_commented: boolean;
  pull_request_assigned: boolean;
  issue_opened: boolean;
  issue_closed: boolean;
  issue_commented: boolean;
  issue_assigned: boolean;
}

export interface NotificationSchedule {
  real_time: boolean;
  digest_time: string;
  digest_enabled: boolean;
  digest_days: string[];
  second_digest_time?: string;
  second_digest_enabled?: boolean;
}

export interface DigestNotification {
  id: string;
  type: string;
  title: string;
  url: string;
  author: string;
  repository: string;
  timestamp: string;
  metadata?: any;
}
