import { Module } from '@nestjs/common';
import { DigestService } from './digest.service';
import { DigestController } from './digest.controller';
import { DatabaseModule } from '../database/database.module';
import { GitHubModule } from '../github/github.module';
import { SlackModule } from '../slack/slack.module';
import { RadarAuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, GitHubModule, SlackModule, RadarAuthModule],
  controllers: [DigestController],
  providers: [DigestService],
  exports: [DigestService],
})
export class DigestModule {}