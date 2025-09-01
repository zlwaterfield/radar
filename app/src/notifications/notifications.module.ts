import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { GitHubModule } from '../github/github.module';
import { NotificationService } from './services/notification.service';
import { LLMAnalyzerService } from './services/llm-analyzer.service';

@Module({
  imports: [ConfigModule, DatabaseModule, GitHubModule],
  providers: [NotificationService, LLMAnalyzerService],
  exports: [NotificationService, LLMAnalyzerService],
})
export class NotificationsModule {}
