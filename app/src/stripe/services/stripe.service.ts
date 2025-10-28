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

  async getUserIdFromCustomerId(customerId: string): Promise<string | null> {
    const user = await this.db.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });

    return user?.id || null;
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
    const firstSubItem = stripeSub.items.data[0];
    const priceId = stripeSub.items.data[0].price.id;

    return this.db.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: stripeSub.id,
        stripePriceId: priceId,
        planName: this.getPlanNameFromPriceId(priceId),
        status: stripeSub.status,
        currentPeriodStart: firstSubItem.current_period_start
          ? new Date(firstSubItem.current_period_start * 1000)
          : null,
        currentPeriodEnd: firstSubItem.current_period_end
          ? new Date(firstSubItem.current_period_end * 1000)
          : null,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end ?? false,
        trialStart: stripeSub.trial_start
          ? new Date(stripeSub.trial_start * 1000)
          : null,
        trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
        hasUsedTrial: !!stripeSub.trial_end,
      },
      update: {
        stripeSubscriptionId: stripeSub.id,
        stripePriceId: priceId,
        planName: this.getPlanNameFromPriceId(priceId),
        status: stripeSub.status,
        currentPeriodStart: firstSubItem.current_period_start
          ? new Date(firstSubItem.current_period_start * 1000)
          : null,
        currentPeriodEnd: firstSubItem.current_period_end
          ? new Date(firstSubItem.current_period_end * 1000)
          : null,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end ?? false,
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

  async changeSubscription(userId: string, newPriceId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // If user doesn't have an active subscription, use checkout flow instead
    if (!user.subscription?.stripeSubscriptionId) {
      throw new Error('No active subscription to change. Use checkout instead.');
    }

    // Get the current subscription from Stripe
    const stripeSubscription = await this.stripe.subscriptions.retrieve(
      user.subscription.stripeSubscriptionId,
    );

    if (!stripeSubscription || stripeSubscription.status === 'canceled') {
      throw new Error('No active subscription found in Stripe');
    }

    // Update the subscription with the new price
    const updatedSubscription = await this.stripe.subscriptions.update(
      user.subscription.stripeSubscriptionId,
      {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: 'create_prorations', // Pro-rate the charge
      },
    );

    this.logger.log(`Subscription updated for user ${userId} to price ${newPriceId}`);

    // Sync the updated subscription
    await this.syncSubscription(userId);

    return updatedSubscription;
  }

  async cancelSubscription(userId: string, cancelImmediately: boolean = false) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.subscription?.stripeSubscriptionId) {
      throw new Error('No active subscription to cancel');
    }

    if (cancelImmediately) {
      // Cancel immediately
      await this.stripe.subscriptions.cancel(user.subscription.stripeSubscriptionId);
      this.logger.log(`Subscription canceled immediately for user ${userId}`);
    } else {
      // Cancel at period end
      await this.stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      this.logger.log(`Subscription set to cancel at period end for user ${userId}`);
    }

    // Sync the subscription
    await this.syncSubscription(userId);

    return { success: true };
  }

  async reactivateSubscription(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.subscription?.stripeSubscriptionId) {
      throw new Error('No subscription to reactivate');
    }

    // Remove the cancel_at_period_end flag
    await this.stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    this.logger.log(`Subscription reactivated for user ${userId}`);

    // Sync the subscription
    await this.syncSubscription(userId);

    return { success: true };
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
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
      update: {
        planName: 'free',
        status: 'active',
        stripeSubscriptionId: null,
        stripePriceId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    });
  }
}
