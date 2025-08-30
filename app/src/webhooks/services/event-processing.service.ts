import { Injectable, Logger } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { NotificationsService } from '@/notifications/services/notifications.service';

@Injectable()
export class EventProcessingService {
  private readonly logger = new Logger(EventProcessingService.name);
  private isProcessing = false;

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Process all unprocessed events
   */
  async processEvents(): Promise<number> {
    if (this.isProcessing) {
      this.logger.debug('Event processing already in progress, skipping');
      return 0;
    }

    this.isProcessing = true;
    let processedCount = 0;

    try {
      this.logger.debug('Starting event processing');

      // Get unprocessed events in batches
      let events = await this.webhooksService.getUnprocessedEvents(50);

      while (events.length > 0) {
        for (const event of events) {
          const success = await this.processEvent(event);

          if (success) {
            await this.webhooksService.markEventProcessed(event.id);
            processedCount++;
          }
        }

        // Get next batch
        events = await this.webhooksService.getUnprocessedEvents(50);
      }

      this.logger.log(`Processed ${processedCount} events`);
      return processedCount;
    } catch (error) {
      this.logger.error('Error in event processing:', error);
      return processedCount;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: any): Promise<boolean> {
    try {
      this.logger.debug(`Processing event ${event.id} (${event.eventType})`);

      // Process the event through the notifications service
      const success = await this.notificationsService.processEvent(event);

      if (success) {
        this.logger.debug(`Successfully processed event ${event.id}`);
      } else {
        this.logger.warn(`Failed to process event ${event.id}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Error processing event ${event.id}:`, error);
      return false;
    }
  }

  /**
   * Get processing status
   */
  getProcessingStatus(): {
    isProcessing: boolean;
    serviceName: string;
  } {
    return {
      isProcessing: this.isProcessing,
      serviceName: 'EventProcessingService',
    };
  }
}
