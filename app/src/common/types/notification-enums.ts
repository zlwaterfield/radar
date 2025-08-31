/**
 * Notification enums for Radar.
 * 
 * Defines the enums used for notification logic, matching the Python version.
 */

/**
 * Reason for watching a pull request or issue
 */
export enum WatchingReason {
  AUTHOR = 'author',
  REVIEWER = 'reviewer', 
  ASSIGNED = 'assigned',
  MENTIONED = 'mentioned',
  TEAM_MENTIONED = 'team_mentioned',
  SUBSCRIBED = 'subscribed',
  MANUAL = 'manual'
}

/**
 * Type of notification trigger
 */
export enum NotificationTrigger {
  REVIEW_REQUESTED = 'review_requested',
  REVIEW_REQUEST_REMOVED = 'review_request_removed',
  REVIEWED = 'reviewed',
  COMMENTED = 'commented',
  MERGED = 'merged',
  CLOSED = 'closed',
  OPENED = 'opened',
  REOPENED = 'reopened',
  ASSIGNED = 'assigned',
  UNASSIGNED = 'unassigned',
  LABELED = 'labeled',
  UNLABELED = 'unlabeled',
  MENTIONED = 'mentioned',
  TEAM_MENTIONED = 'team_mentioned',
  COMMITTED = 'committed',
  STATUS_CHANGED = 'status_changed',
  CHECK_FAILED = 'check_failed',
  CHECK_SUCCEEDED = 'check_succeeded'
}