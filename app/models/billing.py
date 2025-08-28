"""
Billing models for the Radar application.
"""
from datetime import datetime, date
from typing import Dict, List, Optional, Any, Union
from enum import Enum

from pydantic import BaseModel, Field, ConfigDict


class PlanName(str, Enum):
    """Subscription plan names."""
    FREE = "free"
    PRO = "pro" 
    ENTERPRISE = "enterprise"


class SubscriptionStatus(str, Enum):
    """Subscription status values."""
    ACTIVE = "active"
    CANCELED = "canceled"
    PAST_DUE = "past_due"
    UNPAID = "unpaid"
    INCOMPLETE = "incomplete"


class PlanFeatures(BaseModel):
    """Features included in a subscription plan."""
    repositories_limit: Optional[int] = None  # None = unlimited
    notifications_limit: Optional[int] = None  # None = unlimited
    ai_features: bool = False
    digest_notifications: bool = False
    priority_support: bool = False
    team_features: bool = False


class SubscriptionPlanBase(BaseModel):
    """Base model for subscription plan data."""
    name: PlanName
    stripe_price_id: Optional[str] = None
    monthly_price: int = 0  # Price in cents
    features: PlanFeatures
    is_active: bool = True


class SubscriptionPlanCreate(SubscriptionPlanBase):
    """Model for creating a subscription plan."""
    pass


class SubscriptionPlanUpdate(BaseModel):
    """Model for updating a subscription plan."""
    stripe_price_id: Optional[str] = None
    monthly_price: Optional[int] = None
    features: Optional[PlanFeatures] = None
    is_active: Optional[bool] = None


class SubscriptionPlan(SubscriptionPlanBase):
    """Model for subscription plan data returned to clients."""
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserSubscriptionBase(BaseModel):
    """Base model for user subscription data."""
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False


class UserSubscriptionCreate(UserSubscriptionBase):
    """Model for creating a user subscription."""
    user_id: str
    plan_id: str
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None


class UserSubscriptionUpdate(UserSubscriptionBase):
    """Model for updating a user subscription."""
    plan_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None


class UserSubscription(UserSubscriptionBase):
    """Model for user subscription data returned to clients."""
    id: str
    user_id: str
    plan_id: str
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserSubscriptionWithPlan(UserSubscription):
    """Model for user subscription with plan details."""
    plan: SubscriptionPlan

    model_config = ConfigDict(from_attributes=True)


class UserUsageBase(BaseModel):
    """Base model for user usage data."""
    repositories_tracked: int = 0
    notifications_sent: int = 0
    digest_notifications: int = 0
    keyword_notifications: int = 0
    ai_requests: int = 0


class UserUsageCreate(UserUsageBase):
    """Model for creating user usage record."""
    user_id: str
    period_start: date
    period_end: date


class UserUsageUpdate(UserUsageBase):
    """Model for updating user usage."""
    pass


class UserUsage(UserUsageBase):
    """Model for user usage data returned to clients."""
    id: str
    user_id: str
    period_start: date
    period_end: date
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UsageStats(BaseModel):
    """Model for usage statistics."""
    current_period: UserUsage
    plan_limits: PlanFeatures
    usage_percentage: Dict[str, Optional[float]]  # percentage of limit used


# Stripe-specific models
class StripeCustomerCreate(BaseModel):
    """Model for creating a Stripe customer."""
    email: str
    name: Optional[str] = None
    metadata: Optional[Dict[str, str]] = None


class StripeSubscriptionCreate(BaseModel):
    """Model for creating a Stripe subscription."""
    customer_id: str
    price_id: str
    metadata: Optional[Dict[str, str]] = None


class StripeWebhookEvent(BaseModel):
    """Model for Stripe webhook events."""
    id: str
    type: str
    data: Dict[str, Any]
    created: int
    livemode: bool


# Billing API request/response models
class CreateCheckoutSessionRequest(BaseModel):
    """Request to create a Stripe checkout session."""
    plan_name: PlanName
    success_url: str
    cancel_url: str


class CreateCheckoutSessionResponse(BaseModel):
    """Response with Stripe checkout session URL."""
    checkout_url: str
    session_id: str


class CreatePortalSessionRequest(BaseModel):
    """Request to create a Stripe customer portal session."""
    return_url: str


class CreatePortalSessionResponse(BaseModel):
    """Response with Stripe customer portal URL."""
    portal_url: str


class BillingInfo(BaseModel):
    """Complete billing information for a user."""
    subscription: UserSubscriptionWithPlan
    current_usage: UserUsage
    usage_stats: UsageStats
    upcoming_invoice: Optional[Dict[str, Any]] = None