import { Module, forwardRef } from '@nestjs/common';
import { SlackIntegrationController } from './controllers/slack-integration.controller';
import { GitHubIntegrationController } from './controllers/github-integration.controller';
import { SlackIntegrationService } from './services/slack-integration.service';
import { GitHubIntegrationService } from './services/github-integration.service';
import { DatabaseModule } from '../database/database.module';
import { GitHubModule } from '../github/github.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [DatabaseModule, GitHubModule, forwardRef(() => UsersModule)],
  controllers: [SlackIntegrationController, GitHubIntegrationController],
  providers: [SlackIntegrationService, GitHubIntegrationService],
  exports: [SlackIntegrationService, GitHubIntegrationService],
})
export class IntegrationsModule {}
