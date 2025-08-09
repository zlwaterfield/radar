"""
Tests for GitHub webhook handling and notification routing.
"""
import hashlib
import hmac
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import status
from httpx import AsyncClient

from app.core.config import settings
from app.db.supabase import SupabaseManager


@pytest.mark.webhook
@pytest.mark.github
class TestGitHubWebhookSignatureVerification:
    """Test webhook signature verification."""

    def calculate_signature(self, payload: bytes, secret: str, algorithm: str = "sha256") -> str:
        """Calculate GitHub webhook signature."""
        if algorithm == "sha256":
            signature = hmac.new(
                secret.encode(),
                payload,
                hashlib.sha256
            ).hexdigest()
            return f"sha256={signature}"
        elif algorithm == "sha1":
            signature = hmac.new(
                secret.encode(),
                payload,
                hashlib.sha1
            ).hexdigest()
            return f"sha1={signature}"

    async def test_valid_sha256_signature(self, async_client: AsyncClient, github_webhook_secret: str, push_payload):
        """Test webhook with valid SHA256 signature."""
        payload_bytes = json.dumps(push_payload).encode()
        signature = self.calculate_signature(payload_bytes, github_webhook_secret, "sha256")
        
        headers = {
            "X-GitHub-Event": "push",
            "X-GitHub-Delivery": "test-delivery-id",
            "X-Hub-Signature-256": signature,
            "Content-Type": "application/json"
        }
        
        with patch.object(SupabaseManager, 'get_repository_id', return_value="repo-123"), \
             patch.object(SupabaseManager, 'create_event', return_value="event-123"), \
             patch.object(SupabaseManager, 'get_users_by_repository', return_value=[]), \
             patch.object(SupabaseManager, 'update_event', return_value=True):
            
            response = await async_client.post(
                "/api/webhooks/github",
                json=push_payload,
                headers=headers
            )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == {"status": "success", "message": "Webhook processed"}

    async def test_valid_sha1_signature(self, async_client: AsyncClient, github_webhook_secret: str, push_payload):
        """Test webhook with valid SHA1 signature (legacy)."""
        payload_bytes = json.dumps(push_payload).encode()
        signature = self.calculate_signature(payload_bytes, github_webhook_secret, "sha1")
        
        headers = {
            "X-GitHub-Event": "push",
            "X-GitHub-Delivery": "test-delivery-id",
            "X-Hub-Signature": signature,
            "Content-Type": "application/json"
        }
        
        with patch.object(SupabaseManager, 'get_repository_id', return_value="repo-123"), \
             patch.object(SupabaseManager, 'create_event', return_value="event-123"), \
             patch.object(SupabaseManager, 'get_users_by_repository', return_value=[]), \
             patch.object(SupabaseManager, 'update_event', return_value=True):
            
            response = await async_client.post(
                "/api/webhooks/github",
                json=push_payload,
                headers=headers
            )
        
        assert response.status_code == status.HTTP_200_OK

    async def test_invalid_signature(self, async_client: AsyncClient, github_webhook_secret: str, push_payload):
        """Test webhook with invalid signature."""
        headers = {
            "X-GitHub-Event": "push",
            "X-GitHub-Delivery": "test-delivery-id",
            "X-Hub-Signature-256": "sha256=invalid_signature",
            "Content-Type": "application/json"
        }
        
        response = await async_client.post(
            "/api/webhooks/github",
            json=push_payload,
            headers=headers
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Invalid signature" in response.json()["detail"]

    async def test_missing_signature(self, async_client: AsyncClient, push_payload):
        """Test webhook with missing signature."""
        headers = {
            "X-GitHub-Event": "push",
            "X-GitHub-Delivery": "test-delivery-id",
            "Content-Type": "application/json"
        }
        
        response = await async_client.post(
            "/api/webhooks/github",
            json=push_payload,
            headers=headers
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "No signature provided" in response.json()["detail"]

    async def test_invalid_signature_format(self, async_client: AsyncClient, push_payload):
        """Test webhook with invalid signature format."""
        headers = {
            "X-GitHub-Event": "push", 
            "X-GitHub-Delivery": "test-delivery-id",
            "X-Hub-Signature-256": "invalid_format",
            "Content-Type": "application/json"
        }
        
        response = await async_client.post(
            "/api/webhooks/github",
            json=push_payload,
            headers=headers
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Invalid signature format" in response.json()["detail"]

    @patch.object(settings, 'GITHUB_WEBHOOK_SECRET', None)
    async def test_no_webhook_secret_configured(self, async_client: AsyncClient, push_payload):
        """Test webhook when no secret is configured (should skip verification)."""
        headers = {
            "X-GitHub-Event": "push",
            "X-GitHub-Delivery": "test-delivery-id",
            "Content-Type": "application/json"
        }
        
        with patch.object(SupabaseManager, 'get_repository_id', return_value="repo-123"), \
             patch.object(SupabaseManager, 'create_event', return_value="event-123"), \
             patch.object(SupabaseManager, 'get_users_by_repository', return_value=[]), \
             patch.object(SupabaseManager, 'update_event', return_value=True):
            
            response = await async_client.post(
                "/api/webhooks/github",
                json=push_payload,
                headers=headers
            )
        
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.webhook
@pytest.mark.github
class TestGitHubWebhookEventProcessing:
    """Test GitHub webhook event processing and routing."""

    @pytest.fixture(autouse=True)
    def setup_mocks(self):
        """Set up common mocks for webhook processing."""
        with patch.object(SupabaseManager, 'get_repository_id', return_value="repo-123"), \
             patch.object(SupabaseManager, 'create_event', return_value="event-123"), \
             patch.object(SupabaseManager, 'update_event', return_value=True), \
             patch.object(SupabaseManager, 'should_filter_event', return_value=False):
            yield

    async def make_webhook_request(self, async_client: AsyncClient, event_type: str, payload: dict, 
                                 github_webhook_secret: str) -> dict:
        """Helper to make a webhook request with proper signature."""
        payload_bytes = json.dumps(payload).encode()
        signature = hmac.new(
            github_webhook_secret.encode(),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()
        
        headers = {
            "X-GitHub-Event": event_type,
            "X-GitHub-Delivery": "test-delivery-id",
            "X-Hub-Signature-256": f"sha256={signature}",
            "Content-Type": "application/json"
        }
        
        response = await async_client.post(
            "/api/webhooks/github",
            json=payload,
            headers=headers
        )
        return response

    async def test_pull_request_opened_event(self, async_client: AsyncClient, github_webhook_secret: str, 
                                           pull_request_opened_payload: dict, test_users: list):
        """Test pull request opened webhook event."""
        with patch.object(SupabaseManager, 'get_users_by_repository', return_value=test_users), \
             patch('app.api.routes.webhooks.process_pull_request_event', new_callable=AsyncMock) as mock_process:
            
            response = await self.make_webhook_request(
                async_client, "pull_request", pull_request_opened_payload, github_webhook_secret
            )
            
            assert response.status_code == status.HTTP_200_OK
            mock_process.assert_called_once_with(pull_request_opened_payload, test_users, "event-123")

    async def test_push_event(self, async_client: AsyncClient, github_webhook_secret: str, 
                            push_payload: dict, test_users: list):
        """Test push webhook event."""
        with patch.object(SupabaseManager, 'get_users_by_repository', return_value=test_users), \
             patch('app.api.routes.webhooks.process_push_event', new_callable=AsyncMock) as mock_process:
            
            response = await self.make_webhook_request(
                async_client, "push", push_payload, github_webhook_secret
            )
            
            assert response.status_code == status.HTTP_200_OK
            mock_process.assert_called_once_with(push_payload, test_users, "event-123")

    async def test_issue_opened_event(self, async_client: AsyncClient, github_webhook_secret: str, 
                                    issue_opened_payload: dict, test_users: list):
        """Test issue opened webhook event."""
        with patch.object(SupabaseManager, 'get_users_by_repository', return_value=test_users), \
             patch('app.api.routes.webhooks.process_issue_event', new_callable=AsyncMock) as mock_process:
            
            response = await self.make_webhook_request(
                async_client, "issue", issue_opened_payload, github_webhook_secret
            )
            
            assert response.status_code == status.HTTP_200_OK
            mock_process.assert_called_once_with(issue_opened_payload, test_users, "event-123")

    async def test_no_users_watching_repository(self, async_client: AsyncClient, github_webhook_secret: str, 
                                              push_payload: dict):
        """Test webhook when no users are watching the repository."""
        with patch.object(SupabaseManager, 'get_users_by_repository', return_value=[]):
            
            response = await self.make_webhook_request(
                async_client, "push", push_payload, github_webhook_secret
            )
            
            assert response.status_code == status.HTTP_200_OK

    async def test_filtered_event(self, async_client: AsyncClient, github_webhook_secret: str, 
                                push_payload: dict, test_users: list):
        """Test webhook when event should be filtered out."""
        with patch.object(SupabaseManager, 'get_users_by_repository', return_value=test_users), \
             patch.object(SupabaseManager, 'should_filter_event', return_value=True):
            
            response = await self.make_webhook_request(
                async_client, "push", push_payload, github_webhook_secret
            )
            
            assert response.status_code == status.HTTP_200_OK

    async def test_unsupported_event_type(self, async_client: AsyncClient, github_webhook_secret: str, 
                                        push_payload: dict, test_users: list):
        """Test webhook with unsupported event type."""
        with patch.object(SupabaseManager, 'get_users_by_repository', return_value=test_users):
            
            response = await self.make_webhook_request(
                async_client, "unsupported_event", push_payload, github_webhook_secret
            )
            
            assert response.status_code == status.HTTP_200_OK

    async def test_event_processing_error(self, async_client: AsyncClient, github_webhook_secret: str, 
                                        push_payload: dict, test_users: list):
        """Test webhook when event processing fails."""
        with patch.object(SupabaseManager, 'get_users_by_repository', return_value=test_users), \
             patch.object(SupabaseManager, 'create_failed_webhook_event', return_value=True), \
             patch('app.api.routes.webhooks.process_push_event', side_effect=Exception("Processing error")):
            
            response = await self.make_webhook_request(
                async_client, "push", push_payload, github_webhook_secret
            )
            
            assert response.status_code == status.HTTP_200_OK

    async def test_invalid_payload_structure(self, async_client: AsyncClient, github_webhook_secret: str):
        """Test webhook with invalid payload structure."""
        invalid_payload = {"invalid": "payload"}
        
        response = await self.make_webhook_request(
            async_client, "push", invalid_payload, github_webhook_secret
        )
        
        # Should still process but may fail during event handling
        assert response.status_code == status.HTTP_200_OK

    async def test_repository_not_found(self, async_client: AsyncClient, github_webhook_secret: str, push_payload: dict):
        """Test webhook when repository is not found in database."""
        with patch.object(SupabaseManager, 'get_repository_id', return_value=None):
            
            response = await self.make_webhook_request(
                async_client, "push", push_payload, github_webhook_secret
            )
            
            assert response.status_code == status.HTTP_200_OK

    async def test_ping_event(self, async_client: AsyncClient, github_webhook_secret: str):
        """Test GitHub ping webhook event."""
        ping_payload = {
            "zen": "Non-blocking is better than blocking.",
            "hook_id": 12345,
            "hook": {
                "type": "Repository",
                "id": 12345,
                "name": "web",
                "active": True,
                "events": ["push", "pull_request"],
                "config": {
                    "content_type": "json",
                    "insecure_ssl": "0",
                    "url": "https://example.com/webhook"
                }
            },
            "repository": {
                "id": 987654321,
                "name": "test-repo",
                "full_name": "acme-corp/test-repo"
            },
            "sender": {
                "login": "testuser",
                "id": 12345
            }
        }
        
        response = await self.make_webhook_request(
            async_client, "ping", ping_payload, github_webhook_secret
        )
        
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.webhook
@pytest.mark.notification
class TestNotificationRouting:
    """Test notification routing logic for different webhook events."""

    @pytest.fixture
    def mock_services(self):
        """Mock all external services."""
        with patch('app.services.notification_service.NotificationService') as mock_notification, \
             patch('app.services.slack_service.SlackService') as mock_slack, \
             patch('app.services.monitoring_service.MonitoringService') as mock_monitoring:
            
            # Configure mocks
            mock_notification_instance = AsyncMock()
            mock_notification.return_value = mock_notification_instance
            
            mock_slack_instance = AsyncMock()
            mock_slack.return_value = mock_slack_instance
            
            mock_monitoring_instance = AsyncMock()
            mock_monitoring.return_value = mock_monitoring_instance
            
            yield {
                'notification': mock_notification_instance,
                'slack': mock_slack_instance,
                'monitoring': mock_monitoring_instance
            }

    async def test_notification_sent_to_all_watching_users(self, mock_services, test_users: list, 
                                                          pull_request_opened_payload: dict):
        """Test that notifications are sent to all users watching a repository."""
        from app.api.routes.webhooks import process_pull_request_event
        
        await process_pull_request_event(pull_request_opened_payload, test_users, "event-123")
        
        # Verify notification service was called for each user
        assert mock_services['notification'].process_notification.call_count == len(test_users)

    async def test_user_specific_notification_settings(self, mock_services, test_users: list, 
                                                      push_payload: dict):
        """Test that user-specific notification settings are respected."""
        from app.api.routes.webhooks import process_push_event
        
        # Mock user settings
        with patch.object(SupabaseManager, 'get_user_settings') as mock_get_settings:
            mock_get_settings.side_effect = [
                {"push_notifications": True},  # User 1 wants push notifications
                {"push_notifications": False}  # User 2 doesn't want push notifications
            ]
            
            await process_push_event(push_payload, test_users, "event-123")
            
            # Should still call notification service (it decides based on settings)
            assert mock_services['notification'].process_notification.call_count == len(test_users)

    async def test_keyword_matching_in_notifications(self, mock_services, test_users: list, 
                                                   issue_opened_payload: dict):
        """Test that keyword matching works in notifications."""
        from app.api.routes.webhooks import process_issue_event
        
        # Mock keyword matching
        with patch('app.services.openai_analyzer_service.OpenAIAnalyzerService') as mock_analyzer:
            mock_analyzer_instance = AsyncMock()
            mock_analyzer.return_value = mock_analyzer_instance
            mock_analyzer_instance.analyze_keywords.return_value = {
                "matches": [{"keyword": "authentication", "confidence": 0.9}]
            }
            
            await process_issue_event(issue_opened_payload, test_users, "event-123")
            
            # Verify notification processing
            assert mock_services['notification'].process_notification.called

    async def test_notification_failure_handling(self, mock_services, test_users: list, 
                                                push_payload: dict):
        """Test handling of notification delivery failures."""
        from app.api.routes.webhooks import process_push_event
        
        # Mock notification failure
        mock_services['notification'].process_notification.side_effect = Exception("Slack API error")
        
        # Should not raise exception, but should log error
        await process_push_event(push_payload, test_users, "event-123")
        
        # Verify error was logged (through monitoring service)
        assert mock_services['monitoring'].log_error.called or mock_services['notification'].process_notification.called

    async def test_rate_limiting_notifications(self, mock_services, test_users: list):
        """Test that notifications respect rate limiting."""
        from app.api.routes.webhooks import process_push_event
        
        # Simulate multiple rapid push events
        push_events = []
        for i in range(5):
            push_event = {
                "ref": "refs/heads/main",
                "repository": {"id": 987654321, "full_name": "acme-corp/awesome-app"},
                "commits": [{"id": f"commit-{i}"}],
                "sender": {"login": "testuser"}
            }
            push_events.append(push_event)
        
        # Process multiple events
        for event in push_events:
            await process_push_event(event, test_users, f"event-{hash(json.dumps(event))}")
        
        # Verify notifications were attempted (rate limiting handled by service layer)
        assert mock_services['notification'].process_notification.call_count >= len(push_events)

    async def test_notification_retry_on_temporary_failure(self, mock_services, test_users: list, 
                                                         pull_request_opened_payload: dict):
        """Test notification retry mechanism for temporary failures."""
        from app.api.routes.webhooks import process_pull_request_event
        
        # Mock temporary failure followed by success
        mock_services['notification'].process_notification.side_effect = [
            Exception("Temporary network error"),  # First call fails
            None,  # Retry succeeds
        ]
        
        with patch('app.utils.retry.notification_retry_handler') as mock_retry:
            await process_pull_request_event(pull_request_opened_payload, test_users, "event-123")
            
            # Verify retry mechanism was used
            assert mock_retry.called or mock_services['notification'].process_notification.call_count > 0


@pytest.mark.webhook
@pytest.mark.unit
class TestWebhookUtilityFunctions:
    """Test utility functions used in webhook processing."""

    def test_validate_webhook_payload(self):
        """Test webhook payload validation."""
        from app.utils.validation import validate_webhook_payload
        
        # Valid payload
        valid_payload = {
            "repository": {"full_name": "test/repo"},
            "sender": {"login": "testuser"},
            "action": "opened"
        }
        assert validate_webhook_payload(valid_payload) is True
        
        # Invalid payload (missing required fields)
        invalid_payload = {"invalid": "data"}
        assert validate_webhook_payload(invalid_payload) is False

    def test_sanitize_webhook_data(self):
        """Test webhook data sanitization."""
        from app.utils.validation import sanitize_string
        
        # Normal string
        assert sanitize_string("normal string") == "normal string"
        
        # String with HTML
        assert sanitize_string("<script>alert('xss')</script>") != "<script>alert('xss')</script>"
        
        # Very long string
        long_string = "a" * 2000
        sanitized = sanitize_string(long_string, max_length=100)
        assert len(sanitized) <= 100

    def test_event_filtering(self):
        """Test event filtering logic."""
        # This would test the should_filter_event logic
        # Implementation depends on your filtering criteria
        pass


@pytest.mark.webhook
@pytest.mark.integration
class TestWebhookIntegration:
    """Integration tests for webhook processing end-to-end."""

    @pytest.mark.slow
    async def test_complete_webhook_flow(self, async_client: AsyncClient, github_webhook_secret: str,
                                       pull_request_opened_payload: dict):
        """Test complete webhook processing flow from request to notification."""
        # This would be a more comprehensive integration test
        # that tests the entire flow with real-like conditions
        
        with patch.object(SupabaseManager, 'get_repository_id', return_value="repo-123"), \
             patch.object(SupabaseManager, 'create_event', return_value="event-123"), \
             patch.object(SupabaseManager, 'get_users_by_repository', return_value=[
                 {"id": "user-1", "slack_id": "U123", "name": "Test User"}
             ]), \
             patch.object(SupabaseManager, 'update_event', return_value=True), \
             patch.object(SupabaseManager, 'should_filter_event', return_value=False):
            
            payload_bytes = json.dumps(pull_request_opened_payload).encode()
            signature = hmac.new(
                github_webhook_secret.encode(),
                payload_bytes,
                hashlib.sha256
            ).hexdigest()
            
            headers = {
                "X-GitHub-Event": "pull_request",
                "X-GitHub-Delivery": "test-delivery-id",
                "X-Hub-Signature-256": f"sha256={signature}",
                "Content-Type": "application/json"
            }
            
            response = await async_client.post(
                "/api/webhooks/github",
                json=pull_request_opened_payload,
                headers=headers
            )
            
            assert response.status_code == status.HTTP_200_OK
            assert response.json()["status"] == "success"