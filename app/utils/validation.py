"""
Input validation utilities for Radar API.

This module provides validation functions for API inputs.
"""
import re
from typing import Any, Dict, List, Optional
import bleach
from pydantic import BaseModel, Field, field_validator, HttpUrl, ConfigDict


def sanitize_string(value: str, max_length: int = 1000) -> str:
    """
    Sanitize a string input by removing potentially harmful content.
    
    Args:
        value: The string to sanitize
        max_length: Maximum allowed length
        
    Returns:
        Sanitized string
    """
    if not value:
        return ""
    
    # Truncate to max length
    value = value[:max_length]
    
    # Remove any HTML tags
    value = bleach.clean(value, tags=[], strip=True)
    
    # Remove null bytes
    value = value.replace('\x00', '')
    
    # Normalize whitespace
    value = ' '.join(value.split())
    
    return value


def validate_github_username(username: str) -> bool:
    """
    Validate GitHub username format.
    
    Args:
        username: GitHub username
        
    Returns:
        True if valid
    """
    if not username:
        return False
    
    # GitHub username rules:
    # - May only contain alphanumeric characters or hyphens
    # - Cannot have multiple consecutive hyphens
    # - Cannot begin or end with a hyphen
    # - Maximum 39 characters
    pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$'
    
    if not re.match(pattern, username):
        return False
    
    # Check for consecutive hyphens
    if '--' in username:
        return False
    
    return True


def validate_repository_name(repo_name: str) -> bool:
    """
    Validate repository name format (owner/repo).
    
    Args:
        repo_name: Repository full name
        
    Returns:
        True if valid
    """
    if not repo_name or '/' not in repo_name:
        return False
    
    parts = repo_name.split('/')
    if len(parts) != 2:
        return False
    
    owner, repo = parts
    
    # Validate owner (same rules as username)
    if not validate_github_username(owner):
        return False
    
    # Validate repo name
    # Repository names can contain alphanumeric, hyphen, underscore, and period
    if not re.match(r'^[a-zA-Z0-9._-]+$', repo):
        return False
    
    # Cannot start with period
    if repo.startswith('.'):
        return False
    
    return True


def validate_slack_channel(channel: str) -> bool:
    """
    Validate Slack channel format.
    
    Args:
        channel: Slack channel ID or name
        
    Returns:
        True if valid
    """
    if not channel:
        return False
    
    # Channel can be:
    # - Channel ID (C1234567890)
    # - Channel name (#general)
    # - Direct message (@username or U1234567890)
    
    # Channel ID pattern
    if re.match(r'^[CUD][A-Z0-9]{8,}$', channel):
        return True
    
    # Channel name pattern
    if re.match(r'^#[a-z0-9][a-z0-9_-]{0,20}$', channel):
        return True
    
    # Direct message pattern
    if re.match(r'^@[a-zA-Z0-9][a-zA-Z0-9._-]{0,20}$', channel):
        return True
    
    return False


def validate_webhook_payload(payload: Dict[str, Any]) -> bool:
    """
    Validate GitHub webhook payload structure.
    
    Args:
        payload: Webhook payload
        
    Returns:
        True if valid
    """
    if not isinstance(payload, dict):
        return False
    
    # Check for required fields
    required_fields = ['repository', 'sender']
    for field in required_fields:
        if field not in payload:
            return False
    
    # Validate repository structure
    repo = payload.get('repository', {})
    if not isinstance(repo, dict):
        return False
    
    if 'id' not in repo or 'full_name' not in repo:
        return False
    
    # Validate sender structure
    sender = payload.get('sender', {})
    if not isinstance(sender, dict):
        return False
    
    if 'id' not in sender or 'login' not in sender:
        return False
    
    return True


# Pydantic models for request validation

class RepositoryToggleRequest(BaseModel):
    """Request model for toggling repository status."""
    enabled: bool = Field(..., description="Whether the repository is enabled")
    
    @field_validator('enabled')
    @classmethod
    def validate_enabled(cls, v):
        if not isinstance(v, bool):
            raise ValueError('enabled must be a boolean')
        return v


class NotificationPreferencesUpdate(BaseModel):
    """Request model for updating notification preferences."""
    # PR & Issue Activity
    pr_comments: Optional[bool] = None
    pr_reviews: Optional[bool] = None
    pr_status_changes: Optional[bool] = None
    pr_assignments: Optional[bool] = None
    pr_opened: Optional[bool] = None
    
    issue_comments: Optional[bool] = None
    issue_status_changes: Optional[bool] = None
    issue_assignments: Optional[bool] = None
    
    # CI/CD
    check_failures: Optional[bool] = None
    check_successes: Optional[bool] = None
    
    # Mentions & Keywords
    mentioned_in_comments: Optional[bool] = None
    keyword_notifications_enabled: Optional[bool] = None
    keywords: Optional[List[str]] = None
    keyword_notification_threshold: Optional[float] = None
    
    # Noise Control
    mute_own_activity: Optional[bool] = None
    mute_bot_comments: Optional[bool] = None
    mute_draft_prs: Optional[bool] = None
    
    # Daily digest
    digest_enabled: Optional[bool] = None
    digest_time: Optional[str] = None
    
    # Legacy fields (kept for backward compatibility)
    author_reviewed: Optional[bool] = None
    author_commented: Optional[bool] = None
    author_merged: Optional[bool] = None
    author_closed: Optional[bool] = None
    reviewer_review_requested: Optional[bool] = None
    reviewer_commented: Optional[bool] = None
    reviewer_merged: Optional[bool] = None
    reviewer_closed: Optional[bool] = None
    assignee_assigned: Optional[bool] = None
    assignee_commented: Optional[bool] = None
    assignee_merged: Optional[bool] = None
    assignee_closed: Optional[bool] = None
    
    model_config = ConfigDict(extra='forbid')  # Don't allow extra fields


class KeywordUpdate(BaseModel):
    """Request model for updating keywords."""
    keywords: List[str] = Field(..., max_length=50)
    
    @field_validator('keywords', mode='before')
    @classmethod
    def validate_keywords(cls, v):
        if not isinstance(v, list):
            raise ValueError('Keywords must be a list')
        
        validated_keywords = []
        for keyword in v:
            if not isinstance(keyword, str):
                raise ValueError('Each keyword must be a string')
            
            # Sanitize and validate length
            sanitized = sanitize_string(keyword, max_length=100)
            
            if len(sanitized) < 2:
                raise ValueError('Keywords must be at least 2 characters')
            
            validated_keywords.append(sanitized)
        
        return validated_keywords


class DigestScheduleUpdate(BaseModel):
    """Request model for updating digest schedule."""
    digest_enabled: bool = Field(..., description="Whether digest is enabled")
    digest_time: Optional[str] = Field(None, pattern=r'^([01]\d|2[0-3]):([0-5]\d)$')
    second_digest_enabled: Optional[bool] = None
    second_digest_time: Optional[str] = Field(None, pattern=r'^([01]\d|2[0-3]):([0-5]\d)$')
    
    @field_validator('digest_time', 'second_digest_time')
    @classmethod
    def validate_time_format(cls, v):
        if v and not re.match(r'^([01]\d|2[0-3]):([0-5]\d)$', v):
            raise ValueError('Time must be in HH:MM format')
        return v