/**
 * Testing utilities for GitHub events and Slack notifications
 */

import { WebClient } from '@slack/web-api';
import { PrismaClient } from '@prisma/client';

// Test data factories
export class TestDataFactory {
  static createGitHubUser(overrides = {}) {
    return {
      id: 12345,
      login: 'testuser',
      type: 'User',
      ...overrides,
    };
  }

  static createRepository(overrides = {}) {
    return {
      id: 67890,
      name: 'test-repo',
      full_name: 'testuser/test-repo',
      ...overrides,
    };
  }

  static createPullRequest(overrides = {}) {
    return {
      number: 123,
      title: 'Test PR',
      state: 'open',
      html_url: 'https://github.com/testuser/test-repo/pull/123',
      user: TestDataFactory.createGitHubUser(),
      ...overrides,
    };
  }

  static createPRWebhook(action: string, overrides = {}) {
    return {
      action,
      pull_request: TestDataFactory.createPullRequest(),
      repository: TestDataFactory.createRepository(),
      sender: TestDataFactory.createGitHubUser(),
      ...overrides,
    };
  }

  static createIssueWebhook(action: string, overrides = {}) {
    return {
      action,
      issue: {
        number: 456,
        title: 'Test Issue',
        state: 'open',
        html_url: 'https://github.com/testuser/test-repo/issues/456',
        user: TestDataFactory.createGitHubUser(),
        ...overrides,
      },
      repository: TestDataFactory.createRepository(),
      sender: TestDataFactory.createGitHubUser(),
      ...overrides,
    };
  }

  static createRadarUser(overrides = {}) {
    return {
      id: 'user-123',
      githubId: '12345',
      githubLogin: 'testuser',
      slackId: 'U123456',
      slackBotToken: 'xoxb-test-token',
      isActive: true,
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
      repositories: [
        {
          githubId: '67890',
          enabled: true,
          isActive: true,
        },
      ],
      teams: [],
      ...overrides,
    };
  }
}

// Mock configurations
export class TestMocks {
  static createPrismaMock() {
    return {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      event: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      notification: {
        create: jest.fn(),
        update: jest.fn(),
      },
      $disconnect: jest.fn(),
    } as unknown as jest.Mocked<PrismaClient>;
  }

  static createSlackMock() {
    return {
      conversations: {
        open: jest.fn().mockResolvedValue({
          ok: true,
          channel: { id: 'D123456' },
        }),
      },
      chat: {
        postMessage: jest.fn().mockResolvedValue({
          ok: true,
          ts: '1234567890.123',
        }),
      },
    } as unknown as jest.Mocked<WebClient>;
  }

  static createNotificationServiceMock() {
    return {
      processPullRequestEvent: jest.fn().mockResolvedValue({
        shouldNotify: true,
        matchedKeywords: [],
        matchDetails: {},
      }),
      processIssueEvent: jest.fn().mockResolvedValue({
        shouldNotify: true,
        matchedKeywords: [],
        matchDetails: {},
      }),
    };
  }
}

// Test scenarios for comprehensive coverage
export const TestScenarios = {
  // PR event variations
  prEvents: [
    'opened',
    'closed',
    'reopened',
    'ready_for_review',
    'review_requested',
    'assigned',
    'unassigned',
  ],

  // Issue event variations
  issueEvents: ['opened', 'closed', 'reopened', 'assigned', 'unassigned'],

  // Notification settings variations
  settingsCombinations: [
    { pull_request_opened: true, mute_own_activity: false },
    { pull_request_opened: true, mute_own_activity: true },
    { pull_request_opened: false, mute_own_activity: false },
    { pull_request_reviewed: true, mute_bot_comments: false },
    { pull_request_reviewed: true, mute_bot_comments: true },
  ],

  // User involvement scenarios
  watchingReasons: [
    'author',
    'reviewer',
    'assigned',
    'mentioned',
    'team_assigned',
    'subscribed',
  ],
};

// Assertion helpers
export class TestAssertions {
  static expectSlackMessageStructure(message: any) {
    expect(message).toHaveProperty('attachments');
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments[0]).toHaveProperty('color');
    expect(message.attachments[0]).toHaveProperty('blocks');
    expect(message.attachments[0].blocks.length).toBeGreaterThan(0);
  }

  static expectNotificationCreated(
    prismaMock: any,
    userId: string,
    eventId: string,
  ) {
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        eventId,
        messageType: expect.any(String),
      }),
    });
  }

  static expectSlackMessageSent(slackMock: any) {
    expect(slackMock.conversations.open).toHaveBeenCalled();
    expect(slackMock.chat.postMessage).toHaveBeenCalled();
  }
}
