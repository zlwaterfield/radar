import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GitHubService } from './services/github.service';
import { GitHubTokenService } from './services/github-token.service';
import { GitHubController } from './controllers/github.controller';
import { DatabaseModule } from '../database/database.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [ConfigModule, DatabaseModule, AnalyticsModule],
  controllers: [GitHubController],
  providers: [GitHubService, GitHubTokenService],
  exports: [GitHubService, GitHubTokenService],
})
export class GitHubModule {}
