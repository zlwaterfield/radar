"""
User models for the Radar application.
"""
from datetime import datetime
from typing import Dict, List, Optional, Any

from pydantic import BaseModel, Field, EmailStr, ConfigDict


class UserBase(BaseModel):
    """Base model for user data."""
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    is_active: bool = True


class UserCreate(UserBase):
    """Model for creating a user."""
    slack_id: str
    slack_team_id: str
    slack_access_token: str
    slack_refresh_token: Optional[str] = None
    github_id: Optional[str] = None
    github_access_token: Optional[str] = None
    github_refresh_token: Optional[str] = None


class UserUpdate(UserBase):
    """Model for updating a user."""
    slack_access_token: Optional[str] = None
    slack_refresh_token: Optional[str] = None
    github_id: Optional[str] = None
    github_access_token: Optional[str] = None
    github_refresh_token: Optional[str] = None


class UserInDB(UserBase):
    """Model for user data in the database."""
    id: str
    slack_id: str
    slack_team_id: str
    slack_access_token: str
    slack_refresh_token: Optional[str] = None
    github_id: Optional[str] = None
    github_access_token: Optional[str] = None
    github_refresh_token: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class User(UserBase):
    """Model for user data returned to clients."""
    id: str
    slack_id: str
    slack_team_id: str
    github_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserSettings(BaseModel):
    """Model for user settings."""
    user_id: str
    notification_preferences: Dict[str, bool] = Field(
        default_factory=lambda: {
            "pull_request_opened": True,
            "pull_request_closed": True,
            "pull_request_merged": True,
            "pull_request_reviewed": True,
            "pull_request_commented": True,
            "pull_request_assigned": True,
            "issue_opened": True,
            "issue_closed": True,
            "issue_commented": True,
            "issue_assigned": True,
        }
    )
    notification_schedule: Dict[str, Any] = Field(
        default_factory=lambda: {
            "real_time": True,
            "digest_time": "09:00",
            "digest_enabled": True,
            "digest_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "second_digest_time": None,
            "second_digest_enabled": False,
        }
    )
    stats_time_window: int = 14  # Days
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class Repository(BaseModel):
    """Model for repository data."""
    id: str
    user_id: str
    github_id: str
    name: str
    full_name: str
    organization: Optional[str] = None
    is_private: bool
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class Organization(BaseModel):
    """Model for organization data."""
    id: str
    user_id: str
    github_id: str
    name: str
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
