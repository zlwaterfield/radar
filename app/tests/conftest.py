"""
Pytest configuration and fixtures for Radar tests.
"""
import asyncio
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient

from app.core.config import settings
from app.db.supabase import SupabaseManager
from app.main import app
from app.services.slack_service import SlackService
from app.services.notification_service import NotificationService
from app.services.monitoring_service import MonitoringService


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def test_client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest_asyncio.fixture
async def async_client():
    """Create an async test client for the FastAPI app."""
    from httpx import ASGITransport
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def mock_supabase_manager(mocker):
    """Mock the SupabaseManager for database operations."""
    mock = mocker.patch.object(SupabaseManager, '__new__')
    mock_instance = AsyncMock()
    mock.return_value = mock_instance
    
    # Mock common methods
    mock_instance.get_users_by_repository = AsyncMock(return_value=[])
    mock_instance.get_user_settings = AsyncMock(return_value={})
    mock_instance.create_event = AsyncMock(return_value="test-event-id")
    mock_instance.update_event = AsyncMock(return_value=True)
    mock_instance.create_failed_webhook_event = AsyncMock(return_value=True)
    mock_instance.get_repository_settings = AsyncMock(return_value={})
    mock_instance.should_filter_event = AsyncMock(return_value=False)
    
    return mock_instance


@pytest.fixture
def mock_slack_service(mocker):
    """Mock the SlackService for Slack operations."""
    mock = mocker.patch.object(SlackService, '__new__')
    mock_instance = AsyncMock()
    mock.return_value = mock_instance
    
    # Mock common methods
    mock_instance.send_notification = AsyncMock(return_value=True)
    mock_instance.format_notification = AsyncMock(return_value="Test notification")
    
    return mock_instance


@pytest.fixture
def mock_notification_service(mocker):
    """Mock the NotificationService."""
    mock = mocker.patch.object(NotificationService, '__new__')
    mock_instance = AsyncMock()
    mock.return_value = mock_instance
    
    # Mock common methods
    mock_instance.process_notification = AsyncMock(return_value=True)
    mock_instance.should_notify = AsyncMock(return_value=True)
    
    return mock_instance


@pytest.fixture
def mock_monitoring_service(mocker):
    """Mock the MonitoringService."""
    mock = mocker.patch.object(MonitoringService, '__new__')
    mock_instance = AsyncMock()
    mock.return_value = mock_instance
    
    # Mock common methods
    mock_instance.track_event = AsyncMock()
    mock_instance.log_error = AsyncMock()
    
    return mock_instance


@pytest.fixture
def webhook_headers():
    """Standard webhook headers for GitHub requests."""
    return {
        "User-Agent": "GitHub-Hookshot/123abc",
        "Content-Type": "application/json",
        "X-GitHub-Delivery": "12345678-1234-1234-1234-123456789abc",
        "X-GitHub-Event": "push",
        "X-Hub-Signature-256": "sha256=test_signature"
    }


@pytest.fixture
def github_webhook_secret(monkeypatch):
    """Set up a test webhook secret."""
    test_secret = "test-webhook-secret-123"
    monkeypatch.setattr(settings, "GITHUB_WEBHOOK_SECRET", test_secret)
    return test_secret


@pytest.fixture
def sample_repository():
    """Sample repository data used in webhook payloads."""
    return {
        "id": 123456,
        "node_id": "MDEwOlJlcG9zaXRvcnkxMjM0NTY=",
        "name": "test-repo",
        "full_name": "testuser/test-repo",
        "private": False,
        "html_url": "https://github.com/testuser/test-repo",
        "description": "A test repository",
        "fork": False,
        "created_at": "2023-01-01T00:00:00Z",
        "updated_at": "2023-01-01T00:00:00Z",
        "pushed_at": "2023-01-01T00:00:00Z",
        "clone_url": "https://github.com/testuser/test-repo.git",
        "size": 100,
        "stargazers_count": 5,
        "watchers_count": 5,
        "language": "Python",
        "has_issues": True,
        "has_projects": True,
        "has_wiki": True,
        "has_pages": False,
        "forks_count": 2,
        "archived": False,
        "disabled": False,
        "open_issues_count": 3,
        "topics": ["python", "testing"],
        "visibility": "public",
        "default_branch": "main"
    }


@pytest.fixture  
def sample_user():
    """Sample user data (sender/actor) used in webhook payloads."""
    return {
        "login": "testuser",
        "id": 12345,
        "node_id": "MDQ6VXNlcjEyMzQ1",
        "avatar_url": "https://github.com/images/error/testuser_happy.gif",
        "gravatar_id": "",
        "url": "https://api.github.com/users/testuser",
        "html_url": "https://github.com/testuser",
        "type": "User",
        "site_admin": False
    }


@pytest.fixture
def sample_pull_request(sample_repository, sample_user):
    """Sample pull request data used in webhook payloads."""
    return {
        "id": 789123,
        "node_id": "MDExOlB1bGxSZXF1ZXN0Nzg5MTIz",
        "number": 42,
        "title": "Add new feature",
        "body": "This PR adds a new feature to the application",
        "state": "open",
        "locked": False,
        "user": sample_user,
        "created_at": "2023-01-01T12:00:00Z",
        "updated_at": "2023-01-01T12:00:00Z",
        "closed_at": None,
        "merged_at": None,
        "merge_commit_sha": None,
        "assignee": None,
        "assignees": [],
        "requested_reviewers": [],
        "requested_teams": [],
        "labels": [],
        "milestone": None,
        "draft": False,
        "commits_url": "https://api.github.com/repos/testuser/test-repo/pulls/42/commits",
        "review_comments_url": "https://api.github.com/repos/testuser/test-repo/pulls/42/comments",
        "comments_url": "https://api.github.com/repos/testuser/test-repo/issues/42/comments",
        "statuses_url": "https://api.github.com/repos/testuser/test-repo/statuses/abc123",
        "head": {
            "label": "testuser:feature-branch",
            "ref": "feature-branch",
            "sha": "abc123def456",
            "user": sample_user,
            "repo": sample_repository
        },
        "base": {
            "label": "testuser:main",
            "ref": "main", 
            "sha": "def456abc123",
            "user": sample_user,
            "repo": sample_repository
        },
        "_links": {
            "self": {"href": "https://api.github.com/repos/testuser/test-repo/pulls/42"},
            "html": {"href": "https://github.com/testuser/test-repo/pull/42"},
            "issue": {"href": "https://api.github.com/repos/testuser/test-repo/issues/42"},
        }
    }


@pytest.fixture
def sample_issue(sample_repository, sample_user):
    """Sample issue data used in webhook payloads."""
    return {
        "id": 456789,
        "node_id": "MDU6SXNzdWU0NTY3ODk=",
        "number": 10,
        "title": "Bug in feature X",
        "body": "There's a bug when using feature X with parameter Y",
        "state": "open",
        "locked": False,
        "user": sample_user,
        "assignee": None,
        "assignees": [],
        "labels": [
            {
                "id": 111,
                "node_id": "MDU6TGFiZWwxMTE=",
                "name": "bug",
                "color": "d73a4a",
                "default": True,
                "description": "Something isn't working"
            }
        ],
        "milestone": None,
        "comments": 2,
        "created_at": "2023-01-01T10:00:00Z",
        "updated_at": "2023-01-01T10:00:00Z",
        "closed_at": None,
        "repository": sample_repository,
        "url": "https://api.github.com/repos/testuser/test-repo/issues/10",
        "html_url": "https://github.com/testuser/test-repo/issues/10"
    }


def load_fixture_data(fixture_name: str) -> Dict[str, Any]:
    """Load webhook fixture data from JSON files."""
    fixture_path = Path(__file__).parent / "fixtures" / f"{fixture_name}.json"
    if fixture_path.exists():
        with open(fixture_path, 'r') as f:
            return json.load(f)
    return {}


# Webhook event fixtures - loaded from JSON files
@pytest.fixture
def pull_request_opened_payload(sample_repository, sample_user, sample_pull_request):
    """GitHub pull request opened webhook payload."""
    return {
        "action": "opened",
        "number": 42,
        "pull_request": sample_pull_request,
        "repository": sample_repository,
        "sender": sample_user
    }


@pytest.fixture
def pull_request_closed_payload(sample_repository, sample_user, sample_pull_request):
    """GitHub pull request closed webhook payload."""
    pr = sample_pull_request.copy()
    pr.update({
        "state": "closed",
        "merged": False,
        "closed_at": "2023-01-01T15:00:00Z"
    })
    return {
        "action": "closed",
        "number": 42,
        "pull_request": pr,
        "repository": sample_repository,
        "sender": sample_user
    }


@pytest.fixture
def issue_opened_payload(sample_repository, sample_user, sample_issue):
    """GitHub issue opened webhook payload."""
    return {
        "action": "opened",
        "issue": sample_issue,
        "repository": sample_repository,
        "sender": sample_user
    }


@pytest.fixture
def push_payload(sample_repository, sample_user):
    """GitHub push webhook payload."""
    return {
        "ref": "refs/heads/main",
        "before": "abc123def456",
        "after": "def456abc123",
        "created": False,
        "deleted": False,
        "forced": False,
        "base_ref": None,
        "compare": "https://github.com/testuser/test-repo/compare/abc123def456...def456abc123",
        "commits": [
            {
                "id": "def456abc123",
                "tree_id": "tree123",
                "distinct": True,
                "message": "Fix bug in feature X",
                "timestamp": "2023-01-01T12:00:00Z",
                "url": "https://github.com/testuser/test-repo/commit/def456abc123",
                "author": {
                    "name": "Test User",
                    "email": "testuser@example.com",
                    "username": "testuser"
                },
                "committer": {
                    "name": "Test User", 
                    "email": "testuser@example.com",
                    "username": "testuser"
                },
                "added": ["new_file.py"],
                "removed": [],
                "modified": ["existing_file.py"]
            }
        ],
        "head_commit": {
            "id": "def456abc123",
            "tree_id": "tree123",
            "distinct": True,
            "message": "Fix bug in feature X",
            "timestamp": "2023-01-01T12:00:00Z",
            "url": "https://github.com/testuser/test-repo/commit/def456abc123",
            "author": {
                "name": "Test User",
                "email": "testuser@example.com",
                "username": "testuser"
            },
            "committer": {
                "name": "Test User",
                "email": "testuser@example.com", 
                "username": "testuser"
            },
            "added": ["new_file.py"],
            "removed": [],
            "modified": ["existing_file.py"]
        },
        "repository": sample_repository,
        "pusher": {
            "name": "testuser",
            "email": "testuser@example.com"
        },
        "sender": sample_user
    }


@pytest.fixture
def test_users():
    """Sample users for testing notification routing."""
    return [
        {
            "id": "user-1",
            "slack_id": "U123456",
            "slack_team_id": "T123456", 
            "name": "Test User 1",
            "email": "user1@example.com",
            "github_username": "testuser1",
            "repositories": ["testuser/test-repo"]
        },
        {
            "id": "user-2", 
            "slack_id": "U654321",
            "slack_team_id": "T123456",
            "name": "Test User 2",
            "email": "user2@example.com", 
            "github_username": "testuser2",
            "repositories": ["testuser/test-repo", "testuser/other-repo"]
        }
    ]