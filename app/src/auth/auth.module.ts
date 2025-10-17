import { Module, forwardRef } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { AuthGuard } from './guards/auth.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { DigestModule } from '../digest/digest.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { StripeModule } from '../stripe/stripe.module';
import { auth } from './auth.config';

@Module({
  imports: [
    BetterAuthModule.forRoot(auth),
    forwardRef(() => NotificationsModule),
    forwardRef(() => DigestModule),
    AnalyticsModule,
    StripeModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class RadarAuthModule {}
