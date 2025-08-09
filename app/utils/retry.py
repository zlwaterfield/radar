"""
Retry utilities for Radar.

This module provides retry functionality for failed operations.
"""
import asyncio
import logging
from typing import Any, Callable, Dict, Optional, TypeVar, Union
from functools import wraps
import random

logger = logging.getLogger(__name__)

T = TypeVar('T')


class RetryError(Exception):
    """Exception raised when all retry attempts fail."""
    
    def __init__(self, message: str, last_error: Optional[Exception] = None):
        super().__init__(message)
        self.last_error = last_error


def exponential_backoff(attempt: int, base_delay: float = 1.0, max_delay: float = 60.0) -> float:
    """
    Calculate exponential backoff delay with jitter.
    
    Args:
        attempt: The attempt number (0-based)
        base_delay: Base delay in seconds
        max_delay: Maximum delay in seconds
        
    Returns:
        Delay in seconds
    """
    # Calculate exponential delay
    delay = min(base_delay * (2 ** attempt), max_delay)
    
    # Add jitter (±25% randomization)
    jitter = delay * 0.25 * (2 * random.random() - 1)
    
    return max(0, delay + jitter)


async def retry_async(
    func: Callable[..., T],
    *args,
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exceptions: tuple = (Exception,),
    on_retry: Optional[Callable[[int, Exception], None]] = None,
    **kwargs
) -> T:
    """
    Retry an async function with exponential backoff.
    
    Args:
        func: Async function to retry
        *args: Positional arguments for the function
        max_attempts: Maximum number of attempts
        base_delay: Base delay between retries in seconds
        max_delay: Maximum delay between retries in seconds
        exceptions: Tuple of exceptions to catch and retry
        on_retry: Optional callback called on each retry with (attempt, exception)
        **kwargs: Keyword arguments for the function
        
    Returns:
        Result of the function
        
    Raises:
        RetryError: If all attempts fail
    """
    last_error = None
    
    for attempt in range(max_attempts):
        try:
            return await func(*args, **kwargs)
        except exceptions as e:
            last_error = e
            
            # Log the error
            logger.warning(
                f"Attempt {attempt + 1}/{max_attempts} failed for {func.__name__}: {e}"
            )
            
            # Call retry callback if provided
            if on_retry:
                try:
                    on_retry(attempt, e)
                except Exception as callback_error:
                    logger.error(f"Error in retry callback: {callback_error}")
            
            # If this was the last attempt, raise
            if attempt >= max_attempts - 1:
                break
            
            # Calculate delay and wait
            delay = exponential_backoff(attempt, base_delay, max_delay)
            logger.info(f"Retrying {func.__name__} in {delay:.2f} seconds...")
            await asyncio.sleep(delay)
    
    # All attempts failed
    raise RetryError(
        f"All {max_attempts} attempts failed for {func.__name__}",
        last_error
    )


def retry_async_decorator(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exceptions: tuple = (Exception,),
    on_retry: Optional[Callable[[int, Exception], None]] = None
):
    """
    Decorator for retrying async functions.
    
    Args:
        max_attempts: Maximum number of attempts
        base_delay: Base delay between retries in seconds
        max_delay: Maximum delay between retries in seconds
        exceptions: Tuple of exceptions to catch and retry
        on_retry: Optional callback called on each retry
        
    Returns:
        Decorated function
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await retry_async(
                func,
                *args,
                max_attempts=max_attempts,
                base_delay=base_delay,
                max_delay=max_delay,
                exceptions=exceptions,
                on_retry=on_retry,
                **kwargs
            )
        return wrapper
    return decorator


class NotificationRetryHandler:
    """Handler for notification retry logic."""
    
    def __init__(self):
        self.failed_notifications: Dict[str, Dict[str, Any]] = {}
    
    async def send_notification_with_retry(
        self,
        notification_func: Callable,
        notification_id: str,
        *args,
        max_attempts: int = 3,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """
        Send a notification with retry logic.
        
        Args:
            notification_func: Function to send notification
            notification_id: Unique ID for this notification
            *args: Arguments for notification function
            max_attempts: Maximum retry attempts
            **kwargs: Keyword arguments for notification function
            
        Returns:
            Notification response or None if failed
        """
        try:
            def on_retry(attempt: int, error: Exception):
                # Store failed notification for potential manual retry
                self.failed_notifications[notification_id] = {
                    "id": notification_id,
                    "attempt": attempt + 1,
                    "error": str(error),
                    "timestamp": asyncio.get_event_loop().time(),
                    "args": args,
                    "kwargs": kwargs
                }
            
            result = await retry_async(
                notification_func,
                *args,
                max_attempts=max_attempts,
                base_delay=2.0,
                max_delay=30.0,
                exceptions=(Exception,),
                on_retry=on_retry,
                **kwargs
            )
            
            # Remove from failed notifications if successful
            self.failed_notifications.pop(notification_id, None)
            
            return result
            
        except RetryError as e:
            logger.error(
                f"Failed to send notification {notification_id} after "
                f"{max_attempts} attempts: {e.last_error}"
            )
            
            # Mark as permanently failed
            if notification_id in self.failed_notifications:
                self.failed_notifications[notification_id]["permanently_failed"] = True
            
            return None
    
    async def retry_failed_notifications(self) -> Dict[str, bool]:
        """
        Retry all failed notifications.
        
        Returns:
            Dict mapping notification IDs to success status
        """
        results = {}
        
        # Get copy of failed notifications to avoid modification during iteration
        failed_notifications = list(self.failed_notifications.items())
        
        for notification_id, notification_data in failed_notifications:
            # Skip permanently failed notifications
            if notification_data.get("permanently_failed"):
                results[notification_id] = False
                continue
            
            # Retry the notification
            # This would need to be implemented based on your specific needs
            # For now, we'll just mark it as attempted
            results[notification_id] = False
        
        return results


# Global retry handler instance
notification_retry_handler = NotificationRetryHandler()