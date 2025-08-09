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
    async def determine_watching_reasons(user_id: str, data: Dict[str, Any]) -> Set[WatchingReason]:
        """
        Determine the reasons why a user is watching a PR or issue
        
        Args:
            user_id: User ID
            data: PR or issue data
            
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
        
        # Determine if this is a PR or an issue
        is_pr = False
        
        # Check for direct PR indicators
        if "head" in data or "requested_reviewers" in data:
            is_pr = True
        # Check for PR in issue (issue comment case)
        elif "issue" in data and "pull_request" in data.get("issue", {}):
            is_pr = True
        # Check for pull_request field directly
        elif "pull_request" in data:
            is_pr = True
        # Check URL for PR pattern as fallback
        elif "html_url" in data and "/pull/" in data.get("html_url", ""):
            is_pr = True
        
        # Check if user is the author
        if data.get("user", {}).get("login") == github_username:
            watching_reasons.add(WatchingReason.AUTHOR)
        
        if is_pr:
            # For issue comments on PRs, we need to fetch the full PR data
            pr_data = data
            
            # If this is an issue comment on a PR, we need to fetch the PR details
            if "issue" in data and "pull_request" in data.get("issue", {}):
                try:
                    # Extract repository and PR number
                    repository = data.get("repository", {}).get("full_name")
                    pr_number = data.get("issue", {}).get("number")
                    
                    if repository and pr_number:
                        # Get user's GitHub token
                        github_token = user.get("github_access_token")
                        
                        if github_token:
                            # Fetch PR details from GitHub
                            from app.services.github_service import GitHubService
                            print("Fetching PR details from GitHub...", github_token)
                            github_service = GitHubService(token=github_token)
                            pr_details = github_service.get_pull_request(repository, pr_number)
                            
                            if pr_details:
                                pr_data = pr_details
                except Exception as e:
                    logger.error(f"Error fetching PR details: {e}")
            
            # Check if user is a reviewer
            requested_reviewers = pr_data.get("requested_reviewers", [])
            for reviewer in requested_reviewers:
                if reviewer.get("login") == github_username:
                    watching_reasons.add(WatchingReason.REVIEWER)
                    break
        
        # Check if user is assigned (works for both PRs and issues)
        assignees = data.get("assignees", [])
        for assignee in assignees:
            if assignee.get("login") == github_username:
                watching_reasons.add(WatchingReason.ASSIGNED)
                break
        
        # Check if user is mentioned in the PR/issue description
        body = data.get("body", "")
        if body and f"@{github_username}" in body:
            watching_reasons.add(WatchingReason.MENTIONED)
        
        # Check if user's team is mentioned
        # This would require additional logic to get user's teams
        
        return watching_reasons
    
    @classmethod
    async def should_notify(
        cls,
        user_id: str, 
        pr_data: Dict[str, Any], 
        trigger: NotificationTrigger, 
        actor_id: str = None
    ) -> bool:
        """
        Determine if a user should be notified based on their preferences and watching reasons.
        
        Args:
            user_id: User ID
            pr_data: Pull request data dictionary
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
            watching_reasons = await cls.determine_watching_reasons(user_id, pr_data)

            # If the user isn't watching the PR, don't notify
            if not watching_reasons:
                return False
            
            # Check if this is the user's own activity
            # Compare GitHub IDs instead of database user IDs
            if actor_id and preferences.mute_own_activity:
                user = await SupabaseManager.get_user(user_id)
                if user and str(actor_id) == str(user.get("github_id")):
                    return False
            
            # Check if this is a draft PR and user has muted draft PRs
            if preferences.mute_draft_prs and pr_data.get("draft", False):
                return False
            
            # Check if user should be notified based on activity type (not role)
            # Only notify if user has some relationship to the PR/issue
            if not watching_reasons:
                return False
            
            # Always notify if mentioned (regardless of other preferences)
            if WatchingReason.MENTIONED in watching_reasons:
                return preferences.mentioned_in_comments
            
            # Check preferences based on activity type
            if trigger == NotificationTrigger.COMMENTED:
                return preferences.pr_comments
            elif trigger == NotificationTrigger.REVIEWED:
                return preferences.pr_reviews
            elif trigger in [NotificationTrigger.MERGED, NotificationTrigger.CLOSED, NotificationTrigger.REOPENED]:
                return preferences.pr_status_changes
            elif trigger in [NotificationTrigger.ASSIGNED, NotificationTrigger.UNASSIGNED, NotificationTrigger.REVIEW_REQUESTED, NotificationTrigger.REVIEW_REQUEST_REMOVED]:
                return preferences.pr_assignments
            elif trigger == NotificationTrigger.OPENED:
                return preferences.pr_opened
            elif trigger == NotificationTrigger.CHECK_FAILED:
                return preferences.check_failures
            elif trigger == NotificationTrigger.CHECK_SUCCEEDED:
                return preferences.check_successes
            
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
            logger.debug(f"Checking keyword notification for user {user_id} with content length: {len(content)}")
            
            # Import OpenAI analyzer service
            from app.services.openai_analyzer_service import OpenAIAnalyzerService
            
            # Analyze content
            result = await OpenAIAnalyzerService.analyze_content(content, user_id)
            
            logger.debug(f"Keyword notification check result for user {user_id}: {result}")
            return result
        except Exception as e:
            logger.error(f"Error checking if user should be notified based on keywords: {e}", exc_info=True)
            return False, [], {}
    
    @classmethod
    async def should_notify_based_on_keywords(
        cls, 
        user_id: str, 
        content_list: List[str], 
        event_type: str
    ) -> Tuple[bool, List[str], Dict[str, Any]]:
        """
        Check if user should be notified based on keyword matching across multiple content pieces.
        
        Args:
            user_id: User ID
            content_list: List of content strings to analyze
            event_type: Type of event (for logging purposes)
            
        Returns:
            Tuple of (should_notify, matched_keywords, match_details)
        """
        try:
            logger.warning(f"KEYWORD CHECK: should_notify_based_on_keywords called for user {user_id}, event_type: {event_type}, content pieces: {len(content_list)}")
            
            # Import OpenAI analyzer service
            from app.services.openai_analyzer_service import OpenAIAnalyzerService
            
            # Combine all content with separators
            combined_content = "\n\n".join([content for content in content_list if content and content.strip()])
            logger.warning(f"KEYWORD CHECK: Combined content length: {len(combined_content)}, preview: {combined_content[:100]}...")
            
            if not combined_content.strip():
                return False, [], {}
            
            # Analyze content
            should_notify, matched_keywords, match_details = await OpenAIAnalyzerService.analyze_content(combined_content, user_id)
            
            # Log keyword matches for monitoring
            if should_notify and matched_keywords:
                logger.info(f"Keyword match for user {user_id} in {event_type}: {matched_keywords}")
            
            return should_notify, matched_keywords, match_details
            
        except Exception as e:
            logger.error(f"Error checking if user should be notified based on keywords: {e}", exc_info=True)
            return False, [], {}
    
    @classmethod
    async def process_pull_request_event(
        cls,
        user_id: str,
        payload: Dict[str, Any],
        event_id: str
    ) -> Tuple[bool, List[str], Dict[str, Any]]:
        """
        Process a pull request event and determine if a user should be notified.
        
        Args:
            user_id: User ID
            payload: Event payload
            event_id: Event ID
            
        Returns:
            Tuple containing:
            - bool: True if the user should be notified, False otherwise
            - List[str]: List of matched keywords if any
            - Dict[str, Any]: Match details if any
        """
        try:
            # Extract data from payload
            action = payload.get("action")
            pr = payload.get("pull_request", {})
            sender = payload.get("sender", {})
            
            # Skip if action is not interesting
            if action not in ["opened", "closed", "reopened", "review_requested", "review_request_removed", "assigned", "unassigned", "edited"]:
                return False, [], {}
            
            # Import OpenAI analyzer service
            from app.services.openai_analyzer_service import OpenAIAnalyzerService
            
            # Determine notification trigger based on action
            trigger = None
            if action == "opened":
                trigger = NotificationTrigger.OPENED
            elif action == "reopened":
                trigger = NotificationTrigger.REOPENED
            elif action == "closed" and pr.get("merged"):
                trigger = NotificationTrigger.MERGED
            elif action == "closed" and not pr.get("merged"):
                trigger = NotificationTrigger.CLOSED
            elif action == "review_requested":
                trigger = NotificationTrigger.REVIEW_REQUESTED
            elif action == "review_request_removed":
                trigger = NotificationTrigger.REVIEW_REQUEST_REMOVED
            elif action == "assigned":
                trigger = NotificationTrigger.ASSIGNED
            elif action == "unassigned":
                trigger = NotificationTrigger.UNASSIGNED
            
            if not trigger:
                return False, [], {}
            
            # Check if user should be notified based on notification preferences
            should_notify_preferences = await cls.should_notify(
                user_id, 
                pr, 
                trigger, 
                actor_id=sender.get("id")
            )
            
            # Extract content for AI analysis
            pr_content = f"Title: {pr.get('title', '')}\nDescription: {pr.get('body', '')}"
            
            # Check if user should be notified based on keyword analysis
            should_notify_keywords, matched_keywords, match_details = await OpenAIAnalyzerService.analyze_content(
                pr_content, user_id
            )
            
            # Determine if notification should be sent
            should_notify = should_notify_preferences or should_notify_keywords
            
            return should_notify, matched_keywords, match_details
            
        except Exception as e:
            logger.error(f"Error processing pull request event: {e}", exc_info=True)
            return False, [], {}
    
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
            
            # Get user
            user = await SupabaseManager.get_user(user_id)
            if not user:
                return False
            
            # Check if user should be notified
            return await cls.should_notify(
                user_id,
                pr,
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
                # User is mentioned, always notify
                return True
            
            # Check if user should be notified
            return cls.should_notify(
                user_id,
                pr,
                NotificationTrigger.COMMENTED,
                actor_id=sender.get("id")
            )
            
        except Exception as e:
            logger.error(f"Error processing pull request comment event: {e}", exc_info=True)
            return False

    @classmethod
    async def process_issue_comment_event(
        cls,
        user_id: str,
        payload: Dict[str, Any],
        event_id: str
    ) -> Tuple[bool, List[str], Dict[str, Any]]:
        """
        Process an issue comment event and determine if a user should be notified.
        
        Args:
            user_id: User ID
            payload: Event payload
            event_id: Event ID
            
        Returns:
            Tuple containing:
            - bool: True if the user should be notified, False otherwise
            - List[str]: List of matched keywords if any
            - Dict[str, Any]: Match details if any
        """
        try:
            # Extract data from payload
            comment = payload.get("comment", {})
            issue = payload.get("issue", {})
            sender = payload.get("sender", {})
            
            # Get user settings
            settings = await SupabaseManager.get_user_settings(user_id)
            if not settings:
                # Use default settings
                preferences = NotificationPreferences()
            else:
                # Use user settings
                preferences_data = settings.get("notification_preferences", {})
                preferences = NotificationPreferences(**preferences_data)
            
            # Check if this is the user's own activity
            user = await SupabaseManager.get_user(user_id)
            if not user:
                return False, [], {}
                
            github_username = user.get("github_login")
            is_own_activity = sender.get("login") == github_username
            
            # Don't notify for own activity if muted
            if is_own_activity and preferences.mute_own_activity:
                return False, [], {}
            
            # Check for keyword matches in comment body
            content_to_check = [comment.get("body", "")]
            
            logger.warning(f"KEYWORD CHECK: Processing issue comment event for user {user_id}, comment length: {len(content_to_check[0])}")
            
            should_notify_keywords, matched_keywords, match_details = await cls.should_notify_based_on_keywords(
                user_id, content_to_check, "issue_comment"
            )
            
            logger.warning(f"KEYWORD CHECK RESULT: User {user_id}, should_notify: {should_notify_keywords}, matched_keywords: {matched_keywords}")
            
            # If we have keyword matches, always notify
            if should_notify_keywords:
                return True, matched_keywords, match_details
            
            # Check if user is mentioned in the comment first
            comment_body = comment.get("body", "")
            if comment_body and f"@{github_username}" in comment_body:
                # User is mentioned, check their mention preference
                if preferences.mentioned_in_comments:
                    return True, [], {}
                else:
                    return False, [], {}
            
            # Get watching reasons for this issue (only check if no keyword matches)
            watching_reasons = await cls.determine_watching_reasons(user_id, issue)
            
            # If the user isn't watching the issue, don't notify
            if not watching_reasons:
                return False, [], {}
            
            # Use general comment preference for all users involved with the PR/issue
            # Check if this is a PR or issue based on whether it has pull_request field
            is_pr = "pull_request" in issue
            
            if is_pr:
                should_notify_preferences = preferences.pr_comments
            else:
                should_notify_preferences = preferences.issue_comments
            
            # Always notify if mentioned
            if WatchingReason.MENTIONED in watching_reasons:
                should_notify_preferences = True
            
            return should_notify_preferences, [], {}
            
        except Exception as e:
            logger.error(f"Error processing issue comment event: {e}", exc_info=True)
            return False, [], {}

    @classmethod
    async def process_issue_event(
        cls,
        user_id: str,
        payload: Dict[str, Any],
        event_id: str
    ) -> Tuple[bool, List[str], Dict[str, Any]]:
        """
        Process an issue event and determine if a user should be notified.
        
        Args:
            user_id: User ID
            payload: Event payload
            event_id: Event ID
            
        Returns:
            Tuple containing:
            - bool: True if the user should be notified, False otherwise
            - List[str]: List of matched keywords if any
            - Dict[str, Any]: Match details if any
        """
        try:
            # Extract data from payload
            action = payload.get("action")
            issue = payload.get("issue", {})
            sender = payload.get("sender", {})
            
            # Skip if action is not interesting
            if action not in ["opened", "closed", "reopened", "assigned", "edited"]:
                return False, [], {}
            
            # Get user settings
            settings = await SupabaseManager.get_user_settings(user_id)
            if not settings:
                # Use default settings
                preferences = NotificationPreferences()
            else:
                # Use user settings
                preferences_data = settings.get("notification_preferences", {})
                preferences = NotificationPreferences(**preferences_data)
            
            # Check if this is the user's own activity
            user = await SupabaseManager.get_user(user_id)
            if not user:
                return False, [], {}
                
            github_username = user.get("github_login")
            is_own_activity = sender.get("login") == github_username
            
            # Don't notify for own activity if muted
            if is_own_activity and preferences.mute_own_activity:
                return False, [], {}
            
            # Check for keyword matches in issue title and body
            content_to_check = [
                issue.get("title", ""),
                issue.get("body", "")
            ]
            
            logger.warning(f"KEYWORD CHECK: Processing issue event for user {user_id}, action: {action}, content length: {[len(c) for c in content_to_check]}")
            
            should_notify_keywords, matched_keywords, match_details = await cls.should_notify_based_on_keywords(
                user_id, content_to_check, "issue"
            )
            
            logger.warning(f"KEYWORD CHECK RESULT: User {user_id}, should_notify: {should_notify_keywords}, matched_keywords: {matched_keywords}")
            
            # If we have keyword matches, always notify
            if should_notify_keywords:
                return True, matched_keywords, match_details
            
            # Get watching reasons for this issue (only check if no keyword matches)
            watching_reasons = await cls.determine_watching_reasons(user_id, issue)
            
            # If the user isn't watching the issue, don't notify
            if not watching_reasons:
                return False, [], {}
            
            # Always notify if mentioned (regardless of other preferences)
            if WatchingReason.MENTIONED in watching_reasons:
                return preferences.mentioned_in_comments, [], {}
            
            # Check notification preferences based on issue action
            if action in ["opened", "reopened", "closed"]:
                should_notify_preferences = preferences.issue_status_changes
            elif action == "assigned":
                should_notify_preferences = preferences.issue_assignments
            else:
                # Default for other actions
                should_notify_preferences = True
            
            return should_notify_preferences, [], {}
            
        except Exception as e:
            logger.error(f"Error processing issue event: {e}", exc_info=True)
            return False, [], {}
    
    @classmethod
    async def process_discussion_event(
        cls,
        user_id: str,
        payload: Dict[str, Any],
        event_id: str
    ) -> Tuple[bool, List[str], Dict[str, Any]]:
        """
        Process a discussion event and determine if a user should be notified.
        
        Args:
            user_id: User ID
            payload: Event payload
            event_id: Event ID
            
        Returns:
            Tuple containing:
            - bool: True if the user should be notified, False otherwise
            - List[str]: List of matched keywords if any
            - Dict[str, Any]: Match details if any
        """
        try:
            # Extract data from payload
            action = payload.get("action")
            discussion = payload.get("discussion", {})
            sender = payload.get("sender", {})
            
            # Skip if action is not interesting
            if action not in ["created", "answered", "locked", "unlocked", "category_changed"]:
                return False, [], {}
            
            # Get user settings
            settings = await SupabaseManager.get_user_settings(user_id)
            if not settings:
                # Use default settings - assume discussions are enabled by default
                discussion_notifications_enabled = True
            else:
                # Check if discussion notifications are enabled
                notification_preferences = settings.get("notification_preferences", {})
                discussion_notifications_enabled = notification_preferences.get("discussions", True)
            
            if not discussion_notifications_enabled:
                return False, [], {}
            
            # Check if this is the user's own activity
            user = await SupabaseManager.get_user(user_id)
            if not user:
                return False, [], {}
                
            github_username = user.get("github_login")
            is_own_activity = sender.get("login") == github_username
            
            # Don't notify for own activity if muted
            mute_own_activity = notification_preferences.get("mute_own_activity", False)
            if is_own_activity and mute_own_activity:
                return False, [], {}
            
            # Check for keyword matches in discussion title and body
            content_to_check = [
                discussion.get("title", ""),
                discussion.get("body", "")
            ]
            
            should_notify_keywords, matched_keywords, match_details = await cls.should_notify_based_on_keywords(
                user_id, content_to_check, "discussion"
            )
            
            # If we have keyword matches, always notify
            if should_notify_keywords:
                return True, matched_keywords, match_details
            
            # Default notification logic - notify for all interesting discussion actions
            return True, [], {}
            
        except Exception as e:
            logger.error(f"Error processing discussion event: {e}", exc_info=True)
            return False, [], {}
    
    @classmethod
    async def process_discussion_comment_event(
        cls,
        user_id: str,
        payload: Dict[str, Any],
        event_id: str
    ) -> bool:
        """
        Process a discussion comment event and determine if a user should be notified.
        
        Args:
            user_id: User ID
            payload: Event payload
            event_id: Event ID
            
        Returns:
            True if the user should be notified, False otherwise
        """
        try:
            # Extract data from payload
            action = payload.get("action")
            comment = payload.get("comment", {})
            discussion = payload.get("discussion", {})
            sender = payload.get("sender", {})
            
            # Skip if action is not interesting
            if action not in ["created", "edited"]:
                return False
            
            # Get user settings
            settings = await SupabaseManager.get_user_settings(user_id)
            if not settings:
                # Use default settings - assume discussion comments are enabled by default
                discussion_comment_notifications_enabled = True
            else:
                # Check if discussion comment notifications are enabled
                notification_preferences = settings.get("notification_preferences", {})
                discussion_comment_notifications_enabled = notification_preferences.get("discussion_comments", True)
            
            if not discussion_comment_notifications_enabled:
                return False
            
            # Check if this is the user's own activity
            user = await SupabaseManager.get_user(user_id)
            if not user:
                return False
                
            github_username = user.get("github_login")
            is_own_activity = sender.get("login") == github_username
            
            # Don't notify for own activity if muted
            mute_own_activity = notification_preferences.get("mute_own_activity", False)
            if is_own_activity and mute_own_activity:
                return False
            
            # Check for keyword matches in comment body
            content_to_check = [comment.get("body", "")]
            
            should_notify_keywords, matched_keywords, match_details = await cls.should_notify_based_on_keywords(
                user_id, content_to_check, "discussion_comment"
            )
            
            # If we have keyword matches, always notify
            if should_notify_keywords:
                return True
            
            # Default notification logic - notify for discussion comments
            return True
            
        except Exception as e:
            logger.error(f"Error processing discussion comment event: {e}", exc_info=True)
            return False
