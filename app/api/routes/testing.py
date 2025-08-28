"""
Testing API routes for manual Slack message testing.
"""
import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

from app.models.slack import (
    PullRequestMessage, 
    PullRequestReviewMessage,
    PullRequestCommentMessage,
    IssueMessage,
    IssueCommentMessage,
    DigestMessage,
    StatsMessage,
    MessageType
)
from app.services.slack_service import SlackService

logger = logging.getLogger(__name__)

router = APIRouter()

class TestMessageRequest(BaseModel):
    """Request model for testing Slack messages."""
    slack_access_token: str = Field(..., description="Slack access token for sending messages")
    channel: str = Field(..., description="Slack channel ID or name to send the message to")
    message_type: str = Field(..., description="Type of message to test")
    
    # Pull Request fields
    pr_number: Optional[int] = Field(None, description="Pull request number")
    pr_title: Optional[str] = Field(None, description="Pull request title")
    pr_url: Optional[str] = Field(None, description="Pull request URL")
    pr_action: Optional[str] = Field(None, description="PR action (opened, closed, merged, reopened, assigned, unassigned, review_requested, review_request_removed, edited)")
    
    # Review fields
    review_state: Optional[str] = Field(None, description="Review state (approved, changes_requested, commented)")
    review_comment: Optional[str] = Field(None, description="Review comment text")
    
    # Issue fields
    issue_number: Optional[int] = Field(None, description="Issue number")
    issue_title: Optional[str] = Field(None, description="Issue title")
    issue_url: Optional[str] = Field(None, description="Issue URL")
    issue_action: Optional[str] = Field(None, description="Issue action (opened, closed, reopened, assigned, unassigned, edited)")
    
    # Comment fields
    comment: Optional[str] = Field(None, description="Comment text")
    
    # Common fields
    repository: Optional[str] = Field("test/repo", description="Repository name")
    user: Optional[str] = Field("testuser", description="GitHub username")
    
    # Digest fields
    date: Optional[str] = Field(None, description="Date for digest/stats messages")

class TestMessageResponse(BaseModel):
    """Response model for test message sending."""
    success: bool
    message_ts: Optional[str] = None
    error: Optional[str] = None
    channel: Optional[str] = None

@router.post("/send-test-message", response_model=TestMessageResponse)
async def send_test_message(request: TestMessageRequest) -> TestMessageResponse:
    """
    Send a test Slack message with the specified type and parameters.
    
    This endpoint allows you to manually trigger different types of Slack messages
    for testing purposes. You can test pull request notifications, reviews,
    comments, issues, digests, and stats messages.
    
    Args:
        request: Test message request with Slack token, channel, and message details
        
    Returns:
        Response indicating success/failure and message timestamp
    """
    try:
        # Initialize Slack service with provided token
        slack_service = SlackService(token=request.slack_access_token)
        
        # Create the appropriate message type
        message = None
        
        if request.message_type == "pull_request":
            message = PullRequestMessage(
                channel=request.channel,
                message_type=MessageType.PULL_REQUEST,
                pull_request_number=request.pr_number or 123,
                pull_request_title=request.pr_title or "Test Pull Request",
                pull_request_url=request.pr_url or "https://github.com/test/repo/pull/123",
                action=request.pr_action or "opened",
                repository=request.repository,
                user=request.user,
                blocks=[],  # Initialize empty blocks
                attachments=[]  # Initialize empty attachments
            )
            message = SlackService.create_pull_request_message(message)
            
        elif request.message_type == "pull_request_review":
            message = PullRequestReviewMessage(
                channel=request.channel,
                message_type=MessageType.PULL_REQUEST_REVIEW,
                pull_request_number=request.pr_number or 123,
                pull_request_title=request.pr_title or "Test Pull Request",
                pull_request_url=request.pr_url or "https://github.com/test/repo/pull/123",
                review_state=request.review_state or "approved",
                review_comment=request.review_comment or "Looks good to me!",
                repository=request.repository,
                user=request.user,
                blocks=[],
                attachments=[]
            )
            message = SlackService.create_pull_request_review_message(message)
            
        elif request.message_type == "pull_request_comment":
            message = PullRequestCommentMessage(
                channel=request.channel,
                message_type=MessageType.PULL_REQUEST_COMMENT,
                pull_request_number=request.pr_number or 123,
                pull_request_title=request.pr_title or "Test Pull Request",
                pull_request_url=request.pr_url or "https://github.com/test/repo/pull/123",
                comment=request.comment or "This is a test comment on the pull request.",
                repository=request.repository,
                user=request.user,
                blocks=[],
                attachments=[]
            )
            message = SlackService.create_pull_request_comment_message(message)
            
        elif request.message_type == "issue":
            message = IssueMessage(
                channel=request.channel,
                message_type=MessageType.ISSUE,
                issue_number=request.issue_number or 456,
                issue_title=request.issue_title or "Test Issue",
                issue_url=request.issue_url or "https://github.com/test/repo/issues/456",
                action=request.issue_action or "opened",
                repository=request.repository,
                user=request.user,
                blocks=[],
                attachments=[]
            )
            message = SlackService.create_issue_message(message)
            
        elif request.message_type == "issue_comment":
            message = IssueCommentMessage(
                channel=request.channel,
                message_type=MessageType.ISSUE_COMMENT,
                issue_number=request.issue_number or 456,
                issue_title=request.issue_title or "Test Issue",
                issue_url=request.issue_url or "https://github.com/test/repo/issues/456",
                comment=request.comment or "This is a test comment on the issue.",
                repository=request.repository,
                user=request.user,
                blocks=[],
                attachments=[]
            )
            message = SlackService.create_issue_comment_message(message)
            
        elif request.message_type == "digest":
            message = DigestMessage(
                channel=request.channel,
                message_type=MessageType.DIGEST,
                date=request.date or "2023-12-01",
                time_period="daily",
                pull_requests=[
                    {
                        "number": 123,
                        "title": "Test Pull Request 1",
                        "html_url": "https://github.com/test/repo/pull/123",
                        "state": "open"
                    },
                    {
                        "number": 124,
                        "title": "Test Pull Request 2",
                        "html_url": "https://github.com/test/repo/pull/124",
                        "state": "merged"
                    }
                ],
                issues=[
                    {
                        "number": 456,
                        "title": "Test Issue 1",
                        "html_url": "https://github.com/test/repo/issues/456",
                        "state": "open"
                    }
                ],
                blocks=[],
                attachments=[]
            )
            message = SlackService.create_digest_message(message)
            
        elif request.message_type == "stats":
            message = StatsMessage(
                channel=request.channel,
                message_type=MessageType.STATS,
                date=request.date or "2023-12-01",
                stats={
                    "pull_requests_open": 5,
                    "pull_requests_closed": 3,
                    "pull_requests_merged": 8,
                    "pull_requests_total": 16,
                    "reviews_approved": 12,
                    "reviews_changes_requested": 2,
                    "reviews_commented": 4,
                    "reviews_total": 18
                },
                blocks=[],
                attachments=[]
            )
            message = SlackService.create_stats_message(message)
            
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported message type: {request.message_type}. "
                       f"Supported types: pull_request, pull_request_review, pull_request_comment, "
                       f"issue, issue_comment, digest, stats"
            )
        
        if not message:
            raise HTTPException(status_code=400, detail="Failed to create message")
        
        # Send the message
        response = await slack_service.send_message(message)
        
        return TestMessageResponse(
            success=True,
            message_ts=response.get("ts"),
            channel=response.get("channel")
        )
        
    except SlackApiError as e:
        slack_error = e.response.get('error', str(e)) if hasattr(e, 'response') and e.response else str(e)
        logger.error(f"Slack API error: {slack_error}")
        
        # Provide more helpful error messages
        error_message = slack_error
        if slack_error == "invalid_auth":
            error_message = "Invalid Slack token. Make sure your token starts with 'xoxb-' and has the correct permissions."
        elif slack_error == "channel_not_found":
            error_message = "Channel not found. Make sure the channel exists and your bot has access to it."
        elif slack_error == "not_in_channel":
            error_message = "Bot is not in the channel. Add your bot to the channel or use a channel ID instead."
        elif "missing_scope" in slack_error:
            error_message = f"Missing permissions: {slack_error}. Make sure your bot has the 'chat:write' scope."
        
        return TestMessageResponse(
            success=False,
            error=f"Slack API error: {error_message}"
        )
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return TestMessageResponse(
            success=False,
            error=f"Validation error: {str(e)}. Check your message parameters."
        )
    except Exception as e:
        logger.error(f"Error sending test message: {e}", exc_info=True)
        
        # Check if it's a Pydantic validation error
        if "validation error" in str(e).lower():
            return TestMessageResponse(
                success=False,
                error=f"Message validation failed: {str(e)}. This might be due to missing required fields or incorrect data types."
            )
        
        return TestMessageResponse(
            success=False,
            error=f"Internal server error: {str(e)}"
        )

@router.get("/message-types")
async def get_supported_message_types() -> Dict[str, Any]:
    """
    Get a list of supported message types and their required/optional parameters.
    
    Returns:
        Dictionary containing supported message types and their parameters
    """
    return {
        "supported_types": {
            "pull_request": {
                "description": "Pull request notifications (opened, closed, merged, etc.)",
                "required": ["pr_number", "pr_title", "pr_url", "pr_action"],
                "optional": ["repository", "user"]
            },
            "pull_request_review": {
                "description": "Pull request review notifications",
                "required": ["pr_number", "pr_title", "pr_url", "review_state"],
                "optional": ["review_comment", "repository", "user"]
            },
            "pull_request_comment": {
                "description": "Pull request comment notifications",
                "required": ["pr_number", "pr_title", "pr_url", "comment"],
                "optional": ["repository", "user"]
            },
            "issue": {
                "description": "Issue notifications (opened, closed, etc.)",
                "required": ["issue_number", "issue_title", "issue_url", "issue_action"],
                "optional": ["repository", "user"]
            },
            "issue_comment": {
                "description": "Issue comment notifications",
                "required": ["issue_number", "issue_title", "issue_url", "comment"],
                "optional": ["repository", "user"]
            },
            "digest": {
                "description": "Daily/weekly digest of GitHub activity",
                "required": [],
                "optional": ["date"]
            },
            "stats": {
                "description": "GitHub activity statistics",
                "required": [],
                "optional": ["date"]
            }
        },
        "common_parameters": {
            "slack_access_token": "Your Slack access token (required)",
            "channel": "Slack channel ID or name (required)",
            "repository": "Repository name (default: 'test/repo')",
            "user": "GitHub username (default: 'testuser')"
        }
    }