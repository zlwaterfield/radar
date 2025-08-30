import { Module } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { AuthGuard } from './guards/auth.guard';
import { auth } from './auth.config';

@Module({
  imports: [BetterAuthModule.forRoot(auth)],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class RadarAuthModule {}
