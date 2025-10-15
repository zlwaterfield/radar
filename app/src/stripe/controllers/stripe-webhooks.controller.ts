import {
  Controller,
  Post,
  Req,
  Headers,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';
import { StripeService } from '../services/stripe.service';
import { EntitlementsService } from '../services/entitlements.service';

@Controller('webhooks/stripe')
export class StripeWebhooksController {
  private readonly logger = new Logger(StripeWebhooksController.name);
  private stripe: Stripe;

  constructor(
    private stripeService: StripeService,
    private entitlementsService: EntitlementsService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-08-27.basil',
    });
  }

  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    let event: Stripe.Event;

    try {
      // Get raw body for signature verification
      const rawBody = req.rawBody;
      if (!rawBody) {
        throw new Error('Raw body is required for webhook verification');
      }

      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid signature');
    }

    this.logger.log(`Received webhook: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Error processing webhook ${event.type}:`, error);
      // Don't throw - acknowledge receipt but log error
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId || session.client_reference_id;

    if (!userId) {
      this.logger.warn('No userId in checkout session metadata');
      return;
    }

    this.logger.log(`Checkout completed for user ${userId}`);

    await this.stripeService.syncSubscription(userId);
    await this.entitlementsService.syncUserEntitlements(userId);
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const userId = subscription.metadata?.userId;

    if (!userId) {
      this.logger.warn('No userId in subscription metadata');
      return;
    }

    this.logger.log(`Subscription ${subscription.status} for user ${userId}`);

    await this.stripeService.syncSubscription(userId);
    await this.entitlementsService.syncUserEntitlements(userId);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const userId = subscription.metadata?.userId;

    if (!userId) {
      this.logger.warn('No userId in subscription metadata');
      return;
    }

    this.logger.log(`Subscription deleted for user ${userId}`);

    // Revert to free plan
    await this.stripeService.syncSubscription(userId);
    await this.entitlementsService.syncUserEntitlements(userId);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    this.logger.warn(`Payment failed for customer ${customerId}`);

    // Could send notification to user here
    // For now, just log it
  }
}
