# Radar Test Suite

Comprehensive test suite for GitHub webhook processing and notification routing in Radar.

## Overview

This test suite covers:

- **GitHub Webhook Processing**: Signature verification, event routing, payload validation
- **Notification Logic**: User filtering, keyword matching, delivery routing  
- **Slack Integration**: Message formatting, delivery, error handling
- **Database Operations**: Mocked Supabase interactions
- **End-to-End Workflows**: Complete webhook-to-notification flows

## Test Structure

```
tests/
├── conftest.py                    # Pytest configuration and shared fixtures
├── fixtures/                     # Real GitHub webhook payloads
│   ├── pull_request_opened.json
│   ├── push.json
│   ├── issue_opened.json
│   ├── issue_comment.json
│   └── pull_request_review.json
├── test_github_webhooks.py       # Webhook processing tests
├── test_notification_routing.py  # Notification logic tests
├── test_supabase.py              # Database integration tests
├── test_webhook_retry.py         # Retry mechanism tests
├── run_tests.py                  # Test runner script
└── README.md                     # This file
```

## Running Tests

### Quick Start

```bash
# Install test dependencies
pip install -r requirements.txt

# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=app --cov-report=html
```

### Using the Test Runner

```bash
# Run all tests
python tests/run_tests.py

# Run specific test types
python tests/run_tests.py --type webhook
python tests/run_tests.py --type notification
python tests/run_tests.py --type unit
python tests/run_tests.py --type integration

# Run with coverage
python tests/run_tests.py --coverage

# Skip slow tests
python tests/run_tests.py --fast

# Verbose output
python tests/run_tests.py --verbose
```

### Running Specific Test Files

```bash
# Webhook tests only
pytest tests/test_github_webhooks.py -v

# Notification tests only  
pytest tests/test_notification_routing.py -v

# Tests with specific markers
pytest -m webhook tests/
pytest -m notification tests/
pytest -m "unit and not slow" tests/
```

## Test Categories

### Webhook Tests (`test_github_webhooks.py`)

**Signature Verification Tests**
- Valid SHA256/SHA1 signatures
- Invalid signatures  
- Missing signatures
- Malformed signatures
- No secret configured scenarios

**Event Processing Tests**
- Pull request events (opened, closed, merged)
- Push events (single/multiple commits)
- Issue events (opened, closed, assigned)
- Issue comment events
- Pull request review events
- Unsupported event types
- Invalid payload structures

**Error Handling Tests**
- Processing failures
- Database connection errors
- Repository not found scenarios
- Event filtering logic

### Notification Tests (`test_notification_routing.py`)

**User Filtering Tests**
- Notification preferences (enabled/disabled)
- Event type preferences 
- Own activity filtering
- Time window/quiet hours
- Keyword matching

**Slack Integration Tests**
- Message formatting for different event types
- Keyword highlighting
- Delivery success/failure
- Rate limiting
- Cross-team notifications

**Workflow Tests**
- End-to-end notification flows
- Batching rapid events
- Retry mechanisms
- User mention handling

## Test Fixtures

### GitHub Webhook Payloads

All fixtures in `tests/fixtures/` contain real GitHub webhook payload structures:

- **`pull_request_opened.json`**: Complete PR opened event with all GitHub fields
- **`push.json`**: Multi-commit push event with file changes
- **`issue_opened.json`**: Issue with labels, assignees, milestone
- **`issue_comment.json`**: Comment on issue with code snippets
- **`pull_request_review.json`**: Approved review with detailed feedback

### Shared Fixtures (conftest.py)

- **`mock_supabase_manager`**: Mocked database operations
- **`mock_slack_service`**: Mocked Slack client
- **`webhook_headers`**: Standard GitHub webhook headers
- **`sample_repository`**: Test repository data
- **`sample_user`**: Test user data
- **`test_users`**: Multiple users for routing tests

## Mocking Strategy

### Database Operations
All Supabase operations are mocked to avoid external dependencies:

```python
@pytest.fixture
def mock_supabase_manager(mocker):
    mock = mocker.patch.object(SupabaseManager, '__new__')
    mock_instance = AsyncMock()
    mock.return_value = mock_instance
    
    # Mock specific methods
    mock_instance.get_users_by_repository = AsyncMock(return_value=[])
    mock_instance.create_event = AsyncMock(return_value="event-123")
    
    return mock_instance
```

### External Services
Slack, OpenAI, and other external APIs are mocked:

```python 
with patch('app.services.slack_service.SlackService') as mock_slack:
    mock_instance = AsyncMock()
    mock_slack.return_value = mock_instance
    # Test logic here
```

## Environment Variables

Tests require these environment variables:

```bash
ENVIRONMENT=test
GITHUB_WEBHOOK_SECRET=test-secret-123
SUPABASE_URL=https://test.supabase.co
SUPABASE_KEY=test-key
SLACK_CLIENT_ID=test-client-id
SLACK_CLIENT_SECRET=test-client-secret
```

## CI/CD Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

The GitHub Actions workflow (`.github/workflows/test.yml`) runs:
- Tests on Python 3.9, 3.10, and 3.11
- Unit tests, webhook tests, notification tests
- Fast integration tests (slow tests run separately)
- Code coverage reporting
- Linting and formatting checks

## Writing New Tests

### Webhook Tests

```python
async def test_new_webhook_event(self, async_client, github_webhook_secret):
    """Test new webhook event type."""
    payload = {"action": "new_action", "repository": {...}}
    
    response = await self.make_webhook_request(
        async_client, "new_event", payload, github_webhook_secret
    )
    
    assert response.status_code == status.HTTP_200_OK
```

### Notification Tests

```python
async def test_new_notification_scenario(self, notification_service, sample_user_data):
    """Test new notification scenario."""
    with patch.object(SupabaseManager, 'get_user_settings', return_value={
        "new_setting": True
    }):
        result = await notification_service.should_notify(sample_user_data, notification_data)
        assert result is True
```

### Adding New Fixtures

1. Create JSON file in `tests/fixtures/` with real GitHub webhook payload
2. Add fixture function in `conftest.py`:

```python
@pytest.fixture
def new_event_payload():
    """New event webhook payload."""
    return load_fixture_data("new_event")
```

## Test Coverage

Current test coverage targets:

- **Webhook processing**: >95%
- **Notification logic**: >90% 
- **Service integrations**: >85%
- **Error handling**: >90%

Run coverage report:
```bash
pytest tests/ --cov=app --cov-report=html
open htmlcov/index.html
```

## Debugging Tests

### Running Individual Tests
```bash
# Single test with output
pytest tests/test_github_webhooks.py::TestGitHubWebhookSignatureVerification::test_valid_sha256_signature -v -s

# Test class
pytest tests/test_github_webhooks.py::TestGitHubWebhookSignatureVerification -v

# With pdb debugger
pytest tests/test_github_webhooks.py::test_name --pdb
```

### Viewing Mock Calls
```python
# In test, verify mock was called correctly
mock_service.method.assert_called_once_with(expected_args)
print(mock_service.method.call_args_list)  # Debug call arguments
```

### Test Data Inspection
```python  
# Print test data for debugging
print(json.dumps(payload, indent=2))
print(f"Response: {response.json()}")
```

## Best Practices

1. **Use realistic test data**: Fixtures contain real GitHub webhook payloads
2. **Mock external dependencies**: Never call real APIs in tests
3. **Test error scenarios**: Include failure cases and edge conditions  
4. **Isolated tests**: Each test should be independent
5. **Clear assertions**: Test one thing per test method
6. **Descriptive names**: Test names should explain the scenario
7. **Document complex tests**: Add docstrings for complex test logic