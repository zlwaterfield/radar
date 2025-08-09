"""
Webhook retry service for Radar.

This service handles retrying failed webhook events with exponential backoff.
"""
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

from app.db.supabase import SupabaseManager
from app.services.monitoring_service import MonitoringService
from app.api.routes.webhooks import process_github_event

logger = logging.getLogger(__name__)


class WebhookRetryService:
    """Service for handling webhook retry logic."""
    
    def __init__(self):
        self.retry_delays = [5, 15, 60, 300, 900]  # 5 min, 15 min, 1 hour, 5 hours, 15 hours
        self.max_retries = len(self.retry_delays)
    
    async def process_failed_webhooks(self) -> Dict[str, Any]:
        """
        Process all pending failed webhook events.
        
        Returns:
            Dictionary with processing results
        """
        try:
            logger.info("Starting webhook retry processing")
            
            # Get pending failed webhook events
            failed_events = await SupabaseManager.get_pending_failed_webhook_events()
            
            if not failed_events:
                logger.info("No failed webhook events to retry")
                return {
                    "processed": 0,
                    "succeeded": 0,
                    "failed": 0,
                    "permanently_failed": 0
                }
            
            logger.info(f"Found {len(failed_events)} failed webhook events to retry")
            
            results = {
                "processed": len(failed_events),
                "succeeded": 0,
                "failed": 0,
                "permanently_failed": 0
            }
            
            # Process each failed event
            for failed_event in failed_events:
                try:
                    result = await self._retry_webhook_event(failed_event)
                    results[result] += 1
                    
                    # Add small delay between retries to avoid overwhelming the system
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    logger.error(f"Error retrying webhook event {failed_event['id']}: {e}")
                    results["failed"] += 1
            
            # Track retry processing metrics
            MonitoringService.track_event(
                "webhook_retry_batch_processed",
                properties=results
            )
            
            logger.info(f"Webhook retry processing complete: {results}")
            return results
            
        except Exception as e:
            logger.error(f"Error processing failed webhooks: {e}", exc_info=True)
            return {
                "processed": 0,
                "succeeded": 0,
                "failed": 0,
                "permanently_failed": 0,
                "error": str(e)
            }
    
    async def _retry_webhook_event(self, failed_event: Dict[str, Any]) -> str:
        """
        Retry a single failed webhook event.
        
        Args:
            failed_event: Failed webhook event data
            
        Returns:
            Result status: "succeeded", "failed", or "permanently_failed"
        """
        event_id = failed_event["id"]
        retry_count = failed_event["retry_count"]
        max_retries = failed_event["max_retries"]
        
        logger.info(
            f"Retrying webhook event {event_id} (attempt {retry_count + 1}/{max_retries})"
        )
        
        # Update status to retrying
        await SupabaseManager.update_failed_webhook_event(
            event_id, "retrying", retry_count + 1
        )
        
        try:
            # Extract event data
            payload = failed_event["payload"]
            event_type = failed_event["event_type"]
            
            # Find users watching this repository
            repository = payload.get("repository", {})
            repo_id = str(repository.get("id", ""))
            
            if repo_id:
                users = await SupabaseManager.get_users_by_repository(repo_id)
            else:
                users = []
            
            # Retry processing the webhook event
            await process_github_event(event_type, payload, event_id)
            
            # Mark as succeeded
            await SupabaseManager.update_failed_webhook_event(
                event_id, "succeeded"
            )
            
            # Track successful retry
            MonitoringService.track_event(
                "webhook_retry_succeeded",
                properties={
                    "event_type": event_type,
                    "retry_count": retry_count + 1,
                    "repository": failed_event.get("repository_name", "unknown")
                }
            )
            
            logger.info(f"Successfully retried webhook event {event_id}")
            return "succeeded"
            
        except Exception as e:
            error_message = str(e)
            new_retry_count = retry_count + 1
            
            logger.warning(
                f"Webhook retry failed for event {event_id} "
                f"(attempt {new_retry_count}/{max_retries}): {error_message}"
            )
            
            if new_retry_count >= max_retries:
                # Mark as permanently failed
                await SupabaseManager.update_failed_webhook_event(
                    event_id, "failed", new_retry_count, None, error_message
                )
                
                # Track permanent failure
                MonitoringService.track_event(
                    "webhook_retry_permanently_failed",
                    properties={
                        "event_type": failed_event["event_type"],
                        "final_retry_count": new_retry_count,
                        "repository": failed_event.get("repository_name", "unknown"),
                        "error": error_message
                    }
                )
                
                logger.error(f"Webhook event {event_id} permanently failed after {new_retry_count} attempts")
                return "permanently_failed"
            else:
                # Schedule next retry
                delay_minutes = self.retry_delays[min(new_retry_count - 1, len(self.retry_delays) - 1)]
                next_retry_at = datetime.utcnow() + timedelta(minutes=delay_minutes)
                
                await SupabaseManager.update_failed_webhook_event(
                    event_id, "pending", new_retry_count, next_retry_at.isoformat(), error_message
                )
                
                # Track retry failure
                MonitoringService.track_event(
                    "webhook_retry_failed",
                    properties={
                        "event_type": failed_event["event_type"],
                        "retry_count": new_retry_count,
                        "next_retry_minutes": delay_minutes,
                        "repository": failed_event.get("repository_name", "unknown"),
                        "error": error_message
                    }
                )
                
                logger.info(
                    f"Scheduled webhook event {event_id} for retry in {delay_minutes} minutes "
                    f"(attempt {new_retry_count + 1}/{max_retries})"
                )
                return "failed"
    
    async def retry_specific_event(self, failed_event_id: str) -> bool:
        """
        Retry a specific failed webhook event.
        
        Args:
            failed_event_id: ID of the failed event to retry
            
        Returns:
            True if retry was successful
        """
        try:
            # Get the specific failed event
            response = SupabaseManager.supabase.table("failed_webhook_events").select("*").eq("id", failed_event_id).execute()
            
            if not response.data:
                logger.warning(f"Failed webhook event {failed_event_id} not found")
                return False
            
            failed_event = response.data[0]
            
            # Only retry if status is pending or failed
            if failed_event["status"] not in ["pending", "failed"]:
                logger.warning(f"Failed webhook event {failed_event_id} has status {failed_event['status']}, cannot retry")
                return False
            
            result = await self._retry_webhook_event(failed_event)
            return result == "succeeded"
            
        except Exception as e:
            logger.error(f"Error retrying specific webhook event {failed_event_id}: {e}")
            return False
    
    async def get_retry_stats(self) -> Dict[str, Any]:
        """
        Get statistics about webhook retry processing.
        
        Returns:
            Dictionary with retry statistics
        """
        try:
            stats = await SupabaseManager.get_failed_webhook_events_stats()
            
            # Add additional stats
            current_time = datetime.utcnow()
            response = SupabaseManager.supabase.table("failed_webhook_events").select("next_retry_at, retry_count").eq("status", "pending").execute()
            
            overdue_count = 0
            high_retry_count = 0
            
            for event in response.data or []:
                next_retry_str = event.get("next_retry_at")
                if next_retry_str:
                    next_retry = datetime.fromisoformat(next_retry_str.replace('Z', '+00:00'))
                    if next_retry <= current_time:
                        overdue_count += 1
                
                retry_count = event.get("retry_count", 0)
                if retry_count >= 2:  # High retry count threshold
                    high_retry_count += 1
            
            stats.update({
                "overdue_retries": overdue_count,
                "high_retry_count": high_retry_count,
                "total_failed_events": sum(stats.values())
            })
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting retry stats: {e}")
            return {
                "pending": 0,
                "retrying": 0,
                "failed": 0,
                "succeeded": 0,
                "overdue_retries": 0,
                "high_retry_count": 0,
                "total_failed_events": 0
            }


# Global webhook retry service instance
webhook_retry_service = WebhookRetryService()