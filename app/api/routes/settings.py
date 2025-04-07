"""
Settings routes for Radar.

This module handles user settings and preferences.
"""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, status

from app.db.supabase import SupabaseManager
from app.models.settings import (
    UserSettings,
    RepositorySettings,
    UpdateSettingsRequest,
    PaginatedRepositoriesResponse,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/user/{user_id}", response_model=UserSettings)
async def get_user_settings(user_id: str):
    """
    Get settings for a user.
    
    Args:
        user_id: The user ID
        
    Returns:
        User settings
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get user settings
    user_settings = await SupabaseManager.get_user_settings(user_id)
    
    if not user_settings:
        # Create default settings
        default_settings = {
            "notification_preferences": {
                "pull_request_opened": True,
                "pull_request_closed": True,
                "pull_request_merged": True,
                "pull_request_reopened": True,
                "pull_request_assigned": True,
                "pull_request_review_requested": True,
                "pull_request_reviewed": True,
                "pull_request_commented": True,
                "issue_opened": True,
                "issue_closed": True,
                "issue_reopened": True,
                "issue_assigned": True,
                "issue_commented": True,
                "push": False
            },
            "digest_settings": {
                "enabled": True,
                "frequency": "daily",
                "time": "09:00",
                "timezone": "UTC",
                "include_pull_requests": True,
                "include_issues": True,
                "include_stats": True
            }
        }
        
        user_settings = await SupabaseManager.update_user_settings(user_id, default_settings)
        
        if not user_settings:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create default settings"
            )
    
    return user_settings


@router.put("/user/{user_id}", response_model=UserSettings)
async def update_user_settings(user_id: str, settings_request: UpdateSettingsRequest):
    """
    Update settings for a user.
    
    Args:
        user_id: The user ID
        settings_request: Settings data to update
        
    Returns:
        Updated user settings
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get current settings
    current_settings = await SupabaseManager.get_user_settings(user_id)
    
    if not current_settings:
        # Create default settings
        current_settings = {
            "notification_preferences": {},
            "digest_settings": {}
        }
    
    # Update settings
    updated_settings = current_settings.copy()
    
    if settings_request.notification_preferences:
        if "notification_preferences" not in updated_settings:
            updated_settings["notification_preferences"] = {}
            
        updated_settings["notification_preferences"].update(
            settings_request.notification_preferences.dict(exclude_none=True)
        )
    
    if settings_request.digest_settings:
        if "digest_settings" not in updated_settings:
            updated_settings["digest_settings"] = {}
            
        updated_settings["digest_settings"].update(
            settings_request.digest_settings.dict(exclude_none=True)
        )
    
    # Save updated settings
    result = await SupabaseManager.update_user_settings(user_id, updated_settings)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update settings"
        )
    
    return result


@router.get("/user/{user_id}/repositories", response_model=PaginatedRepositoriesResponse)
async def get_user_repositories(
    user_id: str,
    page: int = 1,
    page_size: int = 10,
    enabled: Optional[bool] = None,
    search: Optional[str] = None
):
    """
    Get repositories for a user with pagination and filtering.
    
    Args:
        user_id: The user ID
        page: Page number (1-indexed)
        page_size: Number of items per page
        enabled: Filter by enabled status
        search: Search term for repository name or description
        
    Returns:
        Paginated list of repository settings
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get user repositories with pagination and filtering
    repositories = await SupabaseManager.get_user_repositories(
        user_id=user_id,
        page=page,
        page_size=page_size,
        enabled=enabled,
        search=search
    )
    
    return repositories


@router.post("/user/{user_id}/repositories", response_model=RepositorySettings)
async def add_user_repository(user_id: str, repository: RepositorySettings):
    """
    Add a repository for a user.
    
    Args:
        user_id: The user ID
        repository: Repository settings
        
    Returns:
        Added repository settings
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Add repository
    result = await SupabaseManager.add_user_repository(user_id=user_id, repo_data=repository.dict(exclude_none=True))
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add repository"
        )
    
    return result


@router.delete("/user/{user_id}/repositories/{repo_id}")
async def remove_user_repository(user_id: str, repo_id: str):
    """
    Remove a repository for a user.
    
    Args:
        user_id: The user ID
        repo_id: The repository ID
        
    Returns:
        Success message
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Remove repository
    success = await SupabaseManager.remove_user_repository(user_id, repo_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove repository"
        )
    
    return {"message": "Repository removed successfully"}


@router.patch("/user/{user_id}/repositories/{repo_id}/toggle")
async def toggle_repository_enabled(
    user_id: str,
    repo_id: str,
    request: Request
):
    """
    Toggle the enabled status of a repository.
    
    Args:
        user_id: The user ID
        repo_id: The repository ID
        request: Request with enabled status in body
        
    Returns:
        Updated repository settings
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Parse request body
    body = await request.json()
    enabled = body.get("enabled")
    
    if enabled is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing 'enabled' field in request body"
        )
    
    # Update repository enabled status
    updated_repository = await SupabaseManager.update_repository_enabled_status(user_id, repo_id, enabled)
    
    if not updated_repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )
    
    return updated_repository


@router.patch("/user/{user_id}/repositories/toggle-all")
async def toggle_all_repositories_enabled(
    user_id: str,
    request: Request
):
    """
    Toggle the enabled status of all repositories for a user.
    
    Args:
        user_id: The user ID
        request: Request with enabled status in body
        
    Returns:
        Success message
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Parse request body
    body = await request.json()
    enabled = body.get("enabled")
    
    if enabled is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing 'enabled' field in request body"
        )
    
    # Update all repositories enabled status
    success = await SupabaseManager.update_all_repositories_enabled_status(user_id, enabled)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update repositories"
        )
    
    return {"message": f"All repositories {'enabled' if enabled else 'disabled'} successfully"}
