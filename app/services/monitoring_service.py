"""
Monitoring and analytics service for Radar.

This module provides comprehensive monitoring, logging, and analytics
using PostHog and structured logging.
"""
import logging
import time
from datetime import datetime
from typing import Any, Dict, Optional, Union
from functools import wraps
import traceback

import posthog

from app.core.config import settings

# Configure structured logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize PostHog if API key is provided
if settings.POSTHOG_API_KEY:
    posthog.api_key = settings.POSTHOG_API_KEY
    posthog.host = settings.POSTHOG_HOST
    logger.info("PostHog analytics initialized")
else:
    logger.warning("PostHog API key not configured - analytics disabled")


class MonitoringService:
    """Service for monitoring, analytics, and error tracking."""
    
    @staticmethod
    def track_event(
        event_name: str,
        user_id: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ):
        """
        Track an analytics event.
        
        Args:
            event_name: Name of the event
            user_id: User ID (optional)
            properties: Event properties
            context: Additional context
        """
        try:
            if not settings.POSTHOG_API_KEY:
                return
            
            event_properties = {
                "timestamp": datetime.utcnow().isoformat(),
                "environment": settings.ENVIRONMENT,
                "$app": "radar-backend"
            }
            
            if properties:
                event_properties.update(properties)
            
            if context:
                event_properties["context"] = context
            
            # Use anonymous ID if no user_id provided
            distinct_id = user_id or "anonymous"
            
            posthog.capture(
                distinct_id=distinct_id,
                event=event_name,
                properties=event_properties
            )
            
            logger.debug(f"Tracked event: {event_name} for user: {distinct_id}")
            
        except Exception as e:
            logger.error(f"Error tracking event {event_name}: {e}")
    
    @staticmethod
    def track_user(user_id: str, properties: Optional[Dict[str, Any]] = None):
        """
        Track or update user properties.
        
        Args:
            user_id: User ID
            properties: User properties
        """
        try:
            if not settings.POSTHOG_API_KEY:
                return
            
            user_properties = {
                "environment": settings.ENVIRONMENT,
                "$app": "radar-backend"
            }
            
            if properties:
                user_properties.update(properties)
            
            posthog.identify(
                distinct_id=user_id,
                properties=user_properties
            )
            
            logger.debug(f"Tracked user: {user_id}")
            
        except Exception as e:
            logger.error(f"Error tracking user {user_id}: {e}")
    
    @staticmethod
    def track_error(
        error: Exception,
        user_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        extra_data: Optional[Dict[str, Any]] = None
    ):
        """
        Track an error event.
        
        Args:
            error: The exception that occurred
            user_id: User ID (optional)
            context: Error context
            extra_data: Additional error data
        """
        try:
            error_properties = {
                "error_type": type(error).__name__,
                "error_message": str(error),
                "error_traceback": traceback.format_exc(),
                "timestamp": datetime.utcnow().isoformat(),
                "environment": settings.ENVIRONMENT
            }
            
            if context:
                error_properties["context"] = context
            
            if extra_data:
                error_properties.update(extra_data)
            
            MonitoringService.track_event(
                "error_occurred",
                user_id=user_id,
                properties=error_properties
            )
            
            # Also log the error
            logger.error(f"Error tracked: {error}", exc_info=True)
            
        except Exception as e:
            logger.error(f"Error tracking error: {e}")
    
    @staticmethod
    def track_notification_sent(
        user_id: str,
        notification_type: str,
        repository: str,
        success: bool,
        error: Optional[str] = None,
        matched_keywords: Optional[list] = None
    ):
        """
        Track a notification delivery event.
        
        Args:
            user_id: User ID
            notification_type: Type of notification
            repository: Repository name
            success: Whether delivery was successful
            error: Error message if failed
            matched_keywords: Keywords that triggered the notification
        """
        properties = {
            "notification_type": notification_type,
            "repository": repository,
            "success": success,
            "delivery_time": datetime.utcnow().isoformat()
        }
        
        if error:
            properties["error"] = error
        
        if matched_keywords:
            properties["matched_keywords"] = matched_keywords
            properties["keyword_count"] = len(matched_keywords)
        
        MonitoringService.track_event(
            "notification_sent",
            user_id=user_id,
            properties=properties
        )
    
    @staticmethod
    def track_webhook_received(
        event_type: str,
        repository: str,
        action: Optional[str] = None,
        processing_time: Optional[float] = None,
        success: bool = True,
        error: Optional[str] = None
    ):
        """
        Track a webhook event.
        
        Args:
            event_type: GitHub event type
            repository: Repository name
            action: Event action
            processing_time: Time taken to process
            success: Whether processing was successful
            error: Error message if failed
        """
        properties = {
            "event_type": event_type,
            "repository": repository,
            "success": success,
            "received_at": datetime.utcnow().isoformat()
        }
        
        if action:
            properties["action"] = action
        
        if processing_time:
            properties["processing_time_ms"] = round(processing_time * 1000, 2)
        
        if error:
            properties["error"] = error
        
        MonitoringService.track_event(
            "webhook_received",
            properties=properties
        )
    
    @staticmethod
    def track_user_action(
        user_id: str,
        action: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Track a user action.
        
        Args:
            user_id: User ID
            action: Action performed
            resource_type: Type of resource acted upon
            resource_id: ID of the resource
            metadata: Additional action metadata
        """
        properties = {
            "action": action,
            "performed_at": datetime.utcnow().isoformat()
        }
        
        if resource_type:
            properties["resource_type"] = resource_type
        
        if resource_id:
            properties["resource_id"] = resource_id
        
        if metadata:
            properties.update(metadata)
        
        MonitoringService.track_event(
            "user_action",
            user_id=user_id,
            properties=properties
        )
    
    @staticmethod
    def track_authentication(
        user_id: str,
        auth_method: str,
        success: bool,
        provider: Optional[str] = None,
        error: Optional[str] = None
    ):
        """
        Track authentication events.
        
        Args:
            user_id: User ID
            auth_method: Authentication method
            success: Whether authentication was successful
            provider: Auth provider (slack, github)
            error: Error message if failed
        """
        properties = {
            "auth_method": auth_method,
            "success": success,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if provider:
            properties["provider"] = provider
        
        if error:
            properties["error"] = error
        
        event_name = "authentication_success" if success else "authentication_failed"
        
        MonitoringService.track_event(
            event_name,
            user_id=user_id,
            properties=properties
        )


def track_performance(event_name: str, user_id: Optional[str] = None):
    """
    Decorator to track performance of functions.
    
    Args:
        event_name: Name for the performance event
        user_id: User ID (optional)
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            success = True
            error_msg = None
            
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                success = False
                error_msg = str(e)
                raise
            finally:
                duration = time.time() - start_time
                
                properties = {
                    "function_name": func.__name__,
                    "duration_ms": round(duration * 1000, 2),
                    "success": success
                }
                
                if error_msg:
                    properties["error"] = error_msg
                
                MonitoringService.track_event(
                    f"performance_{event_name}",
                    user_id=user_id,
                    properties=properties
                )
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            success = True
            error_msg = None
            
            try:
                result = func(*args, **kwargs)
                return result
            except Exception as e:
                success = False
                error_msg = str(e)
                raise
            finally:
                duration = time.time() - start_time
                
                properties = {
                    "function_name": func.__name__,
                    "duration_ms": round(duration * 1000, 2),
                    "success": success
                }
                
                if error_msg:
                    properties["error"] = error_msg
                
                MonitoringService.track_event(
                    f"performance_{event_name}",
                    user_id=user_id,
                    properties=properties
                )
        
        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def track_errors(user_id: Optional[str] = None, context: Optional[Dict[str, Any]] = None):
    """
    Decorator to automatically track errors in functions.
    
    Args:
        user_id: User ID (optional)
        context: Additional context
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                MonitoringService.track_error(
                    error=e,
                    user_id=user_id,
                    context={
                        "function_name": func.__name__,
                        **(context or {})
                    }
                )
                raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                MonitoringService.track_error(
                    error=e,
                    user_id=user_id,
                    context={
                        "function_name": func.__name__,
                        **(context or {})
                    }
                )
                raise
        
        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


# Create a structured logger for the application
class RadarLogger:
    """Enhanced logger with structured logging capabilities."""
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
    
    def info(self, message: str, **kwargs):
        """Log info with structured data."""
        extra_data = {"data": kwargs} if kwargs else {}
        self.logger.info(message, extra=extra_data)
    
    def error(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log error with structured data."""
        extra_data = {"data": kwargs} if kwargs else {}
        if error:
            extra_data["error"] = str(error)
        self.logger.error(message, extra=extra_data, exc_info=error is not None)
    
    def warning(self, message: str, **kwargs):
        """Log warning with structured data."""
        extra_data = {"data": kwargs} if kwargs else {}
        self.logger.warning(message, extra=extra_data)
    
    def debug(self, message: str, **kwargs):
        """Log debug with structured data."""
        extra_data = {"data": kwargs} if kwargs else {}
        self.logger.debug(message, extra=extra_data)


def get_logger(name: str) -> RadarLogger:
    """Get a structured logger instance."""
    return RadarLogger(name)