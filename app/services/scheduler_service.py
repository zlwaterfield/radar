"""
Scheduler service for Radar.

This service manages background tasks including webhook retry processing.
"""
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.services.webhook_retry_service import webhook_retry_service
from app.services.monitoring_service import MonitoringService

logger = logging.getLogger(__name__)


class SchedulerService:
    """Service for managing scheduled tasks."""
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self._is_running = False
    
    def start(self):
        """Start the scheduler."""
        if self._is_running:
            logger.warning("Scheduler is already running")
            return
        
        logger.info("Starting scheduler service")
        
        # Schedule webhook retry processing every 5 minutes
        self.scheduler.add_job(
            func=self._process_failed_webhooks,
            trigger=IntervalTrigger(minutes=5),
            id="webhook_retry_processor",
            name="Process Failed Webhooks",
            max_instances=1,  # Prevent overlapping executions
            coalesce=True,    # Combine missed executions
            misfire_grace_time=60  # Allow 60 seconds grace for missed executions
        )
        
        # Schedule retry stats collection every hour
        self.scheduler.add_job(
            func=self._collect_retry_stats,
            trigger=IntervalTrigger(hours=1),
            id="retry_stats_collector",
            name="Collect Retry Statistics",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300  # 5 minutes grace
        )
        
        self.scheduler.start()
        self._is_running = True
        logger.info("Scheduler service started successfully")
    
    def stop(self):
        """Stop the scheduler."""
        if not self._is_running:
            logger.warning("Scheduler is not running")
            return
        
        logger.info("Stopping scheduler service")
        self.scheduler.shutdown(wait=True)
        self._is_running = False
        logger.info("Scheduler service stopped")
    
    def is_running(self) -> bool:
        """Check if scheduler is running."""
        return self._is_running
    
    async def _process_failed_webhooks(self):
        """Process failed webhook events."""
        try:
            logger.info("Starting scheduled webhook retry processing")
            start_time = datetime.utcnow()
            
            # Process all failed webhooks
            results = await webhook_retry_service.process_failed_webhooks()
            
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            logger.info(
                f"Scheduled webhook retry processing complete in {processing_time:.2f}s: "
                f"processed={results['processed']}, succeeded={results['succeeded']}, "
                f"failed={results['failed']}, permanently_failed={results['permanently_failed']}"
            )
            
            # Track retry processing metrics
            MonitoringService.track_event(
                "scheduled_webhook_retry_completed",
                properties={
                    **results,
                    "processing_time_seconds": processing_time
                }
            )
            
        except Exception as e:
            logger.error(f"Error in scheduled webhook retry processing: {e}", exc_info=True)
            
            # Track error
            MonitoringService.track_event(
                "scheduled_webhook_retry_failed",
                properties={
                    "error": str(e),
                    "exception_type": type(e).__name__
                }
            )
    
    async def _collect_retry_stats(self):
        """Collect and log retry statistics."""
        try:
            logger.debug("Collecting webhook retry statistics")
            
            stats = await webhook_retry_service.get_retry_stats()
            
            logger.info(f"Webhook retry statistics: {stats}")
            
            # Track stats
            MonitoringService.track_event(
                "webhook_retry_stats_collected",
                properties=stats
            )
            
            # Log warnings for concerning stats
            if stats.get("overdue_retries", 0) > 10:
                logger.warning(f"High number of overdue retries: {stats['overdue_retries']}")
            
            if stats.get("high_retry_count", 0) > 5:
                logger.warning(f"High number of events with multiple retry attempts: {stats['high_retry_count']}")
            
        except Exception as e:
            logger.error(f"Error collecting retry statistics: {e}", exc_info=True)
    
    def add_job(self, func, trigger, **kwargs):
        """Add a custom job to the scheduler."""
        if not self._is_running:
            logger.error("Cannot add job: scheduler is not running")
            return None
        
        return self.scheduler.add_job(func, trigger, **kwargs)
    
    def remove_job(self, job_id: str):
        """Remove a job from the scheduler."""
        try:
            self.scheduler.remove_job(job_id)
            logger.info(f"Removed job: {job_id}")
        except Exception as e:
            logger.error(f"Error removing job {job_id}: {e}")
    
    def get_jobs(self) -> list:
        """Get list of scheduled jobs."""
        if not self._is_running:
            return []
        
        return self.scheduler.get_jobs()
    
    async def trigger_webhook_retry(self) -> Dict[str, Any]:
        """Manually trigger webhook retry processing."""
        logger.info("Manually triggering webhook retry processing")
        return await webhook_retry_service.process_failed_webhooks()


# Global scheduler service instance
scheduler_service = SchedulerService()