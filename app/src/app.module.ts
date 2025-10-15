import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import githubConfig from './config/github.config';
import slackConfig from './config/slack.config';
import monitoringConfig from './config/monitoring.config';

import { DatabaseModule } from './database/database.module';
import { RadarAuthModule } from './auth/auth.module';
import { GitHubModule } from './github/github.module';
import { SlackModule } from './slack/slack.module';
import { UsersModule } from './users/users.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DigestModule } from './digest/digest.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { StripeModule } from './stripe/stripe.module';

import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ErrorTrackingInterceptor } from './common/interceptors/error-tracking.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        githubConfig,
        slackConfig,
        monitoringConfig,
      ],
      envFilePath: ['.env.local', '.env'],
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    ScheduleModule.forRoot(),
    DatabaseModule,
    RadarAuthModule,
    GitHubModule,
    SlackModule,
    UsersModule,
    WebhooksModule,
    IntegrationsModule,
    NotificationsModule,
    DigestModule,
    AnalyticsModule,
    StripeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ErrorTrackingInterceptor,
    },
  ],
})
export class AppModule {}
