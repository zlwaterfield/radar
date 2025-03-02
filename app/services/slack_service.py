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
            message: The message to send
            
        Returns:
            The Slack API response
        """
        try:
            response = self.client.chat_postMessage(
                channel=message.channel,
                text=message.text,
                blocks=self._convert_blocks_to_dict(message.blocks),
                thread_ts=message.thread_ts,
                unfurl_links=message.unfurl_links,
                unfurl_media=message.unfurl_media
            )
            return response
        except SlackApiError as e:
            logger.error(f"Error sending message to Slack: {e}")
            raise
            
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
            response = self.client.chat_update(
                channel=channel,
                ts=ts,
                text=message.text,
                blocks=self._convert_blocks_to_dict(message.blocks)
            )
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
        # Create header
        header = HeaderBlock(
            text=TextObject(
                type="plain_text",
                text=f"Pull Request {pr_message.action.capitalize()}: {pr_message.pull_request_title}"
            )
        )
        
        # Create main section
        section = SectionBlock(
            text=TextObject(
                type="mrkdwn",
                text=f"<{pr_message.pull_request_url}|#{pr_message.pull_request_number} {pr_message.pull_request_title}>\n"
                     f"Repository: *{pr_message.repository}*"
            )
        )
        
        # Create context
        context = ContextBlock(
            elements=[
                TextObject(
                    type="mrkdwn",
                    text=f"*{pr_message.user}* {pr_message.action} this pull request"
                )
            ]
        )
        
        # Assemble blocks
        blocks = [header, section, DividerBlock(), context]
        
        # Update the message blocks
        pr_message.blocks = blocks
        
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
        # Determine emoji based on review state
        emoji = "✅" if review_message.review_state == "approved" else "❌" if review_message.review_state == "changes_requested" else "💬"
        
        # Create header
        header = HeaderBlock(
            text=TextObject(
                type="plain_text",
                text=f"Pull Request Review: {review_message.pull_request_title}"
            )
        )
        
        # Create main section
        section = SectionBlock(
            text=TextObject(
                type="mrkdwn",
                text=f"<{review_message.pull_request_url}|#{review_message.pull_request_number} {review_message.pull_request_title}>\n"
                     f"Repository: *{review_message.repository}*\n"
                     f"Review: {emoji} *{review_message.review_state.replace('_', ' ').title()}*"
            )
        )
        
        # Add review comment if present
        blocks = [header, section]
        
        if review_message.review_comment:
            comment_section = SectionBlock(
                text=TextObject(
                    type="mrkdwn",
                    text=f">{review_message.review_comment}"
                )
            )
            blocks.append(comment_section)
        
        # Create context
        context = ContextBlock(
            elements=[
                TextObject(
                    type="mrkdwn",
                    text=f"*{review_message.user}* reviewed this pull request"
                )
            ]
        )
        
        # Assemble blocks
        blocks.append(DividerBlock())
        blocks.append(context)
        
        # Update the message blocks
        review_message.blocks = blocks
        
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
        # Create header
        header = HeaderBlock(
            text=TextObject(
                type="plain_text",
                text=f"Pull Request Comment: {comment_message.pull_request_title}"
            )
        )
        
        # Create main section
        section = SectionBlock(
            text=TextObject(
                type="mrkdwn",
                text=f"<{comment_message.pull_request_url}|#{comment_message.pull_request_number} {comment_message.pull_request_title}>\n"
                     f"Repository: *{comment_message.repository}*"
            )
        )
        
        # Add comment
        comment_section = SectionBlock(
            text=TextObject(
                type="mrkdwn",
                text=f">{comment_message.comment}"
            )
        )
        
        # Create context
        context = ContextBlock(
            elements=[
                TextObject(
                    type="mrkdwn",
                    text=f"*{comment_message.user}* commented on this pull request"
                )
            ]
        )
        
        # Assemble blocks
        blocks = [header, section, comment_section, DividerBlock(), context]
        
        # Update the message blocks
        comment_message.blocks = blocks
        
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
        # Create header
        header = HeaderBlock(
            text=TextObject(
                type="plain_text",
                text=f"Issue {issue_message.action.capitalize()}: {issue_message.issue_title}"
            )
        )
        
        # Create main section
        section = SectionBlock(
            text=TextObject(
                type="mrkdwn",
                text=f"<{issue_message.issue_url}|#{issue_message.issue_number} {issue_message.issue_title}>\n"
                     f"Repository: *{issue_message.repository}*"
            )
        )
        
        # Create context
        context = ContextBlock(
            elements=[
                TextObject(
                    type="mrkdwn",
                    text=f"*{issue_message.user}* {issue_message.action} this issue"
                )
            ]
        )
        
        # Assemble blocks
        blocks = [header, section, DividerBlock(), context]
        
        # Update the message blocks
        issue_message.blocks = blocks
        
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
        # Create header
        header = HeaderBlock(
            text=TextObject(
                type="plain_text",
                text=f"Issue Comment: {comment_message.issue_title}"
            )
        )
        
        # Create main section
        section = SectionBlock(
            text=TextObject(
                type="mrkdwn",
                text=f"<{comment_message.issue_url}|#{comment_message.issue_number} {comment_message.issue_title}>\n"
                     f"Repository: *{comment_message.repository}*"
            )
        )
        
        # Add comment
        comment_section = SectionBlock(
            text=TextObject(
                type="mrkdwn",
                text=f">{comment_message.comment}"
            )
        )
        
        # Create context
        context = ContextBlock(
            elements=[
                TextObject(
                    type="mrkdwn",
                    text=f"*{comment_message.user}* commented on this issue"
                )
            ]
        )
        
        # Assemble blocks
        blocks = [header, section, comment_section, DividerBlock(), context]
        
        # Update the message blocks
        comment_message.blocks = blocks
        
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
        # Create header
        header = HeaderBlock(
            text=TextObject(
                type="plain_text",
                text=f"{digest_message.time_period.capitalize()} Digest"
            )
        )
        
        # Create intro section
        intro = SectionBlock(
            text=TextObject(
                type="mrkdwn",
                text=f"Here's your {digest_message.time_period.lower()} summary of GitHub activity:"
            )
        )
        
        # Assemble blocks
        blocks = [header, intro, DividerBlock()]
        
        # Add pull requests section if there are any
        if digest_message.pull_requests:
            pr_header = SectionBlock(
                text=TextObject(
                    type="mrkdwn",
                    text="*Pull Requests*"
                )
            )
            blocks.append(pr_header)
            
            for pr in digest_message.pull_requests:
                pr_section = SectionBlock(
                    text=TextObject(
                        type="mrkdwn",
                        text=f"<{pr['url']}|#{pr['number']} {pr['title']}>\n"
                             f"Repository: *{pr['repository']}*\n"
                             f"Status: {pr['status']}"
                    )
                )
                blocks.append(pr_section)
            
            blocks.append(DividerBlock())
        
        # Add issues section if there are any
        if digest_message.issues:
            issue_header = SectionBlock(
                text=TextObject(
                    type="mrkdwn",
                    text="*Issues*"
                )
            )
            blocks.append(issue_header)
            
            for issue in digest_message.issues:
                issue_section = SectionBlock(
                    text=TextObject(
                        type="mrkdwn",
                        text=f"<{issue['url']}|#{issue['number']} {issue['title']}>\n"
                             f"Repository: *{issue['repository']}*\n"
                             f"Status: {issue['status']}"
                    )
                )
                blocks.append(issue_section)
            
            blocks.append(DividerBlock())
        
        # Add footer
        footer = ContextBlock(
            elements=[
                TextObject(
                    type="mrkdwn",
                    text=f"Generated at {digest_message.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}"
                )
            ]
        )
        blocks.append(footer)
        
        # Update the message blocks
        digest_message.blocks = blocks
        
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
        # Create header
        header = HeaderBlock(
            text=TextObject(
                type="plain_text",
                text=f"GitHub Stats (Last {stats_message.time_window} Days)"
            )
        )
        
        # Create intro section
        intro = SectionBlock(
            text=TextObject(
                type="mrkdwn",
                text=f"Here's a summary of your GitHub activity over the last {stats_message.time_window} days:"
            )
        )
        
        # Create stats sections
        stats_sections = []
        
        if "pull_requests" in stats_message.stats:
            pr_stats = stats_message.stats["pull_requests"]
            pr_section = SectionBlock(
                text=TextObject(
                    type="mrkdwn",
                    text=f"*Pull Requests*\n"
                         f"• Opened: {pr_stats.get('opened', 0)}\n"
                         f"• Closed: {pr_stats.get('closed', 0)}\n"
                         f"• Merged: {pr_stats.get('merged', 0)}\n"
                         f"• Reviews: {pr_stats.get('reviews', 0)}\n"
                         f"• Comments: {pr_stats.get('comments', 0)}"
                )
            )
            stats_sections.append(pr_section)
        
        if "issues" in stats_message.stats:
            issue_stats = stats_message.stats["issues"]
            issue_section = SectionBlock(
                text=TextObject(
                    type="mrkdwn",
                    text=f"*Issues*\n"
                         f"• Opened: {issue_stats.get('opened', 0)}\n"
                         f"• Closed: {issue_stats.get('closed', 0)}\n"
                         f"• Comments: {issue_stats.get('comments', 0)}"
                )
            )
            stats_sections.append(issue_section)
        
        if "repositories" in stats_message.stats:
            repo_stats = stats_message.stats["repositories"]
            repo_section = SectionBlock(
                text=TextObject(
                    type="mrkdwn",
                    text=f"*Repositories*\n"
                         f"• Active: {repo_stats.get('active', 0)}\n"
                         f"• Commits: {repo_stats.get('commits', 0)}"
                )
            )
            stats_sections.append(repo_section)
        
        # Add footer
        footer = ContextBlock(
            elements=[
                TextObject(
                    type="mrkdwn",
                    text=f"Generated at {stats_message.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}"
                )
            ]
        )
        
        # Assemble blocks
        blocks = [header, intro, DividerBlock()]
        blocks.extend(stats_sections)
        blocks.append(DividerBlock())
        blocks.append(footer)
        
        # Update the message blocks
        stats_message.blocks = blocks
        
        return stats_message
