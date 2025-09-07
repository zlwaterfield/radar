import { BadRequestException } from '@nestjs/common';
import type { JsonValue } from '@prisma/client/runtime/library';
import type { NotificationPreferences } from '../types/user.types';
import {
  ALL_NOTIFICATION_PREFERENCE_FIELDS,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../constants/notification-preferences.constants';

/**
 * Safely validates and parses JSON value to NotificationPreferences
 */
export function validateNotificationPreferences(
  jsonValue: JsonValue,
): NotificationPreferences {
  if (!jsonValue || typeof jsonValue !== 'object' || Array.isArray(jsonValue)) {
    // Return default preferences for invalid/empty input
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  const obj = jsonValue as Record<string, unknown>;

  // Get defaults and merge with provided values
  const defaults = { ...DEFAULT_NOTIFICATION_PREFERENCES };

  // Use all notification preference fields for validation
  const booleanFields = [...ALL_NOTIFICATION_PREFERENCE_FIELDS];

  const result: NotificationPreferences = { ...defaults };

  // Only validate and update fields that are present
  for (const field of booleanFields) {
    if (obj[field] !== undefined) {
      if (typeof obj[field] !== 'boolean') {
        throw new BadRequestException(
          `Invalid ${field} value: expected boolean`,
        );
      }
      (result as any)[field] = obj[field];
    }
  }

  // Handle additional fields that might not be in the DTO (like those from frontend)
  const additionalFields = [
    'pull_request_opened',
    'pull_request_closed',
    'pull_request_merged',
    'pull_request_reviewed',
    'pull_request_commented',
    'pull_request_assigned',
    'pull_request_review_requested',
    'issue_opened',
    'issue_closed',
    'issue_commented',
    'issue_assigned',
    'check_failures',
    'check_successes',
    'mention_in_pull_request',
    'mention_in_issue',
    'mute_own_activity',
    'mute_bot_comments',
    'mute_draft_pull_requests',
  ];

  for (const field of additionalFields) {
    if (obj[field] !== undefined) {
      if (typeof obj[field] !== 'boolean') {
        throw new BadRequestException(
          `Invalid ${field} value: expected boolean`,
        );
      }
      (result as any)[field] = obj[field];
    }
  }

  // Handle keyword_notification_preferences if present
  if (obj.keyword_notification_preferences !== undefined) {
    (result as any).keyword_notification_preferences =
      obj.keyword_notification_preferences;
  }

  return result;
}

/**
 * Safely converts null to undefined for optional fields
 */
export function nullToUndefined<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

/**
 * Creates default notification preferences
 * @deprecated Use DEFAULT_NOTIFICATION_PREFERENCES constant directly
 */
export function createDefaultNotificationPreferences(): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES };
}
