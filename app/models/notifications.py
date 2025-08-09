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
    OPENED = "opened"
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
    
    # PR & Issue Activity
    pr_comments: bool = True  # Someone comments on a PR you're involved with
    pr_reviews: bool = True  # Someone reviews a PR you're involved with
    pr_status_changes: bool = True  # PR merged, closed, reopened
    pr_assignments: bool = True  # Assigned to PR, review requested
    pr_opened: bool = True  # New PRs in watched repos
    
    issue_comments: bool = True  # Someone comments on an issue you're involved with
    issue_status_changes: bool = True  # Issue opened, closed, reopened
    issue_assignments: bool = True  # Assigned to issue
    
    # CI/CD
    check_failures: bool = True  # CI checks fail
    check_successes: bool = False  # CI checks pass (usually too noisy)
    
    # Mentions & Keywords
    mentioned_in_comments: bool = True  # Someone mentions you in a comment
    keyword_notifications_enabled: bool = False
    keywords: List[str] = []
    keyword_notification_threshold: float = 0.7  # Threshold for keyword matching confidence
    
    # Noise Control
    mute_own_activity: bool = True
    mute_bot_comments: bool = True
    mute_draft_prs: bool = True  # Ignore draft PR activity
    
    # Daily digest
    digest_enabled: bool = False
    digest_time: str = "09:00"
    
    # Legacy fields (kept for backward compatibility but not used)
    reviewer_review_requested: bool = True
    reviewer_commented: bool = True
    reviewer_merged: bool = True
    reviewer_closed: bool = True
    reviewer_check_failed: bool = True
    reviewer_check_succeeded: bool = True
    author_reviewed: bool = True
    author_commented: bool = True
    author_merged: bool = True
    author_closed: bool = True
    author_check_failed: bool = True
    author_check_succeeded: bool = True
    assignee_assigned: bool = True
    assignee_unassigned: bool = True
    assignee_reviewed: bool = True
    assignee_commented: bool = True
    assignee_merged: bool = True
    assignee_closed: bool = True
    assignee_check_failed: bool = True
    assignee_check_succeeded: bool = True
    
    def get_pr_notifications(self) -> Dict[str, bool]:
        """Get PR notification preferences."""
        return {
            "comments": self.pr_comments,
            "reviews": self.pr_reviews,
            "status_changes": self.pr_status_changes,
            "assignments": self.pr_assignments,
            "opened": self.pr_opened,
        }
    
    def get_issue_notifications(self) -> Dict[str, bool]:
        """Get issue notification preferences."""
        return {
            "comments": self.issue_comments,
            "status_changes": self.issue_status_changes,
            "assignments": self.issue_assignments,
        }
    
    def get_ci_notifications(self) -> Dict[str, bool]:
        """Get CI/CD notification preferences."""
        return {
            "failures": self.check_failures,
            "successes": self.check_successes,
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
