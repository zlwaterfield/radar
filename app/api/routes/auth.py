"""
Authentication routes for Radar.

This module handles authentication with Slack and GitHub.
"""
import logging
from typing import Dict, Any, Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
import httpx

from app.core.config import settings
from app.db.supabase import SupabaseManager
from app.models.auth import SlackOAuthResponse, GitHubOAuthResponse
from app.models.user import UserCreate, UserUpdate, User
from app.services.slack_service import SlackService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/slack/login")
async def slack_login():
    """
    Initiate Slack OAuth flow.
    
    Returns:
        Redirect to Slack OAuth page
    """
    params = {
        "client_id": settings.SLACK_APP_CLIENT_ID,
        "scope": "chat:write,chat:write.public,commands,users:read,users:read.email,team:read,im:history,im:read,im:write,app_mentions:read",
        "redirect_uri": f"https://zach.ngrok.dev/api/auth/slack/callback",
    }
    
    auth_url = f"https://slack.com/oauth/v2/authorize?{urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.get("/slack/callback")
async def slack_callback(code: str, state: Optional[str] = None):
    """
    Handle Slack OAuth callback.
    
    Args:
        code: OAuth code from Slack
        state: Optional state parameter
        
    Returns:
        Redirect to frontend with auth token
    """
    try:
        # Exchange code for token
        slack_service = SlackService()
        oauth_response = await slack_service.get_oauth_access(code)
        
        if not oauth_response.get("ok", False):
            logger.error(f"Slack OAuth error: {oauth_response.get('error')}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Slack OAuth error: {oauth_response.get('error')}"
            )
        
        # Get user info
        user_id = oauth_response["authed_user"]["id"]
        team_id = oauth_response["team"]["id"]
        access_token = oauth_response["access_token"]
        refresh_token = oauth_response.get("refresh_token")
        
        # Check if user exists
        existing_user = await SupabaseManager.get_user_by_slack_id(user_id)
        
        if existing_user:
            # Update user
            user_data = {
                "slack_access_token": access_token,
            }
            if refresh_token:
                user_data["slack_refresh_token"] = refresh_token
                
            updated_user = await SupabaseManager.update_user(existing_user["id"], user_data)
            if not updated_user:
                logger.error(f"Failed to update user {user_id}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update user"
                )
                
            user_id = existing_user["id"]
        else:
            # Create new user
            user_data = {
                "slack_id": user_id,
                "slack_team_id": team_id,
                "slack_access_token": access_token,
            }
            if refresh_token:
                user_data["slack_refresh_token"] = refresh_token
                
            # Get user profile
            try:
                slack_client = SlackService(token=access_token)
                user_info = await slack_client.get_user_info(user_id)
                
                if user_info:
                    user_data["name"] = user_info.get("real_name") or user_info.get("name")
                    user_data["email"] = user_info.get("profile", {}).get("email")
            except Exception as e:
                logger.warning(f"Failed to get Slack user profile: {e}")
                
            new_user = await SupabaseManager.create_user(user_data)
            if not new_user:
                logger.error(f"Failed to create user for Slack ID {user_id}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create user"
                )
                
            user_id = new_user["id"]
            
            # Create default user settings
            await SupabaseManager.update_user_settings(user_id, {})
        
        # Redirect to frontend with success message
        frontend_url = f"{settings.FRONTEND_URL}/auth/success?provider=slack&user_id={user_id}"
        return RedirectResponse(url=frontend_url)
        
    except Exception as e:
        logger.error(f"Error in Slack callback: {e}", exc_info=True)
        frontend_url = f"{settings.FRONTEND_URL}/auth/error?provider=slack&error={str(e)}"
        return RedirectResponse(url=frontend_url)


@router.get("/github/login")
async def github_login(user_id: str, reconnect: bool = False):
    """
    Initiate GitHub OAuth flow.
    
    Args:
        user_id: User ID to associate with GitHub account
        reconnect: Whether this is a reconnection to update permissions
        
    Returns:
        Redirect to GitHub OAuth page
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": f"https://zach.ngrok.dev/api/auth/github/callback",
        "scope": "repo user:email read:org admin:org",
        "state": user_id,  # Use state to store user_id
    }
    
    # If reconnecting, add the access_type=offline parameter to force a new token
    if reconnect:
        params["access_type"] = "offline"
    
    auth_url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.get("/github/callback")
async def github_callback(code: str, state: str):
    """
    Handle GitHub OAuth callback.
    
    Args:
        code: OAuth code from GitHub
        state: State parameter containing user_id
        
    Returns:
        Redirect to frontend with auth token
    """
    try:
        # Get user ID from state
        user_id = state
        
        # Check if user exists
        user = await SupabaseManager.get_user(user_id)
        if not user:
            logger.error(f"User {user_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Exchange code for token
        async with httpx.AsyncClient() as client:
            print(f"Exchanging GitHub OAuth code for token with client_id: {settings.GITHUB_CLIENT_ID}")
            print(f"Redirect URI: https://zach.ngrok.dev/api/auth/github/callback")
            
            response = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": f"https://zach.ngrok.dev/api/auth/github/callback",
                },
                headers={"Accept": "application/json"}
            )
            
            print(f"GitHub OAuth response status: {response.status_code}")
            
            if response.status_code != 200:
                logger.error(f"GitHub OAuth error: {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"GitHub OAuth error: {response.text}"
                )
            
            oauth_data = response.json()
            
            # Log token info for debugging
            print("GitHub OAuth response keys:", oauth_data.keys())
            if "access_token" in oauth_data:
                token = oauth_data["access_token"]
                print("Token type:", type(token))
                print("Token length:", len(token))
                print("Token prefix:", token[:4] if len(token) > 4 else token)
                print("Token suffix:", token[-4:] if len(token) > 4 else token)
            
            if "refresh_token" in oauth_data:
                refresh_token = oauth_data["refresh_token"]
                print("Refresh token length:", len(refresh_token))
                print("Refresh token prefix:", refresh_token[:4] if len(refresh_token) > 4 else refresh_token)
            
            if "expires_in" in oauth_data:
                print("Token expires in:", oauth_data["expires_in"], "seconds")
            
            if "error" in oauth_data:
                logger.error(f"GitHub OAuth error: {oauth_data['error']}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"GitHub OAuth error: {oauth_data['error']}"
                )
            
            access_token = oauth_data.get("access_token")
            refresh_token = oauth_data.get("refresh_token")
            
            if not access_token:
                logger.error("No access token in GitHub OAuth response")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No access token in GitHub OAuth response"
                )
            
            # Get GitHub user info
            github_user = await get_github_user(access_token)
            
            if not github_user:
                logger.error("Failed to get GitHub user info")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to get GitHub user info"
                )
            
            # Update user with GitHub info
            user_data = {
                "github_id": str(github_user["id"]),
                "github_access_token": access_token,
                "github_login": github_user["login"]
            }
            
            if refresh_token:
                user_data["github_refresh_token"] = refresh_token
                
            updated_user = await SupabaseManager.update_user(user_id, user_data)
            
            if not updated_user:
                logger.error(f"Failed to update user {user_id} with GitHub info")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update user with GitHub info"
                )
            
            # Redirect to frontend with success message
            frontend_url = f"{settings.FRONTEND_URL}/auth/success?provider=github&user_id={user_id}"
            return RedirectResponse(url=frontend_url)
            
    except Exception as e:
        logger.error(f"Error in GitHub callback: {e}", exc_info=True)
        frontend_url = f"{settings.FRONTEND_URL}/auth/error?provider=github&error={str(e)}"
        return RedirectResponse(url=frontend_url)


async def get_github_user(access_token: str) -> Optional[Dict[str, Any]]:
    """
    Get GitHub user info.
    
    Args:
        access_token: GitHub access token
        
    Returns:
        GitHub user info or None if failed
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"token {access_token}",
                    "Accept": "application/vnd.github.v3+json"
                }
            )
            
            if response.status_code != 200:
                logger.error(f"GitHub API error: {response.text}")
                return None
            
            return response.json()
    except Exception as e:
        logger.error(f"Error getting GitHub user: {e}")
        return None


@router.get("/logout")
async def logout(user_id: str):
    """
    Log out a user.
    
    Args:
        user_id: User ID to log out
        
    Returns:
        Success message
    """
    # In a real application, you might want to invalidate tokens or sessions
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=User)
async def get_current_user(user_id: str):
    """
    Get current user info.
    
    Args:
        user_id: User ID
        
    Returns:
        User info
    """
    user = await SupabaseManager.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user
