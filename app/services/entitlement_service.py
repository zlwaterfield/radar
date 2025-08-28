"""
Entitlement service for managing user feature access and usage limits.
"""
import logging
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any
from calendar import monthrange

from app.core.config import settings
from app.db.supabase import SupabaseManager
from app.models.billing import (
    PlanFeatures, 
    UserUsage, 
    UsageStats,
    PlanName,
    SubscriptionStatus
)

logger = logging.getLogger(__name__)


class FeatureFlags:
    """Feature flags for billing and self-hosting compatibility."""
    
    @staticmethod
    def billing_enabled() -> bool:
        """Check if billing is enabled in the current environment."""
        return (
            settings.ENABLE_BILLING and 
            settings.STRIPE_SECRET_KEY is not None and
            settings.STRIPE_PUBLISHABLE_KEY is not None
        )
    
    @staticmethod
    def is_self_hosted() -> bool:
        """Check if this is a self-hosted installation."""
        return not FeatureFlags.billing_enabled()


class EntitlementService:
    """Service for checking user entitlements and managing feature access."""
    
    @staticmethod
    async def get_user_plan(user_id: str) -> str:
        """
        Get the user's current subscription plan.
        
        Args:
            user_id: User ID
            
        Returns:
            Plan name (free, pro, enterprise)
        """
        try:
            # For self-hosted installations, default to enterprise
            if FeatureFlags.is_self_hosted():
                return settings.DEFAULT_SELF_HOSTED_PLAN
            
            # Get user subscription from database
            subscription = await SupabaseManager.get_user_subscription(user_id)
            
            if not subscription:
                # No subscription found, default to free
                return PlanName.FREE.value
                
            if subscription.get("status") != SubscriptionStatus.ACTIVE.value:
                # Inactive subscription, downgrade to free
                return PlanName.FREE.value
                
            # Get plan details
            plan = await SupabaseManager.get_subscription_plan(subscription["plan_id"])
            return plan["name"] if plan else PlanName.FREE.value
            
        except Exception as e:
            logger.error(f"Error getting user plan for {user_id}: {e}")
            return PlanName.FREE.value
    
    @staticmethod
    async def get_plan_features(plan_name: str) -> PlanFeatures:
        """
        Get features for a subscription plan.
        
        Args:
            plan_name: Plan name (free, pro, enterprise)
            
        Returns:
            Plan features
        """
        try:
            plan = await SupabaseManager.get_subscription_plan_by_name(plan_name)
            if plan and plan.get("features"):
                return PlanFeatures(**plan["features"])
        except Exception as e:
            logger.error(f"Error getting plan features for {plan_name}: {e}")
        
        # Default features for free plan
        return PlanFeatures(
            repositories_limit=3,
            notifications_limit=100,
            ai_features=False,
            digest_notifications=False,
            priority_support=False,
            team_features=False
        )
    
    @staticmethod
    async def get_current_usage(user_id: str) -> UserUsage:
        """
        Get current month's usage for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            Current usage stats
        """
        try:
            # Get current month date range
            now = datetime.now()
            period_start = date(now.year, now.month, 1)
            _, last_day = monthrange(now.year, now.month)
            period_end = date(now.year, now.month, last_day)
            
            # Get usage from database
            usage = await SupabaseManager.get_user_usage(user_id, period_start, period_end)
            
            if usage:
                return UserUsage(**usage)
            
            # Create default usage if none exists
            default_usage = {
                "id": "",
                "user_id": user_id,
                "period_start": period_start,
                "period_end": period_end,
                "repositories_tracked": 0,
                "notifications_sent": 0,
                "digest_notifications": 0,
                "keyword_notifications": 0,
                "ai_requests": 0,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            return UserUsage(**default_usage)
            
        except Exception as e:
            logger.error(f"Error getting current usage for {user_id}: {e}")
            return UserUsage(
                id="",
                user_id=user_id,
                period_start=date.today(),
                period_end=date.today(),
                repositories_tracked=0,
                notifications_sent=0,
                digest_notifications=0,
                keyword_notifications=0,
                ai_requests=0,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
    
    @staticmethod
    async def can_add_repository(user_id: str) -> bool:
        """
        Check if user can add another repository.
        
        Args:
            user_id: User ID
            
        Returns:
            True if user can add repository, False otherwise
        """
        try:
            plan_name = await EntitlementService.get_user_plan(user_id)
            features = await EntitlementService.get_plan_features(plan_name)
            
            # Unlimited repositories
            if features.repositories_limit is None:
                return True
            
            # Count current active repositories
            current_repos = await SupabaseManager.count_user_repositories(user_id)
            
            return current_repos < features.repositories_limit
            
        except Exception as e:
            logger.error(f"Error checking repository limit for {user_id}: {e}")
            return False
    
    @staticmethod
    async def can_send_notification(user_id: str) -> bool:
        """
        Check if user can send another notification this month.
        
        Args:
            user_id: User ID
            
        Returns:
            True if user can send notification, False otherwise
        """
        try:
            plan_name = await EntitlementService.get_user_plan(user_id)
            features = await EntitlementService.get_plan_features(plan_name)
            
            # Unlimited notifications
            if features.notifications_limit is None:
                return True
            
            # Check current month usage
            current_usage = await EntitlementService.get_current_usage(user_id)
            
            return current_usage.notifications_sent < features.notifications_limit
            
        except Exception as e:
            logger.error(f"Error checking notification limit for {user_id}: {e}")
            return False
    
    @staticmethod
    async def can_use_ai_features(user_id: str) -> bool:
        """
        Check if user can use AI features (keyword matching, etc.).
        
        Args:
            user_id: User ID
            
        Returns:
            True if user can use AI features, False otherwise
        """
        try:
            plan_name = await EntitlementService.get_user_plan(user_id)
            features = await EntitlementService.get_plan_features(plan_name)
            
            return features.ai_features
            
        except Exception as e:
            logger.error(f"Error checking AI features for {user_id}: {e}")
            return False
    
    @staticmethod
    async def can_use_digest_notifications(user_id: str) -> bool:
        """
        Check if user can use digest notifications.
        
        Args:
            user_id: User ID
            
        Returns:
            True if user can use digest notifications, False otherwise
        """
        try:
            plan_name = await EntitlementService.get_user_plan(user_id)
            features = await EntitlementService.get_plan_features(plan_name)
            
            return features.digest_notifications
            
        except Exception as e:
            logger.error(f"Error checking digest notifications for {user_id}: {e}")
            return False
    
    @staticmethod
    async def get_usage_stats(user_id: str) -> UsageStats:
        """
        Get detailed usage statistics for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            Usage statistics with limits and percentages
        """
        try:
            plan_name = await EntitlementService.get_user_plan(user_id)
            features = await EntitlementService.get_plan_features(plan_name)
            current_usage = await EntitlementService.get_current_usage(user_id)
            
            # Calculate usage percentages
            usage_percentage = {}
            
            # Repository usage
            if features.repositories_limit is not None:
                repo_count = await SupabaseManager.count_user_repositories(user_id)
                usage_percentage["repositories"] = (repo_count / features.repositories_limit) * 100
            else:
                usage_percentage["repositories"] = None
            
            # Notification usage
            if features.notifications_limit is not None:
                usage_percentage["notifications"] = (
                    current_usage.notifications_sent / features.notifications_limit
                ) * 100
            else:
                usage_percentage["notifications"] = None
            
            # Other usage types don't have hard limits, but we can track them
            usage_percentage["digest_notifications"] = None
            usage_percentage["keyword_notifications"] = None
            usage_percentage["ai_requests"] = None
            
            return UsageStats(
                current_period=current_usage,
                plan_limits=features,
                usage_percentage=usage_percentage
            )
            
        except Exception as e:
            logger.error(f"Error getting usage stats for {user_id}: {e}")
            # Return default stats
            features = PlanFeatures()
            current_usage = await EntitlementService.get_current_usage(user_id)
            return UsageStats(
                current_period=current_usage,
                plan_limits=features,
                usage_percentage={}
            )
    
    @staticmethod
    async def increment_usage(
        user_id: str, 
        usage_type: str, 
        amount: int = 1
    ) -> bool:
        """
        Increment usage counter for a user.
        
        Args:
            user_id: User ID
            usage_type: Type of usage (notifications_sent, ai_requests, etc.)
            amount: Amount to increment by
            
        Returns:
            True if successfully incremented, False otherwise
        """
        try:
            # Get current month date range
            now = datetime.now()
            period_start = date(now.year, now.month, 1)
            _, last_day = monthrange(now.year, now.month)
            period_end = date(now.year, now.month, last_day)
            
            # Update usage in database
            return await SupabaseManager.increment_user_usage(
                user_id, period_start, period_end, usage_type, amount
            )
            
        except Exception as e:
            logger.error(f"Error incrementing usage for {user_id}: {e}")
            return False