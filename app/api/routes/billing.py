"""
Billing routes for Radar.

This module handles billing and subscription management endpoints.
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, status, Request, Header, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.config import settings
from app.db.supabase import SupabaseManager
from app.models.billing import (
    SubscriptionPlan,
    UserSubscriptionWithPlan,
    UsageStats,
    CreateCheckoutSessionRequest,
    CreateCheckoutSessionResponse,
    CreatePortalSessionRequest,
    CreatePortalSessionResponse,
    BillingInfo,
    PlanName,
    StripeWebhookEvent,
    StripeCustomerCreate,
    StripeSubscriptionCreate
)
from app.services.stripe_service import StripeService
from app.services.entitlement_service import EntitlementService, FeatureFlags
from app.utils.auth import TokenManager

router = APIRouter()
logger = logging.getLogger(__name__)


async def get_current_user_id(authorization: str = Header(None)) -> str:
    """Extract user ID from authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.replace("Bearer ", "")
    payload = TokenManager.validate_user_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    return payload.get("sub")


@router.get("/config")
async def get_billing_config():
    """
    Get billing configuration.
    
    Returns:
        Billing configuration including whether billing is enabled
    """
    return {
        "billing_enabled": FeatureFlags.billing_enabled(),
        "is_self_hosted": FeatureFlags.is_self_hosted(),
        "stripe_publishable_key": settings.STRIPE_PUBLISHABLE_KEY if FeatureFlags.billing_enabled() else None,
        "default_plan": settings.DEFAULT_SELF_HOSTED_PLAN if FeatureFlags.is_self_hosted() else "free"
    }


@router.get("/plans", response_model=List[SubscriptionPlan])
async def get_subscription_plans():
    """
    Get all available subscription plans.
    
    Returns:
        List of subscription plans
    """
    try:
        plans_data = await SupabaseManager.get_all_subscription_plans()
        return [SubscriptionPlan(**plan) for plan in plans_data]
        
    except Exception as e:
        logger.error(f"Error getting subscription plans: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get subscription plans"
        )


@router.get("/subscription", response_model=UserSubscriptionWithPlan)
async def get_user_subscription(user_id: str = Depends(get_current_user_id)):
    """
    Get user's current subscription with plan details.
    
    Args:
        user_id: Current user ID from token
        
    Returns:
        User subscription with plan details
    """
    try:
        subscription_data = await SupabaseManager.get_user_subscription_with_plan(user_id)
        
        if not subscription_data:
            # Create default free subscription if none exists
            free_plan = await SupabaseManager.get_subscription_plan_by_name("free")
            if not free_plan:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Free plan not found"
                )
            
            # Create subscription
            subscription_data = {
                "user_id": user_id,
                "plan_id": free_plan["id"],
                "status": "active",
                "current_period_start": datetime.now(),
                "current_period_end": datetime.now()
            }
            
            created_sub = await SupabaseManager.create_user_subscription(subscription_data)
            if not created_sub:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create default subscription"
                )
            
            # Get the created subscription with plan
            subscription_data = await SupabaseManager.get_user_subscription_with_plan(user_id)
        
        return UserSubscriptionWithPlan(**subscription_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user subscription"
        )


@router.get("/usage", response_model=UsageStats)
async def get_usage_stats(user_id: str = Depends(get_current_user_id)):
    """
    Get user's usage statistics.
    
    Args:
        user_id: Current user ID from token
        
    Returns:
        Usage statistics with limits and percentages
    """
    try:
        usage_stats = await EntitlementService.get_usage_stats(user_id)
        return usage_stats
        
    except Exception as e:
        logger.error(f"Error getting usage stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get usage statistics"
        )


@router.get("/info", response_model=BillingInfo)
async def get_billing_info(user_id: str = Depends(get_current_user_id)):
    """
    Get complete billing information for a user.
    
    Args:
        user_id: Current user ID from token
        
    Returns:
        Complete billing information
    """
    try:
        # Get subscription
        subscription_data = await SupabaseManager.get_user_subscription_with_plan(user_id)
        if not subscription_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subscription not found"
            )
        
        subscription = UserSubscriptionWithPlan(**subscription_data)
        
        # Get usage stats
        usage_stats = await EntitlementService.get_usage_stats(user_id)
        
        # Get upcoming invoice if applicable
        upcoming_invoice = None
        if subscription.stripe_customer_id and FeatureFlags.billing_enabled():
            upcoming_invoice = await StripeService.get_upcoming_invoice(subscription.stripe_customer_id)
        
        return BillingInfo(
            subscription=subscription,
            current_usage=usage_stats.current_period,
            usage_stats=usage_stats,
            upcoming_invoice=upcoming_invoice
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting billing info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get billing information"
        )


@router.post("/checkout", response_model=CreateCheckoutSessionResponse)
async def create_checkout_session(
    request: CreateCheckoutSessionRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Create a Stripe checkout session for subscription upgrade.
    
    Args:
        request: Checkout session request
        user_id: Current user ID from token
        
    Returns:
        Checkout session URL and ID
    """
    if not FeatureFlags.billing_enabled():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Billing is not enabled"
        )
    
    try:
        # Get user info
        user = await SupabaseManager.get_user(user_id, decrypt_tokens=False)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get plan info
        plan = await SupabaseManager.get_subscription_plan_by_name(request.plan_name.value)
        if not plan or not plan.get("stripe_price_id"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Plan not found or not available"
            )
        
        # Get or create Stripe customer
        subscription_data = await SupabaseManager.get_user_subscription(user_id)
        customer_id = subscription_data.get("stripe_customer_id") if subscription_data else None
        
        if not customer_id:
            # Create Stripe customer
            customer_create = StripeCustomerCreate(
                email=user["email"],
                name=user["name"],
                metadata={"user_id": user_id}
            )
            customer_id = await StripeService.create_customer(customer_create)
            
            if not customer_id:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create Stripe customer"
                )
            
            # Update subscription with customer ID
            if subscription_data:
                await SupabaseManager.update_user_subscription(user_id, {
                    "stripe_customer_id": customer_id
                })
        
        # Create checkout session
        checkout_data = await StripeService.create_checkout_session(
            customer_id=customer_id,
            price_id=plan["stripe_price_id"],
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            metadata={"user_id": user_id, "plan_id": plan["id"]}
        )
        
        if not checkout_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create checkout session"
            )
        
        return CreateCheckoutSessionResponse(
            checkout_url=checkout_data["checkout_url"],
            session_id=checkout_data["session_id"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating checkout session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create checkout session"
        )


@router.post("/portal", response_model=CreatePortalSessionResponse)
async def create_portal_session(
    request: CreatePortalSessionRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Create a Stripe customer portal session for subscription management.
    
    Args:
        request: Portal session request
        user_id: Current user ID from token
        
    Returns:
        Customer portal URL
    """
    if not FeatureFlags.billing_enabled():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Billing is not enabled"
        )
    
    try:
        # Get user subscription
        subscription_data = await SupabaseManager.get_user_subscription(user_id)
        if not subscription_data or not subscription_data.get("stripe_customer_id"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No billing account found"
            )
        
        # Create portal session
        portal_url = await StripeService.create_portal_session(
            customer_id=subscription_data["stripe_customer_id"],
            return_url=request.return_url
        )
        
        if not portal_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create portal session"
            )
        
        return CreatePortalSessionResponse(portal_url=portal_url)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating portal session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create portal session"
        )


@router.post("/webhook")
async def handle_stripe_webhook(request: Request):
    """
    Handle Stripe webhook events.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Success response
    """
    if not FeatureFlags.billing_enabled():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Billing is not enabled"
        )
    
    try:
        # Get raw payload and signature
        payload = await request.body()
        signature = request.headers.get("stripe-signature")
        
        if not signature:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing Stripe signature"
            )
        
        # Verify webhook signature
        if not StripeService.verify_webhook_signature(payload, signature):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid webhook signature"
            )
        
        # Parse event
        import json
        event_data = json.loads(payload)
        event = StripeWebhookEvent(**event_data)
        
        # Handle event
        success = await StripeService.handle_webhook_event(event)
        
        if not success:
            logger.error(f"Failed to handle webhook event {event.id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process webhook"
            )
        
        return {"received": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error handling webhook: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to handle webhook"
        )


# Feature entitlement check endpoints

@router.get("/entitlements/repositories")
async def check_repository_entitlement(user_id: str = Depends(get_current_user_id)):
    """
    Check if user can add more repositories.
    
    Args:
        user_id: Current user ID from token
        
    Returns:
        Repository entitlement information
    """
    try:
        can_add = await EntitlementService.can_add_repository(user_id)
        current_count = await SupabaseManager.count_user_repositories(user_id)
        plan_name = await EntitlementService.get_user_plan(user_id)
        features = await EntitlementService.get_plan_features(plan_name)
        
        return {
            "can_add_repository": can_add,
            "current_count": current_count,
            "limit": features.repositories_limit,
            "unlimited": features.repositories_limit is None
        }
        
    except Exception as e:
        logger.error(f"Error checking repository entitlement: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check repository entitlement"
        )


@router.get("/entitlements/ai-features")
async def check_ai_features_entitlement(user_id: str = Depends(get_current_user_id)):
    """
    Check if user can use AI features.
    
    Args:
        user_id: Current user ID from token
        
    Returns:
        AI features entitlement information
    """
    try:
        can_use_ai = await EntitlementService.can_use_ai_features(user_id)
        
        return {
            "can_use_ai_features": can_use_ai,
            "features_available": [
                "keyword_matching",
                "intelligent_notifications"
            ] if can_use_ai else []
        }
        
    except Exception as e:
        logger.error(f"Error checking AI features entitlement: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check AI features entitlement"
        )


@router.get("/entitlements/digest")
async def check_digest_entitlement(user_id: str = Depends(get_current_user_id)):
    """
    Check if user can use digest notifications.
    
    Args:
        user_id: Current user ID from token
        
    Returns:
        Digest notifications entitlement information
    """
    try:
        can_use_digest = await EntitlementService.can_use_digest_notifications(user_id)
        
        return {
            "can_use_digest_notifications": can_use_digest
        }
        
    except Exception as e:
        logger.error(f"Error checking digest entitlement: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check digest entitlement"
        )