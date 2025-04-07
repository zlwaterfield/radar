"""
Slack routes for Radar.

This module handles Slack slash commands and interactive components.
"""
import logging
import json
from typing import Dict, Any, Optional

from fastapi import APIRouter, Request, Response, Form
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.db.supabase import SupabaseManager
from app.services.slack_service import slack_handler, publish_home_view

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/events")
async def slack_events(request: Request):
    """
    Handle Slack events API.
    
    Args:
        request: FastAPI request
        
    Returns:
        Response to Slack
    """
    # Print the body 
    body = await request.body()
    print(body)
    
    # Parse the body to check for event type
    try:
        body_json = json.loads(body)
        
        # Log event details for debugging
        if body_json.get("type") == "event_callback":
            event = body_json.get("event", {})
            event_type = event.get("type")
            print(f"Received Slack event: {event_type}")
            
            # Special handling for app_home_opened events
            if event_type == "app_home_opened":
                print("Processing app_home_opened event directly...")
                
                # Get user ID from the event
                user_id = event.get("user")
                
                # Use the publish_home_view function from slack_service
                await publish_home_view(user_id)
                
                # Return a success response to Slack
                return JSONResponse(content={"ok": True})
    except Exception as e:
        logger.error(f"Error parsing Slack event: {e}", exc_info=True)
    
    # Let the slack_handler process the request for other event types
    return await slack_handler.handle(request)


@router.post("/commands")
async def slack_commands(
    request: Request,
    command: str = Form(...),
    text: str = Form(""),
    user_id: str = Form(...),
    channel_id: str = Form(...),
    response_url: str = Form(...),
    trigger_id: str = Form(...),
):
    """
    Handle Slack slash commands.
    
    Args:
        request: FastAPI request
        command: Slash command
        text: Command text
        user_id: Slack user ID
        channel_id: Slack channel ID
        response_url: Response URL for delayed responses
        trigger_id: Trigger ID for modals
        
    Returns:
        Response to Slack
    """
    try:
        # Process command
        if command == "/radar":
            return await process_radar_command(text, user_id, channel_id, response_url, trigger_id)
        else:
            logger.warning(f"Unknown command: {command}")
            return JSONResponse(content={"text": f"Unknown command: {command}"})
    except Exception as e:
        logger.error(f"Error processing Slack command: {e}", exc_info=True)
        return JSONResponse(content={"text": "An error occurred while processing your command."})


@router.post("/interactivity")
async def slack_interactivity(request: Request):
    """
    Handle Slack interactive components.
    
    Args:
        request: FastAPI request
        
    Returns:
        Response to Slack
    """
    try:
        # Parse payload
        form_data = await request.form()
        payload = json.loads(form_data.get("payload", "{}"))
        
        # Get payload type
        payload_type = payload.get("type")
        
        if payload_type == "view_submission":
            return await process_view_submission(payload)
        elif payload_type == "block_actions":
            return await process_block_actions(payload)
        else:
            logger.warning(f"Unknown payload type: {payload_type}")
            return JSONResponse(content={"text": "Unsupported interaction type."})
    except Exception as e:
        logger.error(f"Error processing Slack interactivity: {e}", exc_info=True)
        return JSONResponse(content={"text": "An error occurred while processing your interaction."})


async def process_radar_command(text: str, user_id: str, channel_id: str, response_url: str, trigger_id: str):
    """
    Process /radar command.
    
    Args:
        text: Command text
        user_id: Slack user ID
        channel_id: Slack channel ID
        response_url: Response URL for delayed responses
        trigger_id: Trigger ID for modals
        
    Returns:
        Response to Slack
    """
    # Get user from database
    user = await SupabaseManager.get_user_by_slack_id(user_id)
    
    if not user:
        return JSONResponse(content={
            "text": "You need to connect your GitHub account first. Please visit our app homepage to set up your account."
        })
    
    # Parse command
    args = text.strip().split()
    
    if not args or args[0] == "help":
        return JSONResponse(content={
            "text": "Radar Commands:\n"
                   "• `/radar help` - Show this help message\n"
                   "• `/radar status` - Check your connection status\n"
                   "• `/radar settings` - Open settings page\n"
                   "• `/radar repos` - List your connected repositories\n"
                   "• `/radar connect` - Connect to GitHub\n"
                   "• `/radar disconnect` - Disconnect from GitHub"
        })
    
    elif args[0] == "status":
        # Check user status
        github_connected = bool(user.get("github_access_token"))
        
        status_text = "Your current status:\n"
        status_text += f"• Slack: Connected as <@{user_id}>\n"
        status_text += f"• GitHub: {'Connected' if github_connected else 'Not connected'}\n"
        
        if github_connected:
            # Get repositories
            repos = await SupabaseManager.get_user_repositories(user["id"])
            status_text += f"• Watching {len(repos)} repositories\n"
        
        return JSONResponse(content={"text": status_text})
    
    elif args[0] == "settings":
        # Check if user exists
        if not user:
            return JSONResponse(content={
                "text": "You need to connect your GitHub account first. Please visit our app homepage to set up your account."
            })
        
        return JSONResponse(content={
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*Radar Settings*\nManage your notification preferences and account settings in the Radar web app."
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Open Settings",
                                "emoji": True
                            },
                            "style": "primary",
                            "url": f"{settings.FRONTEND_URL}/settings/notifications"
                        }
                    ]
                }
            ]
        })
    
    elif args[0] == "repos":
        # List repositories
        if not user.get("github_access_token"):
            return JSONResponse(content={
                "text": "You need to connect your GitHub account first. Use `/radar connect` to connect."
            })
        
        # Get repositories
        repos = await SupabaseManager.get_user_repositories(user["id"])
        
        if not repos:
            return JSONResponse(content={
                "text": "You don't have any repositories connected. Use the settings page to add repositories."
            })
        
        # Format repositories
        repos_text = "Your connected repositories:\n"
        for repo in repos:
            repos_text += f"• {repo['repository_name']} ({repo['repository_url']})\n"
        
        return JSONResponse(content={"text": repos_text})
    
    elif args[0] == "connect":
        # Connect to GitHub
        if user.get("github_access_token"):
            return JSONResponse(content={
                "text": "You are already connected to GitHub. Use `/radar status` to check your status."
            })
        
        # Create GitHub auth URL
        github_url = f"{settings.API_HOST}/api/auth/github/login?user_id={user['id']}"
        
        return JSONResponse(content={
            "text": f"Click the button below to connect your GitHub account.",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "Connect your GitHub account to receive notifications."
                    },
                    "accessory": {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Connect GitHub"
                        },
                        "url": github_url,
                        "action_id": "connect_github"
                    }
                }
            ]
        })
    
    elif args[0] == "disconnect":
        # Disconnect from GitHub
        if not user.get("github_access_token"):
            return JSONResponse(content={
                "text": "You are not connected to GitHub. Use `/radar connect` to connect."
            })
        
        # Update user
        await SupabaseManager.update_user(user["id"], {
            "github_id": None,
            "github_login": None,
            "github_access_token": None,
            "github_refresh_token": None
        })
        
        return JSONResponse(content={
            "text": "Your GitHub account has been disconnected. Use `/radar connect` to reconnect."
        })
    
    else:
        return JSONResponse(content={
            "text": f"Unknown command: {args[0]}. Use `/radar help` to see available commands."
        })


async def process_view_submission(payload: Dict[str, Any]):
    """
    Process view submission.
    
    Args:
        payload: Slack payload
        
    Returns:
        Response to Slack
    """
    # Get view data
    view = payload.get("view", {})
    callback_id = view.get("callback_id")
    
    if callback_id == "settings_modal":
        # Get user
        user_id = payload.get("user", {}).get("id")
        user = await SupabaseManager.get_user_by_slack_id(user_id)
        
        if not user:
            return JSONResponse(content={"response_action": "errors", "errors": {"block_id": "Error: User not found."}})
        
        # Get state values
        state_values = view.get("state", {}).get("values", {})
        
        # Process settings
        notification_preferences = {}
        digest_settings = {}
        
        # Process PR notifications
        for block_id, block_values in state_values.items():
            if "pr_notifications" in block_values:
                selected_options = block_values["pr_notifications"].get("selected_options", [])
                for option in ["pull_request_opened", "pull_request_closed", "pull_request_merged", "pull_request_reviewed", "pull_request_commented"]:
                    notification_preferences[option] = any(opt["value"] == option for opt in selected_options)
            
            if "issue_notifications" in block_values:
                selected_options = block_values["issue_notifications"].get("selected_options", [])
                for option in ["issue_opened", "issue_closed", "issue_commented"]:
                    notification_preferences[option] = any(opt["value"] == option for opt in selected_options)
            
            if "digest_enabled" in block_values:
                selected_option = block_values["digest_enabled"].get("selected_option", {})
                digest_settings["enabled"] = selected_option.get("value") == "true"
            
            if "digest_frequency" in block_values:
                selected_option = block_values["digest_frequency"].get("selected_option", {})
                digest_settings["frequency"] = selected_option.get("value", "daily")
        
        # Update settings
        settings_data = {
            "notification_preferences": notification_preferences,
            "digest_settings": digest_settings
        }
        
        await SupabaseManager.update_user_settings(user["id"], settings_data)
        
        # Return success
        return JSONResponse(content={"response_action": "clear"})
    
    return JSONResponse(content={"response_action": "clear"})


async def process_block_actions(payload: Dict[str, Any]):
    """
    Process block actions.
    
    Args:
        payload: Slack payload
        
    Returns:
        Response to Slack
    """
    # Get actions
    actions = payload.get("actions", [])
    
    if not actions:
        return Response(status_code=200)
    
    # Process each action
    for action in actions:
        action_id = action.get("action_id")
        
        # Handle specific actions here
        if action_id == "connect_github":
            # This is handled by the button URL, no action needed
            pass
    
    return Response(status_code=200)


def get_initial_checkbox_options(settings: Optional[Dict[str, Any]], action_id: str):
    """
    Get initial checkbox options based on user settings.
    
    Args:
        settings: User settings
        action_id: Action ID
        
    Returns:
        List of initial options
    """
    if not settings or "notification_preferences" not in settings:
        # Default all to enabled
        if action_id == "pr_notifications":
            return [
                {"text": {"type": "plain_text", "text": "Opened"}, "value": "pull_request_opened"},
                {"text": {"type": "plain_text", "text": "Closed"}, "value": "pull_request_closed"},
                {"text": {"type": "plain_text", "text": "Merged"}, "value": "pull_request_merged"},
                {"text": {"type": "plain_text", "text": "Reviewed"}, "value": "pull_request_reviewed"},
                {"text": {"type": "plain_text", "text": "Commented"}, "value": "pull_request_commented"}
            ]
        elif action_id == "issue_notifications":
            return [
                {"text": {"type": "plain_text", "text": "Opened"}, "value": "issue_opened"},
                {"text": {"type": "plain_text", "text": "Closed"}, "value": "issue_closed"},
                {"text": {"type": "plain_text", "text": "Commented"}, "value": "issue_commented"}
            ]
    
    # Get preferences
    preferences = settings.get("notification_preferences", {})
    
    # Build initial options
    initial_options = []
    
    if action_id == "pr_notifications":
        for option, label in [
            ("pull_request_opened", "Opened"),
            ("pull_request_closed", "Closed"),
            ("pull_request_merged", "Merged"),
            ("pull_request_reviewed", "Reviewed"),
            ("pull_request_commented", "Commented")
        ]:
            if preferences.get(option, True):
                initial_options.append({
                    "text": {"type": "plain_text", "text": label},
                    "value": option
                })
    
    elif action_id == "issue_notifications":
        for option, label in [
            ("issue_opened", "Opened"),
            ("issue_closed", "Closed"),
            ("issue_commented", "Commented")
        ]:
            if preferences.get(option, True):
                initial_options.append({
                    "text": {"type": "plain_text", "text": label},
                    "value": option
                })
    
    return initial_options


def get_initial_select_option(settings: Optional[Dict[str, Any]], action_id: str):
    """
    Get initial select option based on user settings.
    
    Args:
        settings: User settings
        action_id: Action ID
        
    Returns:
        Initial option
    """
    if not settings or "digest_settings" not in settings:
        # Default values
        if action_id == "digest_frequency":
            return {
                "text": {"type": "plain_text", "text": "Daily"},
                "value": "daily"
            }
    
    # Get digest settings
    digest_settings = settings.get("digest_settings", {})
    
    if action_id == "digest_frequency":
        frequency = digest_settings.get("frequency", "daily")
        label = frequency.capitalize()
        
        return {
            "text": {"type": "plain_text", "text": label},
            "value": frequency
        }
    
    # Default
    return {
        "text": {"type": "plain_text", "text": "Daily"},
        "value": "daily"
    }
