/**
 * Tests for notification settings and decision logic
 * Based on the logic from process-github-event.ts
 */

describe('Notification Settings Logic', () => {
  // Extract the notification preference mapping logic
  function getNotificationPreferenceKey(eventType: string, action: string): string | null {
    if (eventType === 'pull_request') {
      switch (action) {
        case 'opened':
          return 'pull_request_opened';
        case 'closed':
          return 'pull_request_closed';
        case 'reopened':
          return 'pull_request_reopened';
        default:
          return 'pull_request_opened';
      }
    } else if (eventType === 'issues') {
      switch (action) {
        case 'opened':
          return 'issue_opened';
        case 'closed':
          return 'issue_closed';
        case 'reopened':
          return 'issue_reopened';
        default:
          return 'issue_opened';
      }
    } else if (eventType === 'issue_comment') {
      return 'issue_commented';
    } else if (eventType === 'pull_request_review') {
      return 'pull_request_reviewed';
    } else if (eventType === 'pull_request_review_comment') {
      return 'pull_request_commented';
    }
    
    return null;
  }

  // Extract the user notification decision logic
  function shouldNotifyUser(user: any, eventType: string, action: string, payload: any): boolean {
    const settings = user.settings;
    if (!settings) {
      return true; // Default to sending notifications if no settings
    }

    const preferences = settings.notificationPreferences || {};
    
    // Map event types to preference keys
    const eventKey = getNotificationPreferenceKey(eventType, action);
    if (eventKey && preferences[eventKey] === false) {
      return false;
    }

    // Check if the user is the one who triggered the event
    if (payload.sender?.id?.toString() === user.githubId) {
      return preferences.mute_own_activity === false; // If mute_own_activity is true, don't notify (return false)
    }

    // Check bot filtering
    if (payload.sender?.type === 'Bot' && preferences.mute_bot_comments === true) {
      return false;
    }

    return true;
  }

  // Test data factory for users
  function createTestUser(overrides = {}) {
    return {
      id: 'user-123',
      githubId: '12345',
      githubLogin: 'testuser',
      settings: {
        notificationPreferences: {
          pull_request_opened: true,
          pull_request_closed: true,
          pull_request_reviewed: true,
          issue_opened: true,
          issue_commented: true,
          mute_own_activity: true,
          mute_bot_comments: false,
        },
      },
      ...overrides,
    };
  }

  describe('Notification Preference Mapping', () => {
    it('should map pull request events to correct preference keys', () => {
      expect(getNotificationPreferenceKey('pull_request', 'opened')).toBe('pull_request_opened');
      expect(getNotificationPreferenceKey('pull_request', 'closed')).toBe('pull_request_closed');
      expect(getNotificationPreferenceKey('pull_request', 'reopened')).toBe('pull_request_reopened');
      expect(getNotificationPreferenceKey('pull_request', 'assigned')).toBe('pull_request_opened'); // default
    });

    it('should map issue events to correct preference keys', () => {
      expect(getNotificationPreferenceKey('issues', 'opened')).toBe('issue_opened');
      expect(getNotificationPreferenceKey('issues', 'closed')).toBe('issue_closed');
      expect(getNotificationPreferenceKey('issues', 'reopened')).toBe('issue_reopened');
      expect(getNotificationPreferenceKey('issues', 'assigned')).toBe('issue_opened'); // default
    });

    it('should map comment and review events', () => {
      expect(getNotificationPreferenceKey('issue_comment', 'created')).toBe('issue_commented');
      expect(getNotificationPreferenceKey('pull_request_review', 'submitted')).toBe('pull_request_reviewed');
      expect(getNotificationPreferenceKey('pull_request_review_comment', 'created')).toBe('pull_request_commented');
    });

    it('should return null for unsupported event types', () => {
      expect(getNotificationPreferenceKey('push', 'created')).toBe(null);
      expect(getNotificationPreferenceKey('release', 'published')).toBe(null);
    });
  });

  describe('User Notification Decision Logic', () => {
    it('should notify when user has preference enabled', () => {
      const user = createTestUser({
        settings: {
          notificationPreferences: {
            pull_request_opened: true,
          },
        },
      });
      
      const payload = {
        sender: { id: 67890, login: 'otheruser', type: 'User' },
      };

      const result = shouldNotifyUser(user, 'pull_request', 'opened', payload);
      expect(result).toBe(true);
    });

    it('should not notify when user has preference disabled', () => {
      const user = createTestUser({
        settings: {
          notificationPreferences: {
            pull_request_opened: false,
          },
        },
      });
      
      const payload = {
        sender: { id: 67890, login: 'otheruser', type: 'User' },
      };

      const result = shouldNotifyUser(user, 'pull_request', 'opened', payload);
      expect(result).toBe(false);
    });

    it('should mute own activity when mute_own_activity is enabled', () => {
      const user = createTestUser({
        githubId: '12345',
        settings: {
          notificationPreferences: {
            pull_request_opened: true,
            mute_own_activity: true,
          },
        },
      });
      
      const payload = {
        sender: { id: 12345, login: 'testuser', type: 'User' }, // Same as user's GitHub ID
      };

      const result = shouldNotifyUser(user, 'pull_request', 'opened', payload);
      expect(result).toBe(false);
    });

    it('should notify own activity when mute_own_activity is disabled', () => {
      const user = createTestUser({
        githubId: '12345',
        settings: {
          notificationPreferences: {
            pull_request_opened: true,
            mute_own_activity: false,
          },
        },
      });
      
      const payload = {
        sender: { id: 12345, login: 'testuser', type: 'User' },
      };

      const result = shouldNotifyUser(user, 'pull_request', 'opened', payload);
      expect(result).toBe(true);
    });

    it('should mute bot comments when mute_bot_comments is enabled', () => {
      const user = createTestUser({
        settings: {
          notificationPreferences: {
            pull_request_opened: true,
            mute_bot_comments: true,
          },
        },
      });
      
      const payload = {
        sender: { id: 98765, login: 'dependabot[bot]', type: 'Bot' },
      };

      const result = shouldNotifyUser(user, 'pull_request', 'opened', payload);
      expect(result).toBe(false);
    });

    it('should allow bot comments when mute_bot_comments is disabled', () => {
      const user = createTestUser({
        settings: {
          notificationPreferences: {
            pull_request_opened: true,
            mute_bot_comments: false,
          },
        },
      });
      
      const payload = {
        sender: { id: 98765, login: 'dependabot[bot]', type: 'Bot' },
      };

      const result = shouldNotifyUser(user, 'pull_request', 'opened', payload);
      expect(result).toBe(true);
    });

    it('should default to notify when no settings exist', () => {
      const user = {
        id: 'user-123',
        githubId: '12345',
        settings: null,
      };
      
      const payload = {
        sender: { id: 67890, login: 'otheruser', type: 'User' },
      };

      const result = shouldNotifyUser(user, 'pull_request', 'opened', payload);
      expect(result).toBe(true);
    });

    it('should default to notify when notificationPreferences is missing', () => {
      const user = {
        id: 'user-123',
        githubId: '12345',
        settings: {},
      };
      
      const payload = {
        sender: { id: 67890, login: 'otheruser', type: 'User' },
      };

      const result = shouldNotifyUser(user, 'pull_request', 'opened', payload);
      expect(result).toBe(true);
    });
  });

  describe('Complex Settings Scenarios', () => {
    it('should handle multiple conditions correctly', () => {
      const user = createTestUser({
        githubId: '12345',
        settings: {
          notificationPreferences: {
            pull_request_opened: true,
            mute_own_activity: true,
            mute_bot_comments: true,
          },
        },
      });

      // Different user, should notify
      const otherUserPayload = {
        sender: { id: 67890, login: 'otheruser', type: 'User' },
      };
      expect(shouldNotifyUser(user, 'pull_request', 'opened', otherUserPayload)).toBe(true);

      // Own action, should not notify
      const ownActionPayload = {
        sender: { id: 12345, login: 'testuser', type: 'User' },
      };
      expect(shouldNotifyUser(user, 'pull_request', 'opened', ownActionPayload)).toBe(false);

      // Bot action, should not notify
      const botPayload = {
        sender: { id: 98765, login: 'bot', type: 'Bot' },
      };
      expect(shouldNotifyUser(user, 'pull_request', 'opened', botPayload)).toBe(false);
    });

    it('should respect event type preferences individually', () => {
      const user = createTestUser({
        settings: {
          notificationPreferences: {
            pull_request_opened: true,
            pull_request_closed: false,
            issue_opened: false,
            issue_commented: true,
          },
        },
      });
      
      const payload = {
        sender: { id: 67890, login: 'otheruser', type: 'User' },
      };

      expect(shouldNotifyUser(user, 'pull_request', 'opened', payload)).toBe(true);
      expect(shouldNotifyUser(user, 'pull_request', 'closed', payload)).toBe(false);
      expect(shouldNotifyUser(user, 'issues', 'opened', payload)).toBe(false);
      expect(shouldNotifyUser(user, 'issue_comment', 'created', payload)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing sender information', () => {
      const user = createTestUser();
      
      const payload = {}; // No sender
      
      const result = shouldNotifyUser(user, 'pull_request', 'opened', payload);
      expect(result).toBe(true); // Should default to notify
    });

    it('should handle malformed GitHub IDs', () => {
      const user = createTestUser({
        githubId: '12345',
      });
      
      const payload = {
        sender: { id: 'not-a-number', login: 'user', type: 'User' },
      };
      
      const result = shouldNotifyUser(user, 'pull_request', 'opened', payload);
      expect(result).toBe(true); // Should not match own activity check
    });

    it('should handle null/undefined preference values', () => {
      const user = createTestUser({
        settings: {
          notificationPreferences: {
            pull_request_opened: null,
            issue_opened: undefined,
          },
        },
      });
      
      const payload = {
        sender: { id: 67890, login: 'otheruser', type: 'User' },
      };

      // null and undefined should be treated as enabled (not === false)
      expect(shouldNotifyUser(user, 'pull_request', 'opened', payload)).toBe(true);
      expect(shouldNotifyUser(user, 'issues', 'opened', payload)).toBe(true);
    });
  });
});