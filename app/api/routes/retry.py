"""
Retry management routes for Radar.

This module provides endpoints for managing webhook retry operations.
"""
import logging
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException, status, Query

from app.services.webhook_retry_service import webhook_retry_service
from app.services.scheduler_service import scheduler_service
from app.services.monitoring_service import MonitoringService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/webhooks/retry/trigger")
async def trigger_webhook_retry():
    """
    Manually trigger webhook retry processing.
    
    Returns:
        Processing results
    """
    try:
        logger.info("Manual webhook retry triggered via API")
        
        results = await scheduler_service.trigger_webhook_retry()
        
        # Track manual trigger
        MonitoringService.track_event(
            "manual_webhook_retry_triggered",
            properties=results
        )
        
        return {
            "message": "Webhook retry processing triggered successfully",
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error triggering webhook retry: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error triggering webhook retry: {str(e)}"
        )


@router.post("/webhooks/retry/{failed_event_id}")
async def retry_specific_webhook(failed_event_id: str):
    """
    Retry a specific failed webhook event.
    
    Args:
        failed_event_id: ID of the failed webhook event to retry
        
    Returns:
        Retry result
    """
    try:
        logger.info(f"Retrying specific webhook event: {failed_event_id}")
        
        success = await webhook_retry_service.retry_specific_event(failed_event_id)
        
        if success:
            # Track successful manual retry
            MonitoringService.track_event(
                "manual_webhook_retry_succeeded",
                properties={
                    "failed_event_id": failed_event_id
                }
            )
            
            return {
                "message": f"Webhook event {failed_event_id} retried successfully",
                "success": True
            }
        else:
            # Track failed manual retry
            MonitoringService.track_event(
                "manual_webhook_retry_failed",
                properties={
                    "failed_event_id": failed_event_id
                }
            )
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to retry webhook event {failed_event_id}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrying specific webhook event {failed_event_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrying webhook event: {str(e)}"
        )


@router.get("/webhooks/retry/stats")
async def get_retry_stats():
    """
    Get webhook retry statistics.
    
    Returns:
        Retry statistics
    """
    try:
        stats = await webhook_retry_service.get_retry_stats()
        
        return {
            "message": "Retry statistics retrieved successfully",
            "stats": stats
        }
        
    except Exception as e:
        logger.error(f"Error getting retry statistics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting retry statistics: {str(e)}"
        )


@router.get("/webhooks/failed")
async def get_failed_webhooks(
    status_filter: Optional[str] = Query(None, description="Filter by status: pending, retrying, failed, succeeded"),
    limit: Optional[int] = Query(50, description="Number of events to return", ge=1, le=100),
    offset: Optional[int] = Query(0, description="Number of events to skip", ge=0)
):
    """
    Get failed webhook events with optional filtering.
    
    Args:
        status_filter: Optional status filter
        limit: Number of events to return (1-100)
        offset: Number of events to skip
        
    Returns:
        List of failed webhook events
    """
    try:
        from app.db.supabase import SupabaseManager
        
        # Build query
        query = SupabaseManager.supabase.table("failed_webhook_events").select("*")
        
        if status_filter:
            if status_filter not in ["pending", "retrying", "failed", "succeeded"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid status filter. Must be one of: pending, retrying, failed, succeeded"
                )
            query = query.eq("status", status_filter)
        
        # Add ordering and pagination
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        response = query.execute()
        
        return {
            "message": "Failed webhook events retrieved successfully",
            "events": response.data,
            "count": len(response.data),
            "limit": limit,
            "offset": offset
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting failed webhook events: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting failed webhook events: {str(e)}"
        )


@router.get("/scheduler/status")
async def get_scheduler_status():
    """
    Get scheduler service status.
    
    Returns:
        Scheduler status and job information
    """
    try:
        is_running = scheduler_service.is_running()
        jobs = scheduler_service.get_jobs()
        
        job_info = []
        for job in jobs:
            job_info.append({
                "id": job.id,
                "name": job.name,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger)
            })
        
        return {
            "message": "Scheduler status retrieved successfully",
            "status": {
                "running": is_running,
                "job_count": len(jobs),
                "jobs": job_info
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting scheduler status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting scheduler status: {str(e)}"
        )