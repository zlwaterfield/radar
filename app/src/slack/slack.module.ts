import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SlackService } from './services/slack.service';
import { SlackController } from './controllers/slack.controller';
import { RadarAuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { PullRequestsModule } from '../pull-requests/pull-requests.module';

@Module({
  imports: [ConfigModule, RadarAuthModule, UsersModule, PullRequestsModule],
  controllers: [SlackController],
  providers: [SlackService],
  exports: [SlackService],
})
export class SlackModule {}
