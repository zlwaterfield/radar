/**
 * Integration test for the complete GitHub webhook → Slack notification flow
 * Tests the end-to-end pipeline from webhook reception to notification delivery
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhooksController } from './controllers/webhooks.controller';
import { WebhooksService } from './services/webhooks.service';
import { TriggerQueueService } from './services/trigger-queue.service';
import { DatabaseService } from '../database/database.service';
import { UserTeamsSyncService } from '../users/services/user-teams-sync.service';
import { TestDataFactory, TestMocks } from '../test/test-utilities';

describe('Webhook Integration Flow', () => {
  let controller: WebhooksController;
  let webhooksService: WebhooksService;
  let triggerQueueService: jest.Mocked<TriggerQueueService>;
  let databaseService: jest.Mocked<DatabaseService>;

  beforeEach(async () => {
    const mockDatabase = TestMocks.createPrismaMock();
    const mockTriggerQueue = {
      queueGitHubEvent: jest.fn().mockResolvedValue(true),
    };
    const mockConfig = {
      get: jest.fn().mockReturnValue('test-webhook-secret'),
    };
    const mockTeamsSync = {
      addTeamMembership: jest.fn(),
      removeTeamMembership: jest.fn(),
      syncUserGitHubData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        WebhooksService,
        { provide: TriggerQueueService, useValue: mockTriggerQueue },
        { provide: DatabaseService, useValue: mockDatabase },
        { provide: ConfigService, useValue: mockConfig },
        { provide: UserTeamsSyncService, useValue: mockTeamsSync },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    webhooksService = module.get<WebhooksService>(WebhooksService);
    triggerQueueService = module.get(TriggerQueueService);
    databaseService = module.get(DatabaseService);
  });

  describe('PR Opened Webhook Flow', () => {
    it('should process complete PR opened flow', async () => {
      // Arrange
      const prPayload = TestDataFactory.createPRWebhook('opened', {
        pull_request: {
          number: 123,
          title: 'Add user authentication',
          html_url: 'https://github.com/test/repo/pull/123',
          user: { login: 'developer' },
        },
        repository: {
          id: 12345,
          name: 'test-repo',
          full_name: 'test/repo',
        },
        sender: {
          id: 67890,
          login: 'developer',
          type: 'User',
        },
      });

      const mockEvent = {
        id: 'event-123',
        eventType: 'pull_request',
        action: 'opened',
        processed: false,
        payload: prPayload,
      };

      // Mock database responses
      databaseService.event.create.mockResolvedValue(mockEvent);

      // Mock signature verification by spying on the service method
      const verifySpy = jest
        .spyOn(webhooksService, 'verifyGitHubSignature')
        .mockReturnValue(true);

      // Act
      const result = await controller.handleGitHubWebhook(
        prPayload,
        'pull_request',
        'delivery-123',
        'sha256=valid-signature',
      );

      // Assert
      expect(result).toEqual({
        message: 'Webhook processed successfully',
        deliveryId: 'delivery-123',
        eventType: 'pull_request',
      });

      // Verify signature was checked
      expect(verifySpy).toHaveBeenCalled();

      // Verify event was stored
      expect(databaseService.event.create).toHaveBeenCalledWith({
        data: {
          eventType: 'pull_request',
          action: 'opened',
          repositoryId: '12345',
          repositoryName: 'test/repo',
          senderId: '67890',
          senderLogin: 'developer',
          processed: false,
          payload: prPayload,
        },
      });

      // Verify event was queued for processing
      expect(triggerQueueService.queueGitHubEvent).toHaveBeenCalledWith(
        mockEvent,
      );
    });
  });

  describe('Event Filtering Integration', () => {
    it('should reject irrelevant events', async () => {
      const pushPayload = {
        ref: 'refs/heads/main',
        repository: { id: 12345, name: 'test-repo' },
        sender: { id: 67890, login: 'developer', type: 'User' },
      };

      const verifySpy = jest
        .spyOn(webhooksService, 'verifyGitHubSignature')
        .mockReturnValue(true);

      const result = await controller.handleGitHubWebhook(
        pushPayload,
        'push', // Not in relevant events list
        'delivery-124',
        'sha256=valid-signature',
      );

      expect(result.message).toContain('event was skipped');
      expect(databaseService.event.create).not.toHaveBeenCalled();
      expect(triggerQueueService.queueGitHubEvent).not.toHaveBeenCalled();
    });

    it('should reject bot events for regular events', async () => {
      const botPRPayload = TestDataFactory.createPRWebhook('opened', {
        sender: { id: 98765, login: 'dependabot[bot]', type: 'Bot' },
      });

      const verifySpy = jest
        .spyOn(webhooksService, 'verifyGitHubSignature')
        .mockReturnValue(true);

      const result = await controller.handleGitHubWebhook(
        botPRPayload,
        'pull_request',
        'delivery-125',
        'sha256=valid-signature',
      );

      expect(result.message).toContain('event was skipped');
      expect(databaseService.event.create).not.toHaveBeenCalled();
    });

    it('should accept bot events for membership changes', async () => {
      const membershipPayload = {
        action: 'added',
        member: { id: 12345, login: 'newmember' },
        team: { id: 67890, slug: 'dev-team', name: 'Development Team' },
        organization: { login: 'test-org' },
        sender: { id: 98765, login: 'github-bot', type: 'Bot' },
      };

      const mockUser = TestDataFactory.createRadarUser({
        githubId: '12345',
      });

      databaseService.user.findFirst.mockResolvedValue(mockUser);

      const verifySpy = jest
        .spyOn(webhooksService, 'verifyGitHubSignature')
        .mockReturnValue(true);

      const result = await controller.handleGitHubWebhook(
        membershipPayload,
        'membership',
        'delivery-126',
        'sha256=valid-signature',
      );

      expect(result.message).toBe('Webhook processed successfully');
      // Should not create regular event record for membership
      expect(databaseService.event.create).not.toHaveBeenCalled();
      // Should not queue for trigger processing
      expect(triggerQueueService.queueGitHubEvent).not.toHaveBeenCalled();
    });
  });

  describe('Security Validation', () => {
    it('should reject invalid signatures', async () => {
      const prPayload = TestDataFactory.createPRWebhook('opened');

      const verifySpy = jest
        .spyOn(webhooksService, 'verifyGitHubSignature')
        .mockReturnValue(false);

      await expect(
        controller.handleGitHubWebhook(
          prPayload,
          'pull_request',
          'delivery-127',
          'sha256=invalid-signature',
        ),
      ).rejects.toThrow('Invalid webhook signature');

      expect(databaseService.event.create).not.toHaveBeenCalled();
      expect(triggerQueueService.queueGitHubEvent).not.toHaveBeenCalled();
    });

    it('should reject missing headers', async () => {
      const prPayload = TestDataFactory.createPRWebhook('opened');

      await expect(
        controller.handleGitHubWebhook(
          prPayload,
          '', // Missing event type
          'delivery-128',
          'sha256=signature',
        ),
      ).rejects.toThrow('Missing X-GitHub-Event header');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const prPayload = TestDataFactory.createPRWebhook('opened');

      const verifySpy = jest
        .spyOn(webhooksService, 'verifyGitHubSignature')
        .mockReturnValue(true);
      databaseService.event.create.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        controller.handleGitHubWebhook(
          prPayload,
          'pull_request',
          'delivery-129',
          'sha256=valid-signature',
        ),
      ).rejects.toThrow('Failed to process webhook');
    });

    it('should handle trigger queue failures', async () => {
      const prPayload = TestDataFactory.createPRWebhook('opened');
      const mockEvent = {
        id: 'event-130',
        eventType: 'pull_request',
        processed: false,
      };

      const verifySpy = jest
        .spyOn(webhooksService, 'verifyGitHubSignature')
        .mockReturnValue(true);
      databaseService.event.create.mockResolvedValue(mockEvent);
      triggerQueueService.queueGitHubEvent.mockResolvedValue(false); // Queue failed

      // Should still return success - queueing failure is logged but not thrown
      const result = await controller.handleGitHubWebhook(
        prPayload,
        'pull_request',
        'delivery-130',
        'sha256=valid-signature',
      );

      expect(result.message).toBe('Webhook processed successfully');
    });
  });

  describe('Complete Notification Flow Simulation', () => {
    it('should demonstrate full pipeline for relevant user', async () => {
      // This test simulates what happens after the webhook is processed
      // and the trigger task processes the event

      const prPayload = TestDataFactory.createPRWebhook('opened', {
        pull_request: {
          number: 456,
          title: 'Fix critical security issue',
          user: { login: 'security-dev' },
          requested_reviewers: [{ login: 'reviewer1' }],
        },
      });

      const mockEvent = {
        id: 'event-131',
        eventType: 'pull_request',
        action: 'opened',
        processed: false,
        payload: prPayload,
      };

      const relevantUser = TestDataFactory.createRadarUser({
        githubLogin: 'reviewer1',
        settings: {
          notificationPreferences: {
            pull_request_opened: true,
            mute_own_activity: true,
            mute_bot_comments: false,
          },
        },
      });

      // Mock the complete flow
      const verifySpy = jest
        .spyOn(webhooksService, 'verifyGitHubSignature')
        .mockReturnValue(true);
      databaseService.event.create.mockResolvedValue(mockEvent);
      triggerQueueService.queueGitHubEvent.mockResolvedValue(true);

      // Process webhook
      const webhookResult = await controller.handleGitHubWebhook(
        prPayload,
        'pull_request',
        'delivery-131',
        'sha256=valid-signature',
      );

      expect(webhookResult.message).toBe('Webhook processed successfully');

      // Verify the chain of events
      expect(databaseService.event.create).toHaveBeenCalled();
      expect(triggerQueueService.queueGitHubEvent).toHaveBeenCalledWith(
        mockEvent,
      );

      // At this point, the trigger task would:
      // 1. Find relevant users (reviewer1 in this case)
      // 2. Check notification preferences (pull_request_opened: true)
      // 3. Determine watching reasons (REVIEWER)
      // 4. Create Slack message
      // 5. Send to user's Slack DM
      // 6. Mark event as processed

      // This flow is tested separately in the process-github-event.spec.ts
    });
  });
});
