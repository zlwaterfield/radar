import { BadRequestException } from '@nestjs/common';
import type { JsonValue } from '@prisma/client/runtime/library';
import {
  NotificationPreferencesDto,
  NotificationScheduleDto,
} from '../dtos/update-user-settings.dto';

/**
 * Safely validates and parses JSON value to NotificationPreferencesDto
 */
export function validateNotificationPreferences(
  jsonValue: JsonValue,
): NotificationPreferencesDto {
  if (!jsonValue || typeof jsonValue !== 'object' || Array.isArray(jsonValue)) {
    // Return default preferences for invalid/empty input
    return createDefaultNotificationPreferences();
  }

  const obj = jsonValue as Record<string, unknown>;

  // Get defaults and merge with provided values
  const defaults = createDefaultNotificationPreferences();

  // Validate only provided boolean fields
  const booleanFields = [
    'pull_request_opened',
    'pull_request_closed',
    'pull_request_merged',
    'pull_request_reviewed',
    'pull_request_commented',
    'pull_request_assigned',
    'issue_opened',
    'issue_closed',
    'issue_commented',
    'issue_assigned',
  ];

  const result: NotificationPreferencesDto = { ...defaults };

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
    'pr_comments',
    'pr_reviews',
    'pr_status_changes',
    'pr_assignments',
    'pr_opened',
    'issue_comments',
    'issue_status_changes',
    'issue_assignments',
    'check_failures',
    'check_successes',
    'mentioned_in_comments',
    'mute_own_activity',
    'mute_bot_comments',
    'mute_draft_prs',
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
 * Safely validates and parses JSON value to NotificationScheduleDto
 */
export function validateNotificationSchedule(
  jsonValue: JsonValue,
): NotificationScheduleDto {
  if (!jsonValue || typeof jsonValue !== 'object' || Array.isArray(jsonValue)) {
    // Return default schedule for invalid/empty input
    return createDefaultNotificationSchedule();
  }

  const obj = jsonValue as Record<string, unknown>;

  // Get defaults and merge with provided values
  const defaults = createDefaultNotificationSchedule();
  const result: NotificationScheduleDto = { ...defaults };

  // Only validate and update fields that are present
  if (obj.real_time !== undefined) {
    if (typeof obj.real_time !== 'boolean') {
      throw new BadRequestException(
        'Invalid real_time value: expected boolean',
      );
    }
    result.real_time = obj.real_time;
  }

  if (obj.digest_time !== undefined) {
    if (typeof obj.digest_time !== 'string') {
      throw new BadRequestException(
        'Invalid digest_time value: expected string',
      );
    }
    result.digest_time = obj.digest_time;
  }

  if (obj.digest_enabled !== undefined) {
    if (typeof obj.digest_enabled !== 'boolean') {
      throw new BadRequestException(
        'Invalid digest_enabled value: expected boolean',
      );
    }
    result.digest_enabled = obj.digest_enabled;
  }

  if (obj.digest_days !== undefined) {
    if (
      !Array.isArray(obj.digest_days) ||
      !obj.digest_days.every((day) => typeof day === 'string')
    ) {
      throw new BadRequestException(
        'Invalid digest_days value: expected string array',
      );
    }
    result.digest_days = obj.digest_days;
  }

  // Handle optional fields
  if (obj.second_digest_time !== undefined) {
    if (typeof obj.second_digest_time !== 'string') {
      throw new BadRequestException(
        'Invalid second_digest_time value: expected string',
      );
    }
    result.second_digest_time = obj.second_digest_time;
  }

  if (obj.second_digest_enabled !== undefined) {
    if (typeof obj.second_digest_enabled !== 'boolean') {
      throw new BadRequestException(
        'Invalid second_digest_enabled value: expected boolean',
      );
    }
    result.second_digest_enabled = obj.second_digest_enabled;
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
 */
export function createDefaultNotificationPreferences(): NotificationPreferencesDto {
  return {
    pull_request_opened: true,
    pull_request_closed: true,
    pull_request_merged: true,
    pull_request_reviewed: true,
    pull_request_commented: false,
    pull_request_assigned: true,
    issue_opened: true,
    issue_closed: false,
    issue_commented: false,
    issue_assigned: true,
  };
}

/**
 * Creates default notification schedule
 */
export function createDefaultNotificationSchedule(): NotificationScheduleDto {
  return {
    real_time: true,
    digest_time: '09:00',
    digest_enabled: true,
    digest_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    second_digest_time: '16:00',
    second_digest_enabled: false,
  };
}
