"""
Slack service for interacting with the Slack API.
"""
import logging
from typing import Dict, List, Optional, Any, Union

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from slack_bolt import App, BoltContext
from slack_bolt.adapter.fastapi import SlackRequestHandler
from slack_bolt.authorization import AuthorizeResult

from app.core.config import settings
from app.models.slack import (
    SlackMessage, 
    PullRequestMessage, 
    PullRequestReviewMessage,
    PullRequestCommentMessage,
    IssueMessage,
    IssueCommentMessage,
    DigestMessage,
    StatsMessage,
    TextObject,
    SectionBlock,
    DividerBlock,
    ContextBlock,
    HeaderBlock
)
from app.db.supabase import SupabaseManager

logger = logging.getLogger(__name__)

# Initialize the Slack Bolt app for a single workspace
# This is simpler than using a custom authorize function
slack_app = App(
    token=settings.SLACK_BOT_TOKEN,  # Use the bot token directly for single workspace
    signing_secret=settings.SLACK_SIGNING_SECRET,
)

# Create a request handler for FastAPI
slack_handler = SlackRequestHandler(slack_app)

# Add event listeners
@slack_app.event("app_mention")
def handle_app_mention(body, say):
    logger.info(f"Got app_mention event: {body}")
    say("Hello! I'm Radar. I can help you track GitHub activity.")

@slack_app.command("/radar")
def handle_radar_command(ack, command, say):
    logger.info(f"Got radar command: {command}")
    ack()
    say(f"Hello <@{command['user_id']}>! You used the /radar command with text: {command['text']}")

@slack_app.event("message")
def handle_message(body, say):
    logger.info(f"Got message event: {body}")
    # Only respond to direct messages, not channel messages
    if body.get("event", {}).get("channel_type") == "im":
        say("I received your message! I'm Radar, here to help you track GitHub activity.")

# Note: app_home_opened events are also handled directly in the slack_events route
async def publish_home_view(user_id: str):
    """
    Handle the app_home_opened event and render the app home page.
    
    Args:
        user_id: Slack user ID
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Create a client using the bot token
        from slack_sdk import WebClient
        client = WebClient(token=settings.SLACK_BOT_TOKEN)
        
        # First show a loading screen
        client.views_publish(
            user_id=user_id,
            view={
                "type": "home",
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": "Welcome to Radar! 📡",
                            "emoji": True
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "Loading your personalized dashboard..."
                        }
                    }
                ]
            }
        )
        logger.info(f"Published loading home view for user {user_id}")
        
        # Check if user exists in our database
        user = await SupabaseManager.get_user_by_slack_id(user_id)
        logger.info(f"User found: {user is not None}")
        
        # Prepare the home view blocks
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "Welcome to Radar! 📡",
                    "emoji": True
                }
            },
            {
                "type": "divider"
            }
        ]
        
        if user:
            # User has an account - show a simplified view with a button to open dashboard
            blocks.extend([
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Hello, <@{user_id}>!* Your Radar account is connected and active."
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "Radar helps you track GitHub activity and receive notifications in Slack. View your dashboard to see your notifications and manage your settings."
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Open Dashboard",
                                "emoji": True
                            },
                            "style": "primary",
                            "url": f"{settings.FRONTEND_URL}/dashboard"
                        }
                    ]
                },
                {
                    "type": "divider"
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "⚙️ *Available Commands*"
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": "• `/radar help` - Show help information"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "• `/radar settings` - Open settings page"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "• `/radar status` - Check your connection status"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "• `/radar repos` - List your repositories"
                        }
                    ]
                }
            ])
        else:
            # User doesn't have an account - show welcome message and setup button
            blocks.extend([
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*Radar* helps you track GitHub activity and receive notifications in Slack."
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "👋 *Get Started*\nIt looks like you haven't set up your Radar account yet. Connect your GitHub account to start receiving notifications."
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "With Radar, you'll receive notifications for:"
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": "• Pull Requests"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "• Reviews"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "• Comments"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "• Issues"
                        }
                    ]
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Create Account",
                                "emoji": True
                            },
                            "style": "primary",
                            "url": f"{settings.FRONTEND_URL}"
                        }
                    ]
                }
            ])
        
        # Add footer
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": "🔍 Need help? Use `/radar help` or message this bot directly."
                }
            ]
        })
        
        # Update the home view with the full content
        client.views_publish(
            user_id=user_id,
            view={
                "type": "home",
                "blocks": blocks
            }
        )
        logger.info(f"Published full home view for user {user_id}")
        return True
        
    except Exception as e:
        logger.error(f"Error handling app_home_opened: {e}", exc_info=True)
        return False

@slack_app.event("app_home_opened")
async def handle_app_home_opened_event(payload, client, event):
    await publish_home_view(payload["user"])

class SlackService:
    """Service for interacting with the Slack API."""

    # Color scheme for different event types
    EVENT_COLORS = {
        # Pull request actions
        "opened": "#2EB67D",       # Green
        "reopened": "#2EB67D",     # Green
        "closed": "#E01E5A",       # Red
        "merged": "#4A154B",       # Purple
        "review_requested": "#ECB22E", # Yellow
        "review_request_removed": "#8D8D8D", # Gray
        "assigned": "#1D9BD1",     # Blue
        "unassigned": "#8D8D8D",   # Gray
        
        # Review states
        "approved": "#2EB67D",     # Green
        "changes_requested": "#E01E5A", # Red
        "commented": "#1D9BD1",    # Blue
        "dismissed": "#ECB22E",    # Yellow
        
        # Issue actions
        "issue_opened": "#2EB67D", # Green
        "issue_closed": "#E01E5A", # Red
        "issue_reopened": "#2EB67D", # Green
        "issue_commented": "#1D9BD1", # Blue
        
        # Special types
        "keyword_match": "#36C5F0", # Bright Blue for keyword matches
        "digest": "#4A154B",       # Purple for digest messages
        "stats": "#ECB22E",        # Yellow for stats
        
        # Default
        "default": "#1D9BD1"       # Blue
    }
    
    def __init__(self, token: Optional[str] = None):
        """
        Initialize the Slack service.
        
        Args:
            token: Slack API token, defaults to the bot token from settings
        """
        self.client = WebClient(token=token or settings.SLACK_BOT_TOKEN)
        
    async def send_message(self, message: SlackMessage) -> Dict[str, Any]:
        """
        Send a message to Slack.
        
        Args:
            message: Slack message to send
            
        Returns:
            Slack API response
        """
        # Prepare payload
        payload = {
            "channel": message.channel,
            "text": message.text,
            "unfurl_links": message.unfurl_links,
            "unfurl_media": message.unfurl_media,
        }
        
        # Add thread_ts if present
        if message.thread_ts:
            payload["thread_ts"] = message.thread_ts
        
        # Add blocks if present
        if message.blocks:
            payload["blocks"] = message.blocks
        
        # Add attachments if present
        if message.attachments:
            payload["attachments"] = message.attachments
            
        # Add app identity
        message_type = message.message_type.value
        
        # Use different app names based on message type (like Toast example)
        if message_type == "pull_request_review" and getattr(message, "review_state", "") == "approved":
            payload["username"] = "Approved Toast"
        elif message_type == "pull_request_comment" or message_type == "issue_comment":
            payload["username"] = "Messenger Toast"
        else:
            payload["username"] = "Radar"
            
        # Use app icon
        payload["icon_url"] = "https://raw.githubusercontent.com/zlwaterfield/radar/main/client/public/logo.png"
        
        # Send message
        response = self.client.chat_postMessage(**payload)
        
        return response.data
            
    async def update_message(self, channel: str, ts: str, message: SlackMessage) -> Dict[str, Any]:
        """
        Update a message in Slack.
        
        Args:
            channel: The channel ID
            ts: The message timestamp
            message: The new message content
            
        Returns:
            The Slack API response
        """
        try:
            # Prepare message payload
            payload = {
                "channel": channel,
                "ts": ts,
                "text": message.text
            }
            
            # Add blocks if present
            if message.blocks:
                if isinstance(message.blocks[0], dict):
                    payload["blocks"] = message.blocks
                else:
                    payload["blocks"] = self._convert_blocks_to_dict(message.blocks)
            
            # Add attachments if present
            if message.attachments:
                payload["attachments"] = message.attachments
            
            # Update message
            response = self.client.chat_update(**payload)
            return response
        except SlackApiError as e:
            logger.error(f"Error updating message in Slack: {e}")
            raise
            
    async def delete_message(self, channel: str, ts: str) -> Dict[str, Any]:
        """
        Delete a message from Slack.
        
        Args:
            channel: The channel ID
            ts: The message timestamp
            
        Returns:
            The Slack API response
        """
        try:
            response = self.client.chat_delete(
                channel=channel,
                ts=ts
            )
            return response
        except SlackApiError as e:
            logger.error(f"Error deleting message from Slack: {e}")
            raise
            
    async def get_user_info(self, user_id: str) -> Dict[str, Any]:
        """
        Get information about a Slack user.
        
        Args:
            user_id: The Slack user ID
            
        Returns:
            The user information
        """
        try:
            response = self.client.users_info(user=user_id)
            return response["user"]
        except SlackApiError as e:
            logger.error(f"Error getting user info from Slack: {e}")
            raise
            
    async def open_modal(self, trigger_id: str, view: Dict[str, Any]) -> Dict[str, Any]:
        """
        Open a modal in Slack.
        
        Args:
            trigger_id: The trigger ID
            view: The modal view
            
        Returns:
            The Slack API response
        """
        try:
            response = self.client.views_open(
                trigger_id=trigger_id,
                view=view
            )
            return response
        except SlackApiError as e:
            logger.error(f"Error opening modal in Slack: {e}")
            raise
            
    async def update_modal(self, view_id: str, view: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update a modal in Slack.
        
        Args:
            view_id: The view ID
            view: The new modal view
            
        Returns:
            The Slack API response
        """
        try:
            response = self.client.views_update(
                view_id=view_id,
                view=view
            )
            return response
        except SlackApiError as e:
            logger.error(f"Error updating modal in Slack: {e}")
            raise
            
    async def get_oauth_access(self, code: str) -> Dict[str, Any]:
        """
        Exchange an OAuth code for an access token.
        
        Args:
            code: The OAuth code
            
        Returns:
            The OAuth response
        """
        try:
            response = self.client.oauth_v2_access(
                client_id=settings.SLACK_APP_CLIENT_ID,
                client_secret=settings.SLACK_APP_CLIENT_SECRET,
                code=code
            )
            return response
        except SlackApiError as e:
            logger.error(f"Error exchanging OAuth code: {e}")
            raise
            
    def _convert_blocks_to_dict(self, blocks: List[Any]) -> List[Dict[str, Any]]:
        """
        Convert Pydantic block models to dictionaries for the Slack API.
        
        Args:
            blocks: List of block models
            
        Returns:
            List of block dictionaries
        """
        return [block.dict(exclude_none=True) for block in blocks]
            
    @staticmethod
    def create_pull_request_message(
        pr_message: PullRequestMessage
    ) -> PullRequestMessage:
        """
        Create a formatted Slack message for a pull request event.
        
        Args:
            pr_message: Pull request message data
            
        Returns:
            Formatted pull request message
        """
        # Map PR action to color
        color = SlackService.EVENT_COLORS.get(pr_message.action, SlackService.EVENT_COLORS["default"])
        
        # Create icon based on action
        icon = "🔄"  # Default icon
        if pr_message.action == "opened":
            icon = "🆕"
        elif pr_message.action == "closed":
            icon = "🚫"
        elif pr_message.action == "reopened":
            icon = "🔄"
        elif pr_message.action == "merged":
            icon = "🔀"
        elif pr_message.action == "review_requested":
            icon = "👀"
        elif pr_message.action == "assigned":
            icon = "👤"
            
        # Format action text
        action_text = pr_message.action.replace("_", " ").capitalize()
            
        # Create blocks with attachment styling
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{icon} *Pull Request {action_text}*"
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"<{pr_message.pull_request_url}|*PR #{pr_message.pull_request_number}* {pr_message.pull_request_title}>\n"
                           f"*Repository:* `{pr_message.repository}`\n"
                           f"*Type:* Pull Request"
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "View PR",
                        "emoji": True
                    },
                    "url": pr_message.pull_request_url,
                    "action_id": "view_pr"
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"<@{pr_message.user}> {pr_message.action} this pull request"
                    }
                ]
            }
        ]
        
        # Update the message blocks
        pr_message.blocks = []
        
        # Add attachments for color
        pr_message.attachments = [
            {
                "color": color,
                "blocks": blocks
            }
        ]
        
        return pr_message
    
    @staticmethod
    def create_pull_request_review_message(
        review_message: PullRequestReviewMessage
    ) -> PullRequestReviewMessage:
        """
        Create a formatted Slack message for a pull request review event.
        
        Args:
            review_message: Pull request review message data
            
        Returns:
            Formatted pull request review message
        """
        # Map review state to color
        color = SlackService.EVENT_COLORS.get(review_message.state, SlackService.EVENT_COLORS["default"])
        
        # Create icon based on review state
        icon = "💬"  # Default icon
        if review_message.state == "approved":
            icon = "✅"
        elif review_message.state == "changes_requested":
            icon = "❌"
        elif review_message.state == "commented":
            icon = "💬"
        elif review_message.state == "dismissed":
            icon = "🚫"
            
        # Format state text
        state_text = review_message.state.replace("_", " ").capitalize()
            
        # Create blocks with attachment styling
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{icon} *Pull Request Review: {state_text}*"
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"<{review_message.pull_request_url}|*PR #{review_message.pull_request_number}* {review_message.pull_request_title}>\n"
                           f"*Repository:* `{review_message.repository}`\n"
                           f"*Type:* Pull Request"
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "View PR",
                        "emoji": True
                    },
                    "url": review_message.pull_request_url,
                    "action_id": "view_pr"
                }
            }
        ]
        
        # Add review comment if present
        if review_message.review_comment:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Comment:*\n{review_message.review_comment}"
                }
            })
        
        # Update the message blocks
        review_message.blocks = []
        
        # Add attachments for color
        review_message.attachments = [
            {
                "color": color,
                "blocks": blocks
            }
        ]
        
        return review_message
    
    @staticmethod
    def create_pull_request_comment_message(
        comment_message: PullRequestCommentMessage
    ) -> PullRequestCommentMessage:
        """
        Create a formatted Slack message for a pull request comment event.
        
        Args:
            comment_message: Pull request comment message data
            
        Returns:
            Formatted pull request comment message
        """
        # Use the commented color from our color scheme
        color = SlackService.EVENT_COLORS["commented"]
        
        # Create blocks with attachment styling
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "💬 *Pull Request Comment*"
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"<{comment_message.pull_request_url}|*PR #{comment_message.pull_request_number}* {comment_message.pull_request_title}>\n"
                           f"*Repository:* `{comment_message.repository}`\n"
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "View PR",
                        "emoji": True
                    },
                    "url": comment_message.pull_request_url,
                    "action_id": "view_pr"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": comment_message.comment
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"<@{comment_message.user}> commented on this pull request"
                    }
                ]
            }
        ]
        
        # Update text with user mention
        comment_message.text = ""
        
        # Add attachments for color
        comment_message.attachments = [
            {
                "color": color,
                "blocks": blocks
            }
        ]
        
        # Update the message blocks
        comment_message.blocks = []
        
        return comment_message
    
    @staticmethod
    def create_issue_message(
        issue_message: IssueMessage
    ) -> IssueMessage:
        """
        Create a formatted Slack message for an issue event.
        
        Args:
            issue_message: Issue message data
            
        Returns:
            Formatted issue message
        """
        # Map issue action to color
        action_color_key = f"issue_{issue_message.action}"
        color = SlackService.EVENT_COLORS.get(action_color_key, SlackService.EVENT_COLORS["default"])
        
        # Create icon based on action
        icon = "🔄"  # Default icon
        if issue_message.action == "opened":
            icon = "🆕"
        elif issue_message.action == "closed":
            icon = "🚫"
        elif issue_message.action == "reopened":
            icon = "🔄"
        elif issue_message.action == "assigned":
            icon = "👤"
            
        # Format action text
        action_text = issue_message.action.replace("_", " ").capitalize()
        
        # Check if this is a pull request by examining the URL
        # GitHub pull request URLs contain '/pull/' while issue URLs contain '/issues/'
        is_pull_request = '/pull/' in issue_message.issue_url
        
        # Set the appropriate title and type based on whether it's a PR or issue
        if is_pull_request:
            title = f"{icon} *Pull Request {action_text}*"
            item_prefix = "PR"
            view_text = "View PR"
            context_text = f"<@{issue_message.user}> {issue_message.action} this pull request"
        else:
            title = f"{icon} *GitHub Issue {action_text}*"
            item_prefix = "Issue"
            view_text = "View Issue"
            context_text = f"<@{issue_message.user}> {issue_message.action} this issue"
            
        # Create blocks with attachment styling
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": title
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"<{issue_message.issue_url}|*{item_prefix} #{issue_message.issue_number}* {issue_message.issue_title}>\n"
                           f"*Repository:* `{issue_message.repository}`\n"
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": view_text,
                        "emoji": True
                    },
                    "url": issue_message.issue_url,
                    "action_id": "view_issue"
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": context_text
                    }
                ]
            }
        ]
        
        # Update text with user mention
        issue_message.text = ""
        
        # Add attachments for color
        issue_message.attachments = [
            {
                "color": color,
                "blocks": blocks
            }
        ]
        
        # Update the message blocks
        issue_message.blocks = []
        
        return issue_message
    
    @staticmethod
    def create_issue_comment_message(
        comment_message: IssueCommentMessage
    ) -> IssueCommentMessage:
        """
        Create a formatted Slack message for an issue comment event.
        
        Args:
            comment_message: Issue comment message data
            
        Returns:
            Formatted issue comment message
        """
        # Use the issue_commented color from our color scheme
        color = SlackService.EVENT_COLORS["issue_commented"]
        
        # Check if this is a pull request by examining the URL
        # GitHub pull request URLs contain '/pull/' while issue URLs contain '/issues/'
        is_pull_request = '/pull/' in comment_message.issue_url
        
        # Set the appropriate title and type based on whether it's a PR or issue
        if is_pull_request:
            title = "💬 *Pull Request Comment*"
            item_prefix = "PR"
            view_text = "View PR"
            context_text = f"<@{comment_message.user}> commented on this pull request"
        else:
            title = "💬 *Issue Comment*"
            item_prefix = "Issue"
            view_text = "View Issue"
            context_text = f"<@{comment_message.user}> commented on this issue"
        
        # Create blocks as dictionaries directly
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": title
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"<{comment_message.issue_url}|*{item_prefix} #{comment_message.issue_number}* {comment_message.issue_title}>\n"
                           f"*Repository:* `{comment_message.repository}`\n"
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": view_text,
                        "emoji": True
                    },
                    "url": comment_message.issue_url,
                    "action_id": "view_issue"
                }
            }
        ]
        
        # Add comment content if available
        if comment_message.comment:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": comment_message.comment
                }
            })
        
        # Add context about who commented
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": context_text
                }
            ]
        })
        
        # Update text with user mention
        comment_message.text = ""
        
        # Add attachments for color
        comment_message.attachments = [
            {
                "color": color,
                "blocks": blocks
            }
        ]
        
        # Update the message blocks
        comment_message.blocks = []
        
        return comment_message
    
    @staticmethod
    def create_digest_message(
        digest_message: DigestMessage
    ) -> DigestMessage:
        """
        Create a formatted Slack message for a digest notification.
        
        Args:
            digest_message: Digest message data
            
        Returns:
            Formatted digest message
        """
        # Use a consistent color for digest messages
        color = SlackService.EVENT_COLORS["digest"]
        
        # Create blocks as dictionaries directly
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📋 Daily Digest",
                    "emoji": True
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Your GitHub activity summary for {digest_message.date}*"
                }
            }
        ]
        
        # Add pull request section if there are any
        if digest_message.pull_requests and len(digest_message.pull_requests) > 0:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Pull Requests*"
                }
            })
            
            for pr in digest_message.pull_requests:
                blocks.append({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"<{pr['url']}|*#{pr['number']}* {pr['title']}>\n"
                               f"*Repository:* `{pr['repository']}`\n"
                               f"*Status:* {pr['status']}"
                    }
                })
        
        # Add reviews section if there are any
        if digest_message.reviews and len(digest_message.reviews) > 0:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Reviews*"
                }
            })
            
            for review in digest_message.reviews:
                blocks.append({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"<{review['url']}|*#{review['pr_number']}* {review['pr_title']}>\n"
                               f"*Repository:* `{review['repository']}`\n"
                               f"*Review:* {review['state']}"
                    }
                })
        
        # Add mentions section if there are any
        if digest_message.mentions and len(digest_message.mentions) > 0:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Mentions*"
                }
            })
            
            for mention in digest_message.mentions:
                blocks.append({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"<{mention['url']}|*{mention['type']}* in {mention['repository']}>\n"
                               f"*By:* {mention['by']}\n"
                               f"*Content:* {mention['content']}"
                    }
                })
        
        # Add footer
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": "This is your daily digest of GitHub activity. To change your digest settings, visit your Radar settings."
                }
            ]
        })
        
        # Update the message blocks
        digest_message.blocks = []
        
        # Add attachments for color
        digest_message.attachments = [
            {
                "color": color,
                "blocks": blocks
            }
        ]
        
        return digest_message
    
    @staticmethod
    def create_stats_message(
        stats_message: StatsMessage
    ) -> StatsMessage:
        """
        Create a formatted Slack message for a stats notification.
        
        Args:
            stats_message: Stats message data
            
        Returns:
            Formatted stats message
        """
        # Use a consistent color for stats messages
        color = SlackService.EVENT_COLORS["stats"]
        
        # Create blocks as dictionaries directly
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📊 GitHub Activity Stats",
                    "emoji": True
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Your GitHub activity stats as of {stats_message.date}*"
                }
            }
        ]
        
        # Add pull request stats
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*Pull Requests*"
            }
        })
        
        blocks.append({
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": f"*Open:* {stats_message.stats.get('pull_requests_open', 0)}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Closed:* {stats_message.stats.get('pull_requests_closed', 0)}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Merged:* {stats_message.stats.get('pull_requests_merged', 0)}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Total:* {stats_message.stats.get('pull_requests_total', 0)}"
                }
            ]
        })
        
        # Add review stats
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*Reviews*"
            }
        })
        
        blocks.append({
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": f"*Approved:* {stats_message.stats.get('reviews_approved', 0)}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Changes Requested:* {stats_message.stats.get('reviews_changes_requested', 0)}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Commented:* {stats_message.stats.get('reviews_commented', 0)}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Total:* {stats_message.stats.get('reviews_total', 0)}"
                }
            ]
        })
        
        # Add footer
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": "These stats are based on your GitHub activity tracked by Radar. For more details, visit your Radar dashboard."
                }
            ]
        })
        
        # Update the message blocks
        stats_message.blocks = []
        
        # Add attachments for color
        stats_message.attachments = [
            {
                "color": color,
                "blocks": blocks
            }
        ]
        
        return stats_message
