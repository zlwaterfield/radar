"""
Context-aware notification grouping utilities for Radar.

This module provides intelligent grouping of related GitHub events to reduce notification noise.
"""
import logging
from typing import Dict, List, Optional, Any, Set
from datetime import datetime, timedelta
import re

logger = logging.getLogger(__name__)


class EventContext:
    """Represents the context of a GitHub event."""
    
    def __init__(self, event_type: str, event_data: Dict[str, Any]):
        """
        Initialize event context.
        
        Args:
            event_type: Type of event
            event_data: Event data
        """
        self.event_type = event_type
        self.event_data = event_data
        self.repository = event_data.get("repository", {}).get("full_name", "")
        self.actor = event_data.get("actor", {}).get("login", "")
        self.created_at = event_data.get("created_at", "")
        
        # Extract context-specific identifiers
        self.pr_number = None
        self.issue_number = None
        self.commit_id = None
        
        if event_type == "PullRequestEvent" or event_type == "PullRequestReviewEvent":
            self.pr_number = event_data.get("payload", {}).get("pull_request", {}).get("number")
        elif event_type == "IssuesEvent" or event_type == "IssueCommentEvent":
            self.issue_number = event_data.get("payload", {}).get("issue", {}).get("number")
        elif event_type == "PushEvent":
            commits = event_data.get("payload", {}).get("commits", [])
            if commits:
                self.commit_id = commits[0].get("sha")
        elif event_type == "CommitCommentEvent":
            self.commit_id = event_data.get("payload", {}).get("comment", {}).get("commit_id")
    
    def get_context_key(self) -> str:
        """
        Get a key representing the context of this event.
        
        Returns:
            Context key
        """
        if self.pr_number:
            return f"{self.repository}:pr:{self.pr_number}"
        elif self.issue_number:
            return f"{self.repository}:issue:{self.issue_number}"
        elif self.commit_id:
            return f"{self.repository}:commit:{self.commit_id}"
        else:
            return f"{self.repository}:general"
    
    def get_title(self) -> str:
        """
        Get a title for this event context.
        
        Returns:
            Context title
        """
        if self.pr_number:
            pr_title = self.event_data.get("payload", {}).get("pull_request", {}).get("title", "")
            return f"PR #{self.pr_number}: {pr_title}"
        elif self.issue_number:
            issue_title = self.event_data.get("payload", {}).get("issue", {}).get("title", "")
            return f"Issue #{self.issue_number}: {issue_title}"
        elif self.commit_id:
            commit_message = ""
            commits = self.event_data.get("payload", {}).get("commits", [])
            if commits:
                commit_message = commits[0].get("message", "").split("\n")[0]
            return f"Commit {self.commit_id[:7]}: {commit_message}"
        else:
            return f"Activity in {self.repository}"
    
    def get_url(self) -> str:
        """
        Get a URL for this event context.
        
        Returns:
            Context URL
        """
        if self.pr_number:
            return f"https://github.com/{self.repository}/pull/{self.pr_number}"
        elif self.issue_number:
            return f"https://github.com/{self.repository}/issues/{self.issue_number}"
        elif self.commit_id:
            return f"https://github.com/{self.repository}/commit/{self.commit_id}"
        else:
            return f"https://github.com/{self.repository}"


class ContextGroup:
    """Represents a group of related GitHub events."""
    
    def __init__(self, context_key: str, title: str, url: str):
        """
        Initialize context group.
        
        Args:
            context_key: Context key
            title: Group title
            url: Group URL
        """
        self.context_key = context_key
        self.title = title
        self.url = url
        self.events = []
        self.actors = set()
        self.last_updated = None
    
    def add_event(self, event: Dict[str, Any], context: EventContext) -> None:
        """
        Add an event to the group.
        
        Args:
            event: Event data
            context: Event context
        """
        self.events.append(event)
        self.actors.add(context.actor)
        
        # Update last_updated time
        event_time = context.created_at
        if event_time:
            try:
                event_datetime = datetime.fromisoformat(event_time.replace("Z", "+00:00"))
                if not self.last_updated or event_datetime > self.last_updated:
                    self.last_updated = event_datetime
            except (ValueError, TypeError):
                pass
    
    def get_summary(self) -> Dict[str, Any]:
        """
        Get a summary of the context group.
        
        Returns:
            Group summary
        """
        # Count events by type
        event_counts = {}
        for event in self.events:
            event_type = event.get("type", "Unknown")
            if event_type not in event_counts:
                event_counts[event_type] = 0
            event_counts[event_type] += 1
        
        # Generate activity summary
        activity_summary = []
        for event_type, count in event_counts.items():
            activity_text = ContextGrouper._get_activity_text(event_type, count)
            if activity_text:
                activity_summary.append(activity_text)
        
        # Format actors
        actor_list = list(self.actors)
        if len(actor_list) == 1:
            actors_text = actor_list[0]
        elif len(actor_list) == 2:
            actors_text = f"{actor_list[0]} and {actor_list[1]}"
        elif len(actor_list) > 2:
            actors_text = f"{actor_list[0]}, {actor_list[1]}, and {len(actor_list) - 2} others"
        else:
            actors_text = "Unknown users"
        
        # Format time
        time_text = ""
        if self.last_updated:
            time_text = self.last_updated.strftime("%Y-%m-%d %H:%M:%S UTC")
        
        return {
            "context_key": self.context_key,
            "title": self.title,
            "url": self.url,
            "event_count": len(self.events),
            "event_counts": event_counts,
            "activity_summary": ", ".join(activity_summary),
            "actors": actor_list,
            "actors_text": actors_text,
            "last_updated": time_text,
            "events": self.events
        }


class ContextGrouper:
    """Groups related GitHub events to reduce notification noise."""
    
    @staticmethod
    def group_events(events: List[Dict[str, Any]], time_window: int = 60) -> List[Dict[str, Any]]:
        """
        Group related events within a time window.
        
        Args:
            events: List of GitHub events
            time_window: Time window in minutes for grouping events
            
        Returns:
            List of context group summaries
        """
        # Create context for each event
        event_contexts = []
        for event in events:
            context = EventContext(event.get("type", ""), event)
            event_contexts.append((event, context))
        
        # Group events by context key
        context_groups = {}
        for event, context in event_contexts:
            context_key = context.get_context_key()
            
            if context_key not in context_groups:
                context_groups[context_key] = ContextGroup(
                    context_key, context.get_title(), context.get_url()
                )
            
            context_groups[context_key].add_event(event, context)
        
        # Further group by time window
        time_grouped = ContextGrouper._group_by_time(
            list(context_groups.values()), time_window
        )
        
        # Generate summaries
        return [group.get_summary() for group in time_grouped]
    
    @staticmethod
    def _group_by_time(groups: List[ContextGroup], time_window: int) -> List[ContextGroup]:
        """
        Group context groups by time window.
        
        Args:
            groups: List of context groups
            time_window: Time window in minutes
            
        Returns:
            List of merged context groups
        """
        # Sort groups by last_updated time
        sorted_groups = sorted(
            groups,
            key=lambda g: g.last_updated if g.last_updated else datetime.min,
            reverse=True
        )
        
        # Group by time window
        result = []
        for group in sorted_groups:
            # Skip groups without last_updated time
            if not group.last_updated:
                result.append(group)
                continue
            
            # Try to find a matching group within the time window
            found_match = False
            for existing_group in result:
                if not existing_group.last_updated:
                    continue
                
                time_diff = abs((group.last_updated - existing_group.last_updated).total_seconds())
                if time_diff <= (time_window * 60):
                    # Check if they are related (same repository)
                    if group.context_key.split(":")[0] == existing_group.context_key.split(":")[0]:
                        # Merge groups
                        for event in group.events:
                            context = EventContext(event.get("type", ""), event)
                            existing_group.add_event(event, context)
                        found_match = True
                        break
            
            if not found_match:
                result.append(group)
        
        return result
    
    @staticmethod
    def _get_activity_text(event_type: str, count: int) -> str:
        """
        Get human-readable activity text for an event type.
        
        Args:
            event_type: Event type
            count: Event count
            
        Returns:
            Activity text
        """
        if event_type == "PushEvent":
            return f"{count} push{'es' if count > 1 else ''}"
        elif event_type == "PullRequestEvent":
            return f"{count} pull request update{'s' if count > 1 else ''}"
        elif event_type == "PullRequestReviewEvent":
            return f"{count} review{'s' if count > 1 else ''}"
        elif event_type == "IssuesEvent":
            return f"{count} issue update{'s' if count > 1 else ''}"
        elif event_type == "IssueCommentEvent":
            return f"{count} comment{'s' if count > 1 else ''}"
        elif event_type == "CommitCommentEvent":
            return f"{count} commit comment{'s' if count > 1 else ''}"
        elif event_type == "CreateEvent":
            return f"{count} branch/tag creation{'s' if count > 1 else ''}"
        elif event_type == "DeleteEvent":
            return f"{count} branch/tag deletion{'s' if count > 1 else ''}"
        elif event_type == "ForkEvent":
            return f"{count} fork{'s' if count > 1 else ''}"
        elif event_type == "WatchEvent":
            return f"{count} star{'s' if count > 1 else ''}"
        else:
            return f"{count} {event_type}{'s' if count > 1 else ''}"
    
    @staticmethod
    def format_slack_message(group_summary: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format a context group summary as a Slack message.
        
        Args:
            group_summary: Context group summary
            
        Returns:
            Slack message
        """
        # Create message text
        text = f"*{group_summary['title']}*\n{group_summary['activity_summary']} by {group_summary['actors_text']}"
        
        # Create blocks
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": group_summary['title']
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Activity:* {group_summary['activity_summary']}\n*By:* {group_summary['actors_text']}\n*Last updated:* {group_summary['last_updated']}"
                }
            }
        ]
        
        # Add event details
        event_details = []
        for event_type, count in group_summary['event_counts'].items():
            event_details.append(f"• {ContextGrouper._get_activity_text(event_type, count)}")
        
        if event_details:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Details:*\n" + "\n".join(event_details)
                }
            })
        
        # Add link to GitHub
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "View on GitHub"
                    },
                    "url": group_summary['url']
                }
            ]
        })
        
        return {
            "text": text,
            "blocks": blocks
        }
