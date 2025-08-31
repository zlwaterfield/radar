import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { DatabaseService } from '../../database/database.service';
import type { GitHubWebhookPayload } from '../../common/types';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Verify GitHub webhook signature
   */
  verifyGitHubSignature(payload: string, signature: string): boolean {
    try {
      const secret = this.configService.get('github.webhookSecret');
      if (!secret) {
        this.logger.error('GitHub webhook secret not configured');
        return false;
      }

      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload, 'utf8');
      const expectedSignature = `sha256=${hmac.digest('hex')}`;

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      this.logger.error('Error verifying GitHub signature:', error);
      return false;
    }
  }

  /**
   * Process GitHub webhook payload
   */
  async processGitHubWebhook(
    eventType: string,
    payload: GitHubWebhookPayload,
  ): Promise<any> {
    try {
      if (!this.isRelevantEvent(eventType, payload)) {
        this.logger.debug(`Skipping irrelevant event: ${eventType}`);
        return null;
      }

      const event = await this.storeEvent(eventType, payload);

      if (!event) {
        this.logger.error('Failed to store event in database');
        return null;
      }

      this.logger.log(
        `Processed ${eventType} event for repository ${payload.repository?.name}`,
      );
      return event;
    } catch (error) {
      this.logger.error(
        `Error processing GitHub webhook (${eventType}):`,
        error,
      );
      return null;
    }
  }

  /**
   * Check if event is relevant for processing
   */
  private isRelevantEvent(eventType: string, payload: any): boolean {
    const relevantEvents = [
      'pull_request',
      'pull_request_review',
      'pull_request_review_comment',
      'issues',
      'issue_comment',
      'push',
      'create',
      'delete',
      'release',
      'star',
      'fork',
    ];

    if (!relevantEvents.includes(eventType)) {
      return false;
    }

    // Skip bot events
    if (payload.sender?.type === 'Bot') {
      return false;
    }

    // For pull_request events, only process specific actions
    if (eventType === 'pull_request') {
      const relevantActions = [
        'opened',
        'closed',
        'reopened',
        'ready_for_review',
        'review_requested',
        'assigned',
        'unassigned',
      ];
      return relevantActions.includes(payload.action);
    }

    // For issues events, only process specific actions
    if (eventType === 'issues') {
      const relevantActions = [
        'opened',
        'closed',
        'reopened',
        'assigned',
        'unassigned',
      ];
      return relevantActions.includes(payload.action);
    }

    // For review events, only process submitted reviews
    if (eventType === 'pull_request_review') {
      return payload.action === 'submitted';
    }

    // For comments, skip if it's just editing
    if (
      eventType === 'issue_comment' ||
      eventType === 'pull_request_review_comment'
    ) {
      return payload.action === 'created';
    }

    return true;
  }

  /**
   * Store event in database
   */
  private async storeEvent(eventType: string, payload: any): Promise<any> {
    try {
      const repositoryId = payload.repository?.id?.toString() || '';
      const repositoryName = payload.repository?.full_name || '';
      const senderId = payload.sender?.id?.toString() || '';
      const senderLogin = payload.sender?.login || '';

      return await this.databaseService.event.create({
        data: {
          eventType,
          action: payload.action || null,
          repositoryId,
          repositoryName,
          senderId,
          senderLogin,
          processed: false,
          payload: payload,
        },
      });
    } catch (error) {
      this.logger.error('Error storing event:', error);
      return null;
    }
  }

  /**
   * Get unprocessed events
   */
  async getUnprocessedEvents(limit = 50): Promise<any[]> {
    try {
      return await this.databaseService.event.findMany({
        where: {
          processed: false,
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: limit,
      });
    } catch (error) {
      this.logger.error('Error getting unprocessed events:', error);
      return [];
    }
  }

  /**
   * Mark event as processed
   */
  async markEventProcessed(eventId: string): Promise<boolean> {
    try {
      await this.databaseService.event.update({
        where: { id: eventId },
        data: {
          processed: true,
          updatedAt: new Date(),
        },
      });

      return true;
    } catch (error) {
      this.logger.error(`Error marking event ${eventId} as processed:`, error);
      return false;
    }
  }

  /**
   * Get events by repository
   */
  async getEventsByRepository(
    repositoryId: string,
    limit = 20,
  ): Promise<any[]> {
    try {
      return await this.databaseService.event.findMany({
        where: {
          repositoryId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });
    } catch (error) {
      this.logger.error(
        `Error getting events for repository ${repositoryId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get events by user
   */
  async getEventsByUser(userId: string, limit = 20): Promise<any[]> {
    try {
      return await this.databaseService.event.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });
    } catch (error) {
      this.logger.error(`Error getting events for user ${userId}:`, error);
      return [];
    }
  }
}
