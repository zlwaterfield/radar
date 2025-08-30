import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Logger,
  BadRequestException,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WebhooksService } from '../services/webhooks.service';
import { TriggerQueueService } from '../services/trigger-queue.service';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { GetUser } from '@/auth/decorators/user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import type { User } from '@prisma/client';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly triggerQueueService: TriggerQueueService,
  ) {}

  /**
   * Handle GitHub webhook
   */
  @Public()
  @Post('github')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle GitHub webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid webhook signature or payload',
  })
  async handleGitHubWebhook(
    @Body() payload: any,
    @Headers('x-github-event') eventType: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Headers('x-hub-signature-256') signature: string,
  ) {
    if (!eventType) {
      throw new BadRequestException('Missing X-GitHub-Event header');
    }

    if (!signature) {
      throw new BadRequestException('Missing X-Hub-Signature-256 header');
    }

    // Verify webhook signature
    const payloadString = JSON.stringify(payload);
    const isValidSignature = this.webhooksService.verifyGitHubSignature(
      payloadString,
      signature,
    );

    if (!isValidSignature) {
      this.logger.warn(
        `Invalid GitHub webhook signature for delivery ${deliveryId}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(
      `Received GitHub webhook: ${eventType} for ${payload.repository?.full_name} (${deliveryId})`,
    );

    // Process and store webhook
    const storedEvent = await this.webhooksService.processGitHubWebhook(
      eventType,
      payload,
    );

    if (!storedEvent) {
      throw new BadRequestException('Failed to process webhook');
    }

    // Queue event for real-time processing via Trigger.dev
    const queued = await this.triggerQueueService.queueGitHubEvent(storedEvent);

    if (!queued) {
      this.logger.error(
        `Failed to queue event ${storedEvent.id} for processing - no fallback available`,
      );
      // Note: With Trigger.dev handling everything, we rely on its retry mechanism
      // If this fails, the event remains in the database but won't be processed
    } else {
      this.logger.log(
        `Successfully queued event ${storedEvent.id} for real-time processing`,
      );
    }

    return {
      message: 'Webhook processed successfully',
      deliveryId,
      eventType,
    };
  }

  /**
   * Process pending events manually (requeue failed events to Trigger.dev)
   */
  @Post('process-events')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Manually requeue unprocessed events to Trigger.dev',
  })
  @ApiResponse({ status: 200, description: 'Events requeued successfully' })
  async processEvents(@GetUser() user: User) {
    this.logger.log(`Manual event requeuing triggered by user ${user.id}`);

    // Get unprocessed events and requeue them to Trigger.dev
    const unprocessedEvents =
      await this.webhooksService.getUnprocessedEvents(100);
    let requeuedCount = 0;

    for (const event of unprocessedEvents) {
      const queued = await this.triggerQueueService.queueGitHubEvent(event);
      if (queued) {
        requeuedCount++;
      }
    }

    this.logger.log(
      `Requeued ${requeuedCount}/${unprocessedEvents.length} events`,
    );

    return {
      message: 'Event requeuing completed',
      totalUnprocessed: unprocessedEvents.length,
      requeuedCount,
    };
  }

  /**
   * Get webhook statistics
   */
  @Get('stats')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get webhook and event statistics' })
  @ApiResponse({ status: 200, description: 'Webhook statistics' })
  async getWebhookStats() {
    const stats = await this.webhooksService.getEventStats();

    return {
      ...stats,
      message: 'Statistics retrieved successfully',
    };
  }

  /**
   * Get recent events for user
   */
  @Get('events/recent')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recent events for current user' })
  @ApiResponse({ status: 200, description: 'Recent events' })
  async getRecentEvents(@GetUser() user: User) {
    const events = await this.webhooksService.getEventsByUser(user.id, 50);

    return {
      events: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        action: event.action,
        repositoryName: event.repositoryName,
        senderLogin: event.senderLogin,
        processed: event.processed,
        createdAt: event.createdAt,
      })),
      count: events.length,
    };
  }

  /**
   * Clean up old processed events
   */
  @Post('cleanup')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clean up old processed events' })
  @ApiResponse({ status: 200, description: 'Cleanup completed' })
  async cleanupOldEvents(@GetUser() user: User) {
    this.logger.log(`Event cleanup triggered by user ${user.id}`);

    const deletedCount = await this.webhooksService.cleanupOldEvents(30);

    return {
      message: 'Cleanup completed',
      deletedEvents: deletedCount,
    };
  }

  /**
   * Health check for webhook endpoint
   */
  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Webhook service health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'webhooks',
      timestamp: new Date().toISOString(),
    };
  }
}
