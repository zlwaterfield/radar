import { BadRequestException } from '@nestjs/common';
import type { JsonValue } from '@prisma/client/runtime/library';
import { NotificationPreferencesDto, NotificationScheduleDto } from '@/users/dto/user-settings.dto';

/**
 * Safely validates and parses JSON value to NotificationPreferencesDto
 */
export function validateNotificationPreferences(jsonValue: JsonValue): NotificationPreferencesDto {
  if (!jsonValue || typeof jsonValue !== 'object' || Array.isArray(jsonValue)) {
    throw new BadRequestException('Invalid notification preferences format');
  }

  const obj = jsonValue as Record<string, unknown>;

  // Validate required boolean fields
  const requiredFields = [
    'pull_request_opened',
    'pull_request_closed', 
    'pull_request_merged',
    'pull_request_reviewed',
    'pull_request_commented',
    'pull_request_assigned',
    'issue_opened',
    'issue_closed',
    'issue_commented',
    'issue_assigned'
  ];

  for (const field of requiredFields) {
    if (typeof obj[field] !== 'boolean') {
      throw new BadRequestException(`Invalid ${field} value: expected boolean`);
    }
  }

  return {
    pull_request_opened: obj.pull_request_opened as boolean,
    pull_request_closed: obj.pull_request_closed as boolean,
    pull_request_merged: obj.pull_request_merged as boolean,
    pull_request_reviewed: obj.pull_request_reviewed as boolean,
    pull_request_commented: obj.pull_request_commented as boolean,
    pull_request_assigned: obj.pull_request_assigned as boolean,
    issue_opened: obj.issue_opened as boolean,
    issue_closed: obj.issue_closed as boolean,
    issue_commented: obj.issue_commented as boolean,
    issue_assigned: obj.issue_assigned as boolean,
  };
}

/**
 * Safely validates and parses JSON value to NotificationScheduleDto
 */
export function validateNotificationSchedule(jsonValue: JsonValue): NotificationScheduleDto {
  if (!jsonValue || typeof jsonValue !== 'object' || Array.isArray(jsonValue)) {
    throw new BadRequestException('Invalid notification schedule format');
  }

  const obj = jsonValue as Record<string, unknown>;

  // Validate required fields
  if (typeof obj.real_time !== 'boolean') {
    throw new BadRequestException('Invalid real_time value: expected boolean');
  }

  if (typeof obj.digest_time !== 'string') {
    throw new BadRequestException('Invalid digest_time value: expected string');
  }

  if (typeof obj.digest_enabled !== 'boolean') {
    throw new BadRequestException('Invalid digest_enabled value: expected boolean');
  }

  if (!Array.isArray(obj.digest_days) || !obj.digest_days.every(day => typeof day === 'string')) {
    throw new BadRequestException('Invalid digest_days value: expected string array');
  }

  const result: NotificationScheduleDto = {
    real_time: obj.real_time,
    digest_time: obj.digest_time,
    digest_enabled: obj.digest_enabled,
    digest_days: obj.digest_days as string[],
  };

  // Handle optional fields
  if (obj.second_digest_time !== undefined) {
    if (typeof obj.second_digest_time !== 'string') {
      throw new BadRequestException('Invalid second_digest_time value: expected string');
    }
    result.second_digest_time = obj.second_digest_time;
  }

  if (obj.second_digest_enabled !== undefined) {
    if (typeof obj.second_digest_enabled !== 'boolean') {
      throw new BadRequestException('Invalid second_digest_enabled value: expected boolean');
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