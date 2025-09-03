import { Module } from '@nestjs/common';
import { DigestService } from './digest.service';
import { DigestConfigService } from './digest-config.service';
import { DigestController } from './digest.controller';
import { DigestConfigController } from './digest-config.controller';
import { DatabaseModule } from '../database/database.module';
import { GitHubModule } from '../github/github.module';
import { SlackModule } from '../slack/slack.module';
import { RadarAuthModule } from '../auth/auth.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [DatabaseModule, GitHubModule, SlackModule, RadarAuthModule, IntegrationsModule],
  controllers: [DigestController, DigestConfigController],
  providers: [DigestService, DigestConfigService],
  exports: [DigestService, DigestConfigService],
})
export class DigestModule {}
