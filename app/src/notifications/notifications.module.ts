import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { GitHubModule } from '../github/github.module';
import { StripeModule } from '../stripe/stripe.module';
import { NotificationService } from './services/notification.service';
import { LLMAnalyzerService } from './services/llm-analyzer.service';
import { NotificationProfileService } from './services/notification-profile.service';
import { NotificationProfileController } from './controllers/notification-profile.controller';

@Module({
  imports: [ConfigModule, DatabaseModule, forwardRef(() => GitHubModule), StripeModule],
  providers: [
    NotificationService,
    LLMAnalyzerService,
    NotificationProfileService,
  ],
  controllers: [NotificationProfileController],
  exports: [
    NotificationService,
    LLMAnalyzerService,
    NotificationProfileService,
  ],
})
export class NotificationsModule {}
