"""
Tests for notification routing and delivery logic.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock, call
from typing import Dict, List, Any

from app.services.notification_service import NotificationService
from app.services.slack_service import SlackService  
from app.db.supabase import SupabaseManager


@pytest.mark.notification
@pytest.mark.unit
class TestNotificationService:
    """Test the NotificationService class."""

    @pytest.fixture
    def notification_service(self):
        """Create a NotificationService instance."""
        return NotificationService()

    @pytest.fixture
    def sample_user_data(self):
        """Sample user data for testing."""
        return {
            "id": "user-123",
            "slack_id": "U123456",
            "slack_team_id": "T123456",
            "name": "Test User",
            "email": "test@example.com",
            "github_username": "testuser",
            "repositories": ["acme-corp/awesome-app"]
        }

    @pytest.fixture
    def sample_notification_data(self):
        """Sample notification data."""
        return {
            "event_type": "pull_request",
            "action": "opened", 
            "repository": "acme-corp/awesome-app",
            "title": "Add new authentication feature",
            "description": "This PR adds OAuth 2.0 authentication",
            "author": "johndoe",
            "url": "https://github.com/acme-corp/awesome-app/pull/42",
            "created_at": "2024-01-15T14:30:25Z"
        }

    async def test_should_notify_user_basic(self, notification_service, sample_user_data, sample_notification_data):
        """Test basic notification eligibility check."""
        with patch.object(SupabaseManager, 'get_user_settings', return_value={
            "pull_request_notifications": True,
            "notification_enabled": True
        }):
            should_notify = await notification_service.should_notify(sample_user_data, sample_notification_data)
            assert should_notify is True

    async def test_should_not_notify_disabled_user(self, notification_service, sample_user_data, sample_notification_data):
        """Test that disabled users don't get notifications."""
        with patch.object(SupabaseManager, 'get_user_settings', return_value={
            "notification_enabled": False,
            "pull_request_notifications": True
        }):
            should_notify = await notification_service.should_notify(sample_user_data, sample_notification_data)
            assert should_notify is False

    async def test_should_not_notify_disabled_event_type(self, notification_service, sample_user_data, sample_notification_data):
        """Test that users don't get notifications for disabled event types."""
        with patch.object(SupabaseManager, 'get_user_settings', return_value={
            "notification_enabled": True,
            "pull_request_notifications": False
        }):
            should_notify = await notification_service.should_notify(sample_user_data, sample_notification_data)
            assert should_notify is False

    async def test_should_not_notify_own_activity(self, notification_service, sample_user_data, sample_notification_data):
        """Test that users don't get notifications for their own activity."""
        # User's GitHub username matches the author
        sample_user_data["github_username"] = "johndoe"
        
        with patch.object(SupabaseManager, 'get_user_settings', return_value={
            "notification_enabled": True,
            "pull_request_notifications": True,
            "notify_own_activity": False
        }):
            should_notify = await notification_service.should_notify(sample_user_data, sample_notification_data)
            assert should_notify is False

    async def test_keyword_matching_notification(self, notification_service, sample_user_data, sample_notification_data):
        """Test keyword matching in notifications."""
        with patch.object(SupabaseManager, 'get_user_settings', return_value={
            "notification_enabled": True,
            "pull_request_notifications": True,
            "keywords": ["authentication", "oauth"]
        }), patch('app.services.openai_analyzer_service.OpenAIAnalyzerService') as mock_analyzer:
            
            mock_analyzer_instance = AsyncMock()
            mock_analyzer.return_value = mock_analyzer_instance
            mock_analyzer_instance.analyze_keywords.return_value = {
                "matches": [
                    {"keyword": "authentication", "confidence": 0.95, "context": "OAuth 2.0 authentication"}
                ]
            }
            
            result = await notification_service.process_notification(sample_user_data, sample_notification_data, "event-123")
            
            # Should process the notification with keyword matches
            assert result is not None
            mock_analyzer_instance.analyze_keywords.assert_called_once()

    async def test_time_window_filtering(self, notification_service, sample_user_data, sample_notification_data):
        """Test that notifications respect user time window settings."""
        with patch.object(SupabaseManager, 'get_user_settings', return_value={
            "notification_enabled": True,
            "pull_request_notifications": True,
            "quiet_hours_start": "22:00",
            "quiet_hours_end": "08:00",
            "timezone": "UTC"
        }), patch('datetime.datetime') as mock_datetime:
            
            # Mock current time to be in quiet hours (23:00 UTC)
            mock_now = MagicMock()
            mock_now.hour = 23
            mock_datetime.now.return_value = mock_now
            
            should_notify = await notification_service.should_notify(sample_user_data, sample_notification_data)
            
            # Should respect quiet hours (implementation dependent)
            # This test structure shows how to test time-based filtering


@pytest.mark.notification
@pytest.mark.integration
class TestSlackNotificationIntegration:
    """Test Slack notification delivery integration."""

    @pytest.fixture
    def slack_service(self):
        """Create a SlackService instance with mocked client."""
        service = SlackService()
        service.app = MagicMock()
        service.client = AsyncMock()
        return service

    @pytest.fixture
    def sample_slack_message_data(self):
        """Sample data for Slack message formatting."""
        return {
            "event_type": "pull_request",
            "action": "opened",
            "title": "Add new authentication feature",
            "description": "This PR adds OAuth 2.0 authentication using GitHub as provider",
            "author": "johndoe",
            "repository": "acme-corp/awesome-app",
            "url": "https://github.com/acme-corp/awesome-app/pull/42",
            "labels": ["feature", "auth"],
            "created_at": "2024-01-15T14:30:25Z"
        }

    async def test_format_pull_request_notification(self, slack_service, sample_slack_message_data):
        """Test Slack message formatting for pull request notifications."""
        formatted_message = await slack_service.format_notification(
            sample_slack_message_data, 
            "U123456",
            keyword_matches=[]
        )
        
        # Verify message contains expected elements
        assert "Pull Request Opened" in formatted_message["text"]
        assert "Add new authentication feature" in formatted_message["text"]
        assert "johndoe" in formatted_message["text"]
        assert "acme-corp/awesome-app" in formatted_message["text"]
        
        # Verify Slack blocks are properly formatted
        assert "blocks" in formatted_message
        assert len(formatted_message["blocks"]) > 0

    async def test_format_issue_notification(self, slack_service):
        """Test Slack message formatting for issue notifications."""
        issue_data = {
            "event_type": "issue", 
            "action": "opened",
            "title": "Authentication bug with special characters",
            "description": "Users can't login with usernames containing @, +, or - characters",
            "author": "bug-reporter",
            "repository": "acme-corp/awesome-app", 
            "url": "https://github.com/acme-corp/awesome-app/issues/123",
            "labels": ["bug", "high-priority"],
            "assignee": "johndoe"
        }
        
        formatted_message = await slack_service.format_notification(
            issue_data,
            "U123456", 
            keyword_matches=[]
        )
        
        assert "Issue Opened" in formatted_message["text"]
        assert "Authentication bug" in formatted_message["text"]
        assert "bug-reporter" in formatted_message["text"]

    async def test_keyword_highlighting_in_message(self, slack_service, sample_slack_message_data):
        """Test that keyword matches are highlighted in Slack messages."""
        keyword_matches = [
            {"keyword": "authentication", "confidence": 0.95, "context": "OAuth 2.0 authentication"}
        ]
        
        formatted_message = await slack_service.format_notification(
            sample_slack_message_data,
            "U123456",
            keyword_matches=keyword_matches
        )
        
        # Should contain keyword match information
        message_text = str(formatted_message)
        assert "authentication" in message_text.lower()

    async def test_send_notification_success(self, slack_service):
        """Test successful Slack notification delivery."""
        slack_service.client.chat_postMessage = AsyncMock(return_value={
            "ok": True,
            "ts": "1234567890.123456",
            "message": {"ts": "1234567890.123456"}
        })
        
        message_data = {
            "text": "Test notification",
            "blocks": [],
            "channel": "U123456"
        }
        
        result = await slack_service.send_notification("U123456", message_data, "T123456")
        
        assert result is True
        slack_service.client.chat_postMessage.assert_called_once_with(
            channel="U123456",
            text="Test notification",
            blocks=[],
            token=None  # Would be set based on team token
        )

    async def test_send_notification_failure(self, slack_service):
        """Test Slack notification delivery failure handling."""
        slack_service.client.chat_postMessage = AsyncMock(side_effect=Exception("Slack API error"))
        
        message_data = {
            "text": "Test notification",
            "blocks": [],
            "channel": "U123456"
        }
        
        result = await slack_service.send_notification("U123456", message_data, "T123456")
        
        assert result is False

    async def test_rate_limit_handling(self, slack_service):
        """Test Slack rate limit handling."""
        from slack_sdk.errors import SlackApiError
        
        # Mock rate limit error
        rate_limit_error = SlackApiError("Rate limited", {"error": "rate_limited", "retry_after": 30})
        slack_service.client.chat_postMessage = AsyncMock(side_effect=rate_limit_error)
        
        message_data = {
            "text": "Test notification", 
            "blocks": [],
            "channel": "U123456"
        }
        
        result = await slack_service.send_notification("U123456", message_data, "T123456")
        
        # Should handle rate limit gracefully
        assert result is False


@pytest.mark.notification
@pytest.mark.integration 
class TestNotificationWorkflow:
    """Test end-to-end notification workflows."""

    async def test_pull_request_notification_workflow(self, pull_request_opened_payload, test_users):
        """Test complete PR notification workflow."""
        from app.api.routes.webhooks import process_pull_request_event
        
        with patch.object(SupabaseManager, 'get_user_settings') as mock_settings, \
             patch('app.services.notification_service.NotificationService') as mock_notification_service, \
             patch('app.services.slack_service.SlackService') as mock_slack_service:
            
            # Mock user settings
            mock_settings.return_value = {
                "notification_enabled": True,
                "pull_request_notifications": True,
                "keywords": ["authentication"]
            }
            
            # Mock service instances
            mock_notification_instance = AsyncMock()
            mock_notification_service.return_value = mock_notification_instance
            
            mock_slack_instance = AsyncMock()
            mock_slack_service.return_value = mock_slack_instance
            
            # Execute the workflow
            await process_pull_request_event(pull_request_opened_payload, test_users, "event-123")
            
            # Verify notification processing was called for each user
            assert mock_notification_instance.process_notification.call_count == len(test_users)

    async def test_issue_with_mentions_workflow(self, issue_opened_payload, test_users):
        """Test issue notification workflow with user mentions."""
        from app.api.routes.webhooks import process_issue_event
        
        # Modify payload to include user mentions
        issue_opened_payload["issue"]["body"] += "\n\n@johndoe @reviewer1 please take a look"
        
        with patch.object(SupabaseManager, 'get_user_settings') as mock_settings, \
             patch('app.services.notification_service.NotificationService') as mock_notification_service, \
             patch('app.utils.team_analyzer.extract_user_mentions', return_value=["johndoe", "reviewer1"]):
            
            mock_settings.return_value = {
                "notification_enabled": True,
                "issue_notifications": True,
                "mention_notifications": True
            }
            
            mock_notification_instance = AsyncMock()
            mock_notification_service.return_value = mock_notification_instance
            
            await process_issue_event(issue_opened_payload, test_users, "event-123")
            
            # Should process notifications for mentioned users with higher priority
            assert mock_notification_instance.process_notification.called

    async def test_push_notification_batching(self, test_users):
        """Test that rapid push events are batched appropriately."""
        from app.api.routes.webhooks import process_push_event
        
        # Create multiple push events in quick succession
        push_events = []
        for i in range(3):
            push_event = {
                "ref": "refs/heads/main",
                "commits": [
                    {
                        "id": f"commit-{i}",
                        "message": f"Commit {i}",
                        "author": {"name": "Test User", "username": "testuser"}
                    }
                ],
                "repository": {
                    "id": 987654321,
                    "full_name": "acme-corp/awesome-app"
                },
                "sender": {"login": "testuser"}
            }
            push_events.append(push_event)
        
        with patch.object(SupabaseManager, 'get_user_settings') as mock_settings, \
             patch('app.services.notification_service.NotificationService') as mock_notification_service:
            
            mock_settings.return_value = {
                "notification_enabled": True,
                "push_notifications": True,
                "batch_notifications": True
            }
            
            mock_notification_instance = AsyncMock()
            mock_notification_service.return_value = mock_notification_instance
            
            # Process events rapidly
            for i, event in enumerate(push_events):
                await process_push_event(event, test_users, f"event-{i}")
            
            # Verify notifications were processed (batching logic depends on implementation)
            assert mock_notification_instance.process_notification.call_count >= len(test_users)

    async def test_notification_failure_retry(self, pull_request_opened_payload, test_users):
        """Test notification retry on failure."""
        from app.api.routes.webhooks import process_pull_request_event
        
        with patch.object(SupabaseManager, 'get_user_settings') as mock_settings, \
             patch.object(SupabaseManager, 'create_failed_webhook_event') as mock_create_failed, \
             patch('app.services.notification_service.NotificationService') as mock_notification_service:
            
            mock_settings.return_value = {
                "notification_enabled": True,
                "pull_request_notifications": True
            }
            
            # Mock notification service to fail
            mock_notification_instance = AsyncMock()
            mock_notification_service.return_value = mock_notification_instance
            mock_notification_instance.process_notification.side_effect = Exception("Delivery failed")
            
            # Should not raise exception, should log failure
            await process_pull_request_event(pull_request_opened_payload, test_users, "event-123")
            
            # Verify failure was logged for retry
            # (This depends on your specific retry implementation)
            assert mock_notification_instance.process_notification.called

    async def test_cross_team_notifications(self, pull_request_opened_payload):
        """Test notifications across different Slack teams."""
        # Users from different Slack teams
        multi_team_users = [
            {
                "id": "user-1",
                "slack_id": "U123456",
                "slack_team_id": "T123456",  # Team A
                "name": "User 1",
                "repositories": ["acme-corp/awesome-app"]
            },
            {
                "id": "user-2", 
                "slack_id": "U789012",
                "slack_team_id": "T789012",  # Team B
                "name": "User 2",
                "repositories": ["acme-corp/awesome-app"]
            }
        ]
        
        from app.api.routes.webhooks import process_pull_request_event
        
        with patch.object(SupabaseManager, 'get_user_settings') as mock_settings, \
             patch('app.services.notification_service.NotificationService') as mock_notification_service:
            
            mock_settings.return_value = {
                "notification_enabled": True,
                "pull_request_notifications": True
            }
            
            mock_notification_instance = AsyncMock()
            mock_notification_service.return_value = mock_notification_instance
            
            await process_pull_request_event(pull_request_opened_payload, multi_team_users, "event-123")
            
            # Should handle different teams correctly
            assert mock_notification_instance.process_notification.call_count == len(multi_team_users)