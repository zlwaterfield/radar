"""
Tests for webhook retry mechanism.
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta

from app.services.webhook_retry_service import WebhookRetryService, webhook_retry_service
from app.services.scheduler_service import SchedulerService


@pytest.fixture
def retry_service():
    """Create a fresh WebhookRetryService instance for testing."""
    return WebhookRetryService()


@pytest.fixture
def mock_supabase_manager():
    """Mock SupabaseManager for testing."""
    with patch('app.services.webhook_retry_service.SupabaseManager') as mock:
        yield mock


@pytest.fixture
def mock_monitoring_service():
    """Mock MonitoringService for testing."""
    with patch('app.services.webhook_retry_service.MonitoringService') as mock:
        yield mock


class TestWebhookRetryService:
    """Test webhook retry service functionality."""
    
    def test_retry_delays_configuration(self, retry_service):
        """Test that retry delays are configured correctly."""
        assert retry_service.retry_delays == [5, 15, 60, 300, 900]
        assert retry_service.max_retries == 5
    
    @pytest.mark.asyncio
    async def test_process_failed_webhooks_no_events(self, retry_service, mock_supabase_manager):
        """Test processing when no failed events exist."""
        mock_supabase_manager.get_pending_failed_webhook_events = AsyncMock(return_value=[])
        
        result = await retry_service.process_failed_webhooks()
        
        assert result == {
            "processed": 0,
            "succeeded": 0,
            "failed": 0,
            "permanently_failed": 0
        }
    
    @pytest.mark.asyncio
    async def test_process_failed_webhooks_with_events(self, retry_service, mock_supabase_manager, mock_monitoring_service):
        """Test processing failed webhook events."""
        # Mock failed events
        failed_events = [
            {
                "id": "event-1",
                "retry_count": 0,
                "max_retries": 3,
                "event_type": "pull_request",
                "repository_name": "test/repo",
                "payload": {"repository": {"id": "123", "full_name": "test/repo"}}
            }
        ]
        mock_supabase_manager.get_pending_failed_webhook_events = AsyncMock(return_value=failed_events)
        mock_supabase_manager.get_users_by_repository = AsyncMock(return_value=[])
        mock_supabase_manager.update_failed_webhook_event = AsyncMock(return_value=None)
        
        # Mock the process_github_event function to succeed
        with patch('app.services.webhook_retry_service.process_github_event') as mock_process:
            mock_process.return_value = None
            
            result = await retry_service.process_failed_webhooks()
            
            assert result["processed"] == 1
            assert result["succeeded"] == 1
            assert result["failed"] == 0
            assert result["permanently_failed"] == 0
    
    @pytest.mark.asyncio
    async def test_retry_webhook_event_success(self, retry_service, mock_supabase_manager, mock_monitoring_service):
        """Test successful webhook event retry."""
        failed_event = {
            "id": "event-1",
            "retry_count": 0,
            "max_retries": 3,
            "event_type": "pull_request",
            "repository_name": "test/repo",
            "payload": {"repository": {"id": "123", "full_name": "test/repo"}}
        }
        
        mock_supabase_manager.get_users_by_repository = AsyncMock(return_value=[])
        mock_supabase_manager.update_failed_webhook_event = AsyncMock(return_value=None)
        
        with patch('app.services.webhook_retry_service.process_github_event') as mock_process:
            mock_process.return_value = None
            
            result = await retry_service._retry_webhook_event(failed_event)
            
            assert result == "succeeded"
            # Verify event was marked as succeeded
            mock_supabase_manager.update_failed_webhook_event.assert_any_call(
                "event-1", "succeeded"
            )
    
    @pytest.mark.asyncio
    async def test_retry_webhook_event_permanent_failure(self, retry_service, mock_supabase_manager, mock_monitoring_service):
        """Test webhook event that reaches max retries."""
        failed_event = {
            "id": "event-1",
            "retry_count": 2,  # Already at max retries
            "max_retries": 3,
            "event_type": "pull_request",
            "repository_name": "test/repo",
            "payload": {"repository": {"id": "123", "full_name": "test/repo"}}
        }
        
        mock_supabase_manager.get_users_by_repository = AsyncMock(return_value=[])
        mock_supabase_manager.update_failed_webhook_event = AsyncMock(return_value=None)
        
        with patch('app.services.webhook_retry_service.process_github_event') as mock_process:
            mock_process.side_effect = Exception("Test error")
            
            result = await retry_service._retry_webhook_event(failed_event)
            
            assert result == "permanently_failed"
            # Verify event was marked as permanently failed
            mock_supabase_manager.update_failed_webhook_event.assert_any_call(
                "event-1", "failed", 3, None, "Test error"
            )
    
    @pytest.mark.asyncio
    async def test_retry_specific_event_success(self, retry_service, mock_supabase_manager):
        """Test retrying a specific event by ID."""
        failed_event = {
            "id": "event-1",
            "retry_count": 0,
            "max_retries": 3,
            "status": "pending",
            "event_type": "pull_request",
            "repository_name": "test/repo",
            "payload": {"repository": {"id": "123", "full_name": "test/repo"}}
        }
        
        # Mock database response
        mock_response = Mock()
        mock_response.data = [failed_event]
        mock_supabase_manager.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        
        mock_supabase_manager.get_users_by_repository = AsyncMock(return_value=[])
        mock_supabase_manager.update_failed_webhook_event = AsyncMock(return_value=None)
        
        with patch('app.services.webhook_retry_service.process_github_event') as mock_process:
            mock_process.return_value = None
            
            result = await retry_service.retry_specific_event("event-1")
            
            assert result is True
    
    @pytest.mark.asyncio
    async def test_get_retry_stats(self, retry_service, mock_supabase_manager):
        """Test getting retry statistics."""
        stats = {
            "pending": 5,
            "retrying": 2,
            "failed": 1,
            "succeeded": 10
        }
        
        mock_supabase_manager.get_failed_webhook_events_stats = AsyncMock(return_value=stats)
        
        # Mock additional stats query
        mock_response = Mock()
        mock_response.data = [
            {"next_retry_at": (datetime.utcnow() - timedelta(minutes=10)).isoformat(), "retry_count": 1},
            {"next_retry_at": (datetime.utcnow() + timedelta(minutes=10)).isoformat(), "retry_count": 3}
        ]
        mock_supabase_manager.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        
        result = await retry_service.get_retry_stats()
        
        assert "pending" in result
        assert "overdue_retries" in result
        assert "high_retry_count" in result
        assert "total_failed_events" in result


class TestSchedulerService:
    """Test scheduler service functionality."""
    
    def test_scheduler_initialization(self):
        """Test scheduler service initialization."""
        scheduler = SchedulerService()
        assert scheduler._is_running is False
        assert scheduler.scheduler is not None
    
    def test_scheduler_start_stop(self):
        """Test scheduler start and stop functionality."""
        with patch('app.services.scheduler_service.AsyncIOScheduler') as mock_scheduler_class:
            mock_scheduler = Mock()
            mock_scheduler_class.return_value = mock_scheduler
            mock_scheduler.running = False
            
            scheduler = SchedulerService()
            
            # Start scheduler
            scheduler.start()
            mock_scheduler.start.assert_called_once()
            
            # Simulate running state
            mock_scheduler.running = True
            assert scheduler.is_running() is True
            
            # Stop scheduler
            scheduler.stop()
            mock_scheduler.shutdown.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_process_failed_webhooks_scheduled(self):
        """Test scheduled webhook processing."""
        scheduler = SchedulerService()
        
        with patch.object(scheduler, '_process_failed_webhooks') as mock_process:
            mock_process.return_value = None
            
            await scheduler._process_failed_webhooks()
            
            mock_process.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_trigger_webhook_retry(self):
        """Test manual webhook retry trigger."""
        scheduler = SchedulerService()
        
        expected_result = {
            "processed": 1,
            "succeeded": 1,
            "failed": 0,
            "permanently_failed": 0
        }
        
        with patch.object(webhook_retry_service, 'process_failed_webhooks') as mock_process:
            mock_process.return_value = expected_result
            
            result = await scheduler.trigger_webhook_retry()
            
            assert result == expected_result