import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './services/notifications.service';
import { NotificationDistributionService } from './services/notification-distribution.service';
import { NotificationsController } from './controllers/notifications.controller';
import { RadarAuthModule } from '../auth/auth.module';
import { SlackModule } from '../slack/slack.module';
import { UsersModule } from '../users/users.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule,
    RadarAuthModule,
    SlackModule,
    UsersModule,
    forwardRef(() => WebhooksModule),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDistributionService,
  ],
  exports: [
    NotificationsService,
    NotificationDistributionService,
  ],
})
export class NotificationsModule {}