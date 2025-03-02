"""
GitHub event models for the Radar application.
"""
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Union

from pydantic import BaseModel, Field


class EventType(str, Enum):
    """GitHub event types."""
    PULL_REQUEST = "pull_request"
    PULL_REQUEST_REVIEW = "pull_request_review"
    PULL_REQUEST_REVIEW_COMMENT = "pull_request_review_comment"
    ISSUE = "issue"
    ISSUE_COMMENT = "issue_comment"
    PUSH = "push"


class ActionType(str, Enum):
    """GitHub action types."""
    OPENED = "opened"
    CLOSED = "closed"
    REOPENED = "reopened"
    EDITED = "edited"
    ASSIGNED = "assigned"
    UNASSIGNED = "unassigned"
    REVIEW_REQUESTED = "review_requested"
    REVIEW_REQUEST_REMOVED = "review_request_removed"
    LABELED = "labeled"
    UNLABELED = "unlabeled"
    SYNCHRONIZED = "synchronized"
    SUBMITTED = "submitted"
    DISMISSED = "dismissed"
    CREATED = "created"
    DELETED = "deleted"
    MERGED = "merged"


class GitHubUser(BaseModel):
    """GitHub user model."""
    id: int
    login: str
    avatar_url: Optional[str] = None
    html_url: Optional[str] = None


class Organization(BaseModel):
    """GitHub organization model."""
    id: int
    login: str
    url: str
    repos_url: str
    avatar_url: Optional[str] = None
    description: Optional[str] = None
    name: Optional[str] = None
    html_url: Optional[str] = None


class Repository(BaseModel):
    """GitHub repository model."""
    id: int
    name: str
    full_name: str
    private: bool
    html_url: str
    owner: GitHubUser


class PullRequest(BaseModel):
    """GitHub pull request model."""
    id: int
    number: int
    state: str
    title: str
    html_url: str
    body: Optional[str] = None
    user: GitHubUser
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    merged_at: Optional[datetime] = None
    assignees: List[GitHubUser] = []
    requested_reviewers: List[GitHubUser] = []
    merged: Optional[bool] = None
    mergeable: Optional[bool] = None
    draft: Optional[bool] = None
    head: Dict[str, Any]
    base: Dict[str, Any]


class Issue(BaseModel):
    """GitHub issue model."""
    id: int
    number: int
    state: str
    title: str
    html_url: str
    body: Optional[str] = None
    user: GitHubUser
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    assignees: List[GitHubUser] = []


class Comment(BaseModel):
    """GitHub comment model."""
    id: int
    body: str
    user: GitHubUser
    created_at: datetime
    updated_at: datetime
    html_url: str


class Review(BaseModel):
    """GitHub review model."""
    id: int
    user: GitHubUser
    body: Optional[str] = None
    state: str  # APPROVED, CHANGES_REQUESTED, COMMENTED
    submitted_at: datetime
    html_url: str


class PushCommit(BaseModel):
    """GitHub push commit model."""
    id: str
    message: str
    timestamp: datetime
    url: str
    author: Dict[str, str]


class GitHubEvent(BaseModel):
    """Base GitHub event model."""
    event_type: EventType
    action: Optional[ActionType] = None
    repository: Repository
    sender: GitHubUser
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class PullRequestEvent(GitHubEvent):
    """GitHub pull request event model."""
    event_type: EventType = EventType.PULL_REQUEST
    pull_request: PullRequest


class PullRequestReviewEvent(GitHubEvent):
    """GitHub pull request review event model."""
    event_type: EventType = EventType.PULL_REQUEST_REVIEW
    pull_request: PullRequest
    review: Review


class PullRequestReviewCommentEvent(GitHubEvent):
    """GitHub pull request review comment event model."""
    event_type: EventType = EventType.PULL_REQUEST_REVIEW_COMMENT
    pull_request: PullRequest
    comment: Comment


class IssueEvent(GitHubEvent):
    """GitHub issue event model."""
    event_type: EventType = EventType.ISSUE
    issue: Issue


class IssueCommentEvent(GitHubEvent):
    """GitHub issue comment event model."""
    event_type: EventType = EventType.ISSUE_COMMENT
    issue: Issue
    comment: Comment


class PushEvent(GitHubEvent):
    """GitHub push event model."""
    event_type: EventType = EventType.PUSH
    ref: str
    before: str
    after: str
    commits: List[PushCommit]


# Union type for all GitHub events
GitHubEventUnion = Union[
    PullRequestEvent,
    PullRequestReviewEvent,
    PullRequestReviewCommentEvent,
    IssueEvent,
    IssueCommentEvent,
    PushEvent,
]
