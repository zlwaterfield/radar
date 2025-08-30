import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebhooksService } from './services/webhooks.service';
import { TriggerQueueService } from './services/trigger-queue.service';
import { WebhooksController } from './controllers/webhooks.controller';
import { RadarAuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, RadarAuthModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, TriggerQueueService],
  exports: [WebhooksService, TriggerQueueService],
})
export class WebhooksModule {}
