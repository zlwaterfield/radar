// Re-export all types from individual files for cleaner imports
export * from './auth.types';
export * from './github.types';
export * from './slack.types';

// Export specific types from notification.types to avoid conflicts
export type {
  NotificationData,
  DigestNotification,
} from './notification.types';

// Export specific types from user.types to avoid conflicts with notification.types
export type {
  UserProfile,
  UserWithSettings,
  UserSettings,
  UserRepository,
  NotificationPreferences as UserNotificationPreferences,
  NotificationSchedule as UserNotificationSchedule,
} from './user.types';
