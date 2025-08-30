import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Configuration imports
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import githubConfig from './config/github.config';
import slackConfig from './config/slack.config';
import monitoringConfig from './config/monitoring.config';

// Module imports
import { DatabaseModule } from './database/database.module';
import { RadarAuthModule } from './auth/auth.module';
import { GitHubModule } from './github/github.module';
import { SlackModule } from './slack/slack.module';
import { UsersModule } from './users/users.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { NotificationsModule } from './notifications/notifications.module';
import { IntegrationsModule } from './integrations/integrations.module';

// Global providers
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    // Global configuration
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

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Task scheduling
    ScheduleModule.forRoot(),

    // Database
    DatabaseModule,

    // Authentication
    RadarAuthModule,

    // GitHub Integration
    GitHubModule,

    // Slack Integration
    SlackModule,

    // User Management
    UsersModule,

    // Webhooks
    WebhooksModule,

    // Notifications
    NotificationsModule,

    // Integrations
    IntegrationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },

    // Global request logging interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
