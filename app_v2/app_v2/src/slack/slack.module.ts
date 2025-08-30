import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SlackService } from './services/slack.service';
import { SlackController } from './controllers/slack.controller';
import { SlackMessageService } from './services/slack-message.service';
import { RadarAuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, RadarAuthModule],
  controllers: [SlackController],
  providers: [
    SlackService,
    SlackMessageService,
  ],
  exports: [
    SlackService,
    SlackMessageService,
  ],
})
export class SlackModule {}