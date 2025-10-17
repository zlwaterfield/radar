import { Module, forwardRef } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { AuthGuard } from './guards/auth.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { DigestConfigService } from '../digest/digest-config.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { StripeModule } from '../stripe/stripe.module';
import { DatabaseModule } from '../database/database.module';
import { auth } from './auth.config';

@Module({
  imports: [
    BetterAuthModule.forRoot(auth),
    forwardRef(() => NotificationsModule),
    DatabaseModule,
    AnalyticsModule,
    StripeModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, DigestConfigService],
  exports: [AuthService, AuthGuard],
})
export class RadarAuthModule {}
