"""
Stripe service for handling billing and subscription management.
"""
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

import stripe

from app.core.config import settings
from app.db.supabase import SupabaseManager
from app.models.billing import (
    StripeCustomerCreate,
    StripeSubscriptionCreate,
    StripeWebhookEvent,
    PlanName,
    SubscriptionStatus
)
from app.services.entitlement_service import FeatureFlags

logger = logging.getLogger(__name__)

# Configure Stripe
if settings.STRIPE_SECRET_KEY:
    stripe.api_key = settings.STRIPE_SECRET_KEY


class StripeService:
    """Service for managing Stripe operations."""
    
    @staticmethod
    def is_configured() -> bool:
        """Check if Stripe is properly configured."""
        return (
            settings.STRIPE_SECRET_KEY is not None and
            settings.STRIPE_PUBLISHABLE_KEY is not None and
            FeatureFlags.billing_enabled()
        )
    
    @staticmethod
    async def create_customer(customer_data: StripeCustomerCreate) -> Optional[str]:
        """
        Create a Stripe customer.
        
        Args:
            customer_data: Customer creation data
            
        Returns:
            Stripe customer ID or None if failed
        """
        if not StripeService.is_configured():
            logger.warning("Stripe not configured, skipping customer creation")
            return None
            
        try:
            customer = stripe.Customer.create(
                email=customer_data.email,
                name=customer_data.name,
                metadata=customer_data.metadata or {}
            )
            return customer.id
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating customer: {e}")
            return None
        except Exception as e:
            logger.error(f"Error creating Stripe customer: {e}")
            return None
    
    @staticmethod
    async def get_customer(customer_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a Stripe customer.
        
        Args:
            customer_id: Stripe customer ID
            
        Returns:
            Customer data or None if not found
        """
        if not StripeService.is_configured():
            return None
            
        try:
            customer = stripe.Customer.retrieve(customer_id)
            return customer.to_dict() if customer else None
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error getting customer {customer_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting Stripe customer {customer_id}: {e}")
            return None
    
    @staticmethod
    async def create_subscription(subscription_data: StripeSubscriptionCreate) -> Optional[str]:
        """
        Create a Stripe subscription.
        
        Args:
            subscription_data: Subscription creation data
            
        Returns:
            Stripe subscription ID or None if failed
        """
        if not StripeService.is_configured():
            logger.warning("Stripe not configured, skipping subscription creation")
            return None
            
        try:
            subscription = stripe.Subscription.create(
                customer=subscription_data.customer_id,
                items=[{"price": subscription_data.price_id}],
                metadata=subscription_data.metadata or {},
                payment_behavior="default_incomplete",
                payment_settings={"save_default_payment_method": "on_subscription"},
                expand=["latest_invoice.payment_intent"]
            )
            return subscription.id
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating subscription: {e}")
            return None
        except Exception as e:
            logger.error(f"Error creating Stripe subscription: {e}")
            return None
    
    @staticmethod
    async def get_subscription(subscription_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a Stripe subscription.
        
        Args:
            subscription_id: Stripe subscription ID
            
        Returns:
            Subscription data or None if not found
        """
        if not StripeService.is_configured():
            return None
            
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            return subscription.to_dict() if subscription else None
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error getting subscription {subscription_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting Stripe subscription {subscription_id}: {e}")
            return None
    
    @staticmethod
    async def cancel_subscription(subscription_id: str, at_period_end: bool = True) -> bool:
        """
        Cancel a Stripe subscription.
        
        Args:
            subscription_id: Stripe subscription ID
            at_period_end: Whether to cancel at period end or immediately
            
        Returns:
            True if successful, False otherwise
        """
        if not StripeService.is_configured():
            return False
            
        try:
            if at_period_end:
                stripe.Subscription.modify(
                    subscription_id,
                    cancel_at_period_end=True
                )
            else:
                stripe.Subscription.delete(subscription_id)
            return True
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error canceling subscription {subscription_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Error canceling Stripe subscription {subscription_id}: {e}")
            return False
    
    @staticmethod
    async def create_checkout_session(
        customer_id: str, 
        price_id: str, 
        success_url: str, 
        cancel_url: str,
        metadata: Optional[Dict[str, str]] = None
    ) -> Optional[Dict[str, str]]:
        """
        Create a Stripe checkout session.
        
        Args:
            customer_id: Stripe customer ID
            price_id: Stripe price ID
            success_url: URL to redirect to on success
            cancel_url: URL to redirect to on cancel
            metadata: Optional metadata
            
        Returns:
            Dict with checkout URL and session ID, or None if failed
        """
        if not StripeService.is_configured():
            return None
            
        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=["card"],
                line_items=[{
                    "price": price_id,
                    "quantity": 1,
                }],
                mode="subscription",
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata or {},
                allow_promotion_codes=True
            )
            
            return {
                "checkout_url": session.url,
                "session_id": session.id
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating checkout session: {e}")
            return None
        except Exception as e:
            logger.error(f"Error creating Stripe checkout session: {e}")
            return None
    
    @staticmethod
    async def create_portal_session(customer_id: str, return_url: str) -> Optional[str]:
        """
        Create a Stripe customer portal session.
        
        Args:
            customer_id: Stripe customer ID
            return_url: URL to return to after portal session
            
        Returns:
            Portal URL or None if failed
        """
        if not StripeService.is_configured():
            return None
            
        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url,
            )
            return session.url
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating portal session: {e}")
            return None
        except Exception as e:
            logger.error(f"Error creating Stripe portal session: {e}")
            return None
    
    @staticmethod
    async def get_upcoming_invoice(customer_id: str) -> Optional[Dict[str, Any]]:
        """
        Get upcoming invoice for a customer.
        
        Args:
            customer_id: Stripe customer ID
            
        Returns:
            Invoice data or None if not found
        """
        if not StripeService.is_configured():
            return None
            
        try:
            invoice = stripe.Invoice.upcoming(customer=customer_id)
            return invoice.to_dict() if invoice else None
            
        except stripe.error.StripeError as e:
            # This is expected if there's no upcoming invoice
            if e.code != "invoice_upcoming_none":
                logger.error(f"Stripe error getting upcoming invoice: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting upcoming invoice: {e}")
            return None
    
    @staticmethod
    def verify_webhook_signature(payload: bytes, signature: str) -> bool:
        """
        Verify Stripe webhook signature.
        
        Args:
            payload: Raw webhook payload
            signature: Stripe signature header
            
        Returns:
            True if signature is valid, False otherwise
        """
        if not settings.STRIPE_WEBHOOK_SECRET:
            logger.error("Stripe webhook secret not configured")
            return False
            
        try:
            stripe.Webhook.construct_event(
                payload, signature, settings.STRIPE_WEBHOOK_SECRET
            )
            return True
            
        except ValueError as e:
            logger.error(f"Invalid payload: {e}")
            return False
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid signature: {e}")
            return False
    
    @staticmethod
    async def handle_webhook_event(event: StripeWebhookEvent) -> bool:
        """
        Handle Stripe webhook events.
        
        Args:
            event: Stripe webhook event
            
        Returns:
            True if handled successfully, False otherwise
        """
        try:
            event_type = event.type
            data_object = event.data.get("object", {})
            
            if event_type == "customer.subscription.created":
                return await StripeService._handle_subscription_created(data_object)
            
            elif event_type == "customer.subscription.updated":
                return await StripeService._handle_subscription_updated(data_object)
            
            elif event_type == "customer.subscription.deleted":
                return await StripeService._handle_subscription_deleted(data_object)
            
            elif event_type == "invoice.payment_succeeded":
                return await StripeService._handle_payment_succeeded(data_object)
            
            elif event_type == "invoice.payment_failed":
                return await StripeService._handle_payment_failed(data_object)
            
            else:
                logger.info(f"Unhandled webhook event type: {event_type}")
                return True
                
        except Exception as e:
            logger.error(f"Error handling webhook event {event.id}: {e}")
            return False
    
    @staticmethod
    async def _handle_subscription_created(subscription: Dict[str, Any]) -> bool:
        """Handle subscription created event."""
        try:
            subscription_id = subscription["id"]
            customer_id = subscription["customer"]
            status = subscription["status"]
            
            # Find user by Stripe customer ID
            # This would require adding a method to find user by stripe_customer_id
            # For now, we'll log and return True
            logger.info(f"Subscription created: {subscription_id} for customer {customer_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error handling subscription created: {e}")
            return False
    
    @staticmethod
    async def _handle_subscription_updated(subscription: Dict[str, Any]) -> bool:
        """Handle subscription updated event."""
        try:
            subscription_id = subscription["id"]
            status = subscription["status"]
            current_period_start = datetime.fromtimestamp(subscription["current_period_start"])
            current_period_end = datetime.fromtimestamp(subscription["current_period_end"])
            cancel_at_period_end = subscription.get("cancel_at_period_end", False)
            
            # Update subscription in database
            update_data = {
                "status": status,
                "current_period_start": current_period_start,
                "current_period_end": current_period_end,
                "cancel_at_period_end": cancel_at_period_end
            }
            
            # Find and update subscription by stripe_subscription_id
            # This would require adding a method to update by stripe_subscription_id
            logger.info(f"Subscription updated: {subscription_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error handling subscription updated: {e}")
            return False
    
    @staticmethod
    async def _handle_subscription_deleted(subscription: Dict[str, Any]) -> bool:
        """Handle subscription deleted event."""
        try:
            subscription_id = subscription["id"]
            
            # Update subscription status to canceled
            # Move user to free plan
            logger.info(f"Subscription deleted: {subscription_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error handling subscription deleted: {e}")
            return False
    
    @staticmethod
    async def _handle_payment_succeeded(invoice: Dict[str, Any]) -> bool:
        """Handle payment succeeded event."""
        try:
            subscription_id = invoice.get("subscription")
            if subscription_id:
                logger.info(f"Payment succeeded for subscription: {subscription_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error handling payment succeeded: {e}")
            return False
    
    @staticmethod
    async def _handle_payment_failed(invoice: Dict[str, Any]) -> bool:
        """Handle payment failed event."""
        try:
            subscription_id = invoice.get("subscription")
            if subscription_id:
                logger.warning(f"Payment failed for subscription: {subscription_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error handling payment failed: {e}")
            return False