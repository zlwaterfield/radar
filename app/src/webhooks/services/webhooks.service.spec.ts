import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhooksService } from './webhooks.service';
import { DatabaseService } from '../../database/database.service';
import { UserTeamsSyncService } from '../../users/services/user-teams-sync.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockUserTeamsSyncService: jest.Mocked<UserTeamsSyncService>;

  beforeEach(async () => {
    const mockDatabase = {
      event: {
        create: jest.fn(),
      },
    };

    const mockConfig = {
      get: jest.fn().mockReturnValue('test-webhook-secret'),
    };

    const mockTeamsSync = {
      addTeamMembership: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: DatabaseService, useValue: mockDatabase },
        { provide: ConfigService, useValue: mockConfig },
        { provide: UserTeamsSyncService, useValue: mockTeamsSync },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    mockDatabaseService = module.get(DatabaseService);
    mockConfigService = module.get(ConfigService);
    mockUserTeamsSyncService = module.get(UserTeamsSyncService);
  });

  describe('isRelevantEvent filtering', () => {
    it('should accept pull_request opened event', async () => {
      // Arrange
      const payload = {
        action: 'opened',
        pull_request: { number: 123, title: 'Test PR' },
        repository: { id: 12345, name: 'test-repo' },
        sender: { id: 67890, login: 'testuser', type: 'User' },
      };

      mockDatabaseService.event.create.mockResolvedValue({
        id: 'event-123',
        eventType: 'pull_request',
        processed: false,
      });

      // Act
      const result = await service.processGitHubWebhook(
        'pull_request',
        payload,
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result?.processed).toBe(true);
      expect(result?.event).toBeDefined();
      expect(mockDatabaseService.event.create).toHaveBeenCalledWith({
        data: {
          eventType: 'pull_request',
          action: 'opened',
          repositoryId: '12345',
          repositoryName: 'test-repo',
          senderId: '67890',
          senderLogin: 'testuser',
          processed: false,
          payload: payload,
        },
      });
    });

    it('should reject irrelevant event types', async () => {
      // Arrange
      const payload = {
        action: 'created',
        sender: { id: 123, login: 'user' },
      };

      // Act
      const result = await service.processGitHubWebhook(
        'workflow_run',
        payload,
      );

      // Assert
      expect(result).toEqual({ processed: false });
      expect(mockDatabaseService.event.create).not.toHaveBeenCalled();
    });

    it('should reject bot events for regular events', async () => {
      // Arrange
      const payload = {
        action: 'opened',
        pull_request: { number: 123, title: 'Test PR' },
        repository: { id: 12345, name: 'test-repo' },
        sender: { id: 67890, login: 'dependabot[bot]', type: 'Bot' },
      };

      // Act
      const result = await service.processGitHubWebhook(
        'pull_request',
        payload,
      );

      // Assert
      expect(result).toEqual({ processed: false });
      expect(mockDatabaseService.event.create).not.toHaveBeenCalled();
    });

    it('should reject pull_request with irrelevant action', async () => {
      // Arrange
      const payload = {
        action: 'edited', // Not in the allowed actions list
        pull_request: { number: 123, title: 'Test PR' },
        repository: { id: 12345, name: 'test-repo' },
        sender: { id: 67890, login: 'testuser', type: 'User' },
      };

      // Act
      const result = await service.processGitHubWebhook(
        'pull_request',
        payload,
      );

      // Assert
      expect(result).toEqual({ processed: false });
      expect(mockDatabaseService.event.create).not.toHaveBeenCalled();
    });
  });
});
