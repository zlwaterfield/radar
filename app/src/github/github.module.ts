import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GitHubService } from './services/github.service';
import { GitHubController } from './controllers/github.controller';
import { RadarAuthModule } from '../auth/auth.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => RadarAuthModule),
    forwardRef(() => IntegrationsModule),
  ],
  controllers: [GitHubController],
  providers: [GitHubService],
  exports: [GitHubService],
})
export class GitHubModule {}
