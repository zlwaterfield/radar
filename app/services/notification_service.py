"""
Notification service for Radar.

This module handles notification logic for GitHub events.
"""
import logging
from typing import Dict, List, Any, Optional, Set, Tuple

from app.db.supabase import SupabaseManager
from app.models.notifications import WatchingReason, NotificationTrigger, NotificationPreferences

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for handling notifications."""
    
    @staticmethod
    async def determine_watching_reasons(user_id: str, pr_data: Dict[str, Any]) -> Set[WatchingReason]:
        """
        Determine the reasons why a user is watching a pull request.
        
        Args:
            user_id: User ID
            pr_data: Pull request data
            
        Returns:
            Set of watching reasons
        """
        watching_reasons = set()
        
        # Get GitHub username for the user
        user = await SupabaseManager.get_user(user_id)
        if not user or not user.get("github_id"):
            return watching_reasons
        
        github_username = user.get("github_login")
        if not github_username:
            return watching_reasons
        
        # Check if user is the author
        if pr_data.get("user", {}).get("login") == github_username:
            watching_reasons.add(WatchingReason.AUTHOR)
        
        # Check if user is a reviewer
        requested_reviewers = pr_data.get("requested_reviewers", [])
        for reviewer in requested_reviewers:
            if reviewer.get("login") == github_username:
                watching_reasons.add(WatchingReason.REVIEWER)
                break
        
        # Check if user is assigned
        assignees = pr_data.get("assignees", [])
        for assignee in assignees:
            if assignee.get("login") == github_username:
                watching_reasons.add(WatchingReason.ASSIGNED)
                break
        
        # Check if user is mentioned in the PR description
        body = pr_data.get("body", "")
        if body and f"@{github_username}" in body:
            watching_reasons.add(WatchingReason.MENTIONED)
        
        # Check if user's team is mentioned
        # This would require additional logic to get user's teams
        # For now, we'll skip this
        
        # Check if user is subscribed
        # This would require checking the database for manual subscriptions
        # Let's check if we have a record of the user interacting with this PR
        pr_id = pr_data.get("id")
        if pr_id:
            notifications = await SupabaseManager.get_user_notifications_by_pr(user_id, pr_id)
            if notifications and len(notifications) > 0:
                watching_reasons.add(WatchingReason.SUBSCRIBED)
        
        # Check for manual watching (user explicitly chose to watch this PR)
        # This would require a new table to track watched PRs
        # For now, we'll skip this
        
        return watching_reasons
    
    @classmethod
    async def should_notify(
        cls,
        user_id: str, 
        pr_id: str, 
        trigger: NotificationTrigger, 
        actor_id: str = None
    ) -> bool:
        """
        Determine if a user should be notified based on their preferences and watching reasons.
        
        Args:
            user_id: User ID
            pr_id: Pull request ID
            trigger: Notification trigger
            actor_id: ID of the user who triggered the notification
            
        Returns:
            True if the user should be notified, False otherwise
        """
        try:
            # Get user settings
            settings = await SupabaseManager.get_user_settings(user_id)
            if not settings:
                # Use default settings
                preferences = NotificationPreferences()
            else:
                # Use user settings
                preferences_data = settings.get("notification_preferences", {})
                preferences = NotificationPreferences(**preferences_data)
            
            # Get watching reasons for this PR
            watching_reasons = await NotificationService.determine_watching_reasons(user_id, {"id": pr_id})
            
            # If the user isn't watching the PR, don't notify
            if not watching_reasons:
                return False
            
            # Check if this is the user's own activity
            if actor_id and actor_id == user_id and preferences.mute_own_activity:
                return False
            
            # Check if the user should be notified based on their relationship to the PR
            if WatchingReason.AUTHOR in watching_reasons:
                # User is the author
                if trigger == NotificationTrigger.REVIEWED and preferences.author_reviewed:
                    return True
                if trigger == NotificationTrigger.COMMENTED and preferences.author_commented:
                    return True
                if trigger == NotificationTrigger.CHECK_FAILED and preferences.author_check_failed:
                    return True
                if trigger == NotificationTrigger.CHECK_SUCCEEDED and preferences.author_check_succeeded:
                    return True
            
            if WatchingReason.REVIEWER in watching_reasons:
                # User is a reviewer
                if trigger == NotificationTrigger.REVIEW_REQUESTED and preferences.reviewer_review_requested:
                    return True
                if trigger == NotificationTrigger.COMMENTED and preferences.reviewer_commented:
                    return True
                if trigger == NotificationTrigger.MERGED and preferences.reviewer_merged:
                    return True
                if trigger == NotificationTrigger.CLOSED and preferences.reviewer_closed:
                    return True
                if trigger == NotificationTrigger.CHECK_FAILED and preferences.reviewer_check_failed:
                    return True
            
            # Default: don't notify
            return False
        
        except Exception as e:
            logger.error(f"Error checking if user should be notified: {e}", exc_info=True)
            return False
            
    @classmethod
    async def should_notify_keyword(cls, user_id: str, content: str) -> Tuple[bool, List[str], Dict[str, Any]]:
        """
        Check if user should be notified based on keyword matching.
        
        Args:
            user_id: User ID
            content: Content to analyze
            
        Returns:
            Tuple of (should_notify, matched_keywords, match_details)
        """
        try:
            # Import OpenAI analyzer service
            from app.services.openai_analyzer_service import OpenAIAnalyzerService
            
            # Analyze content
            return await OpenAIAnalyzerService.analyze_content(content, user_id)
        except Exception as e:
            logger.error(f"Error checking if user should be notified based on keywords: {e}", exc_info=True)
            return False, [], {}
    
    @classmethod
    async def process_pull_request_event(
        cls,
        payload: Dict[str, Any],
        user_id: str,
        event_id: str
    ) -> bool:
        """
        Process a pull request event and determine if the user should be notified.
        
        Args:
            payload: Event payload
            user_id: User ID
            event_id: Event ID
            
        Returns:
            True if the user should be notified, False otherwise
        """
        try:
            action = payload.get("action")
            pr = payload.get("pull_request", {})
            sender = payload.get("sender", {})
            
            # Map action to trigger
            trigger = None
            if action == "review_requested":
                trigger = NotificationTrigger.REVIEW_REQUESTED
            elif action == "review_request_removed":
                trigger = NotificationTrigger.REVIEW_REQUEST_REMOVED
            elif action == "closed" and pr.get("merged"):
                trigger = NotificationTrigger.MERGED
            elif action == "closed":
                trigger = NotificationTrigger.CLOSED
            elif action == "reopened":
                trigger = NotificationTrigger.REOPENED
            elif action == "assigned":
                trigger = NotificationTrigger.ASSIGNED
            elif action == "unassigned":
                trigger = NotificationTrigger.UNASSIGNED
            elif action == "labeled":
                trigger = NotificationTrigger.LABELED
            elif action == "unlabeled":
                trigger = NotificationTrigger.UNLABELED
            else:
                # For other actions, we don't have a specific trigger
                return False
            
            if not trigger:
                return False
            
            # Get user settings
            settings = await SupabaseManager.get_user_settings(user_id)
            if not settings:
                return False
            
            # Convert to our model
            preferences = NotificationPreferences(**settings.get("notification_preferences", {}))
            
            # Get user
            user = await SupabaseManager.get_user(user_id)
            if not user:
                return False
            
            # Determine watching reasons
            watching_reasons = await cls.determine_watching_reasons(user_id, pr)
            
            # Check if user should be notified
            return cls.should_notify(
                user_id,
                pr.get("id"),
                trigger,
                actor_id=sender.get("id")
            )
            
        except Exception as e:
            logger.error(f"Error processing pull request event: {e}", exc_info=True)
            return False
    
    @classmethod
    async def process_pull_request_review_event(
        cls,
        payload: Dict[str, Any],
        user_id: str,
        event_id: str
    ) -> bool:
        """
        Process a pull request review event and determine if the user should be notified.
        
        Args:
            payload: Event payload
            user_id: User ID
            event_id: Event ID
            
        Returns:
            True if the user should be notified, False otherwise
        """
        try:
            action = payload.get("action")
            pr = payload.get("pull_request", {})
            sender = payload.get("sender", {})
            
            # Only handle submitted reviews for now
            if action != "submitted":
                return False
            
            # Get user settings
            settings = await SupabaseManager.get_user_settings(user_id)
            if not settings:
                return False
            
            # Convert to our model
            preferences = NotificationPreferences(**settings.get("notification_preferences", {}))
            
            # Get user
            user = await SupabaseManager.get_user(user_id)
            if not user:
                return False
            
            # Determine watching reasons
            watching_reasons = await cls.determine_watching_reasons(user_id, pr)
            
            # Check if user should be notified
            return cls.should_notify(
                user_id,
                pr.get("id"),
                NotificationTrigger.REVIEWED,
                actor_id=sender.get("id")
            )
            
        except Exception as e:
            logger.error(f"Error processing pull request review event: {e}", exc_info=True)
            return False
    
    @classmethod
    async def process_pull_request_comment_event(
        cls,
        payload: Dict[str, Any],
        user_id: str,
        event_id: str
    ) -> bool:
        """
        Process a pull request comment event and determine if the user should be notified.
        
        Args:
            payload: Event payload
            user_id: User ID
            event_id: Event ID
            
        Returns:
            True if the user should be notified, False otherwise
        """
        try:
            action = payload.get("action")
            pr = payload.get("pull_request", {})
            comment = payload.get("comment", {})
            sender = payload.get("sender", {})
            
            # Only handle created comments for now
            if action != "created":
                return False
            
            # Skip bot comments if user has muted them
            settings = await SupabaseManager.get_user_settings(user_id)
            if not settings:
                return False
            
            # Convert to our model
            preferences = NotificationPreferences(**settings.get("notification_preferences", {}))
            
            # Check if it's a bot comment and user has muted bot comments
            if preferences.mute_bot_comments and sender.get("type") == "Bot":
                return False
            
            # Get user
            user = await SupabaseManager.get_user(user_id)
            if not user:
                return False
            
            # Check if user is mentioned in the comment
            github_username = user.get("github_login")
            if github_username and comment.get("body") and f"@{github_username}" in comment.get("body"):
                # User is mentioned, add to watching reasons
                watching_reasons = await cls.determine_watching_reasons(user_id, pr)
                watching_reasons.add(WatchingReason.MENTIONED)
            else:
                # User is not mentioned, use regular watching reasons
                watching_reasons = await cls.determine_watching_reasons(user_id, pr)
            
            # Check if user should be notified
            return cls.should_notify(
                user_id,
                pr.get("id"),
                NotificationTrigger.COMMENTED,
                actor_id=sender.get("id")
            )
            
        except Exception as e:
            logger.error(f"Error processing pull request comment event: {e}", exc_info=True)
            return False
