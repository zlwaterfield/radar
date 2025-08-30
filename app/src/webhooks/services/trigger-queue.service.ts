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
}
