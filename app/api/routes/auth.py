"""
Authentication routes for Radar.

This module handles authentication with Slack and GitHub.
"""
import logging
import time
from typing import Dict, Any, Optional
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import httpx

from app.core.config import settings
from app.db.supabase import SupabaseManager
from app.models.user import User
from app.services.slack_service import SlackService
from app.utils.auth import TokenManager

router = APIRouter()
logger = logging.getLogger(__name__)


class TokenValidationRequest(BaseModel):
    token: str

@router.post("/validate")
async def validate_token(request: TokenValidationRequest):
    """
    Validate a JWT token.
    
    Args:
        request: Request containing JWT token to validate
        
    Returns:
        User info if token is valid
    """
    payload = TokenManager.validate_user_token(request.token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    user_id = payload.get("sub")
    user = await SupabaseManager.get_user(user_id, decrypt_tokens=False)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Don't return sensitive tokens
    safe_user = {
        "id": user["id"],
        "name": user.get("name"),
        "email": user.get("email"),
        "slack_id": user.get("slack_id"),
        "github_id": user.get("github_id"),
        "github_login": user.get("github_login"),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at")
    }
    
    return {
        "user": safe_user,
        "token_info": {
            "type": payload.get("type"),
            "provider": payload.get("provider"),
            "expires_at": payload.get("exp")
        }
    }


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
        "redirect_uri": f"{settings.CALLBACK_API_HOST}/api/auth/slack/callback",
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
        redirect_uri = f"{settings.CALLBACK_API_HOST}/api/auth/slack/callback"
        slack_service = SlackService()
        oauth_response = await slack_service.get_oauth_access(code, redirect_uri)
        
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
        
        # Create JWT token for the user
        jwt_token = TokenManager.create_user_token(user_id, {
            "provider": "slack",
            "slack_id": existing_user["slack_id"] if existing_user else new_user["slack_id"]
        })
        
        # Redirect to frontend with JWT token
        frontend_url = f"{settings.FRONTEND_URL}/auth/success?provider=slack&token={jwt_token}"
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
    
    # Generate secure state parameter instead of using user_id directly
    import secrets
    import base64
    import json
    state_token = secrets.token_urlsafe(32)
    state_data = {
        "user_id": user_id,
        "timestamp": int(time.time()),
        "nonce": state_token[:16]
    }
    encoded_state = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()
    
    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": f"{settings.CALLBACK_API_HOST}/api/auth/github/callback",
        # "scope": "repo user:email read:org admin:org",
        "state": encoded_state,  # Use secure encoded state
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
        Redirect to GitHub App installation page
    """
    try:
        # Decode state to get user_id
        import base64
        import json
        
        try:
            state_data = json.loads(base64.urlsafe_b64decode(state.encode()).decode())
            user_id = state_data.get("user_id")
            timestamp = state_data.get("timestamp", 0)
            
            # Check if state is not too old (10 minutes max)
            if time.time() - timestamp > 600:
                raise ValueError("State token expired")
                
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Invalid state parameter in OAuth callback: {e}")
            frontend_url = f"{settings.FRONTEND_URL}/auth/error?provider=github&error=Invalid state parameter"
            return RedirectResponse(url=frontend_url)
        
        if not user_id:
            logger.error("No user_id in OAuth state parameter")
            frontend_url = f"{settings.FRONTEND_URL}/auth/error?provider=github&error=Invalid state"
            return RedirectResponse(url=frontend_url)
        
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
            print(f"Redirect URI: {settings.CALLBACK_API_HOST}/api/auth/github/callback")
            
            response = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": f"{settings.CALLBACK_API_HOST}/api/auth/github/callback",
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
            
            # Create JWT token for the user after successful OAuth
            jwt_token = TokenManager.create_user_token(user_id, {
                "provider": "github", 
                "github_id": updated_user["github_id"]
            })
            
            # OAuth flow complete - redirect back to GitHub auth page for step 2
            frontend_url = f"{settings.FRONTEND_URL}/auth/github?token={jwt_token}"
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


@router.get("/github/install")
async def github_app_install(user_id: str):
    """
    Initiate GitHub App installation.
    
    Args:
        user_id: User ID to associate with the installation
        
    Returns:
        Redirect to GitHub App installation page
    """
    # Check if user exists
    user = await SupabaseManager.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Generate secure random state token instead of using user_id directly
    import secrets
    state_token = secrets.token_urlsafe(32)
    
    # Store state mapping temporarily (in production, use Redis or database)
    # For now, we'll encode user_id in a more secure way
    import base64
    import json
    state_data = {
        "user_id": user_id,
        "timestamp": int(time.time()),
        "nonce": state_token[:16]
    }
    encoded_state = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()
    
    app_name = settings.GITHUB_APP_NAME
    params = {
        "state": encoded_state,
    }
    
    # Add setup_action parameter to ensure proper callback
    setup_params = {
        **params,
        "setup_action": "install"
    }
    
    installation_url = f"https://github.com/apps/{app_name}/installations/new?{urlencode(setup_params)}"
    return RedirectResponse(url=installation_url)


@router.get("/github/app-callback")
async def github_app_callback(installation_id: int, setup_action: str, state: Optional[str] = None):
    """
    Handle GitHub App installation callback.
    
    Args:
        installation_id: GitHub App installation ID
        setup_action: Action performed (install, update, etc.)
        state: State parameter containing encoded user info
        
    Returns:
        Redirect to frontend
    """
    try:
        if not state:
            logger.error("No state parameter in GitHub App installation callback")
            frontend_url = f"{settings.FRONTEND_URL}/auth/error?provider=github&error=No state parameter"
            return RedirectResponse(url=frontend_url)
        
        # Decode state to get user_id
        import base64
        import json
        import time
        
        try:
            state_data = json.loads(base64.urlsafe_b64decode(state.encode()).decode())
            user_id = state_data.get("user_id")
            timestamp = state_data.get("timestamp", 0)
            
            # Check if state is not too old (10 minutes max)
            if time.time() - timestamp > 600:
                raise ValueError("State token expired")
                
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Invalid state parameter: {e}")
            frontend_url = f"{settings.FRONTEND_URL}/auth/error?provider=github&error=Invalid state parameter"
            return RedirectResponse(url=frontend_url)
        
        if not user_id:
            logger.error("No user_id in state parameter")
            frontend_url = f"{settings.FRONTEND_URL}/auth/error?provider=github&error=Invalid state"
            return RedirectResponse(url=frontend_url)
        
        # Check if user exists
        user = await SupabaseManager.get_user(user_id)
        if not user:
            logger.error(f"User {user_id} not found")
            frontend_url = f"{settings.FRONTEND_URL}/auth/error?provider=github&error=User not found"
            return RedirectResponse(url=frontend_url)
        
        if setup_action == "install":
            # Store the installation ID for the user
            updated_user = await SupabaseManager.update_user(user_id, {
                "github_installation_id": installation_id
            })
            
            if not updated_user:
                logger.error(f"Failed to update user {user_id} with installation ID")
                frontend_url = f"{settings.FRONTEND_URL}/auth/error?provider=github&error=Failed to save installation"
                return RedirectResponse(url=frontend_url)
            
            # Redirect to frontend with success
            frontend_url = f"{settings.FRONTEND_URL}/settings/repositories?installation=success"
            return RedirectResponse(url=frontend_url)
        
        else:
            # Handle other setup actions (update, etc.)
            frontend_url = f"{settings.FRONTEND_URL}/settings/repositories?installation=updated"
            return RedirectResponse(url=frontend_url)
            
    except Exception as e:
        logger.error(f"Error in GitHub App callback: {e}", exc_info=True)
        frontend_url = f"{settings.FRONTEND_URL}/auth/error?provider=github&error={str(e)}"
        return RedirectResponse(url=frontend_url)


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
