import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebhooksService } from './services/webhooks.service';
import { EventProcessingService } from './services/event-processing.service';
import { WebhooksController } from './controllers/webhooks.controller';
import { RadarAuthModule } from '../auth/auth.module';
import { GitHubModule } from '../github/github.module';
import { SlackModule } from '../slack/slack.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    RadarAuthModule,
    GitHubModule,
    SlackModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, EventProcessingService],
  exports: [WebhooksService, EventProcessingService],
})
export class WebhooksModule {}
