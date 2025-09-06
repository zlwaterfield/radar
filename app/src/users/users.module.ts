import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersService } from './services/users.service';
import { UsersController } from './controllers/users.controller';
import { UserRepositoriesService } from './services/user-repositories.service';
import { UserTeamsService } from './services/user-teams.service';
import { UserTeamsSyncService } from './services/user-teams-sync.service';
import { UserRepositoriesController } from './controllers/user-repositories.controller';
import { UserTeamsController } from './controllers/user-teams.controller';
import { RadarAuthModule } from '../auth/auth.module';
import { GitHubModule } from '../github/github.module';

@Module({
  imports: [ConfigModule, forwardRef(() => RadarAuthModule), GitHubModule],
  controllers: [
    UsersController,
    UserRepositoriesController,
    UserTeamsController,
  ],
  providers: [
    UsersService,
    UserRepositoriesService,
    UserTeamsService,
    UserTeamsSyncService,
  ],
  exports: [
    UsersService,
    UserRepositoriesService,
    UserTeamsService,
    UserTeamsSyncService,
  ],
})
export class UsersModule {}
