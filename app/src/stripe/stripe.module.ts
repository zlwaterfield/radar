import { Module } from '@nestjs/common';
import { StripeService } from './services/stripe.service';
import { EntitlementsService } from './services/entitlements.service';
import { StripeWebhooksController } from './controllers/stripe-webhooks.controller';
import { BillingController } from './controllers/billing.controller';
import { EntitlementGuard } from './guards/entitlement.guard';
import { DatabaseModule } from '@/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [StripeWebhooksController, BillingController],
  providers: [StripeService, EntitlementsService, EntitlementGuard],
  exports: [StripeService, EntitlementsService, EntitlementGuard],
})
export class StripeModule {}
