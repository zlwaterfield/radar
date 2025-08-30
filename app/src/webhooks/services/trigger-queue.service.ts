import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tasks } from '@trigger.dev/sdk';

interface GitHubEventPayload {
  eventId: string;
  eventType: string;
  action?: string;
  repositoryName: string;
  repositoryId: string;
  senderId: string;
  senderLogin: string;
  payload: any;
  createdAt: string;
}

@Injectable()
export class TriggerQueueService {
  private readonly logger = new Logger(TriggerQueueService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Queue a GitHub event for processing via Trigger.dev
   */
  async queueGitHubEvent(event: any): Promise<boolean> {
    try {
      const payload: GitHubEventPayload = {
        eventId: event.id,
        eventType: event.eventType,
        action: event.action,
        repositoryName: event.repositoryName,
        repositoryId: event.repositoryId,
        senderId: event.senderId,
        senderLogin: event.senderLogin,
        payload: event.payload,
        createdAt: event.createdAt.toISOString(),
      };

      this.logger.log(
        `Queueing GitHub event ${event.id} (${event.eventType}) for processing`,
      );

      // Trigger the background task
      const handle = await tasks.trigger('process-github-event', payload);

      this.logger.log(
        `Successfully queued event ${event.id} with handle: ${handle.id}`,
      );

      return true;
    } catch (error) {
      this.logger.error(`Failed to queue event ${event.id}:`, error);
      return false;
    }
  }

  /**
   * Get the status of a queued event
   */
  async getEventStatus(eventId: string): Promise<any> {
    try {
      // This would be used to check the status of a specific job
      // For now, just return a placeholder
      return {
        eventId,
        status: 'queued',
        message: 'Event queued for processing',
      };
    } catch (error) {
      this.logger.error(`Failed to get status for event ${eventId}:`, error);
      return {
        eventId,
        status: 'error',
        message: 'Failed to get event status',
      };
    }
  }

  /**
   * Health check for Trigger.dev connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - we could ping Trigger.dev or check configuration
      const projectRef = this.configService.get('TRIGGER_PROJECT_REF');
      if (!projectRef) {
        this.logger.warn('TRIGGER_PROJECT_REF not configured');
        return false;
      }

      this.logger.debug('Trigger.dev service is healthy');
      return true;
    } catch (error) {
      this.logger.error('Trigger.dev health check failed:', error);
      return false;
    }
  }
}
