"""
Models for user settings and preferences.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, ConfigDict


class DigestFrequency(str, Enum):
    """Digest frequency options."""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class NotificationPreferences(BaseModel):
    """User notification preferences."""
    pull_request_opened: Optional[bool] = True
    pull_request_closed: Optional[bool] = True
    pull_request_merged: Optional[bool] = True
    pull_request_reopened: Optional[bool] = True
    pull_request_assigned: Optional[bool] = True
    pull_request_review_requested: Optional[bool] = True
    pull_request_reviewed: Optional[bool] = True
    pull_request_commented: Optional[bool] = True
    issue_opened: Optional[bool] = True
    issue_closed: Optional[bool] = True
    issue_reopened: Optional[bool] = True
    issue_assigned: Optional[bool] = True
    issue_commented: Optional[bool] = True
    push: Optional[bool] = False


class DigestSettings(BaseModel):
    """User digest notification settings."""
    enabled: Optional[bool] = True
    frequency: Optional[DigestFrequency] = DigestFrequency.DAILY
    time: Optional[str] = "09:00"  # HH:MM format
    timezone: Optional[str] = "UTC"
    include_pull_requests: Optional[bool] = True
    include_issues: Optional[bool] = True
    include_stats: Optional[bool] = True


class RepositorySettings(BaseModel):
    """User repository settings."""
    id: Optional[str] = None
    user_id: Optional[str] = None
    github_id: str = Field(alias="id")
    name: str = Field(alias="name")
    full_name: Optional[str] = None
    url: str = Field(alias="url")
    description: Optional[str] = None
    organization: Optional[str] = None
    is_private: Optional[bool] = False
    is_fork: Optional[bool] = False
    owner_name: Optional[str] = None
    owner_avatar_url: Optional[str] = None
    owner_url: Optional[str] = None
    enabled: Optional[bool] = False
    is_active: Optional[bool] = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class UserSettings(BaseModel):
    """User settings."""
    id: Optional[str] = None
    user_id: str
    notification_preferences: Optional[Dict[str, Any]] = Field(default_factory=dict)
    digest_settings: Optional[Dict[str, Any]] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UpdateSettingsRequest(BaseModel):
    """Request to update user settings."""
    notification_preferences: Optional[NotificationPreferences] = None
    digest_settings: Optional[DigestSettings] = None


class PaginationParams(BaseModel):
    """Pagination parameters."""
    page: int = 1
    page_size: int = 10


class RepositoryFilterParams(BaseModel):
    """Repository filter parameters."""
    enabled: Optional[bool] = None
    search: Optional[str] = None


class PaginatedRepositoriesResponse(BaseModel):
    """Paginated repositories response."""
    items: List[RepositorySettings]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginatedResponse(BaseModel):
    """Generic paginated response."""
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int
