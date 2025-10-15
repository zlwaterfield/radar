import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { CurrentUser } from '@/auth/decorators/user.decorator';
import { StripeService } from '../services/stripe.service';
import { EntitlementsService } from '../services/entitlements.service';

@Controller('billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(
    private stripeService: StripeService,
    private entitlementsService: EntitlementsService,
  ) {}

  @Get('subscription')
  async getSubscription(@CurrentUser('id') userId: string) {
    const subscription = await this.stripeService.syncSubscription(userId);
    return subscription;
  }

  @Get('entitlements')
  async getEntitlements(@CurrentUser('id') userId: string) {
    const entitlements = await this.entitlementsService.getUserEntitlements(userId);
    return entitlements;
  }

  @Post('checkout')
  async createCheckout(
    @CurrentUser('id') userId: string,
    @Body('priceId') priceId: string,
  ) {
    const url = await this.stripeService.createCheckoutSession(userId, priceId);
    return { url };
  }

  @Post('portal')
  async createPortal(@CurrentUser('id') userId: string) {
    const url = await this.stripeService.createPortalSession(userId);
    return { url };
  }

  @Post('sync')
  async syncSubscription(@CurrentUser('id') userId: string) {
    await this.stripeService.syncSubscription(userId);
    await this.entitlementsService.syncUserEntitlements(userId);
    return { success: true, message: 'Subscription synced successfully' };
  }
}
