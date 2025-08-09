"""
Webhook routes for Radar.

This module handles incoming webhooks from GitHub.
"""
import hashlib
import hmac
import logging
import time
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status, Header

from app.core.config import settings
from app.db.supabase import SupabaseManager
from app.services.slack_service import SlackService
from app.services.monitoring_service import MonitoringService, track_performance
from app.utils.validation import validate_webhook_payload, sanitize_string
from app.utils.retry import notification_retry_handler

router = APIRouter()
logger = logging.getLogger(__name__)


async def verify_github_webhook(request: Request, 
                              x_hub_signature_256: Optional[str] = Header(None),
                              x_hub_signature: Optional[str] = Header(None)):
    """
    Verify GitHub webhook signature.
    
    Args:
        request: FastAPI request
        x_hub_signature_256: GitHub webhook signature (SHA256)
        x_hub_signature: GitHub webhook signature (SHA1) - legacy
        
    Returns:
        True if signature is valid
        
    Raises:
        HTTPException: If signature is invalid
    """
    if not settings.GITHUB_WEBHOOK_SECRET:
        logger.warning("GitHub webhook secret not configured, skipping signature verification")
        return True
    
    # GitHub can send either SHA1 or SHA256 signatures
    signature = x_hub_signature_256 or x_hub_signature
    
    if not signature:
        logger.error("No GitHub webhook signature provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No signature provided"
        )
    
    # Get request body
    body = await request.body()
    
    # Determine algorithm from signature prefix
    if signature.startswith("sha256="):
        algorithm = hashlib.sha256
        prefix = "sha256="
    elif signature.startswith("sha1="):
        algorithm = hashlib.sha1
        prefix = "sha1="
    else:
        logger.error(f"Unknown signature format: {signature[:10]}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature format"
        )
    
    # Calculate expected signature
    expected_signature = prefix + hmac.new(
        settings.GITHUB_WEBHOOK_SECRET.encode(),
        body,
        algorithm
    ).hexdigest()
    
    # Compare signatures
    if not hmac.compare_digest(expected_signature, signature):
        logger.error("Invalid GitHub webhook signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature"
        )
    
    return True


@router.post("/github")
@track_performance("webhook_processing")
async def github_webhook(request: Request, verified: bool = Depends(verify_github_webhook)):
    """
    Handle GitHub webhook events.
    
    Args:
        request: FastAPI request
        verified: Whether the webhook signature is verified
        
    Returns:
        Success message
    """
    start_time = time.time()
    event_type = None
    repository_name = None
    
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
        
        # Extract repository info for monitoring
        repository_name = body.get("repository", {}).get("full_name", "unknown")
        action = body.get("action")
        
        # Validate webhook payload structure
        if not validate_webhook_payload(body):
            logger.error("Invalid webhook payload structure")
            MonitoringService.track_webhook_received(
                event_type=event_type,
                repository=repository_name,
                action=action,
                success=False,
                error="Invalid payload structure"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid webhook payload structure"
            )
        
        # Sanitize and validate repository name
        repo_name = body.get("repository", {}).get("full_name", "")
        if not repo_name or len(repo_name) > 200:
            logger.error(f"Invalid repository name: {repo_name}")
            MonitoringService.track_webhook_received(
                event_type=event_type,
                repository=repository_name,
                action=action,
                success=False,
                error="Invalid repository name"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid repository name"
            )
        
        # Store event in database
        event_data = {
            "event_type": sanitize_string(event_type, max_length=50),
            "action": sanitize_string(body.get("action", ""), max_length=50),
            "repository_id": str(body.get("repository", {}).get("id")),
            "repository_name": sanitize_string(repo_name, max_length=200),
            "sender_id": str(body.get("sender", {}).get("id")),
            "sender_login": sanitize_string(body.get("sender", {}).get("login", ""), max_length=100),
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
        
        # Track successful webhook processing
        processing_time = time.time() - start_time
        MonitoringService.track_webhook_received(
            event_type=event_type,
            repository=repository_name,
            action=action,
            processing_time=processing_time,
            success=True
        )
        
        return {"message": "Webhook received successfully"}
        
    except Exception as e:
        logger.error(f"Error processing GitHub webhook: {e}", exc_info=True)
        
        # Track failed webhook processing
        processing_time = time.time() - start_time
        MonitoringService.track_webhook_received(
            event_type=event_type or "unknown",
            repository=repository_name or "unknown",
            action=None,
            processing_time=processing_time,
            success=False,
            error=str(e)
        )
        
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
        elif event_type == "discussion":
            await process_discussion_event(payload, users, event_id)
        elif event_type == "discussion_comment":
            await process_discussion_comment_event(payload, users, event_id)
        elif event_type == "push":
            await process_push_event(payload, users, event_id)
        else:
            logger.info(f"Unhandled GitHub event type: {event_type}")
        
        # Mark event as processed
        await SupabaseManager.update_event(event_id, {"processed": True})
        
    except Exception as e:
        logger.error(f"Error processing GitHub event: {e}", exc_info=True)
        
        # Create failed webhook event for retry
        try:
            repository = payload.get("repository", {})
            sender = payload.get("sender", {})
            action = payload.get("action")
            
            await SupabaseManager.create_failed_webhook_event(
                event_id=event_id,
                event_type=event_type,
                action=action,
                repository_name=repository.get("full_name", "unknown"),
                repository_id=str(repository.get("id", "")),
                sender_login=sender.get("login", "unknown"),
                payload=payload,
                error_message=str(e),
                error_details={"exception_type": type(e).__name__}
            )
            
            # Track failed event creation
            MonitoringService.track_event(
                "webhook_failed_event_created",
                properties={
                    "event_type": event_type,
                    "repository": repository.get("full_name", "unknown"),
                    "error": str(e)
                }
            )
            
        except Exception as retry_error:
            logger.error(f"Failed to create failed webhook event: {retry_error}", exc_info=True)


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

        from app.services.notification_service import NotificationService
        from app.models.slack import PullRequestMessage
        from app.services.openai_analyzer_service import OpenAIAnalyzerService
        
        for user in users:
            # Check if user should be notified
            should_notify, matched_keywords, match_details = await NotificationService.process_pull_request_event(
                user["id"], payload, event_id
            )
            
            if not should_notify:
                continue
            
            slack_service = SlackService(token=user["slack_access_token"])
            
            # Get user's Slack channel (DM)
            channel = f"@{user['slack_id']}"
            
            # Add keyword match information if applicable
            keyword_text = ""
            if matched_keywords:
                keyword_text = f"\n\n*Matched keywords:* {', '.join(matched_keywords)}"
                
            message = PullRequestMessage(
                channel=channel,
                pull_request_number=pr.get("number"),
                pull_request_title=pr.get("title"),
                pull_request_url=pr.get("html_url"),
                repository=repository.get("full_name"),
                action=action,
                user=sender.get("login"),
                keyword_text=keyword_text,
                blocks=[]  # Will be filled by create_pull_request_message
            )
            message = slack_service.create_pull_request_message(message)
            
            # Handle edit vs create actions
            if action == "edited":
                # Find existing notification to update
                existing_notification = await SupabaseManager.find_notification_by_github_entity(
                    user["id"], "pull_request", str(pr.get("id"))
                )
                
                if existing_notification and existing_notification.get("message_ts"):
                    # Update existing Slack message
                    response = await slack_service.update_message(
                        channel, existing_notification["message_ts"], message
                    )
                    
                    if response:
                        logger.info(f"Updated PR message for user {user['id']} for PR {pr.get('number')}")
                        # Track successful message update
                        MonitoringService.track_notification_sent(
                            user_id=user["id"],
                            notification_type="pull_request_updated",
                            repository=repository.get("full_name"),
                            success=True,
                            matched_keywords=matched_keywords
                        )
                    else:
                        logger.error(f"Failed to update PR message for user {user['id']} for PR {pr.get('number')}")
                else:
                    # No existing message found, send new one
                    notification_id = f"pr_{pr.get('id')}_{user['id']}_{event_id}"
                    response = await notification_retry_handler.send_notification_with_retry(
                        slack_service.send_message,
                        notification_id,
                        message,
                        max_attempts=3
                    )
                    
                    if response:
                        notification_data = {
                            "user_id": user["id"],
                            "event_id": event_id,
                            "message_type": "pull_request",
                            "channel": channel,
                            "message_ts": response.get("ts"),
                            "payload": {
                                "pull_request_id": pr.get("id"),
                                "pull_request_number": pr.get("number"),
                                "action": action
                            }
                        }
                        await SupabaseManager.create_notification(notification_data)
            else:
                # Send notification with retry
                notification_id = f"pr_{pr.get('id')}_{user['id']}_{event_id}"
                response = await notification_retry_handler.send_notification_with_retry(
                    slack_service.send_message,
                    notification_id,
                    message,
                    max_attempts=3
                )
                
                if response:
                    notification_data = {
                        "user_id": user["id"],
                        "event_id": event_id,
                        "message_type": "pull_request",
                        "channel": channel,
                        "message_ts": response.get("ts"),
                        "payload": {
                            "pull_request_id": pr.get("id"),
                            "pull_request_number": pr.get("number"),
                            "action": action
                        }
                    }
                    await SupabaseManager.create_notification(notification_data)
                    
                    # Track successful notification delivery
                    MonitoringService.track_notification_sent(
                        user_id=user["id"],
                        notification_type="pull_request",
                        repository=repository.get("full_name"),
                        success=True,
                        matched_keywords=matched_keywords
                    )
                else:
                    logger.error(f"Failed to send PR notification to user {user['id']} for PR {pr.get('number')}")
                    # Track failed notification delivery
                    MonitoringService.track_notification_sent(
                        user_id=user["id"],
                        notification_type="pull_request",
                        repository=repository.get("full_name"),
                        success=False,
                        error="Failed to send notification"
                    )
            
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
        
        from app.services.notification_service import NotificationService
        from app.models.slack import PullRequestReviewMessage
        
        for user in users:
            # Check if user should be notified
            should_notify = await NotificationService.process_pull_request_review_event(
                payload, user["id"], event_id
            )
            
            if not should_notify:
                continue
            
            slack_service = SlackService(token=user["slack_access_token"])
            
            # Get user's Slack channel (DM)
            channel = f"@{user['slack_id']}"
            
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
            message = slack_service.create_pull_request_review_message(message)
            
            # Send notification with retry
            notification_id = f"review_{review.get('id')}_{user['id']}_{event_id}"
            response = await notification_retry_handler.send_notification_with_retry(
                slack_service.send_message,
                notification_id,
                message,
                max_attempts=3
            )
            
            if response:
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
            else:
                logger.error(f"Failed to send review notification to user {user['id']} for PR {pr.get('number')}")
            
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
        
        from app.services.notification_service import NotificationService
        from app.models.slack import PullRequestCommentMessage
        
        # Create message for each user
        for user in users:
            # Check if user should be notified
            should_notify = await NotificationService.process_pull_request_comment_event(
                payload, user["id"], event_id
            )
            
            if not should_notify:
                continue
            
            slack_service = SlackService(token=user["slack_access_token"])
            
            # Get user's Slack channel (DM)
            channel = f"@{user['slack_id']}"
            
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
            message = slack_service.create_pull_request_comment_message(message)
            response = await slack_service.send_message(message)

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
        if action not in ["opened", "closed", "reopened", "assigned", "edited"]:
            return
        
        from app.services.notification_service import NotificationService
        from app.models.slack import IssueMessage
        
        for user in users:
            # Check if user should be notified
            should_notify, matched_keywords, match_details = await NotificationService.process_issue_event(
                user["id"], payload, event_id
            )
            
            if not should_notify:
                continue
            
            slack_service = SlackService(token=user["slack_access_token"])
            
            # Get user's Slack channel (DM)
            channel = f"@{user['slack_id']}"
            
            # Add keyword match information if applicable
            keyword_text = ""
            if matched_keywords:
                keyword_text = f"\\n\\n*Matched keywords:* {', '.join(matched_keywords)}"
            
            message = IssueMessage(
                channel=channel,
                issue_number=issue.get("number"),
                issue_title=issue.get("title"),
                issue_url=issue.get("html_url"),
                repository=repository.get("full_name"),
                action=action,
                user=sender.get("login"),
                keyword_text=keyword_text,
                blocks=[]  # Will be filled by create_issue_message
            )
            message = slack_service.create_issue_message(message)
            
            # Handle edit vs create actions
            if action == "edited":
                # Find existing notification to update
                existing_notification = await SupabaseManager.find_notification_by_github_entity(
                    user["id"], "issue", str(issue.get("id"))
                )
                
                if existing_notification and existing_notification.get("message_ts"):
                    # Update existing Slack message
                    response = await slack_service.update_message(
                        channel, existing_notification["message_ts"], message
                    )
                    
                    if response:
                        logger.info(f"Updated issue message for user {user['id']} for issue {issue.get('number')}")
                        # Track successful message update
                        MonitoringService.track_notification_sent(
                            user_id=user["id"],
                            notification_type="issue_updated",
                            repository=repository.get("full_name"),
                            success=True,
                            matched_keywords=matched_keywords
                        )
                    else:
                        logger.error(f"Failed to update issue message for user {user['id']} for issue {issue.get('number')}")
                else:
                    # No existing message found, send new one
                    response = await slack_service.send_message(message)
                    
                    if response:
                        notification_data = {
                            "user_id": user["id"],
                            "event_id": event_id,
                            "message_type": "issue",
                            "channel": channel,
                            "message_ts": response.get("ts"),
                            "payload": {
                                "issue_id": issue.get("id"),
                                "issue_number": issue.get("number"),
                                "action": action
                            }
                        }
                        await SupabaseManager.create_notification(notification_data)
            else:
                # Create new message
                response = await slack_service.send_message(message)
                
                if response:
                    notification_data = {
                        "user_id": user["id"],
                        "event_id": event_id,
                        "message_type": "issue",
                        "channel": channel,
                        "message_ts": response.get("ts"),
                        "payload": {
                            "issue_id": issue.get("id"),
                            "issue_number": issue.get("number"),
                            "action": action
                        }
                    }
                    await SupabaseManager.create_notification(notification_data)
                    
                    # Track successful notification delivery
                    MonitoringService.track_notification_sent(
                        user_id=user["id"],
                        notification_type="issue",
                        repository=repository.get("full_name"),
                        success=True,
                        matched_keywords=matched_keywords
                    )
                else:
                    logger.error(f"Failed to send issue notification to user {user['id']} for issue {issue.get('number')}")
                    # Track failed notification delivery
                    MonitoringService.track_notification_sent(
                        user_id=user["id"],
                        notification_type="issue",
                        repository=repository.get("full_name"),
                        success=False,
                        error="Failed to send notification"
                    )
            
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
        if action not in ["created", "edited"]:
            return
        
        from app.services.notification_service import NotificationService
        from app.models.slack import IssueCommentMessage
        
        for user in users:
            # Check if user should be notified
            should_notify, matched_keywords, match_details = await NotificationService.process_issue_comment_event(
                user["id"], payload, event_id
            )
            
            if not should_notify:
                continue
            
            slack_service = SlackService(token=user["slack_access_token"])
            
            # Get user's Slack channel (DM)
            channel = f"@{user['slack_id']}"
            
            # Add keyword match information if applicable
            keyword_text = ""
            if matched_keywords:
                keyword_text = f"\\n\\n*Matched keywords:* {', '.join(matched_keywords)}"
            
            message = IssueCommentMessage(
                channel=channel,
                issue_number=issue.get("number"),
                issue_title=issue.get("title"),
                issue_url=issue.get("html_url"),
                repository=repository.get("full_name"),
                comment=comment.get("body"),
                comment_url=comment.get("html_url"),
                user=sender.get("login"),
                keyword_text=keyword_text,
                blocks=[]  # Will be filled by create_issue_comment_message
            )
            message = slack_service.create_issue_comment_message(message)
            
            # Handle edit vs create actions
            if action == "edited":
                # Find existing notification to update
                existing_notification = await SupabaseManager.find_notification_by_github_entity(
                    user["id"], "issue_comment", str(comment.get("id"))
                )
                
                if existing_notification and existing_notification.get("message_ts"):
                    # Update existing Slack message
                    response = await slack_service.update_message(
                        channel, existing_notification["message_ts"], message
                    )
                    
                    if response:
                        logger.info(f"Updated issue comment message for user {user['id']} for comment {comment.get('id')}")
                        # Track successful message update
                        MonitoringService.track_notification_sent(
                            user_id=user["id"],
                            notification_type="issue_comment_updated",
                            repository=repository.get("full_name"),
                            success=True,
                            matched_keywords=matched_keywords
                        )
                    else:
                        logger.error(f"Failed to update issue comment message for user {user['id']} for comment {comment.get('id')}")
                else:
                    # No existing message found, send new one
                    response = await slack_service.send_message(message)
                    
                    if response:
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
            else:
                # Create new message
                response = await slack_service.send_message(message)
                
                if response:
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
                    
                    # Track successful notification delivery
                    MonitoringService.track_notification_sent(
                        user_id=user["id"],
                        notification_type="issue_comment",
                        repository=repository.get("full_name"),
                        success=True,
                        matched_keywords=matched_keywords
                    )
                else:
                    logger.error(f"Failed to send issue comment notification to user {user['id']} for issue {issue.get('number')}")
                    # Track failed notification delivery
                    MonitoringService.track_notification_sent(
                        user_id=user["id"],
                        notification_type="issue_comment",
                        repository=repository.get("full_name"),
                        success=False,
                        error="Failed to send notification"
                    )
            
    except Exception as e:
        logger.error(f"Error processing issue comment event: {e}", exc_info=True)


async def process_discussion_event(payload: Dict[str, Any], users: list, event_id: str):
    """
    Process discussion event.
    
    Args:
        payload: Event payload
        users: List of users watching the repository
        event_id: Event ID in database
    """
    try:
        action = payload.get("action")
        discussion = payload.get("discussion", {})
        repository = payload.get("repository", {})
        sender = payload.get("sender", {})
        
        # Skip if action is not interesting
        if action not in ["created", "answered", "locked", "unlocked", "category_changed"]:
            return
        
        from app.services.notification_service import NotificationService
        from app.models.slack import DiscussionMessage
        
        for user in users:
            # Check if user should be notified
            should_notify, matched_keywords, match_details = await NotificationService.process_discussion_event(
                user["id"], payload, event_id
            )
            
            if not should_notify:
                continue
            
            slack_service = SlackService(token=user["slack_access_token"])
            
            # Get user's Slack channel (DM)
            channel = f"@{user['slack_id']}"
            
            # Add keyword match information if applicable
            keyword_text = ""
            if matched_keywords:
                keyword_text = f"\\n\\n*Matched keywords:* {', '.join(matched_keywords)}"
                
            message = DiscussionMessage(
                channel=channel,
                discussion_number=discussion.get("number"),
                discussion_title=discussion.get("title"),
                discussion_url=discussion.get("html_url"),
                repository=repository.get("full_name"),
                action=action,
                category=discussion.get("category", {}).get("name") if discussion.get("category") else None,
                user=sender.get("login"),
                keyword_text=keyword_text,
                blocks=[]  # Will be filled by create_discussion_message
            )
            message = slack_service.create_discussion_message(message)
            
            # Send notification with retry
            notification_id = f"discussion_{discussion.get('id')}_{user['id']}_{event_id}"
            response = await notification_retry_handler.send_notification_with_retry(
                slack_service.send_message,
                notification_id,
                message,
                max_attempts=3
            )
            
            if response:
                notification_data = {
                    "user_id": user["id"],
                    "event_id": event_id,
                    "message_type": "discussion",
                    "channel": channel,
                    "message_ts": response.get("ts"),
                    "payload": {
                        "discussion_id": discussion.get("id"),
                        "discussion_number": discussion.get("number"),
                        "action": action
                    }
                }
                await SupabaseManager.create_notification(notification_data)
                
                # Track successful notification delivery
                MonitoringService.track_notification_sent(
                    user_id=user["id"],
                    notification_type="discussion",
                    repository=repository.get("full_name"),
                    success=True,
                    matched_keywords=matched_keywords
                )
            else:
                logger.error(f"Failed to send discussion notification to user {user['id']} for discussion {discussion.get('number')}")
                # Track failed notification delivery
                MonitoringService.track_notification_sent(
                    user_id=user["id"],
                    notification_type="discussion",
                    repository=repository.get("full_name"),
                    success=False,
                    error="Failed to send notification"
                )
            
    except Exception as e:
        logger.error(f"Error processing discussion event: {e}", exc_info=True)


async def process_discussion_comment_event(payload: Dict[str, Any], users: list, event_id: str):
    """
    Process discussion comment event.
    
    Args:
        payload: Event payload
        users: List of users watching the repository
        event_id: Event ID in database
    """
    try:
        action = payload.get("action")
        comment = payload.get("comment", {})
        discussion = payload.get("discussion", {})
        repository = payload.get("repository", {})
        sender = payload.get("sender", {})
        
        # Skip if action is not interesting
        if action not in ["created", "edited"]:
            return
        
        from app.services.notification_service import NotificationService
        from app.models.slack import DiscussionCommentMessage
        
        for user in users:
            # Check if user should be notified
            should_notify = await NotificationService.process_discussion_comment_event(
                user["id"], payload, event_id
            )
            
            if not should_notify:
                continue
            
            slack_service = SlackService(token=user["slack_access_token"])
            
            # Get user's Slack channel (DM)
            channel = f"@{user['slack_id']}"
            
            message = DiscussionCommentMessage(
                channel=channel,
                discussion_number=discussion.get("number"),
                discussion_title=discussion.get("title"),
                discussion_url=discussion.get("html_url"),
                repository=repository.get("full_name"),
                comment=comment.get("body"),
                comment_url=comment.get("html_url"),
                user=sender.get("login"),
                blocks=[]  # Will be filled by create_discussion_comment_message
            )
            message = slack_service.create_discussion_comment_message(message)
            
            # Send notification with retry
            notification_id = f"discussion_comment_{comment.get('id')}_{user['id']}_{event_id}"
            response = await notification_retry_handler.send_notification_with_retry(
                slack_service.send_message,
                notification_id,
                message,
                max_attempts=3
            )
            
            if response:
                notification_data = {
                    "user_id": user["id"],
                    "event_id": event_id,
                    "message_type": "discussion_comment",
                    "channel": channel,
                    "message_ts": response.get("ts"),
                    "payload": {
                        "discussion_id": discussion.get("id"),
                        "discussion_number": discussion.get("number"),
                        "comment_id": comment.get("id"),
                    }
                }
                await SupabaseManager.create_notification(notification_data)
                
                # Track successful notification delivery
                MonitoringService.track_notification_sent(
                    user_id=user["id"],
                    notification_type="discussion_comment",
                    repository=repository.get("full_name"),
                    success=True
                )
            else:
                logger.error(f"Failed to send discussion comment notification to user {user['id']} for discussion {discussion.get('number')}")
                # Track failed notification delivery
                MonitoringService.track_notification_sent(
                    user_id=user["id"],
                    notification_type="discussion_comment",
                    repository=repository.get("full_name"),
                    success=False,
                    error="Failed to send notification"
                )
            
    except Exception as e:
        logger.error(f"Error processing discussion comment event: {e}", exc_info=True)


async def process_push_event(payload: Dict[str, Any], users: list, event_id: str):
    """
    Process push event.
    
    Args:
        payload: Event payload
        users: List of users watching the repository
        event_id: Event ID in database
    """
    pass
