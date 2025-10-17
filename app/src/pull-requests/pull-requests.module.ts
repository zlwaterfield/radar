import { Module } from '@nestjs/common';
import { PullRequestService } from './services/pull-request.service';
import { PullRequestSyncService } from './services/pull-request-sync.service';
import { PullRequestsController } from './controllers/pull-requests.controller';
import { DatabaseModule } from '../database/database.module';
import { GitHubModule } from '../github/github.module';
import { RadarAuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, GitHubModule, RadarAuthModule],
  controllers: [PullRequestsController],
  providers: [PullRequestService, PullRequestSyncService],
  exports: [PullRequestService, PullRequestSyncService],
})
export class PullRequestsModule {}
