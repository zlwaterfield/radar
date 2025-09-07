/**
 * Single source of truth for all notification preference fields and defaults
 * This file eliminates duplication across validation, defaults, and UI
 */

export const NOTIFICATION_PREFERENCE_FIELDS = {
  PR_ACTIVITY: [
    'pull_request_opened',
    'pull_request_closed',
    'pull_request_merged',
    'pull_request_reviewed',
    'pull_request_commented',
    'pull_request_assigned',
    'pull_request_review_requested',
  ],
  ISSUE_ACTIVITY: [
    'issue_opened',
    'issue_closed',
    'issue_commented',
    'issue_assigned',
  ],
  CI_CD: ['check_failures', 'check_successes'],
  MENTIONS: [
    'mention_in_pull_request',
    'mention_in_issue',
  ],
  NOISE_CONTROL: [
    'mute_own_activity',
    'mute_bot_comments',
    'mute_draft_pull_requests',
  ],
} as const;

export const ALL_NOTIFICATION_PREFERENCE_FIELDS = [
  ...NOTIFICATION_PREFERENCE_FIELDS.PR_ACTIVITY,
  ...NOTIFICATION_PREFERENCE_FIELDS.ISSUE_ACTIVITY,
  ...NOTIFICATION_PREFERENCE_FIELDS.CI_CD,
  ...NOTIFICATION_PREFERENCE_FIELDS.MENTIONS,
  ...NOTIFICATION_PREFERENCE_FIELDS.NOISE_CONTROL,
] as const;

/**
 * Default notification preferences - single authoritative source
 */
export const DEFAULT_NOTIFICATION_PREFERENCES = {
  // PR Activity
  pull_request_opened: true,
  pull_request_closed: true,
  pull_request_merged: true,
  pull_request_reviewed: true,
  pull_request_commented: true,
  pull_request_assigned: true,
  pull_request_review_requested: true,

  // Issue Activity
  issue_opened: true,
  issue_closed: true,
  issue_commented: true,
  issue_assigned: true,

  // CI/CD
  check_failures: false,
  check_successes: false,

  // Mentions
  mention_in_pull_request: true,
  mention_in_issue: true,

  // Noise Control
  mute_own_activity: true,
  mute_bot_comments: true,
  mute_draft_pull_requests: true,
};

/**
 * UI field configuration for forms
 */
export const NOTIFICATION_UI_GROUPS = {
  PR_EVENTS: {
    title: 'Pull requests',
    fields: [
      ['pull_request_opened', 'PR opened'],
      ['pull_request_closed', 'PR closed/merged'],
      ['pull_request_reviewed', 'PR reviewed'],
      ['pull_request_commented', 'PR commented'],
      ['pull_request_assigned', 'PR assigned'],
      ['pull_request_review_requested', 'PR review requested'],
    ] as const,
  },
  ISSUE_EVENTS: {
    title: 'Issues',
    fields: [
      ['issue_opened', 'Issue opened'],
      ['issue_closed', 'Issue closed'],
      ['issue_commented', 'Issue commented'],
      ['issue_assigned', 'Issue assigned'],
    ] as const,
  },
  OTHER: {
    title: 'Other',
    fields: [
      ['mention_in_pull_request', 'Mentioned in pull requests'],
      ['mention_in_issue', 'Mentioned in issues'],
    ] as const,
  },
} as const;

// TypeScript utility types
export type NotificationPreferenceKey =
  (typeof ALL_NOTIFICATION_PREFERENCE_FIELDS)[number];
export type NotificationPreferenceDefaults =
  typeof DEFAULT_NOTIFICATION_PREFERENCES;
