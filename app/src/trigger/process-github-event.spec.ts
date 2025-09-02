import {
  TestDataFactory,
  TestMocks,
  TestAssertions,
} from '../test/test-utilities';

// Mock external dependencies
jest.mock('@prisma/client');
jest.mock('@slack/web-api');

describe('GitHub Event Processing', () => {
  let prismaMock: any;
  let slackMock: any;
  let notificationServiceMock: any;

  beforeEach(() => {
    prismaMock = TestMocks.createPrismaMock();
    slackMock = TestMocks.createSlackMock();
    notificationServiceMock = TestMocks.createNotificationServiceMock();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Pull Request Events → Slack Messages', () => {
    it('should create and send Slack notification for PR opened event', async () => {
      // Arrange
      const prWebhook = TestDataFactory.createPRWebhook('opened');
      const radarUser = TestDataFactory.createRadarUser({
        settings: {
          notificationPreferences: {
            pull_request_opened: true,
            mute_own_activity: false, // Allow notifications for own actions
          },
        },
      });
      const event = {
        id: 'event-123',
        eventType: 'pull_request',
        action: 'opened',
        payload: prWebhook,
        processed: false,
      };

      // Mock database responses
      prismaMock.event.findUnique.mockResolvedValue(event);
      prismaMock.user.findMany.mockResolvedValue([radarUser]);
      prismaMock.notification.create.mockResolvedValue({
        id: 'notification-123',
      });
      prismaMock.notification.update.mockResolvedValue({});
      prismaMock.event.update.mockResolvedValue({});

      // Mock notification service response
      notificationServiceMock.processPullRequestEvent.mockResolvedValue({
        shouldNotify: true,
        matchedKeywords: ['bug'],
        matchDetails: { title: 'contains bug keyword' },
      });

      // Act
      const { processGitHubEvent } = require('./process-github-event');
      const result = await processGitHubEvent.run({
        eventId: 'event-123',
        eventType: 'pull_request',
        action: 'opened',
        repositoryName: 'testuser/test-repo',
        repositoryId: '67890',
        senderId: '12345',
        senderLogin: 'testuser',
        payload: prWebhook,
        createdAt: new Date().toISOString(),
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain(
        'Successfully processed pull_request event',
      );

      // Verify event marked as processed
      expect(prismaMock.event.update).toHaveBeenCalledWith({
        where: { id: 'event-123' },
        data: {
          processed: true,
          updatedAt: expect.any(Date),
        },
      });

      // Verify notification created
      TestAssertions.expectNotificationCreated(
        prismaMock,
        radarUser.id,
        'event-123',
      );

      // Verify Slack message sent
      TestAssertions.expectSlackMessageSent(slackMock);

      // Verify Slack message structure
      const slackCall = slackMock.chat.postMessage.mock.calls[0][0];
      TestAssertions.expectSlackMessageStructure(slackCall);

      // Verify PR-specific message content
      const attachment = slackCall.attachments[0];
      const titleBlock = attachment.blocks[0];
      expect(titleBlock.text.text).toContain('Pull Request Opened');
      expect(titleBlock.text.text).toContain('testuser');

      const linkBlock = attachment.blocks[2];
      expect(linkBlock.text.text).toContain('PR #123');
      expect(linkBlock.text.text).toContain('Test PR');
      expect(linkBlock.accessory.url).toBe(prWebhook.pull_request.html_url);
    });

    it('should not send notification when mute_own_activity is enabled and user is sender', async () => {
      // Arrange
      const prWebhook = TestDataFactory.createPRWebhook('opened', {
        sender: { id: 12345, login: 'testuser' }, // Same as user's GitHub ID
      });
      const radarUser = TestDataFactory.createRadarUser({
        githubId: '12345', // Same as sender ID
        settings: {
          notificationPreferences: {
            pull_request_opened: true,
            mute_own_activity: true, // Mute own activity
          },
        },
      });
      const event = {
        id: 'event-124',
        eventType: 'pull_request',
        action: 'opened',
        payload: prWebhook,
        processed: false,
      };

      // Mock database responses
      prismaMock.event.findUnique.mockResolvedValue(event);
      prismaMock.user.findMany.mockResolvedValue([radarUser]);
      prismaMock.event.update.mockResolvedValue({});

      // Act
      const { processGitHubEvent } = require('./process-github-event');
      const result = await processGitHubEvent.run({
        eventId: 'event-124',
        eventType: 'pull_request',
        action: 'opened',
        repositoryName: 'testuser/test-repo',
        repositoryId: '67890',
        senderId: '12345',
        senderLogin: 'testuser',
        payload: prWebhook,
        createdAt: new Date().toISOString(),
      });

      // Assert
      expect(result.success).toBe(true);

      // Verify event was processed but no notifications created
      expect(prismaMock.notification.create).not.toHaveBeenCalled();
      expect(slackMock.chat.postMessage).not.toHaveBeenCalled();
    });

    it('should handle bot events based on mute_bot_comments setting', async () => {
      // Arrange
      const botWebhook = TestDataFactory.createPRWebhook('opened', {
        sender: { id: 98765, login: 'dependabot[bot]', type: 'Bot' },
      });
      const radarUser = TestDataFactory.createRadarUser({
        settings: {
          notificationPreferences: {
            pull_request_opened: true,
            mute_bot_comments: false, // Allow bot notifications
          },
        },
      });
      const event = {
        id: 'event-125',
        eventType: 'pull_request',
        action: 'opened',
        payload: botWebhook,
        processed: false,
      };

      // Mock database responses
      prismaMock.event.findUnique.mockResolvedValue(event);
      prismaMock.user.findMany.mockResolvedValue([radarUser]);
      prismaMock.notification.create.mockResolvedValue({
        id: 'notification-125',
      });
      prismaMock.notification.update.mockResolvedValue({});
      prismaMock.event.update.mockResolvedValue({});

      // Mock notification service - bot events should still go through processing
      notificationServiceMock.processPullRequestEvent.mockResolvedValue({
        shouldNotify: true,
        matchedKeywords: [],
        matchDetails: {},
      });

      // Act
      const { processGitHubEvent } = require('./process-github-event');
      const result = await processGitHubEvent.run({
        eventId: 'event-125',
        eventType: 'pull_request',
        action: 'opened',
        repositoryName: 'testuser/test-repo',
        repositoryId: '67890',
        senderId: '98765',
        senderLogin: 'dependabot[bot]',
        payload: botWebhook,
        createdAt: new Date().toISOString(),
      });

      // Assert
      expect(result.success).toBe(true);
      expect(prismaMock.notification.create).toHaveBeenCalled();
      expect(slackMock.chat.postMessage).toHaveBeenCalled();

      // Verify bot username appears in Slack message
      const slackCall = slackMock.chat.postMessage.mock.calls[0][0];
      const attachment = slackCall.attachments[0];
      const titleBlock = attachment.blocks[0];
      expect(titleBlock.text.text).toContain('dependabot[bot]');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing event gracefully', async () => {
      // Arrange
      prismaMock.event.findUnique.mockResolvedValue(null);

      // Act & Assert
      const { processGitHubEvent } = require('./process-github-event');
      await expect(
        processGitHubEvent.run({
          eventId: 'non-existent',
          eventType: 'pull_request',
          action: 'opened',
          repositoryName: 'test/repo',
          repositoryId: '123',
          senderId: '456',
          senderLogin: 'user',
          payload: {},
          createdAt: new Date().toISOString(),
        }),
      ).rejects.toThrow('Event non-existent not found');
    });

    it('should skip already processed events', async () => {
      // Arrange
      const processedEvent = {
        id: 'event-processed',
        processed: true,
      };
      prismaMock.event.findUnique.mockResolvedValue(processedEvent);

      // Act
      const { processGitHubEvent } = require('./process-github-event');
      const result = await processGitHubEvent.run({
        eventId: 'event-processed',
        eventType: 'pull_request',
        action: 'opened',
        repositoryName: 'test/repo',
        repositoryId: '123',
        senderId: '456',
        senderLogin: 'user',
        payload: {},
        createdAt: new Date().toISOString(),
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Event already processed');
      expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    });
  });
});
