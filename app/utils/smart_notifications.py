"""
Smart notification utilities for Radar.

This module provides intelligent notification handling based on content analysis.
"""
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta

from app.utils.nlp_analyzer import ContentAnalyzer, KeywordWatcher, TeamMentionDetector
from app.db.supabase import SupabaseManager
from app.services.slack_service import SlackService

logger = logging.getLogger(__name__)


class SmartNotifier:
    """Provides intelligent notification handling based on content analysis."""
    
    def __init__(self, slack_service: Optional[SlackService] = None):
        """
        Initialize the smart notifier.
        
        Args:
            slack_service: Optional Slack service instance
        """
        self.slack_service = slack_service or SlackService()
        self.content_analyzer = ContentAnalyzer()
        self.keyword_watcher = KeywordWatcher()
        self.team_mention_detector = TeamMentionDetector()
    
    async def process_github_content(self, content_type: str, content: Dict[str, Any], 
                                     repository: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Process GitHub content and send smart notifications.
        
        Args:
            content_type: Type of content (pull_request, issue, comment, etc.)
            content: Content data
            repository: Repository name
            user_id: Optional user ID to check against
            
        Returns:
            Processing results
        """
        # Extract text based on content type
        text = self._extract_text(content_type, content)
        
        # Analyze content
        analysis = self.content_analyzer.analyze_text(text)
        
        # Check for keyword matches
        keyword_matches = self.keyword_watcher.matches(text)
        
        # Check for team mentions
        team_mentions = self.team_mention_detector.detect_mentions(text)
        
        # Combine results
        results = {
            "content_type": content_type,
            "repository": repository,
            "analysis": analysis,
            "keyword_matches": keyword_matches,
            "team_mentions": team_mentions,
            "notification_sent": False
        }
        
        # Determine users to notify
        users_to_notify = await self._get_users_to_notify(
            repository, analysis, keyword_matches, team_mentions, user_id
        )
        
        # Send notifications
        if users_to_notify:
            await self._send_notifications(users_to_notify, content_type, content, repository, results)
            results["notification_sent"] = True
            results["notified_users"] = [u["id"] for u in users_to_notify]
        
        # Store analysis in database for future reference
        await self._store_analysis(content_type, content, repository, results)
        
        return results
    
    def _extract_text(self, content_type: str, content: Dict[str, Any]) -> str:
        """
        Extract text from content based on type.
        
        Args:
            content_type: Type of content
            content: Content data
            
        Returns:
            Extracted text
        """
        if content_type == "pull_request":
            return f"{content.get('title', '')} {content.get('body', '')}"
        elif content_type == "issue":
            return f"{content.get('title', '')} {content.get('body', '')}"
        elif content_type == "comment":
            return content.get('body', '')
        elif content_type == "commit":
            return content.get('message', '')
        elif content_type == "review":
            return content.get('body', '')
        else:
            return str(content)
    
    async def _get_users_to_notify(self, repository: str, analysis: Dict[str, Any],
                                  keyword_matches: List[str], team_mentions: Dict[str, List[str]],
                                  specific_user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Determine which users should be notified.
        
        Args:
            repository: Repository name
            analysis: Content analysis
            keyword_matches: Keyword matches
            team_mentions: Team mentions
            specific_user_id: Optional specific user to check
            
        Returns:
            List of users to notify
        """
        users_to_notify = []
        
        # Get users watching this repository
        if specific_user_id:
            users = [await SupabaseManager.get_user(specific_user_id)]
            users = [u for u in users if u]  # Filter out None
        else:
            users = await SupabaseManager.get_users_watching_repository(repository)
        
        # Check each user's preferences
        for user in users:
            # Get user settings
            settings = await SupabaseManager.get_user_settings(user["id"])
            if not settings:
                continue
            
            # Check if user should be notified based on content analysis
            if self.content_analyzer.should_notify(analysis, settings):
                users_to_notify.append(user)
                continue
            
            # Check keyword matches
            if keyword_matches and settings.get("notify_on_keywords", True):
                user_keywords = settings.get("keywords", [])
                if any(kw in user_keywords for kw in keyword_matches):
                    users_to_notify.append(user)
                    continue
            
            # Check team mentions
            if team_mentions and settings.get("notify_on_team_mention", True):
                user_teams = settings.get("teams", [])
                for team in user_teams:
                    if team in team_mentions:
                        users_to_notify.append(user)
                        break
        
        return users_to_notify
    
    async def _send_notifications(self, users: List[Dict[str, Any]], content_type: str,
                                 content: Dict[str, Any], repository: str,
                                 results: Dict[str, Any]) -> None:
        """
        Send notifications to users.
        
        Args:
            users: Users to notify
            content_type: Type of content
            content: Content data
            repository: Repository name
            results: Processing results
        """
        for user in users:
            # Skip if no Slack ID
            if not user.get("slack_id"):
                continue
            
            # Create notification message
            message = self._create_notification_message(
                user, content_type, content, repository, results
            )
            
            # Send message
            try:
                await self.slack_service.send_direct_message(
                    user["slack_id"],
                    message["text"],
                    message["blocks"]
                )
            except Exception as e:
                logger.error(f"Error sending notification to user {user['id']}: {e}")
    
    def _create_notification_message(self, user: Dict[str, Any], content_type: str,
                                    content: Dict[str, Any], repository: str,
                                    results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a notification message.
        
        Args:
            user: User to notify
            content_type: Type of content
            content: Content data
            repository: Repository name
            results: Processing results
            
        Returns:
            Message data
        """
        analysis = results["analysis"]
        priority = analysis["priority"]
        patterns = analysis["patterns"]
        
        # Create priority prefix
        priority_prefix = ""
        if priority >= 5:
            priority_prefix = "🚨 *URGENT* "
        elif priority >= 4:
            priority_prefix = "⚠️ *Important* "
        elif priority >= 3:
            priority_prefix = "📢 "
        
        # Create title based on content type
        if content_type == "pull_request":
            title = f"{priority_prefix}Pull Request: {content.get('title', 'No title')}"
        elif content_type == "issue":
            title = f"{priority_prefix}Issue: {content.get('title', 'No title')}"
        elif content_type == "comment":
            title = f"{priority_prefix}New comment on {content.get('parent_type', 'item')}"
        elif content_type == "commit":
            title = f"{priority_prefix}New commit in {repository}"
        elif content_type == "review":
            title = f"{priority_prefix}New review on Pull Request"
        else:
            title = f"{priority_prefix}Activity in {repository}"
        
        # Create message text
        text = f"{title}\n\nRepository: {repository}"
        
        # Create blocks
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": title
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Repository:* {repository}"
                }
            }
        ]
        
        # Add content details
        if content_type == "pull_request" or content_type == "issue":
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": content.get('body', 'No description')[:1500] + 
                            ("..." if len(content.get('body', '')) > 1500 else "")
                }
            })
        elif content_type == "comment" or content_type == "review":
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": content.get('body', 'No comment')[:1500] + 
                            ("..." if len(content.get('body', '')) > 1500 else "")
                }
            })
        
        # Add analysis information
        if patterns:
            blocks.append({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Detected:* {', '.join(patterns)}"
                    }
                ]
            })
        
        # Add link to GitHub
        if content.get('html_url'):
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "View on GitHub"
                        },
                        "url": content['html_url']
                    }
                ]
            })
        
        return {
            "text": text,
            "blocks": blocks
        }
    
    async def _store_analysis(self, content_type: str, content: Dict[str, Any],
                             repository: str, results: Dict[str, Any]) -> None:
        """
        Store analysis results in database.
        
        Args:
            content_type: Type of content
            content: Content data
            repository: Repository name
            results: Processing results
        """
        try:
            # Create analysis record
            analysis_data = {
                "content_type": content_type,
                "content_id": str(content.get("id", "")),
                "repository": repository,
                "analysis": results["analysis"],
                "keyword_matches": results["keyword_matches"],
                "team_mentions": results["team_mentions"],
                "notification_sent": results["notification_sent"],
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Store in database
            await SupabaseManager.store_content_analysis(analysis_data)
        except Exception as e:
            logger.error(f"Error storing analysis: {e}")


class NotificationSummaryGenerator:
    """Generates summaries of notifications for users."""
    
    @staticmethod
    async def generate_daily_summary(user_id: str, days: int = 1) -> Dict[str, Any]:
        """
        Generate a daily summary of notifications for a user.
        
        Args:
            user_id: User ID
            days: Number of days to look back
            
        Returns:
            Summary data
        """
        # Get date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get notifications in date range
        notifications = await SupabaseManager.get_user_notifications(
            user_id, start_date.isoformat(), end_date.isoformat()
        )
        
        if not notifications:
            return {
                "user_id": user_id,
                "period": f"last {days} day(s)",
                "total_notifications": 0,
                "summary": "No notifications in this period",
                "categories": {}
            }
        
        # Count notifications by category
        categories = {}
        for notification in notifications:
            category = notification.get("content_type", "unknown")
            if category not in categories:
                categories[category] = []
            categories[category].append(notification)
        
        # Generate summary text
        total = len(notifications)
        summary = f"You received {total} notification(s) in the last {days} day(s)."
        
        # Add category breakdowns
        category_summaries = {}
        for category, items in categories.items():
            category_summaries[category] = {
                "count": len(items),
                "items": items
            }
        
        return {
            "user_id": user_id,
            "period": f"last {days} day(s)",
            "total_notifications": total,
            "summary": summary,
            "categories": category_summaries
        }
