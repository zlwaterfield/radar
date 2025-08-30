import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Logger,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { WebhooksService } from '../services/webhooks.service';
import { TriggerQueueService } from '../services/trigger-queue.service';
import { Public } from '@/auth/decorators/public.decorator';

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

    const storedEvent = await this.webhooksService.processGitHubWebhook(
      eventType,
      payload,
    );

    if (!storedEvent) {
      throw new BadRequestException('Failed to process webhook');
    }

    const queued = await this.triggerQueueService.queueGitHubEvent(storedEvent);

    if (!queued) {
      this.logger.error(
        "Failed to queue event for processing - no fallback available",
      );
    } else {
      this.logger.log(
        "Successfully queued event for real-time processing",
      );
    }

    return {
      message: 'Webhook processed successfully',
      deliveryId,
      eventType,
    };
  }
}
