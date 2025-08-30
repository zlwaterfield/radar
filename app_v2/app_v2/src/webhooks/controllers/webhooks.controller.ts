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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WebhooksService } from '../services/webhooks.service';
import { EventProcessingService } from '../services/event-processing.service';
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
    private readonly eventProcessingService: EventProcessingService,
  ) {}

  /**
   * Handle GitHub webhook
   */
  @Public()
  @Post('github')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle GitHub webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature or payload' })
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
      this.logger.warn(`Invalid GitHub webhook signature for delivery ${deliveryId}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(
      `Received GitHub webhook: ${eventType} for ${payload.repository?.full_name} (${deliveryId})`,
    );

    // Process webhook
    const success = await this.webhooksService.processGitHubWebhook(eventType, payload);

    if (!success) {
      throw new BadRequestException('Failed to process webhook');
    }

    // Trigger event processing asynchronously
    this.eventProcessingService.processEvents().catch((error) => {
      this.logger.error('Error processing events:', error);
    });

    return {
      message: 'Webhook processed successfully',
      deliveryId,
      eventType,
    };
  }

  /**
   * Process pending events manually
   */
  @Post('process-events')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually trigger event processing' })
  @ApiResponse({ status: 200, description: 'Events processing initiated' })
  async processEvents(@GetUser() user: User) {
    this.logger.log(`Manual event processing triggered by user ${user.id}`);
    
    const processedCount = await this.eventProcessingService.processEvents();
    
    return {
      message: 'Event processing completed',
      processedCount,
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
      events: events.map(event => ({
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