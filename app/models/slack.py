"""
Slack message models for the Radar application.
"""
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Union

from pydantic import BaseModel, Field


class MessageType(str, Enum):
    """Slack message types."""
    PULL_REQUEST = "pull_request"
    PULL_REQUEST_REVIEW = "pull_request_review"
    PULL_REQUEST_COMMENT = "pull_request_comment"
    ISSUE = "issue"
    ISSUE_COMMENT = "issue_comment"
    DISCUSSION = "discussion"
    DISCUSSION_COMMENT = "discussion_comment"
    DIGEST = "digest"
    STATS = "stats"


class SlackBlock(BaseModel):
    """Base model for Slack blocks."""
    type: str
    block_id: Optional[str] = None


class TextObject(BaseModel):
    """Slack text object."""
    type: str  # plain_text or mrkdwn
    text: str
    emoji: Optional[bool] = None


class SectionBlock(SlackBlock):
    """Slack section block."""
    type: str = "section"
    text: Optional[TextObject] = None
    fields: Optional[List[TextObject]] = None
    accessory: Optional[Dict[str, Any]] = None


class DividerBlock(SlackBlock):
    """Slack divider block."""
    type: str = "divider"


class ContextBlock(SlackBlock):
    """Slack context block."""
    type: str = "context"
    elements: List[Union[TextObject, Dict[str, Any]]]


class ImageBlock(SlackBlock):
    """Slack image block."""
    type: str = "image"
    image_url: str
    alt_text: str
    title: Optional[TextObject] = None


class ActionBlock(SlackBlock):
    """Slack action block."""
    type: str = "actions"
    elements: List[Dict[str, Any]]


class HeaderBlock(SlackBlock):
    """Slack header block."""
    type: str = "header"
    text: TextObject


class SlackMessage(BaseModel):
    """Base model for Slack messages."""
    message_type: MessageType
    blocks: List[SlackBlock]
    text: Optional[str] = None
    channel: Optional[str] = None
    thread_ts: Optional[str] = None
    unfurl_links: bool = False
    unfurl_media: bool = False
    attachments: Optional[List[Dict[str, Any]]] = None


class PullRequestMessage(SlackMessage):
    """Slack message for pull request events."""
    message_type: MessageType = MessageType.PULL_REQUEST
    pull_request_number: int
    pull_request_title: str
    pull_request_url: str
    repository: str
    action: str
    user: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class PullRequestReviewMessage(SlackMessage):
    """Slack message for pull request review events."""
    message_type: MessageType = MessageType.PULL_REQUEST_REVIEW
    pull_request_number: int
    pull_request_title: str
    pull_request_url: str
    repository: str
    review_state: str
    review_comment: Optional[str] = None
    user: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class PullRequestCommentMessage(SlackMessage):
    """Slack message for pull request comment events."""
    message_type: MessageType = MessageType.PULL_REQUEST_COMMENT
    pull_request_number: int
    pull_request_title: str
    pull_request_url: str
    repository: str
    comment: str
    comment_url: str
    user: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class IssueMessage(SlackMessage):
    """Slack message for issue events."""
    message_type: MessageType = MessageType.ISSUE
    issue_number: int
    issue_title: str
    issue_url: str
    repository: str
    action: str
    user: str
    keyword_text: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class IssueCommentMessage(SlackMessage):
    """Slack message for issue comment events."""
    message_type: MessageType = MessageType.ISSUE_COMMENT
    issue_number: int
    issue_title: str
    issue_url: str
    repository: str
    comment: str
    comment_url: str
    user: str
    keyword_text: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class DigestMessage(SlackMessage):
    """Slack message for digest notifications."""
    message_type: MessageType = MessageType.DIGEST
    time_period: str  # e.g., "daily", "weekly"
    pull_requests: List[Dict[str, Any]]
    issues: List[Dict[str, Any]]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class DiscussionMessage(SlackMessage):
    """Slack message for discussion events."""
    message_type: MessageType = MessageType.DISCUSSION
    discussion_number: int
    discussion_title: str
    discussion_url: str
    repository: str
    action: str
    category: Optional[str] = None
    user: str
    keyword_text: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class DiscussionCommentMessage(SlackMessage):
    """Slack message for discussion comment events."""
    message_type: MessageType = MessageType.DISCUSSION_COMMENT
    discussion_number: int
    discussion_title: str
    discussion_url: str
    repository: str
    comment: str
    comment_url: str
    user: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class StatsMessage(SlackMessage):
    """Slack message for stats notifications."""
    message_type: MessageType = MessageType.STATS
    time_window: int  # Days
    stats: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
