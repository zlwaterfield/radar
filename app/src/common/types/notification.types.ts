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

// NotificationPreferences and NotificationSchedule moved to user.types.ts to avoid duplication
// Import them from there: import { NotificationPreferences, NotificationSchedule } from './user.types';

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
