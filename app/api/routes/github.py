"""
GitHub routes for Radar.

This module handles GitHub API interactions.
"""
import logging
from typing import Dict, List, Any

from fastapi import APIRouter, HTTPException, status
import httpx

from app.db.supabase import SupabaseManager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/repositories", response_model=List[Dict[str, Any]])
async def get_repositories(user_id: str):
    """
    Get GitHub repositories for a user.
    
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
    
    # Check if user has GitHub access token
    if not user.get("github_access_token"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not connected to GitHub"
        )
    
    # Get repositories from GitHub
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.github.com/user/repos",
                headers={
                    "Authorization": f"token {user['github_access_token']}",
                    "Accept": "application/vnd.github.v3+json"
                },
                params={
                    "sort": "updated",
                    "per_page": 100
                }
            )
            
            if response.status_code != 200:
                logger.error(f"GitHub API error: {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"GitHub API error: {response.text}"
                )
            
            repositories = response.json()
            
            # Format repositories
            formatted_repos = []
            for repo in repositories:
                formatted_repos.append({
                    "id": str(repo["id"]),
                    "name": repo["name"],
                    "full_name": repo["full_name"],
                    "html_url": repo["html_url"],
                    "description": repo.get("description"),
                    "private": repo["private"],
                    "owner": {
                        "id": str(repo["owner"]["id"]),
                        "login": repo["owner"]["login"],
                        "avatar_url": repo["owner"]["avatar_url"],
                        "html_url": repo["owner"]["html_url"],
                    },
                    "created_at": repo["created_at"],
                    "updated_at": repo["updated_at"],
                    "pushed_at": repo["pushed_at"],
                    "language": repo.get("language"),
                    "default_branch": repo["default_branch"],
                })
            
            return formatted_repos
            
    except Exception as e:
        logger.error(f"Error getting GitHub repositories: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting GitHub repositories: {str(e)}"
        )
