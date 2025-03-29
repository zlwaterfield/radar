"""
Webhook routes for Radar.

This module handles incoming webhooks from GitHub.
"""
import hashlib
import hmac
import logging
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status, Header

from app.core.config import settings
from app.db.supabase import SupabaseManager
from app.services.slack_service import SlackService

router = APIRouter()
logger = logging.getLogger(__name__)


async def verify_github_webhook(request: Request, x_hub_signature_256: Optional[str] = Header(None)):
    """
    Verify GitHub webhook signature.
    
    Args:
        request: FastAPI request
        x_hub_signature_256: GitHub webhook signature
        
    Returns:
        True if signature is valid
        
    Raises:
        HTTPException: If signature is invalid
    """
    if not settings.GITHUB_WEBHOOK_SECRET:
        logger.warning("GitHub webhook secret not configured, skipping signature verification")
        return True
    
    if not x_hub_signature_256:
        logger.error("No GitHub webhook signature provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No signature provided"
        )
    
    # Get request body
    body = await request.body()
    
    # Calculate expected signature
    expected_signature = "sha256=" + hmac.new(
        settings.GITHUB_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    
    # Compare signatures
    if not hmac.compare_digest(expected_signature, x_hub_signature_256):
        logger.error("Invalid GitHub webhook signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature"
        )
    
    return True


@router.post("/github")
async def github_webhook(request: Request, verified: bool = Depends(verify_github_webhook)):
    """
    Handle GitHub webhook events.
    
    Args:
        request: FastAPI request
        verified: Whether the webhook signature is verified
        
    Returns:
        Success message
    """
    try:
        # Get event type from header
        event_type = request.headers.get("X-GitHub-Event")
        if not event_type:
            logger.error("No GitHub event type provided")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No event type provided"
            )
        
        # Get request body
        body = await request.json()
        
        # Store event in database
        event_data = {
            "event_type": event_type,
            "action": body.get("action"),
            "repository_id": str(body.get("repository", {}).get("id")),
            "repository_name": body.get("repository", {}).get("full_name"),
            "sender_id": str(body.get("sender", {}).get("id")),
            "sender_login": body.get("sender", {}).get("login"),
            "payload": body,
        }
        
        # Store event in database
        event = await SupabaseManager.create_event(event_data)
        
        if not event:
            logger.error("Failed to store GitHub event")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store event"
            )
        
        # Process event asynchronously
        # In a production environment, you would use a task queue like Celery
        # For simplicity, we'll process it directly here
        await process_github_event(event_type, body, event["id"])
        
        return {"message": "Webhook received successfully"}
        
    except Exception as e:
        logger.error(f"Error processing GitHub webhook: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing webhook: {str(e)}"
        )


async def process_github_event(event_type: str, payload: Dict[str, Any], event_id: str):
    """
    Process GitHub event.
    
    Args:
        event_type: GitHub event type
        payload: Event payload
        event_id: Event ID in database
    """
    try:
        # Get repository
        repository = payload.get("repository", {})
        repo_id = str(repository.get("id"))
        repo_name = repository.get("full_name")
        
        # Find users who are watching this repository
        users = await SupabaseManager.get_users_by_repository(repo_id)
        
        if not users:
            logger.info(f"No users watching repository {repo_name}")
            return
        
        # Process event based on type
        if event_type == "pull_request":
            await process_pull_request_event(payload, users, event_id)
        elif event_type == "pull_request_review":
            await process_pull_request_review_event(payload, users, event_id)
        elif event_type == "pull_request_review_comment":
            await process_pull_request_review_comment_event(payload, users, event_id)
        elif event_type == "issue":
            await process_issue_event(payload, users, event_id)
        elif event_type == "issue_comment":
            await process_issue_comment_event(payload, users, event_id)
        elif event_type == "push":
            await process_push_event(payload, users, event_id)
        else:
            logger.info(f"Unhandled GitHub event type: {event_type}")
        
        # Mark event as processed
        await SupabaseManager.update_event(event_id, {"processed": True})
        
    except Exception as e:
        logger.error(f"Error processing GitHub event: {e}", exc_info=True)


async def process_pull_request_event(payload: Dict[str, Any], users: list, event_id: str):
    """
    Process pull request event.
    
    Args:
        payload: Event payload
        users: List of users watching the repository
        event_id: Event ID in database
    """
    try:
        action = payload.get("action")
        pr = payload.get("pull_request", {})
        repository = payload.get("repository", {})
        sender = payload.get("sender", {})

        # Skip if action is not interesting
        if action not in ["opened", "closed", "reopened", "review_requested", "review_request_removed", "assigned", "unassigned"]:
            return
        
        # Import notification service
        from app.services.notification_service import NotificationService, NotificationTrigger
        
        # Import OpenAI analyzer service
        from app.services.openai_analyzer_service import OpenAIAnalyzerService
        
        # Determine notification trigger based on action
        trigger = None
        if action == "opened" or action == "reopened":
            trigger = NotificationTrigger.REOPENED
        elif action == "closed" and pr.get("merged"):
            trigger = NotificationTrigger.MERGED
        elif action == "closed" and not pr.get("merged"):
            trigger = NotificationTrigger.CLOSED
        elif action == "review_requested":
            trigger = NotificationTrigger.REVIEW_REQUESTED
        elif action == "review_request_removed":
            trigger = NotificationTrigger.REVIEW_REQUEST_REMOVED
        elif action == "assigned":
            trigger = NotificationTrigger.ASSIGNED
        elif action == "unassigned":
            trigger = NotificationTrigger.UNASSIGNED
        
        if not trigger:
            return
        
        # Extract content for AI analysis
        pr_content = f"Title: {pr.get('title', '')}\nDescription: {pr.get('body', '')}"
        
        # Create message for each user
        for user in users:
            # Check if user should be notified based on notification preferences
            should_notify_preferences = await NotificationService.should_notify(
                user["id"], 
                pr, 
                trigger, 
                actor_id=sender.get("id")
            )
            
            # Check if user should be notified based on keyword analysis
            should_notify_keywords, matched_keywords, match_details = await OpenAIAnalyzerService.analyze_content(
                pr_content, user["id"]
            )
            
            # Determine if notification should be sent
            should_notify = should_notify_preferences or should_notify_keywords
            
            if not should_notify:
                continue
            
            # Create Slack message
            slack_service = SlackService(token=user["slack_access_token"])
            
            # Get user's Slack channel (DM)
            channel = f"@{user['slack_id']}"
            
            # Create message
            from app.models.slack import PullRequestMessage
            
            # Add keyword match information if applicable
            keyword_text = ""
            if matched_keywords:
                keyword_text = f"\n\n*Matched keywords:* {', '.join(matched_keywords)}"
                
            # Use keyword_match color if notification is due to keywords
            color_key = "keyword_match" if should_notify_keywords and not should_notify_preferences else action
                
            message = PullRequestMessage(
                channel=channel,
                pull_request_number=pr.get("number"),
                pull_request_title=pr.get("title"),
                pull_request_url=pr.get("html_url"),
                repository=repository.get("full_name"),
                action=color_key,
                user=sender.get("login"),  # GitHub username
                blocks=[]  # Will be filled by create_pull_request_message
            )
            
            # Format message
            message = slack_service.create_pull_request_message(message)
            
            # Add keyword match information to the message if applicable
            if matched_keywords:
                # Add a section for keyword matches
                keyword_section = {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Matched keywords:* {', '.join(matched_keywords)}"
                    }
                }
                
                # Insert before the context block (which is the last block)
                if isinstance(message.blocks, list) and len(message.blocks) > 0:
                    if isinstance(message.blocks[0], dict):
                        message.blocks.insert(-1, keyword_section)
                    else:
                        # Convert to dict if needed
                        from app.models.slack import SectionBlock, TextObject
                        message.blocks.insert(-1, SectionBlock(
                            text=TextObject(
                                type="mrkdwn",
                                text=f"*Matched keywords:* {', '.join(matched_keywords)}"
                            )
                        ))
                
                # Also add to attachments if present
                if message.attachments and len(message.attachments) > 0:
                    if "blocks" in message.attachments[0]:
                        message.attachments[0]["blocks"].insert(-1, keyword_section)
            
            # Send message
            response = await slack_service.send_message(message)
            
            # Store notification in database
            notification_data = {
                "user_id": user["id"],
                "event_id": event_id,
                "message_type": "pull_request",
                "channel": channel,
                "message_ts": response.get("ts"),
                "payload": {
                    "pull_request_id": pr.get("id"),
                    "pull_request_number": pr.get("number"),
                    "action": action,
                    "matched_keywords": matched_keywords if matched_keywords else None,
                    "match_details": match_details if match_details else None
                }
            }
            
            await SupabaseManager.create_notification(notification_data)
            
    except Exception as e:
        logger.error(f"Error processing pull request event: {e}", exc_info=True)


async def process_pull_request_review_event(payload: Dict[str, Any], users: list, event_id: str):
    """
    Process pull request review event.
    
    Args:
        payload: Event payload
        users: List of users watching the repository
        event_id: Event ID in database
    """
    try:
        action = payload.get("action")
        review = payload.get("review", {})
        pr = payload.get("pull_request", {})
        repository = payload.get("repository", {})
        sender = payload.get("sender", {})
        
        # Skip if action is not interesting
        if action != "submitted":
            return
        
        # Import notification service
        from app.services.notification_service import NotificationService
        
        # Create message for each user
        for user in users:
            # Check if user should be notified
            should_notify = await NotificationService.process_pull_request_review_event(
                payload, user["id"], event_id
            )
            
            if not should_notify:
                continue
            
            # Create Slack message
            slack_service = SlackService(token=user["slack_access_token"])
            
            # Get user's Slack channel (DM)
            channel = f"@{user['slack_id']}"
            
            # Create message
            from app.models.slack import PullRequestReviewMessage
            
            message = PullRequestReviewMessage(
                channel=channel,
                pull_request_number=pr.get("number"),
                pull_request_title=pr.get("title"),
                pull_request_url=pr.get("html_url"),
                repository=repository.get("full_name"),
                review_state=review.get("state"),
                review_comment=review.get("body"),
                user=sender.get("login"),
                blocks=[]  # Will be filled by create_pull_request_review_message
            )
            
            # Format message
            message = slack_service.create_pull_request_review_message(message)
            
            # Send message
            response = await slack_service.send_message(message)
            
            # Store notification in database
            notification_data = {
                "user_id": user["id"],
                "event_id": event_id,
                "message_type": "pull_request_review",
                "channel": channel,
                "message_ts": response.get("ts"),
                "payload": {
                    "pull_request_id": pr.get("id"),
                    "pull_request_number": pr.get("number"),
                    "review_id": review.get("id"),
                    "review_state": review.get("state"),
                }
            }
            
            await SupabaseManager.create_notification(notification_data)
            
    except Exception as e:
        logger.error(f"Error processing pull request review event: {e}", exc_info=True)


async def process_pull_request_review_comment_event(payload: Dict[str, Any], users: list, event_id: str):
    """
    Process pull request review comment event.
    
    Args:
        payload: Event payload
        users: List of users watching the repository
        event_id: Event ID in database
    """
    try:
        action = payload.get("action")
        comment = payload.get("comment", {})
        pr = payload.get("pull_request", {})
        repository = payload.get("repository", {})
        sender = payload.get("sender", {})
        
        # Skip if action is not interesting
        if action != "created":
            return
        
        # Import notification service
        from app.services.notification_service import NotificationService
        
        # Create message for each user
        for user in users:
            # Check if user should be notified
            should_notify = await NotificationService.process_pull_request_comment_event(
                payload, user["id"], event_id
            )
            
            if not should_notify:
                continue
            
            # Create Slack message
            slack_service = SlackService(token=user["slack_access_token"])
            
            # Get user's Slack channel (DM)
            channel = f"@{user['slack_id']}"
            
            # Create message
            from app.models.slack import PullRequestCommentMessage
            
            message = PullRequestCommentMessage(
                channel=channel,
                pull_request_number=pr.get("number"),
                pull_request_title=pr.get("title"),
                pull_request_url=pr.get("html_url"),
                repository=repository.get("full_name"),
                comment=comment.get("body"),
                comment_url=comment.get("html_url"),
                user=sender.get("login"),
                blocks=[]  # Will be filled by create_pull_request_comment_message
            )
            
            # Format message
            message = slack_service.create_pull_request_comment_message(message)
            
            # Send message
            response = await slack_service.send_message(message)
            
            # Store notification in database
            notification_data = {
                "user_id": user["id"],
                "event_id": event_id,
                "message_type": "pull_request_comment",
                "channel": channel,
                "message_ts": response.get("ts"),
                "payload": {
                    "pull_request_id": pr.get("id"),
                    "pull_request_number": pr.get("number"),
                    "comment_id": comment.get("id"),
                }
            }
            
            await SupabaseManager.create_notification(notification_data)
            
    except Exception as e:
        logger.error(f"Error processing pull request review comment event: {e}", exc_info=True)


async def process_issue_event(payload: Dict[str, Any], users: list, event_id: str):
    """
    Process issue event.
    
    Args:
        payload: Event payload
        users: List of users watching the repository
        event_id: Event ID in database
    """
    try:
        action = payload.get("action")
        issue = payload.get("issue", {})
        repository = payload.get("repository", {})
        sender = payload.get("sender", {})
        
        # Skip if action is not interesting
        if action not in ["opened", "closed", "reopened", "assigned"]:
            return
        
        # Create message for each user
        for user in users:
            # Check user settings
            settings = await SupabaseManager.get_user_settings(user["id"])
            if not settings:
                continue
            
            # Check if user wants to receive this notification
            notification_key = f"issue_{action}"
            if not settings.get("notification_preferences", {}).get(notification_key, True):
                continue
            
            # Create Slack message
            slack_service = SlackService(token=user["slack_access_token"])
            
            # Get user's Slack channel (DM)
            channel = f"@{user['slack_id']}"
            
            # Create message
            from app.models.slack import IssueMessage
            
            message = IssueMessage(
                channel=channel,
                issue_number=issue.get("number"),
                issue_title=issue.get("title"),
                issue_url=issue.get("html_url"),
                repository=repository.get("full_name"),
                action=action,
                user=sender.get("login"),
                blocks=[]  # Will be filled by create_issue_message
            )
            
            # Format message
            message = slack_service.create_issue_message(message)
            
            # Send message
            response = await slack_service.send_message(message)
            
            # Store notification in database
            notification_data = {
                "user_id": user["id"],
                "event_id": event_id,
                "message_type": "issue",
                "channel": channel,
                "message_ts": response.get("ts"),
                "payload": {
                    "issue_id": issue.get("id"),
                    "issue_number": issue.get("number"),
                    "action": action,
                }
            }
            
            await SupabaseManager.create_notification(notification_data)
            
    except Exception as e:
        logger.error(f"Error processing issue event: {e}", exc_info=True)


async def process_issue_comment_event(payload: Dict[str, Any], users: list, event_id: str):
    """
    Process issue comment event.
    
    Args:
        payload: Event payload
        users: List of users watching the repository
        event_id: Event ID in database
    """
    try:
        action = payload.get("action")
        issue = payload.get("issue", {})
        comment = payload.get("comment", {})
        repository = payload.get("repository", {})
        sender = payload.get("sender", {})
        
        # Skip if action is not interesting
        if action != "created":
            return
        
        # Import notification service
        from app.services.notification_service import NotificationService
        
        # Create message for each user
        for user in users:
            # Check if user should be notified
            should_notify = await NotificationService.process_issue_comment_event(
                user["id"], payload, event_id
            )
            
            if not should_notify:
                continue
            
            # Create Slack message
            slack_service = SlackService(token=user["slack_access_token"])
            
            # Get user's Slack channel (DM)
            channel = f"@{user['slack_id']}"
            
            # Create message
            from app.models.slack import IssueCommentMessage
            
            message = IssueCommentMessage(
                channel=channel,
                issue_number=issue.get("number"),
                issue_title=issue.get("title"),
                issue_url=issue.get("html_url"),
                repository=repository.get("full_name"),
                comment=comment.get("body"),
                comment_url=comment.get("html_url"),
                user=sender.get("login"),
                blocks=[]  # Will be filled by create_issue_comment_message
            )
            
            # Format message
            message = slack_service.create_issue_comment_message(message)
            
            # Send message
            response = await slack_service.send_message(message)
            
            # Store notification in database
            notification_data = {
                "user_id": user["id"],
                "event_id": event_id,
                "message_type": "issue_comment",
                "channel": channel,
                "message_ts": response.get("ts"),
                "payload": {
                    "issue_id": issue.get("id"),
                    "issue_number": issue.get("number"),
                    "comment_id": comment.get("id"),
                }
            }
            
            await SupabaseManager.create_notification(notification_data)
            
    except Exception as e:
        logger.error(f"Error processing issue comment event: {e}", exc_info=True)


async def process_push_event(payload: Dict[str, Any], users: list, event_id: str):
    """
    Process push event.
    
    Args:
        payload: Event payload
        users: List of users watching the repository
        event_id: Event ID in database
    """
    # For simplicity, we'll skip implementing push event notifications
    # This would be similar to the other event handlers
    pass
