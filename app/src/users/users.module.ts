import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersService } from './services/users.service';
import { UsersController } from './controllers/users.controller';
import { UserSettingsService } from './services/user-settings.service';
import { UserRepositoriesService } from './services/user-repositories.service';
import { UserSettingsController } from './controllers/user-settings.controller';
import { UserRepositoriesController } from './controllers/user-repositories.controller';
import { RadarAuthModule } from '../auth/auth.module';
import { GitHubModule } from '../github/github.module';

@Module({
  imports: [ConfigModule, RadarAuthModule, GitHubModule],
  controllers: [
    UsersController,
    UserSettingsController,
    UserRepositoriesController,
  ],
  providers: [UsersService, UserSettingsService, UserRepositoriesService],
  exports: [UsersService, UserSettingsService, UserRepositoriesService],
})
export class UsersModule {}
