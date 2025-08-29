"""
Supabase client and database operations for Radar.
"""
import logging
from typing import Any, Dict, List, Optional, Union
import math
from datetime import datetime

from supabase import create_client, Client

from app.core.config import settings
from app.utils.auth import TokenManager

logger = logging.getLogger(__name__)

# Initialize Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


class SupabaseManager:
    """Manager class for Supabase operations."""
    
    # Add supabase client as a class property
    supabase = supabase

    @staticmethod
    async def get_user(user_id: str, decrypt_tokens: bool = True) -> Optional[Dict[str, Any]]:
        """
        Get a user by ID.
        
        Args:
            user_id: The user ID
            decrypt_tokens: Whether to decrypt stored tokens
            
        Returns:
            User data or None if not found
        """
        try:
            response = SupabaseManager.supabase.table("users").select("*").eq("id", user_id).execute()
            data = response.data
            
            if data and len(data) > 0:
                user = data[0]
                
                # Decrypt tokens if requested
                if decrypt_tokens:
                    if user.get("github_access_token"):
                        decrypted = TokenManager.decrypt_external_token(user["github_access_token"])
                        user["github_access_token"] = decrypted
                    
                    if user.get("slack_access_token"):
                        decrypted = TokenManager.decrypt_external_token(user["slack_access_token"])
                        user["slack_access_token"] = decrypted
                
                return user
            return None
        except Exception as e:
            logger.error(f"Error getting user {user_id}: {e}")
            return None

    @staticmethod
    async def get_all_users() -> List[Dict[str, Any]]:
        """
        Get all users.
        
        Returns:
            List of all users
        """
        try:
            response = SupabaseManager.supabase.table("users").select("*").execute()
            return response.data or []
        except Exception as e:
            logger.error(f"Error getting all users: {e}")
            return []

    @staticmethod
    async def get_users_with_digest_enabled() -> List[Dict[str, Any]]:
        """
        Get all users who have digest notifications enabled.
        
        Returns:
            List of users with digest notifications enabled
        """
        try:
            # First get all users
            users_response = SupabaseManager.supabase.table("users").select("*").execute()
            users = users_response.data or []
            
            # Filter users with digest enabled
            result = []
            for user in users:
                user_id = user["id"]
                settings_response = SupabaseManager.supabase.table("user_settings").select("*").eq("user_id", user_id).execute()
                settings = settings_response.data
                
                if settings and len(settings) > 0:
                    notification_schedule = settings[0].get("notification_schedule", {})
                    if notification_schedule.get("digest_enabled", False):
                        result.append(user)
            
            return result
        except Exception as e:
            logger.error(f"Error getting users with digest enabled: {e}")
            return []

    @staticmethod
    async def get_last_digest(user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the last digest sent to a user.
        
        Args:
            user_id: The user ID
            
        Returns:
            Last digest data or None if not found
        """
        try:
            response = SupabaseManager.supabase.table("user_digests").select("*").eq("user_id", user_id).order("sent_at", desc=True).limit(1).execute()
            data = response.data
            
            if data and len(data) > 0:
                return data[0]
            return None
        except Exception as e:
            logger.error(f"Error getting last digest for user {user_id}: {e}")
            return None

    @staticmethod
    async def create_user(user_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Create a new user.
        
        Args:
            user_data: User data to insert
            
        Returns:
            Created user data or None if failed
        """
        try:
            # Encrypt tokens before storing
            data_to_store = user_data.copy()
            
            if data_to_store.get("github_access_token"):
                data_to_store["github_access_token"] = TokenManager.encrypt_external_token(
                    data_to_store["github_access_token"]
                )
            
            if data_to_store.get("slack_access_token"):
                data_to_store["slack_access_token"] = TokenManager.encrypt_external_token(
                    data_to_store["slack_access_token"]
                )
            
            response = SupabaseManager.supabase.table("users").insert(data_to_store).execute()
            data = response.data
            
            if data and len(data) > 0:
                # Return decrypted version
                return await SupabaseManager.get_user(data[0]["id"])
            return None
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            return None

    @staticmethod
    async def update_user(user_id: str, user_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update a user.
        
        Args:
            user_id: The user ID
            user_data: User data to update
            
        Returns:
            Updated user data or None if failed
        """
        try:
            # Encrypt tokens before storing
            data_to_store = user_data.copy()
            
            if data_to_store.get("github_access_token"):
                data_to_store["github_access_token"] = TokenManager.encrypt_external_token(
                    data_to_store["github_access_token"]
                )
            
            if data_to_store.get("slack_access_token"):
                data_to_store["slack_access_token"] = TokenManager.encrypt_external_token(
                    data_to_store["slack_access_token"]
                )
            
            response = SupabaseManager.supabase.table("users").update(data_to_store).eq("id", user_id).execute()
            data = response.data
            
            if data and len(data) > 0:
                # Return decrypted version
                return await SupabaseManager.get_user(user_id)
            return None
        except Exception as e:
            logger.error(f"Error updating user {user_id}: {e}")
            return None

    @staticmethod
    async def delete_user(user_id: str) -> bool:
        """
        Delete a user.
        
        Args:
            user_id: The user ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            response = SupabaseManager.supabase.table("users").delete().eq("id", user_id).execute()
            return len(response.data) > 0
        except Exception as e:
            logger.error(f"Error deleting user {user_id}: {e}")
            return False

    @staticmethod
    async def get_user_by_slack_id(slack_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a user by Slack ID.
        
        Args:
            slack_id: The Slack user ID
            
        Returns:
            User data or None if not found
        """
        try:
            response = SupabaseManager.supabase.table("users").select("*").eq("slack_id", slack_id).execute()
            data = response.data
            
            if data and len(data) > 0:
                return data[0]
            return None
        except Exception as e:
            logger.error(f"Error getting user by Slack ID {slack_id}: {e}")
            return None

    @staticmethod
    async def get_user_by_github_id(github_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a user by GitHub ID.
        
        Args:
            github_id: The GitHub user ID
            
        Returns:
            User data or None if not found
        """
        try:
            response = SupabaseManager.supabase.table("users").select("*").eq("github_id", github_id).execute()
            data = response.data
            
            if data and len(data) > 0:
                return data[0]
            return None
        except Exception as e:
            logger.error(f"Error getting user by GitHub ID {github_id}: {e}")
            return None

    @staticmethod
    async def get_user_by_github_login(github_login: str) -> Optional[Dict[str, Any]]:
        """
        Get a user by GitHub login (username).
        
        Args:
            github_login: GitHub username
            
        Returns:
            User data or None if not found
        """
        try:
            response = SupabaseManager.supabase.table("users").select("*").eq("github_login", github_login).execute()
            data = response.data
            
            if data and len(data) > 0:
                return data[0]
            return None
        except Exception as e:
            logger.error(f"Error getting user by GitHub login {github_login}: {e}")
            return None

    @staticmethod
    async def get_user_repositories(
        user_id: str, 
        page: int = 1, 
        page_size: int = 10,
        organization: Optional[str] = None,
        enabled: Optional[bool] = None,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get repositories for a user with pagination and filtering.
        
        Args:
            user_id: The user ID
            page: Page number (1-indexed)
            page_size: Number of items per page
            organization: Filter by organization
            enabled: Filter by enabled status
            search: Search term for repository name or description
            
        Returns:
            Dictionary with repositories and pagination info
        """
        try:
            # Calculate offset
            offset = (page - 1) * page_size
            
            # Start building the query
            query = SupabaseManager.supabase.table("user_repositories").select("*", count="exact").eq("user_id", user_id)
            
            # Apply filters
            if organization:
                query = query.eq("organization", organization)
            
            if enabled is not None:
                query = query.eq("enabled", enabled)
                
            if search:
                # Search in name, full_name, or description
                query = query.or_(f"name.ilike.%{search}%,full_name.ilike.%{search}%,description.ilike.%{search}%")
            
            # Get total count first
            count_response = query.execute()
            total = count_response.count or 0
            
            # Then get paginated data
            response = query.range(offset, offset + page_size - 1).order("name").execute()
            
            # Calculate total pages
            total_pages = (total + page_size - 1) // page_size
            
            return {
                "items": response.data or [],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages
            }
        except Exception as e:
            logger.error(f"Error getting repositories for user {user_id}: {e}")
            return {
                "items": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0
            }

    @staticmethod
    async def add_user_repository(
        user_id: str, 
        repo_data: Dict[str, Any] = None,
        github_id: str = None,
        name: str = None,
        full_name: str = None,
        description: str = "",
        url: str = "",
        is_private: bool = False,
        is_fork: bool = False,
        owner_name: str = "",
        owner_avatar_url: str = "",
        owner_url: str = "",
        organization: str = None,
        is_active: bool = True,
        enabled: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Add a repository for a user.
        
        This method supports two ways of calling:
        1. Passing a complete repo_data dictionary
        2. Passing individual repository parameters
        
        Args:
            user_id: The user ID
            repo_data: Complete repository data dictionary (if provided, other parameters are ignored)
            github_id: GitHub repository ID
            name: Repository name
            full_name: Repository full name (owner/name)
            description: Repository description
            url: Repository URL
            is_private: Whether the repository is private
            is_fork: Whether the repository is a fork
            owner_name: Repository owner name
            owner_avatar_url: Repository owner avatar URL
            owner_url: Repository owner URL
            organization: Repository organization
            is_active: Whether the repository is active
            enabled: Whether the repository is enabled for notifications
            
        Returns:
            Repository data or None if failed
        """
        try:
            # If repo_data is provided, use it directly
            if repo_data is not None:
                final_repo_data = repo_data.copy()
                final_repo_data["user_id"] = user_id
            # Otherwise, construct repo_data from individual parameters
            else:
                if github_id is None or name is None or full_name is None:
                    logger.error("Missing required parameters for add_user_repository")
                    return None
                    
                final_repo_data = {
                    "user_id": user_id,
                    "github_id": github_id,
                    "name": name,
                    "full_name": full_name,
                    "description": description,
                    "url": url,
                    "is_private": is_private,
                    "is_fork": is_fork,
                    "owner_name": owner_name,
                    "owner_avatar_url": owner_avatar_url,
                    "owner_url": owner_url,
                    "organization": organization,
                    "is_active": is_active,
                    "enabled": enabled
                }
            
            response = SupabaseManager.supabase.table("user_repositories").insert(final_repo_data).execute()
            data = response.data
            
            if data and len(data) > 0:
                return data[0]
            return None
        except Exception as e:
            logger.error(f"Error adding repository for user {user_id}: {e}")
            return None

    @staticmethod
    async def update_user_repository(user_id: str, repo_id: str, repo_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update a repository for a user.
        
        Args:
            user_id: The user ID
            repo_id: The repository ID
            repo_data: Repository data to update
            
        Returns:
            Updated repository data or None if failed
        """
        try:
            response = SupabaseManager.supabase.table("user_repositories").update(repo_data).eq("user_id", user_id).eq("id", repo_id).execute()
            data = response.data
            
            if data and len(data) > 0:
                return data[0]
            return None
        except Exception as e:
            logger.error(f"Error updating repository {repo_id} for user {user_id}: {e}")
            return None

    @staticmethod
    async def remove_user_repository(user_id: str, repo_id: str) -> bool:
        """
        Remove a repository for a user.
        
        Args:
            user_id: The user ID
            repo_id: The repository ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            response = SupabaseManager.supabase.table("user_repositories").delete().eq("user_id", user_id).eq("id", repo_id).execute()
            return len(response.data) > 0
        except Exception as e:
            logger.error(f"Error removing repository {repo_id} for user {user_id}: {e}")
            return False

    @staticmethod
    async def get_user_settings(user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user settings.
        
        Args:
            user_id: The user ID
            
        Returns:
            User settings or None if not found
        """
        try:
            response = SupabaseManager.supabase.table("user_settings").select("*").eq("user_id", user_id).execute()
            data = response.data
            
            if data and len(data) > 0:
                return data[0]
            return None
        except Exception as e:
            logger.error(f"Error getting settings for user {user_id}: {e}")
            return None

    @staticmethod
    async def update_user_settings(user_id: str, settings_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update user settings.
        
        Args:
            user_id: The user ID
            settings_data: Settings data to update
            
        Returns:
            Updated settings data or None if failed
        """
        try:
            # Check if settings exist
            existing_settings = await SupabaseManager.get_user_settings(user_id)
            
            if existing_settings:
                # Update existing settings
                response = SupabaseManager.supabase.table("user_settings").update(settings_data).eq("user_id", user_id).execute()
            else:
                # Create new settings
                settings_data["user_id"] = user_id
                response = SupabaseManager.supabase.table("user_settings").insert(settings_data).execute()
            
            data = response.data
            
            if data and len(data) > 0:
                return data[0]
            return None
        except Exception as e:
            logger.error(f"Error updating settings for user {user_id}: {e}")
            return None

    @staticmethod
    async def clear_user_repositories(user_id: str) -> bool:
        """
        Clear all repositories for a user.
        
        Args:
            user_id: The user ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            response = SupabaseManager.supabase.table("user_repositories").delete().eq("user_id", user_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error clearing repositories for user {user_id}: {e}")
            return False

    @staticmethod
    async def update_repository_enabled_status(user_id: str, repo_id: str, is_active: bool) -> Optional[Dict[str, Any]]:
        """
        Update the enabled status of a repository.
        
        Args:
            user_id: The user ID
            repo_id: The repository ID
            is_active: Whether the repository is enabled for notifications
            
        Returns:
            Updated repository data or None if failed
        """
        try:
            # Update both enabled and is_active fields for consistency
            response = SupabaseManager.supabase.table("user_repositories").update({
                "enabled": is_active,
                "is_active": is_active
            }).eq("user_id", user_id).eq("id", repo_id).execute()
            data = response.data
            
            if data and len(data) > 0:
                return data[0]
            return None
        except Exception as e:
            logger.error(f"Error updating repository {repo_id} enabled status for user {user_id}: {e}")
            return None

    @staticmethod
    async def update_all_repositories_enabled_status(user_id: str, is_active: bool) -> bool:
        """
        Update the enabled status of all repositories for a user.
        
        Args:
            user_id: The user ID
            is_active: Whether the repositories should be enabled for notifications
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Update both enabled and is_active fields for consistency
            response = SupabaseManager.supabase.table("user_repositories").update({
                "enabled": is_active,
                "is_active": is_active
            }).eq("user_id", user_id).execute()
            
            return True
        except Exception as e:
            logger.error(f"Error updating all repositories enabled status for user {user_id}: {e}")
            return False

    @staticmethod
    async def get_github_token(user_id: str) -> Optional[str]:
        """
        Get the GitHub access token for a user.
        
        Args:
            user_id: The user ID
            
        Returns:
            The GitHub access token or None if not found
        """
        try:
            # Get user from database
            user = await SupabaseManager.get_user(user_id)
            if not user:
                return None
            
            # Return GitHub access token
            return user.get("github_access_token")
        except Exception as e:
            logger.error(f"Error getting GitHub token for user {user_id}: {e}")
            return None

    @staticmethod
    async def create_event(event_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Create a new event in the database.
        
        Args:
            event_data: Event data including event_type, action, repository_id, etc.
            
        Returns:
            Created event data or None if failed
        """
        try:
            response = SupabaseManager.supabase.table("events").insert(event_data).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Error creating event: {e}")
            return None

    @staticmethod
    async def update_event(event_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update an event in the database.
        
        Args:
            event_id: Event ID
            update_data: Data to update
            
        Returns:
            Updated event data or None if failed
        """
        try:
            response = SupabaseManager.supabase.table("events").update(update_data).eq("id", event_id).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Error updating event {event_id}: {e}")
            return None

    @staticmethod
    async def get_users_by_repository(repo_id: str) -> List[Dict[str, Any]]:
        """
        Get users who are watching a repository.
        
        Args:
            repo_id: Repository ID
            
        Returns:
            List of users watching the repository
        """
        try:
            # Get user_ids from user_repositories table where repository_id matches and enabled is true
            user_repos_response = SupabaseManager.supabase.table("user_repositories").select("user_id").eq("github_id", repo_id).eq("enabled", True).execute()
            
            if not user_repos_response.data:
                return []
            
            # Extract user_ids
            user_ids = [item["user_id"] for item in user_repos_response.data]
            
            if not user_ids:
                return []
            
            # Get users with these IDs
            users = []
            for user_id in user_ids:
                user = await SupabaseManager.get_user(user_id)
                if user:
                    # Get user settings
                    user_settings = await SupabaseManager.get_user_settings(user_id)
                    if user_settings:
                        user["settings"] = user_settings
                    users.append(user)
            
            return users
        except Exception as e:
            logger.error(f"Error getting users for repository {repo_id}: {e}")
            return []

    @staticmethod
    async def get_user_notifications_by_pr(user_id: str, pr_id: str) -> List[Dict[str, Any]]:
        """
        Get notifications for a user related to a specific pull request.
        
        Args:
            user_id: The user ID
            pr_id: The pull request ID
            
        Returns:
            List of notifications
        """
        try:
            response = SupabaseManager.supabase.table("notifications").select("*").eq("user_id", user_id).execute()
            data = response.data or []
            
            # Filter notifications related to this PR
            pr_notifications = []
            for notification in data:
                payload = notification.get("payload", {})
                if payload.get("pull_request_id") == pr_id:
                    pr_notifications.append(notification)
            
            return pr_notifications
        except Exception as e:
            logger.error(f"Error getting notifications for user {user_id} and PR {pr_id}: {e}")
            return []
    
    @staticmethod
    async def get_user_watched_prs(user_id: str) -> List[Dict[str, Any]]:
        """
        Get pull requests that a user is watching.
        
        Args:
            user_id: The user ID
            
        Returns:
            List of pull request IDs
        """
        try:
            # For now, we'll consider a PR as watched if the user has received notifications for it
            response = SupabaseManager.supabase.table("notifications").select("*").eq("user_id", user_id).execute()
            data = response.data or []
            
            # Extract unique PR IDs
            pr_ids = set()
            for notification in data:
                payload = notification.get("payload", {})
                pr_id = payload.get("pull_request_id")
                if pr_id:
                    pr_ids.add(pr_id)
            
            return list(pr_ids)
        except Exception as e:
            logger.error(f"Error getting watched PRs for user {user_id}: {e}")
            return []
    
    @staticmethod
    async def update_user_watched_prs(user_id: str, pr_id: str, watch: bool = True) -> bool:
        """
        Update a user's watched pull requests.
        
        Args:
            user_id: The user ID
            pr_id: The pull request ID
            watch: Whether to watch or unwatch the PR
            
        Returns:
            Success status
        """
        try:
            # Get existing watched PRs
            user_settings = await SupabaseManager.get_user_settings(user_id)
            
            if not user_settings:
                return False
            
            # Get watched PRs
            watched_prs = user_settings.get("watched_prs", [])
            
            # Check if PR is already in watched PRs
            pr_exists = any(pr["pull_request_id"] == pr_id for pr in watched_prs)
            
            if watch and not pr_exists:
                # Add PR to watched PRs
                watched_prs.append({
                    "pull_request_id": pr_id,
                    "added_at": datetime.now().isoformat(),
                    "manual_watch": True
                })
                
                # Update user settings
                await SupabaseManager.update_user_settings(user_id, {"watched_prs": watched_prs})
                
                # Create notification for manual watch
                notification_data = {
                    "user_id": user_id,
                    "event_id": None,  # No event for manual watch
                    "message_type": "watch",
                    "channel": None,
                    "message_ts": None,
                    "payload": {
                        "pull_request_id": pr_id,
                        "manual_watch": True
                    }
                }
                
                await SupabaseManager.create_notification(notification_data)
            
            return True
        except Exception as e:
            logger.error(f"Error updating watched PRs for user {user_id}: {e}")
            return False

    @staticmethod
    async def find_notification_by_github_entity(
        user_id: str, 
        message_type: str, 
        github_entity_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Find existing notification for a specific GitHub entity.
        
        Args:
            user_id: User ID
            message_type: Type of message (issue, issue_comment, pull_request, etc.)
            github_entity_id: GitHub entity ID (issue_id, comment_id, etc.)
            
        Returns:
            Existing notification data or None if not found
        """
        try:
            # Query notifications table for matching user, message type, and GitHub entity
            response = SupabaseManager.supabase.table("notifications").select("*").eq("user_id", user_id).eq("message_type", message_type).execute()
            
            if response.data:
                for notification in response.data:
                    payload = notification.get("payload", {})
                    # Check different entity ID fields based on message type
                    entity_ids = [
                        payload.get("issue_id"),
                        payload.get("comment_id"), 
                        payload.get("pull_request_id"),
                        payload.get("discussion_id"),
                        payload.get("review_id")
                    ]
                    
                    if github_entity_id in [str(eid) for eid in entity_ids if eid]:
                        return notification
            
            return None
        except Exception as e:
            logger.error(f"Error finding notification by GitHub entity: {e}")
            return None

    @staticmethod
    async def create_notification(notification_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Create a new notification in the database.
        
        Args:
            notification_data: Notification data including user_id, event_id, message_type, etc.
            
        Returns:
            Created notification data or None if failed
        """
        try:
            response = SupabaseManager.supabase.table("notifications").insert(notification_data).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Error creating notification: {e}")
            return None

    @staticmethod
    async def record_digest(
        user_id: str,
        message_ts: str,
        pull_request_count: int = 0,
        issue_count: int = 0
    ) -> Optional[Dict[str, Any]]:
        """
        Record a sent digest notification in the database.
        
        Args:
            user_id: The user ID
            message_ts: The Slack message timestamp
            pull_request_count: Number of pull requests in the digest
            issue_count: Number of issues in the digest
            
        Returns:
            Created digest record or None if failed
        """
        try:
            digest_data = {
                "user_id": user_id,
                "sent_at": datetime.utcnow().isoformat(),
                "message_ts": message_ts,
                "pull_request_count": pull_request_count,
                "issue_count": issue_count
            }
            
            response = SupabaseManager.supabase.table("user_digests").insert(digest_data).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Error recording digest for user {user_id}: {e}")
            return None

    @staticmethod
    async def get_user_repository_by_github_id(user_id: str, github_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a repository for a user by GitHub ID.
        
        Args:
            user_id: The user ID
            github_id: The GitHub repository ID
            
        Returns:
            Repository data or None if not found
        """
        try:
            response = SupabaseManager.supabase.table("user_repositories").select("*").eq("user_id", user_id).eq("github_id", github_id).execute()
            data = response.data
            
            if data and len(data) > 0:
                return data[0]
            return None
        except Exception as e:
            logger.error(f"Error getting repository by GitHub ID {github_id} for user {user_id}: {e}")
            return None
    
    @staticmethod
    async def get_repository_pull_requests(repo_id: str, since: datetime = None) -> List[Dict[str, Any]]:
        """
        Get pull requests for a repository since a given date.
        
        Args:
            repo_id: Repository ID
            since: Get PRs created after this date
            
        Returns:
            List of pull requests
        """
        try:
            # For now, return empty list as we'd need to query GitHub API
            # In production, this would fetch from a cache or GitHub API
            logger.info(f"get_repository_pull_requests called for repo {repo_id} since {since}")
            return []
        except Exception as e:
            logger.error(f"Error getting pull requests for repository {repo_id}: {e}")
            return []
    
    @staticmethod
    async def get_repository_issues(repo_id: str, since: datetime = None) -> List[Dict[str, Any]]:
        """
        Get issues for a repository since a given date.
        
        Args:
            repo_id: Repository ID
            since: Get issues created after this date
            
        Returns:
            List of issues
        """
        try:
            # For now, return empty list as we'd need to query GitHub API
            # In production, this would fetch from a cache or GitHub API
            logger.info(f"get_repository_issues called for repo {repo_id} since {since}")
            return []
        except Exception as e:
            logger.error(f"Error getting issues for repository {repo_id}: {e}")
            return []
    
    @staticmethod
    async def get_repository_comments(repo_id: str, since: datetime = None) -> List[Dict[str, Any]]:
        """
        Get comments for a repository since a given date.
        
        Args:
            repo_id: Repository ID
            since: Get comments created after this date
            
        Returns:
            List of comments
        """
        try:
            # For now, return empty list as we'd need to query GitHub API
            # In production, this would fetch from a cache or GitHub API
            logger.info(f"get_repository_comments called for repo {repo_id} since {since}")
            return []
        except Exception as e:
            logger.error(f"Error getting comments for repository {repo_id}: {e}")
            return []
    
    @staticmethod
    async def get_repository_reviews(repo_id: str, since: datetime = None) -> List[Dict[str, Any]]:
        """
        Get reviews for a repository since a given date.
        
        Args:
            repo_id: Repository ID
            since: Get reviews created after this date
            
        Returns:
            List of reviews
        """
        try:
            # For now, return empty list as we'd need to query GitHub API
            # In production, this would fetch from a cache or GitHub API
            logger.info(f"get_repository_reviews called for repo {repo_id} since {since}")
            return []
        except Exception as e:
            logger.error(f"Error getting reviews for repository {repo_id}: {e}")
            return []
