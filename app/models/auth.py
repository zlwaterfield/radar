"""
Authentication models for the Radar application.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class Token(BaseModel):
    """Token model."""
    access_token: str
    token_type: str
    expires_at: datetime


class TokenData(BaseModel):
    """Token data model."""
    user_id: Optional[str] = None


class SlackOAuthResponse(BaseModel):
    """Slack OAuth response model."""
    ok: bool
    app_id: str
    authed_user: dict
    team: dict
    access_token: str
    token_type: str
    scope: str
    bot_user_id: str
    error: Optional[str] = None


class GitHubOAuthResponse(BaseModel):
    """GitHub OAuth response model."""
    access_token: str
    token_type: str
    scope: str
    error: Optional[str] = None
    error_description: Optional[str] = None
    error_uri: Optional[str] = None
