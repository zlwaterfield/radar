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

logger = logging.getLogger(__name__)

# Initialize the Slack Bolt app for a single workspace
# This is simpler than using a custom authorize function
slack_app = App(
    token=settings.SLACK_BOT_TOKEN,  # Use the bot token directly for single workspace
    signing_secret=settings.SLACK_SIGNING_SECRET,
    process_before_response=False
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

@slack_app.event("app_home_opened")
def handle_app_home_opened(client, event, logger):
    """
    Handle the app_home_opened event and render the app home page.
    
    Args:
        client: Slack client
        event: Event data
        logger: Logger
    """
    logger.info(f"Got app_home_opened event: {event}")
    user_id = event["user"]
    
    try:
        # Call views.publish with the built-in client
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
                        "type": "divider"
                    },
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
                            "text": "👋 *Get Started*\nUse the `/radar` command to configure your settings and start receiving notifications."
                        }
                    },
                    {
                        "type": "divider"
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "🔔 *Notifications*\nYou'll receive notifications for:"
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
                        "type": "divider"
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "⚙️ *Commands*"
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
                                "text": "• `/radar settings` - Configure your settings"
                            },
                            {
                                "type": "mrkdwn",
                                "text": "• `/radar stats` - View your GitHub stats"
                            }
                        ]
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "mrkdwn",
                                "text": "🔍 Need help? Use `/radar help` or message this bot directly."
                            }
                        ]
                    }
                ]
            }
        )
        logger.info(f"Published home view for user {user_id}")
    except Exception as e:
        logger.error(f"Error publishing home view: {e}")


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
                client_id=settings.SLACK_CLIENT_ID,
                client_secret=settings.SLACK_CLIENT_SECRET,
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
    def create_pull_request_message(pr_message: PullRequestMessage) -> PullRequestMessage:
        """
        Create a formatted Slack message for a pull request event.
        
        Args:
            pr_message: Pull request message data
            
        Returns:
            Formatted pull request message
        """
        # Determine color based on action
        color = SlackService.EVENT_COLORS.get(pr_message.action, SlackService.EVENT_COLORS["default"])
        
        # Determine emoji based on action
        emoji = "🔄"  # Default
        if pr_message.action == "opened":
            emoji = "🆕"
        elif pr_message.action == "closed":
            emoji = "🚫"
        elif pr_message.action == "merged":
            emoji = "🔀"
        elif pr_message.action == "reopened":
            emoji = "♻️"
        elif pr_message.action == "review_requested":
            emoji = "👀"
        
        # Create message title
        if pr_message.action == "review_requested":
            title = f"{emoji} Review requested on PR"
        else:
            title = f"{emoji} PR {pr_message.action}"
        
        # Create blocks as dictionaries directly
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": title,
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
                    "text": f"<{pr_message.pull_request_url}|*#{pr_message.pull_request_number}* {pr_message.pull_request_title}>\n"
                           f"*Repository:* `{pr_message.repository}`"
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
                        "text": f"@{pr_message.user} {pr_message.action} this pull request"
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
        # Determine color based on review state
        color = SlackService.EVENT_COLORS.get(review_message.review_state, SlackService.EVENT_COLORS["default"])
        
        # Create title based on review state
        if review_message.review_state == "approved":
            title = "✅ Approved"
        elif review_message.review_state == "changes_requested":
            title = "❌ Changes Requested"
        elif review_message.review_state == "commented":
            title = "💬 Review Comment"
        else:
            title = "🔍 Review Submitted"
        
        # Create blocks as dictionaries directly
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": title,
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
                    "text": f"@{review_message.user} {review_message.review_state} your PR"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"<{review_message.pull_request_url}|*#{review_message.pull_request_number}* {review_message.pull_request_title}>\n"
                           f"*Repository:* `{review_message.repository}`"
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
                    "text": f"<{comment_message.pull_request_url}|*#{comment_message.pull_request_number}* {comment_message.pull_request_title}>\n"
                           f"*Repository:* `{comment_message.repository}`"
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
                    "text": f">*Comment:*\n>{comment_message.comment}"
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
            
        # Create blocks with attachment styling
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{icon} *Issue {action_text}*"
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"<{issue_message.issue_url}|*#{issue_message.issue_number}* {issue_message.issue_title}>\n"
                           f"*Repository:* `{issue_message.repository}`"
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "View Issue",
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
                        "text": f"<@{issue_message.user}> {issue_message.action} this issue"
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
        
        # Create blocks as dictionaries directly instead of using Pydantic models
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"@{comment_message.user} commented on this issue"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"<{comment_message.issue_url}|*#{comment_message.issue_number}* {comment_message.issue_title}>"
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "View Issue",
                        "emoji": True
                    },
                    "url": comment_message.issue_url,
                    "action_id": "view_issue"
                }
            }
        ]
        
        # Add comment content if present
        if comment_message.comment:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{comment_message.comment}"
                }
            })
        
        # Add repository info in the footer
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"Repository: `{comment_message.repository}`"
                }
            ]
        })
        
        # Update the message blocks
        comment_message.blocks = []
        
        # Add attachments for color
        comment_message.attachments = [
            {
                "color": color,
                "blocks": blocks
            }
        ]
        
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
        
        # Create blocks as dictionaries directly instead of using Pydantic models
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
        
        # Create blocks as dictionaries directly instead of using Pydantic models
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
