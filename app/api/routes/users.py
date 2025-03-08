"""
User routes for Radar.

This module handles user management operations.
"""
import logging
from typing import Dict, List, Optional, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.db.supabase import SupabaseManager
from app.models.user import User, UserCreate, UserUpdate, UserInDB, Repository, Organization
from app.services.github_service import GitHubService
from app.services.slack_service import SlackService

router = APIRouter()
logger = logging.getLogger(__name__)

class NotificationSettings(BaseModel):
    pull_requests: bool = True
    reviews: bool = True
    comments: bool = True
    issues: bool = True
    digest_enabled: bool = False
    digest_time: str = "09:00"


@router.get("/{user_id}", response_model=User)
async def get_user(user_id: str):
    """
    Get user by ID.
    
    Args:
        user_id: User ID
        
    Returns:
        User data
    """
    user = await SupabaseManager.get_user(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.get("/slack/{slack_id}", response_model=User)
async def get_user_by_slack_id(slack_id: str):
    """
    Get user by Slack ID.
    
    Args:
        slack_id: Slack user ID
        
    Returns:
        User data
    """
    user = await SupabaseManager.get_user_by_slack_id(slack_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.get("/github/{github_id}", response_model=User)
async def get_user_by_github_id(github_id: str):
    """
    Get user by GitHub ID.
    
    Args:
        github_id: GitHub user ID
        
    Returns:
        User data
    """
    user = await SupabaseManager.get_user_by_github_id(github_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.put("/{user_id}", response_model=User)
async def update_user(user_id: str, user_update: UserUpdate):
    """
    Update user.
    
    Args:
        user_id: User ID
        user_update: User update data
        
    Returns:
        Updated user data
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update user
    updated_user = await SupabaseManager.update_user(user_id, user_update.dict(exclude_unset=True))
    
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )
    
    return updated_user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str):
    """
    Delete user.
    
    Args:
        user_id: User ID
        
    Returns:
        No content
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Delete user
    success = await SupabaseManager.delete_user(user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{user_id}/repositories", response_model=List[Repository])
async def get_user_repositories(user_id: str):
    """
    Get user repositories.
    
    Args:
        user_id: User ID
        
    Returns:
        List of repositories
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get repositories
    repositories = await SupabaseManager.get_user_repositories(user_id)
    
    return repositories


@router.post("/{user_id}/repositories", response_model=Repository)
async def add_user_repository(user_id: str, repository: Dict[str, Any]):
    """
    Add repository to user.
    
    Args:
        user_id: User ID
        repository: Repository data
        
    Returns:
        Added repository
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Add repository
    repository_data = {
        "github_id": str(repository["id"]),
        "name": repository["name"],
        "full_name": repository["full_name"],
        "organization": repository["owner"]["login"] if repository.get("owner") else None,
        "is_private": repository.get("private", False),
        "enabled": True
    }
    
    added_repository = await SupabaseManager.add_user_repository(user_id=user_id, repo_data=repository_data)
    
    if not added_repository:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add repository"
        )
    
    return added_repository


@router.delete("/{user_id}/repositories/{repository_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_user_repository(user_id: str, repository_id: str):
    """
    Remove repository from user.
    
    Args:
        user_id: User ID
        repository_id: Repository ID
        
    Returns:
        No content
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Remove repository
    success = await SupabaseManager.remove_user_repository(user_id, repository_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove repository"
        )
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{user_id}/repositories", response_model=Dict[str, Any])
async def update_user_repositories(user_id: str, data):
    """
    Update user repositories (enable/disable repositories).
    
    Args:
        user_id: User ID
        data: Repository update data containing list of repository IDs to enable
        
    Returns:
        Status message
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        # Get all repositories for the user
        repositories = await SupabaseManager.get_user_repositories(user_id)
        
        # Update repository enabled status
        updated_repos = []
        for repo in repositories:
            # Determine if this repository should be enabled
            enabled = repo["github_id"] in data.repositories
            
            # Only update if the status has changed
            if repo["enabled"] != enabled:
                # Update repository in database
                updated_repo = await SupabaseManager.update_user_repository(
                    user_id, 
                    repo["id"], 
                    {"enabled": enabled}
                )
                if updated_repo:
                    updated_repos.append(updated_repo)
        
        return {
            "status": "success",
            "message": "Repositories updated successfully",
            "updated_count": len(updated_repos)
        }
    
    except Exception as e:
        logger.error(f"Error updating repositories for user {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update repositories: {str(e)}"
        )


@router.post("/{user_id}/repositories/refresh", response_model=Dict[str, Any])
async def refresh_user_repositories(user_id: str):
    print('refreshing user repositories', user_id)
    """
    Refresh user repositories from GitHub.
    
    Args:
        user_id: User ID
        
    Returns:
        Status message
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)

    print('user', user)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if user has GitHub token
    github_access_token = user.get("github_access_token")

    print('github_access_token', github_access_token)
    print('github_access_token type:', type(github_access_token))
    print('github_access_token length:', len(github_access_token) if github_access_token else 0)
    # Check if token starts with expected format (usually "gho_" for OAuth tokens)
    if github_access_token and len(github_access_token) > 4:
        prefix = github_access_token[:4]
        print('github_access_token prefix:', prefix)
        
        # Check if token has the expected format
        if prefix != 'ghu_' and prefix != 'gho_' and prefix != 'ghp_' and len(github_access_token) > 30:
            print(f"WARNING: GitHub token has unexpected prefix: {prefix}. Expected ghu_, gho_, or ghp_")
            print("This might indicate an invalid or malformed token")
            
            # Try to fix the token format
            fixed_token = fix_github_token_format(github_access_token)
            if fixed_token != github_access_token:
                print(f"Fixed token: {fixed_token[:4]}...{fixed_token[-4:] if len(fixed_token) > 8 else ''}")
                print(f"Fixed token length: {len(fixed_token)}")
                
                # Update the token in memory for this request
                github_access_token = fixed_token
                
                # Also update in the database
                print("Updating token in database...")
                await SupabaseManager.update_user(user_id, {"github_access_token": fixed_token})
                print("Token updated in database")
        
    # Check when the token was last updated in the database
    if user.get("updated_at"):
        print('Token last updated at:', user.get("updated_at"))
        
    # Check if we have a refresh token
    github_refresh_token = user.get("github_refresh_token")
    print('Have refresh token:', bool(github_refresh_token))
    
    if not github_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have GitHub token"
        )
    
    print('github_access_token', github_access_token)
    try:
        # Check token directly with GitHub API
        print("Checking token directly with GitHub API...")
        token_check_result = await check_github_token(github_access_token)
        print(f"Direct token check valid: {token_check_result.get('valid')}")
        
        # If direct check failed, try with a different authorization format
        if not token_check_result.get('valid'):
            print("Direct check failed, trying with 'Bearer' prefix instead of 'token'...")
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.github.com/user",
                    headers={
                        "Authorization": f"Bearer {github_access_token}",
                        "Accept": "application/vnd.github.v3+json"
                    }
                )
                print(f"Bearer auth check status: {response.status_code}")
                if response.status_code == 200:
                    print("Bearer auth successful!")
        
        # Create GitHub service
        github_service = GitHubService(token=github_access_token)
        
        # Test token with a simple API call
        print("Testing GitHub token with a simple API call...")
        token_test_result = github_service.test_token()
        print(f"Token test result: {token_test_result}")
        
        # Validate token before proceeding
        print("Validating GitHub token...")
        is_valid = github_service.validate_token()
        print(f"Token validation result: {is_valid}")
        
        # If validation fails, try different token formats
        if not is_valid and github_access_token:
            print("Token validation failed, trying different token formats...")
            formats_result = github_service.try_token_formats(github_access_token)
            print(f"Token formats result: {formats_result}")
            
            # If we found a working format, the github_service object has been updated with a working client
            if formats_result:
                print("Found a working token format!")
                is_valid = True
        
        if not is_valid:
            # Token is invalid, check if we have a refresh token
            github_refresh_token = user.get("github_refresh_token")
            print(f"Have refresh token: {bool(github_refresh_token)}")
            
            if github_refresh_token:
                print("Attempting to refresh GitHub token...")
                # Try to refresh the token
                new_token = await refresh_github_token(github_refresh_token)
                print(f"Token refresh successful: {bool(new_token)}")
                
                if new_token:
                    print(f"New token prefix: {new_token[:4] if len(new_token) > 4 else new_token}")
                    print(f"New token length: {len(new_token)}")
                    
                    # Update user with new token
                    updated_user = await SupabaseManager.update_user(user_id, {"github_access_token": new_token})
                    print(f"User updated with new token: {bool(updated_user)}")
                    
                    # Create new GitHub service with new token
                    github_service = GitHubService(token=new_token)
                    print("Created new GitHub service with refreshed token")
                else:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="GitHub token is invalid and could not be refreshed"
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="GitHub token is invalid and no refresh token is available"
                )
        
        # Get repositories
        print("Fetching GitHub repositories...")
        repositories = github_service.get_repositories()
        print(f"Fetched {len(repositories)} repositories")

        print('repositories', repositories)
        
        # Clear existing repositories
        print("Clearing existing repositories...")
        await SupabaseManager.clear_user_repositories(user_id)
        
        # Add repositories
        print("Adding repositories...")
        for repo in repositories:
            await SupabaseManager.add_user_repository(
                user_id=user_id,
                github_id=str(repo["id"]),
                name=repo["name"],
                full_name=repo["full_name"],
                description=repo["description"] or "",
                url=repo["html_url"],
                is_private=repo["private"],
                is_fork=repo["fork"],
                owner_name=repo["owner"]["login"],
                owner_avatar_url=repo["owner"]["avatar_url"],
                owner_url=repo["owner"]["html_url"],
                enabled=True  # Enable by default
            )
        
        return {
            "status": "success",
            "message": "Repositories refreshed successfully",
            "count": len(repositories),
        }
    
    except Exception as e:
        logger.error(f"Error refreshing repositories for user {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh repositories: {str(e)}"
        )


async def check_github_token(token: str) -> Dict[str, Any]:
    """
    Check GitHub token directly with GitHub's API.
    
    Args:
        token: GitHub access token
        
    Returns:
        Dictionary with token information
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"token {token}",
                    "Accept": "application/vnd.github.v3+json"
                }
            )
            
            print(f"GitHub API direct check status: {response.status_code}")
            
            if response.status_code == 200:
                user_data = response.json()
                print(f"GitHub API direct check successful: {user_data.get('login')}")
                return {
                    "valid": True,
                    "user": user_data
                }
            else:
                print(f"GitHub API direct check failed: {response.text}")
                return {
                    "valid": False,
                    "error": response.text
                }
    except Exception as e:
        print(f"Error checking GitHub token: {e}")
        return {
            "valid": False,
            "error": str(e)
        }


async def refresh_github_token(refresh_token: str) -> Optional[str]:
    """
    Refresh GitHub OAuth token.
    
    Args:
        refresh_token: GitHub refresh token
        
    Returns:
        New access token or None if failed
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token"
                },
                headers={"Accept": "application/json"}
            )
            
            if response.status_code != 200:
                logger.error(f"GitHub token refresh error: {response.text}")
                return None
            
            oauth_data = response.json()
            
            if "error" in oauth_data:
                logger.error(f"GitHub token refresh error: {oauth_data['error']}")
                return None
            
            access_token = oauth_data.get("access_token")
            
            if not access_token:
                logger.error("No access token in GitHub token refresh response")
                return None
            
            return access_token
    except Exception as e:
        logger.error(f"Error refreshing GitHub token: {e}")
        return None


def fix_github_token_format(token: str) -> str:
    """
    Fix GitHub token format if needed.
    
    Args:
        token: GitHub access token
        
    Returns:
        Fixed token
    """
    # Check if token has the expected format
    if token and len(token) > 4:
        prefix = token[:4]
        
        # If token doesn't have a valid prefix but looks like it might be a token
        if prefix != 'ghu_' and prefix != 'gho_' and prefix != 'ghp_' and len(token) > 30:
            print(f"Attempting to fix token format. Current prefix: {prefix}")
            
            # If token has no prefix but is the right length, add the prefix
            if len(token) >= 36:  # Typical token length without prefix
                # Try to add the ghu_ prefix (for user-to-server tokens)
                fixed_token = f"ghu_{token}"
                print(f"Added 'ghu_' prefix to token. New length: {len(fixed_token)}")
                return fixed_token
    
    # Return original token if no fix needed or if we couldn't determine how to fix it
    return token

@router.get("/{user_id}/settings", response_model=Dict[str, Any])
async def get_user_settings(user_id: str):
    """
    Get user notification settings.
    
    Args:
        user_id: User ID
        
    Returns:
        User notification settings
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        # Get user settings
        settings = await SupabaseManager.get_user_settings(user_id)
        
        if not settings:
            # Create default settings
            from app.models.notifications import NotificationPreferences, NotificationSchedule, UserSettings
            default_settings = UserSettings().dict()
            
            settings = {
                "notification_preferences": default_settings["notification_preferences"],
                "notification_schedule": default_settings["notification_schedule"],
                "stats_time_window": default_settings["stats_time_window"],
                "keyword_notification_preferences": {
                    "enabled": False,
                    "keywords": []
                }
            }
            
            # Save default settings
            await SupabaseManager.create_user_settings(user_id, settings)
        
        # Ensure keyword notification preferences exist
        if "keyword_notification_preferences" not in settings:
            settings["keyword_notification_preferences"] = {
                "enabled": False,
                "keywords": []
            }
        
        return settings
    
    except Exception as e:
        logger.error(f"Error getting settings for user {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get settings: {str(e)}"
        )


@router.post("/{user_id}/settings", response_model=Dict[str, Any])
async def update_user_settings(user_id: str, settings: Dict[str, Any]):
    """
    Update user notification settings.
    
    Args:
        user_id: User ID
        settings: Notification settings to update
        
    Returns:
        Updated notification settings
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        # Validate settings with our models
        from app.models.notifications import NotificationPreferences, NotificationSchedule, UserSettings
        
        # Get current settings
        current_settings = await SupabaseManager.get_user_settings(user_id)
        
        if not current_settings:
            # Create default settings
            default_settings = UserSettings().dict()
            current_settings = {
                "notification_preferences": default_settings["notification_preferences"],
                "notification_schedule": default_settings["notification_schedule"],
                "stats_time_window": default_settings["stats_time_window"],
                "keyword_notification_preferences": {
                    "enabled": False,
                    "keywords": []
                }
            }
        
        # Ensure keyword notification preferences exist
        if "keyword_notification_preferences" not in current_settings:
            current_settings["keyword_notification_preferences"] = {
                "enabled": False,
                "keywords": []
            }
        
        # Update with new settings
        if "notification_preferences" in settings:
            # Validate notification preferences
            prefs = NotificationPreferences(**settings["notification_preferences"])
            current_settings["notification_preferences"] = prefs.dict()
        
        if "notification_schedule" in settings:
            # Validate notification schedule
            schedule = NotificationSchedule(**settings["notification_schedule"])
            current_settings["notification_schedule"] = schedule.dict()
        
        if "stats_time_window" in settings:
            current_settings["stats_time_window"] = settings["stats_time_window"]
            
        if "keyword_notification_preferences" in settings:
            # Validate keyword notification preferences
            keyword_prefs = settings["keyword_notification_preferences"]
            
            # Ensure required fields
            if "enabled" not in keyword_prefs:
                keyword_prefs["enabled"] = False
                
            if "keywords" not in keyword_prefs:
                keyword_prefs["keywords"] = []
                
            # Update settings
            current_settings["keyword_notification_preferences"] = keyword_prefs
        
        # Update settings in database
        success = await SupabaseManager.update_user_settings(user_id, current_settings)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update settings"
            )
        
        # Return updated settings
        return current_settings
    
    except Exception as e:
        logger.error(f"Error updating settings for user {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update settings: {str(e)}"
        )

class UserStats(BaseModel):
    totalNotifications: int = 0
    pullRequests: int = 0
    reviews: int = 0
    comments: int = 0


@router.get("/{user_id}/stats", response_model=UserStats)
async def get_user_stats(user_id: str):
    """
    Get user notification statistics.
    
    Args:
        user_id: User ID
        
    Returns:
        User notification statistics
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        # Query the notifications table to get actual stats
        total_notifications = 0
        pull_requests = 0
        reviews = 0
        comments = 0
        
        # Get all notifications for this user
        notifications_response = SupabaseManager.supabase.table("notifications").select("*").eq("user_id", user_id).execute()
        notifications = notifications_response.data or []
        
        # Count different types of notifications
        total_notifications = len(notifications)
        
        for notification in notifications:
            event_type = notification.get("event_type", "")
            if event_type == "pull_request":
                pull_requests += 1
            elif event_type == "review":
                reviews += 1
            elif event_type == "comment":
                comments += 1
        
        stats = UserStats(
            totalNotifications=total_notifications,
            pullRequests=pull_requests,
            reviews=reviews,
            comments=comments
        )
        
        return stats
    
    except Exception as e:
        logger.error(f"Error getting stats for user {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get stats: {str(e)}"
        )


class DetailedStats(BaseModel):
    totalNotifications: int = 0
    pullRequests: int = 0
    reviews: int = 0
    comments: int = 0
    issues: int = 0
    byRepository: Dict[str, Dict[str, Any]] = {}
    byDay: List[Dict[str, Any]] = []


@router.get("/{user_id}/stats/detailed", response_model=DetailedStats)
async def get_user_detailed_stats(user_id: str):
    """
    Get detailed user notification statistics.
    
    Args:
        user_id: User ID
        
    Returns:
        Detailed user notification statistics
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        # In a real implementation, this would query the database for actual stats
        # For now, we'll return mock data
        # TODO: Implement actual stats collection
        
        # Get user repositories for mock data
        repositories = await SupabaseManager.get_user_repositories(user_id)
        repo_stats = {}
        
        for repo in repositories:
            if repo.get("enabled", False):
                repo_stats[repo["github_id"]] = {
                    "name": repo["name"],
                    "count": 5  # Mock count
                }
        
        # Generate mock daily data for the past 7 days
        from datetime import datetime, timedelta
        daily_stats = []
        today = datetime.now()
        
        for i in range(7):
            day = today - timedelta(days=i)
            daily_stats.append({
                "date": day.strftime("%Y-%m-%d"),
                "count": 3 + i  # Mock count that increases as we go back in time
            })
        
        # Sort by date
        daily_stats.sort(key=lambda x: x["date"])
        
        # Mock detailed stats
        stats = DetailedStats(
            totalNotifications=35,
            pullRequests=15,
            reviews=10,
            comments=7,
            issues=3,
            byRepository=repo_stats,
            byDay=daily_stats
        )
        
        return stats
    
    except Exception as e:
        logger.error(f"Error getting detailed stats for user {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get detailed stats: {str(e)}"
        )
