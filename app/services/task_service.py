"""
Task service for Radar.

This module provides a service for handling background tasks and scheduled jobs. 
Currently this is using APScheduler, but in the future we may use a more robust 
task scheduler.
"""
import logging
from datetime import datetime, time, timedelta
from typing import Callable, Awaitable

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db.supabase import SupabaseManager
from app.services.slack_service import SlackService
from app.services.monitoring_service import MonitoringService
from app.models.slack import DigestMessage, MessageType

logger = logging.getLogger(__name__)


class TaskService:
    """Service for handling background tasks and scheduled jobs."""

    _instance = None
    _scheduler = None

    def __new__(cls):
        """Singleton pattern."""
        if cls._instance is None:
            cls._instance = super(TaskService, cls).__new__(cls)
            cls._scheduler = AsyncIOScheduler()
            cls._scheduler.start()
            logger.info("Task scheduler started")
        return cls._instance

    @classmethod
    async def schedule_digest_notifications(cls):
        """
        Schedule digest notifications for all users.
        
        This method schedules daily digest notifications for all users
        based on their notification preferences.
        """
        try:
            # Get all users with digest enabled
            users = await SupabaseManager.get_users_with_digest_enabled()
            
            # Clear existing digest jobs
            for job in cls._scheduler.get_jobs():
                if job.id.startswith("digest_"):
                    job.remove()
            
            # Schedule new digest jobs
            for user in users:
                user_id = user["id"]
                settings = await SupabaseManager.get_user_settings(user_id)
                
                if not settings or not settings.get("notification_schedule", {}).get("digest_enabled", False):
                    continue
                
                # Get digest time
                digest_time_str = settings.get("notification_schedule", {}).get("digest_time", "09:00")
                try:
                    hour, minute = map(int, digest_time_str.split(":"))
                    digest_time = time(hour=hour, minute=minute)
                except (ValueError, TypeError):
                    logger.warning(f"Invalid digest time format for user {user_id}: {digest_time_str}")
                    digest_time = time(hour=9, minute=0)
                
                # Get digest days
                digest_days = settings.get("notification_schedule", {}).get("digest_days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
                
                # Convert day names to lowercase abbreviations for APScheduler
                day_mapping = {
                    "Monday": "mon",
                    "Tuesday": "tue",
                    "Wednesday": "wed",
                    "Thursday": "thu",
                    "Friday": "fri",
                    "Saturday": "sat",
                    "Sunday": "sun"
                }
                
                # Map the day names to their abbreviations
                day_abbrs = [day_mapping.get(day, "mon") for day in digest_days]
                day_of_week = ",".join(day_abbrs) if day_abbrs else "mon-fri"
                
                # Schedule job
                cls._scheduler.add_job(
                    cls.send_digest_notification,
                    CronTrigger(
                        day_of_week=day_of_week,
                        hour=digest_time.hour,
                        minute=digest_time.minute
                    ),
                    id=f"digest_{user_id}",
                    args=[user_id],
                    replace_existing=True
                )
                
                logger.info(f"Scheduled digest notification for user {user_id} at {digest_time_str} on {day_of_week}")
                
                # Schedule second digest if enabled
                second_digest_enabled = settings.get("notification_schedule", {}).get("second_digest_enabled", False)
                if second_digest_enabled:
                    second_digest_time_str = settings.get("notification_schedule", {}).get("second_digest_time", "16:00")
                    try:
                        hour, minute = map(int, second_digest_time_str.split(":"))
                        second_digest_time = time(hour=hour, minute=minute)
                    except (ValueError, TypeError):
                        logger.warning(f"Invalid second digest time format for user {user_id}: {second_digest_time_str}")
                        second_digest_time = time(hour=16, minute=0)
                    
                    # Schedule job
                    cls._scheduler.add_job(
                        cls.send_digest_notification,
                        CronTrigger(
                            day_of_week=day_of_week,
                            hour=second_digest_time.hour,
                            minute=second_digest_time.minute
                        ),
                        id=f"digest2_{user_id}",
                        args=[user_id],
                        replace_existing=True
                    )
                    
                    logger.info(f"Scheduled second digest notification for user {user_id} at {second_digest_time_str} on {day_of_week}")
        
        except Exception as e:
            logger.error(f"Error scheduling digest notifications: {e}", exc_info=True)
    
    @classmethod
    async def send_digest_notification(cls, user_id: str):
        """
        Send digest notification to a user.
        
        Args:
            user_id: User ID
        """
        try:
            # Get user
            user = await SupabaseManager.get_user(user_id)
            
            if not user:
                logger.warning(f"User not found for digest notification: {user_id}")
                return
            
            # Get user settings
            settings = await SupabaseManager.get_user_settings(user_id)
            
            if not settings or not settings.get("notification_schedule", {}).get("digest_enabled", False):
                logger.warning(f"Digest notifications disabled for user {user_id}")
                return
            
            # Get activity since last digest
            last_digest = await SupabaseManager.get_last_digest(user_id)
            
            if last_digest:
                since = datetime.fromisoformat(last_digest["sent_at"])
            else:
                # Default to 24 hours ago
                since = datetime.utcnow() - timedelta(days=1)
            
            # Get repositories - this returns a paginated response
            repo_response = await SupabaseManager.get_user_repositories(user_id, page_size=100)
            repositories = repo_response.get("items", [])
            
            if not repositories:
                logger.warning(f"No repositories found for user {user_id}")
                return
            
            # Get activity
            pull_requests = []
            issues = []
            
            for repo in repositories:
                # Get pull requests
                repo_prs = await SupabaseManager.get_repository_pull_requests(
                    repo["id"],
                    since=since
                )
                
                pull_requests.extend(repo_prs)
                
                # Get issues
                repo_issues = await SupabaseManager.get_repository_issues(
                    repo["id"],
                    since=since
                )
                
                issues.extend(repo_issues)
            
            # Skip if no activity
            if not pull_requests and not issues:
                logger.info(f"No activity found for user {user_id} since {since}")
                return
            
            # Format digest message
            time_period = "daily"  # TODO: Make this dynamic based on settings
            
            # Create digest message
            digest_message = DigestMessage(
                message_type=MessageType.DIGEST,
                time_period=time_period,
                pull_requests=pull_requests,
                issues=issues,
                blocks=[],  # Will be generated by SlackService
                text=f"Your {time_period} GitHub digest",
                channel=user["slack_id"]  # Send as DM
            )
            
            # Send message
            slack_service = SlackService(token=user["slack_access_token"])
            message_ts = await slack_service.send_digest(digest_message)
            
            if message_ts:
                # Record digest
                await SupabaseManager.record_digest(
                    user_id=user_id,
                    message_ts=message_ts,
                    pull_request_count=len(pull_requests),
                    issue_count=len(issues)
                )
                
                # Track successful digest delivery
                MonitoringService.track_notification_sent(
                    user_id=user_id,
                    notification_type="digest",
                    repository="digest_summary",
                    success=True
                )
                
                logger.info(f"Sent digest notification to user {user_id} with {len(pull_requests)} PRs and {len(issues)} issues")
            else:
                # Track failed digest delivery
                MonitoringService.track_notification_sent(
                    user_id=user_id,
                    notification_type="digest",
                    repository="digest_summary",
                    success=False,
                    error="Failed to send digest message"
                )
                
                logger.error(f"Failed to send digest notification to user {user_id}")
        
        except Exception as e:
            logger.error(f"Error sending digest notification to user {user_id}: {e}", exc_info=True)
    
    # @classmethod
    # async def schedule_stats_notifications(cls):
    #     """
    #     Schedule stats notifications for all users.
        
    #     This method schedules weekly stats notifications for all users
    #     based on their notification preferences.
    #     """
    #     try:
    #         # Get all users
    #         users = await SupabaseManager.get_all_users()
            
    #         # Clear existing stats jobs
    #         for job in cls._scheduler.get_jobs():
    #             if job.id.startswith("stats_"):
    #                 job.remove()
            
    #         # Schedule new stats jobs
    #         for user in users:
    #             user_id = user["id"]
                
    #             # Schedule job for Monday at 10:00 AM
    #             cls._scheduler.add_job(
    #                 cls.send_stats_notification,
    #                 CronTrigger(
    #                     day_of_week="mon",
    #                     hour=10,
    #                     minute=0
    #                 ),
    #                 id=f"stats_{user_id}",
    #                 args=[user_id],
    #                 replace_existing=True
    #             )
                
    #             logger.info(f"Scheduled stats notification for user {user_id} at 10:00 on Monday")
        
    #     except Exception as e:
    #         logger.error(f"Error scheduling stats notifications: {e}", exc_info=True)
    
    # @classmethod
    # async def send_stats_notification(cls, user_id: str):
    #     """
    #     Send stats notification to a user.
        
    #     Args:
    #         user_id: User ID
    #     """
    #     try:
    #         # Get user
    #         user = await SupabaseManager.get_user(user_id)
            
    #         if not user:
    #             logger.warning(f"User not found for stats notification: {user_id}")
    #             return
            
    #         # Get user settings
    #         settings = await SupabaseManager.get_user_settings(user_id)
            
    #         if not settings:
    #             logger.warning(f"Settings not found for user {user_id}")
    #             return
            
    #         # Get stats time window
    #         time_window = settings.get("stats_time_window", 14)  # Default to 2 weeks
            
    #         # Get repositories
    #         repositories = await SupabaseManager.get_user_repositories(user_id)
            
    #         if not repositories:
    #             logger.warning(f"No repositories found for user {user_id}")
    #             return
            
    #         # Calculate stats
    #         since = datetime.utcnow() - timedelta(days=time_window)
            
    #         stats = {
    #             "pull_requests": {
    #                 "opened": 0,
    #                 "closed": 0,
    #                 "merged": 0
    #             },
    #             "issues": {
    #                 "opened": 0,
    #                 "closed": 0
    #             },
    #             "comments": 0,
    #             "reviews": 0,
    #             "repositories": {}
    #         }
            
    #         for repo in repositories:
    #             repo_name = repo["full_name"]
    #             stats["repositories"][repo_name] = {
    #                 "pull_requests": {
    #                     "opened": 0,
    #                     "closed": 0,
    #                     "merged": 0
    #                 },
    #                 "issues": {
    #                     "opened": 0,
    #                     "closed": 0
    #                 },
    #                 "comments": 0,
    #                 "reviews": 0
    #             }
                
    #             # Get pull requests
    #             repo_prs = await SupabaseManager.get_repository_pull_requests(
    #                 repo["id"],
    #                 since=since
    #             )
                
    #             for pr in repo_prs:
    #                 if pr["created_at"] >= since.isoformat():
    #                     stats["pull_requests"]["opened"] += 1
    #                     stats["repositories"][repo_name]["pull_requests"]["opened"] += 1
                    
    #                 if pr["closed_at"] and pr["closed_at"] >= since.isoformat():
    #                     stats["pull_requests"]["closed"] += 1
    #                     stats["repositories"][repo_name]["pull_requests"]["closed"] += 1
                    
    #                 if pr["merged_at"] and pr["merged_at"] >= since.isoformat():
    #                     stats["pull_requests"]["merged"] += 1
    #                     stats["repositories"][repo_name]["pull_requests"]["merged"] += 1
                
    #             # Get issues
    #             repo_issues = await SupabaseManager.get_repository_issues(
    #                 repo["id"],
    #                 since=since
    #             )
                
    #             for issue in repo_issues:
    #                 if issue["created_at"] >= since.isoformat():
    #                     stats["issues"]["opened"] += 1
    #                     stats["repositories"][repo_name]["issues"]["opened"] += 1
                    
    #                 if issue["closed_at"] and issue["closed_at"] >= since.isoformat():
    #                     stats["issues"]["closed"] += 1
    #                     stats["repositories"][repo_name]["issues"]["closed"] += 1
                
    #             # Get comments
    #             repo_comments = await SupabaseManager.get_repository_comments(
    #                 repo["id"],
    #                 since=since
    #             )
                
    #             stats["comments"] += len(repo_comments)
    #             stats["repositories"][repo_name]["comments"] += len(repo_comments)
                
    #             # Get reviews
    #             repo_reviews = await SupabaseManager.get_repository_reviews(
    #                 repo["id"],
    #                 since=since
    #             )
                
    #             stats["reviews"] += len(repo_reviews)
    #             stats["repositories"][repo_name]["reviews"] += len(repo_reviews)
            
    #         # Skip if no activity
    #         if (stats["pull_requests"]["opened"] == 0 and
    #             stats["pull_requests"]["closed"] == 0 and
    #             stats["pull_requests"]["merged"] == 0 and
    #             stats["issues"]["opened"] == 0 and
    #             stats["issues"]["closed"] == 0 and
    #             stats["comments"] == 0 and
    #             stats["reviews"] == 0):
    #             logger.info(f"No activity found for user {user_id} in the last {time_window} days")
    #             return
            
    #         # Send stats message
    #         slack_service = SlackService(token=user["slack_access_token"])
    #         await slack_service.send_stats(
    #             channel=user["slack_id"],  # Send as DM
    #             time_window=time_window,
    #             stats=stats
    #         )
            
    #         logger.info(f"Sent stats notification to user {user_id} for the last {time_window} days")
        
    #     except Exception as e:
    #         logger.error(f"Error sending stats notification to user {user_id}: {e}", exc_info=True)
    
    @classmethod
    def add_job(cls, func: Callable[..., Awaitable[None]], trigger, **kwargs):
        """
        Add a job to the scheduler.
        
        Args:
            func: Function to execute
            trigger: Job trigger
            **kwargs: Additional arguments for the scheduler
        
        Returns:
            Job ID
        """
        return cls._scheduler.add_job(func, trigger, **kwargs).id
    
    @classmethod
    def remove_job(cls, job_id: str):
        """
        Remove a job from the scheduler.
        
        Args:
            job_id: Job ID
        """
        cls._scheduler.remove_job(job_id)
    
    @classmethod
    def shutdown(cls):
        """Shutdown the scheduler."""
        if cls._scheduler:
            cls._scheduler.shutdown()
            logger.info("Task scheduler shutdown")
