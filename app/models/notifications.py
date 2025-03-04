"""
Notification models for Radar.

This module defines the notification models used in the application.
"""
from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class WatchingReason(str, Enum):
    """Reason for watching a pull request."""
    AUTHOR = "author"
    REVIEWER = "reviewer"
    ASSIGNED = "assigned"
    MENTIONED = "mentioned"
    TEAM_MENTIONED = "team_mentioned"
    SUBSCRIBED = "subscribed"
    MANUAL = "manual"


class NotificationTrigger(str, Enum):
    """Type of notification trigger."""
    REVIEW_REQUESTED = "review_requested"
    REVIEW_REQUEST_REMOVED = "review_request_removed"
    REVIEWED = "reviewed"
    COMMENTED = "commented"
    MERGED = "merged"
    CLOSED = "closed"
    REOPENED = "reopened"
    ASSIGNED = "assigned"
    UNASSIGNED = "unassigned"
    LABELED = "labeled"
    UNLABELED = "unlabeled"
    MENTIONED = "mentioned"
    TEAM_MENTIONED = "team_mentioned"
    COMMITTED = "committed"
    STATUS_CHANGED = "status_changed"
    CHECK_FAILED = "check_failed"
    CHECK_SUCCEEDED = "check_succeeded"


class NotificationPreferences(BaseModel):
    """User notification preferences."""
    
    # Basic notification types
    issues: bool = True
    
    # Reviewer notifications
    reviewer_review_requested: bool = True
    reviewer_commented: bool = True
    reviewer_merged: bool = True
    reviewer_closed: bool = True
    reviewer_check_failed: bool = True
    
    # Author notifications
    author_reviewed: bool = True
    author_commented: bool = True
    author_check_failed: bool = True
    author_check_succeeded: bool = True
    
    # Noise reduction
    mute_own_activity: bool = True
    mute_bot_comments: bool = True
    group_similar: bool = True
    
    # Daily digest
    digest_enabled: bool = False
    digest_time: str = "09:00"
    
    # Keyword notifications
    keyword_notifications_enabled: bool = False
    keywords: List[str] = []
    keyword_notification_threshold: float = 0.7  # Threshold for keyword matching confidence
    
    def get_reviewer_notifications(self) -> Dict[str, bool]:
        """Get reviewer notification preferences."""
        return {
            "review_requested": self.reviewer_review_requested,
            "commented": self.reviewer_commented,
            "merged": self.reviewer_merged,
            "closed": self.reviewer_closed,
            "check_failed": self.reviewer_check_failed,
        }
    
    def get_author_notifications(self) -> Dict[str, bool]:
        """Get author notification preferences."""
        return {
            "reviewed": self.author_reviewed,
            "commented": self.author_commented,
            "check_failed": self.author_check_failed,
            "check_succeeded": self.author_check_succeeded,
        }


class NotificationSchedule(BaseModel):
    """User notification schedule."""
    real_time: bool = True
    digest_enabled: bool = True
    digest_time: str = "09:00"
    digest_days: List[str] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    second_digest_enabled: bool = False
    second_digest_time: Optional[str] = None


class UserSettings(BaseModel):
    """User settings."""
    notification_preferences: NotificationPreferences = Field(default_factory=NotificationPreferences)
    notification_schedule: NotificationSchedule = Field(default_factory=NotificationSchedule)
    stats_time_window: int = 14
