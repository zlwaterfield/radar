import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { DatabaseService } from '@/database/database.service';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;

  constructor(private db: DatabaseService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-08-27.basil',
    });
  }

  async createCheckoutSession(userId: string, priceId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new Error('User not found');
    }

    let customerId = user.stripeCustomerId;

    // Create customer if doesn't exist
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email!,
        metadata: { userId: user.id },
      });
      customerId = customer.id;

      await this.db.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/settings/billing?canceled=true`,
      subscription_data: {
        metadata: { userId },
      },
    });

    return session.url;
  }

  async createPortalSession(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user?.stripeCustomerId) {
      throw new Error('No Stripe customer found');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/settings/billing`,
    });

    return session.url;
  }

  async syncSubscription(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.stripeCustomerId) {
      return this.setFreePlan(userId);
    }

    const subscriptions = await this.stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'all',
      limit: 1,
    });

    if (subscriptions.data.length === 0 || subscriptions.data[0].status === 'canceled') {
      return this.setFreePlan(userId);
    }

    const stripeSub = subscriptions.data[0];
    const priceId = stripeSub.items.data[0].price.id;

    // Use type assertion for accessing period properties
    const subAny = stripeSub as any;

    return this.db.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: stripeSub.id,
        stripePriceId: priceId,
        planName: this.getPlanNameFromPriceId(priceId),
        status: stripeSub.status,
        currentPeriodStart: subAny.current_period_start
          ? new Date(subAny.current_period_start * 1000)
          : null,
        currentPeriodEnd: subAny.current_period_end
          ? new Date(subAny.current_period_end * 1000)
          : null,
        cancelAtPeriodEnd: subAny.cancel_at_period_end ?? false,
        trialStart: subAny.trial_start
          ? new Date(subAny.trial_start * 1000)
          : null,
        trialEnd: subAny.trial_end ? new Date(subAny.trial_end * 1000) : null,
        hasUsedTrial: !!subAny.trial_end,
      },
      update: {
        stripeSubscriptionId: stripeSub.id,
        stripePriceId: priceId,
        planName: this.getPlanNameFromPriceId(priceId),
        status: stripeSub.status,
        currentPeriodStart: subAny.current_period_start
          ? new Date(subAny.current_period_start * 1000)
          : null,
        currentPeriodEnd: subAny.current_period_end
          ? new Date(subAny.current_period_end * 1000)
          : null,
        cancelAtPeriodEnd: subAny.cancel_at_period_end ?? false,
      },
    });
  }

  private getPlanNameFromPriceId(priceId: string): string {
    // Both monthly and annual map to the same plan name
    if (
      priceId === process.env.STRIPE_BASIC_MONTHLY_PRICE_ID ||
      priceId === process.env.STRIPE_BASIC_ANNUAL_PRICE_ID
    ) {
      return 'basic';
    }
    if (
      priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID ||
      priceId === process.env.STRIPE_PRO_ANNUAL_PRICE_ID
    ) {
      return 'pro';
    }
    return 'free';
  }

  private async setFreePlan(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });

    return this.db.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: user?.stripeCustomerId || '',
        planName: 'free',
        status: 'active',
      },
      update: {
        planName: 'free',
        status: 'active',
        stripeSubscriptionId: null,
        stripePriceId: null,
      },
    });
  }
}
