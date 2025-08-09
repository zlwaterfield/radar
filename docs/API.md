# Radar API Documentation

This document provides comprehensive information about the Radar API endpoints, authentication, request/response formats, and usage examples.

## Base URL

```
http://localhost:8000/api
```

## Authentication

Radar uses JWT (JSON Web Tokens) for authentication. Most endpoints require authentication.

### Getting an Access Token

```bash
POST /auth/login
Content-Type: application/json

{
    "slack_user_id": "U123456789",
    "slack_team_id": "T987654321"
}
```

**Response:**
```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 3600
}
```

### Using the Access Token

Include the token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## API Endpoints

### Authentication & Users

#### `POST /auth/login`
Authenticate user and receive JWT token.

**Request Body:**
```json
{
    "slack_user_id": "U123456789",
    "slack_team_id": "T987654321"
}
```

**Response:**
```json
{
    "access_token": "jwt_token_here",
    "token_type": "bearer",
    "expires_in": 3600,
    "user_id": "uuid"
}
```

#### `GET /users/me`
Get current authenticated user's profile.

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "slack_id": "U123456789",
    "slack_team_id": "T987654321",
    "github_login": "johndoe",
    "created_at": "2024-01-01T00:00:00Z"
}
```

#### `PUT /users/settings`
Update user notification preferences.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
    "notification_preferences": {
        // PR & Issue Activity (activity-based, not role-based)
        "pr_comments": true,
        "pr_reviews": true,
        "pr_status_changes": true,
        "pr_assignments": true,
        "pr_opened": true,
        
        "issue_comments": true,
        "issue_status_changes": true,
        "issue_assignments": true,
        
        // CI/CD
        "check_failures": true,
        "check_successes": false,
        
        // Mentions & Keywords
        "mentioned_in_comments": true,
        "keyword_notifications_enabled": true,
        "keywords": ["bug", "security", "performance"],
        "keyword_notification_threshold": 0.7,
        
        // Noise Control
        "mute_own_activity": true,
        "mute_bot_comments": true,
        "mute_draft_prs": true,
        
        // Daily Digest
        "digest_enabled": true,
        "digest_time": "09:00"
    }
}
```

### GitHub Integration

#### `GET /github/repositories`
List user's accessible GitHub repositories.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `sync` (optional): If `true`, forces a fresh sync from GitHub

**Response:**
```json
{
    "repositories": [
        {
            "id": "123",
            "name": "my-project",
            "full_name": "user/my-project",
            "description": "My awesome project",
            "private": false,
            "enabled": true,
            "webhook_configured": true
        }
    ],
    "total": 1
}
```

#### `POST /github/repositories/sync`
Synchronize repositories from GitHub.

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
    "message": "Repositories synced successfully",
    "synced_count": 5,
    "total_repositories": 10
}
```

#### `GET /github/user`
Get GitHub user information.

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
    "id": "123456",
    "login": "johndoe",
    "name": "John Doe",
    "email": "john@example.com",
    "avatar_url": "https://avatars.githubusercontent.com/u/123456",
    "public_repos": 25,
    "followers": 100
}
```

### Slack Integration

#### `GET /slack/channels`
List available Slack channels for the user.

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
    "channels": [
        {
            "id": "C123456789",
            "name": "general",
            "is_private": false,
            "is_member": true
        },
        {
            "id": "C987654321", 
            "name": "dev-team",
            "is_private": true,
            "is_member": true
        }
    ]
}
```

#### `POST /slack/test`
Send a test message to verify Slack integration.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
    "channel": "#general",
    "message": "Test message from Radar"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Test message sent successfully",
    "slack_response": {
        "ts": "1234567890.123456",
        "channel": "C123456789"
    }
}
```

### Webhooks & Events

#### `POST /webhooks/github`
GitHub webhook endpoint for receiving events.

⚠️ **This endpoint is secured with webhook signature verification**

**Headers:**
- `X-GitHub-Event`: Event type (e.g., "pull_request", "issues")
- `X-Hub-Signature-256`: GitHub webhook signature (SHA256)
- `X-Hub-Signature`: GitHub webhook signature (SHA1) - legacy support

**Request Body:** GitHub webhook payload (varies by event type)

**Response:**
```json
{
    "message": "Webhook received successfully"
}
```

### Webhook Retry Management

#### `GET /retry/webhooks/retry/stats`
Get webhook retry statistics.

**Response:**
```json
{
    "message": "Retry statistics retrieved successfully",
    "stats": {
        "pending": 5,
        "retrying": 2,
        "failed": 1,
        "succeeded": 47,
        "overdue_retries": 1,
        "high_retry_count": 0,
        "total_failed_events": 55
    }
}
```

#### `POST /retry/webhooks/retry/trigger`
Manually trigger webhook retry processing.

**Response:**
```json
{
    "message": "Webhook retry processing triggered successfully",
    "results": {
        "processed": 3,
        "succeeded": 2,
        "failed": 1,
        "permanently_failed": 0
    }
}
```

#### `POST /retry/webhooks/retry/{failed_event_id}`
Retry a specific failed webhook event.

**Parameters:**
- `failed_event_id`: UUID of the failed webhook event

**Response:**
```json
{
    "message": "Webhook event abc-123-def retried successfully",
    "success": true
}
```

#### `GET /retry/webhooks/failed`
List failed webhook events with filtering options.

**Query Parameters:**
- `status_filter` (optional): Filter by status ("pending", "retrying", "failed", "succeeded")
- `limit` (optional): Number of events to return (1-100, default: 50)
- `offset` (optional): Number of events to skip (default: 0)

**Response:**
```json
{
    "message": "Failed webhook events retrieved successfully",
    "events": [
        {
            "id": "abc-123-def",
            "event_type": "pull_request",
            "action": "opened",
            "repository_name": "user/repo",
            "retry_count": 2,
            "max_retries": 3,
            "status": "pending",
            "next_retry_at": "2024-01-01T10:30:00Z",
            "error_message": "Connection timeout",
            "created_at": "2024-01-01T10:00:00Z"
        }
    ],
    "count": 1,
    "limit": 50,
    "offset": 0
}
```

### Settings & Configuration

#### `GET /settings/user/{user_id}`
Get user settings and notification preferences.

**Headers:** `Authorization: Bearer {token}`

**Parameters:**
- `user_id`: UUID of the user

**Response:**
```json
{
    "user_id": "uuid",
    "notification_preferences": {
        // New activity-based preferences
        "pr_comments": true,
        "pr_reviews": true,
        "pr_status_changes": true,
        "pr_assignments": true,
        "pr_opened": true,
        
        "issue_comments": true,
        "issue_status_changes": true,
        "issue_assignments": true,
        
        "check_failures": true,
        "check_successes": false,
        
        "mentioned_in_comments": true,
        "keyword_notifications_enabled": true,
        "keywords": ["bug", "security"],
        "keyword_notification_threshold": 0.7,
        
        "mute_own_activity": true,
        "mute_bot_comments": true,
        "mute_draft_prs": true,
        
        "digest_enabled": false,
        "digest_time": "09:00",
        
        // Legacy fields (maintained for backward compatibility)
        "author_reviewed": true,
        "author_commented": true,
        "reviewer_review_requested": true
    }
}
```

#### `PUT /settings/user/{user_id}`
Update user settings and notification preferences.

**Headers:** `Authorization: Bearer {token}`

**Parameters:**
- `user_id`: UUID of the user

**Request Body:**
```json
{
    "notification_preferences": {
        "author_reviewed": true,
        "keyword_notifications_enabled": true,
        "keywords": ["urgent", "breaking"]
    },
    "notification_schedule": {
        "digest_enabled": false
    }
}
```

#### `GET /retry/scheduler/status`
Get background scheduler status.

**Response:**
```json
{
    "message": "Scheduler status retrieved successfully",
    "status": {
        "running": true,
        "job_count": 2,
        "jobs": [
            {
                "id": "webhook_retry_processor",
                "name": "Process Failed Webhooks",
                "next_run_time": "2024-01-01T10:35:00Z",
                "trigger": "interval[0:05:00]"
            },
            {
                "id": "retry_stats_collector",
                "name": "Collect Retry Statistics", 
                "next_run_time": "2024-01-01T11:00:00Z",
                "trigger": "interval[1:00:00]"
            }
        ]
    }
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
    "detail": "Error description",
    "error_code": "SPECIFIC_ERROR_CODE"
}
```

### Common HTTP Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required or invalid
- `403 Forbidden`: Access denied
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Validation errors
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

### Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default Limit**: 100 requests per minute per IP
- **Authenticated Users**: 300 requests per minute per user
- **Webhook Endpoints**: 1000 requests per minute (higher limit for GitHub webhooks)

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
```

## Webhook Event Types

Radar processes the following GitHub webhook events:

### Pull Request Events
- `pull_request`: opened, closed, edited, assigned, review_requested
- `pull_request_review`: submitted, dismissed
- `pull_request_review_comment`: created, edited

### Issue Events  
- `issues`: opened, closed, edited, assigned, unassigned
- `issue_comment`: created, edited

### Discussion Events
- `discussion`: created, answered, locked, unlocked
- `discussion_comment`: created, edited

### Repository Events
- `push`: commits pushed to repository

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class RadarAPI {
    constructor(baseURL = 'http://localhost:8000/api') {
        this.baseURL = baseURL;
        this.token = null;
    }
    
    async login(slackUserId, slackTeamId) {
        const response = await axios.post(`${this.baseURL}/auth/login`, {
            slack_user_id: slackUserId,
            slack_team_id: slackTeamId
        });
        this.token = response.data.access_token;
        return response.data;
    }
    
    async getRepositories() {
        const response = await axios.get(`${this.baseURL}/github/repositories`, {
            headers: { Authorization: `Bearer ${this.token}` }
        });
        return response.data;
    }
    
    async getRetryStats() {
        const response = await axios.get(`${this.baseURL}/retry/webhooks/retry/stats`, {
            headers: { Authorization: `Bearer ${this.token}` }
        });
        return response.data.stats;
    }
}

// Usage
const radar = new RadarAPI();
await radar.login('U123456789', 'T987654321');
const repositories = await radar.getRepositories();
```

### Python

```python
import httpx
from typing import Optional, Dict, Any

class RadarAPI:
    def __init__(self, base_url: str = "http://localhost:8000/api"):
        self.base_url = base_url
        self.token: Optional[str] = None
        
    async def login(self, slack_user_id: str, slack_team_id: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/auth/login",
                json={
                    "slack_user_id": slack_user_id,
                    "slack_team_id": slack_team_id
                }
            )
            response.raise_for_status()
            data = response.json()
            self.token = data["access_token"]
            return data
    
    async def get_repositories(self) -> Dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.token}"}
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/github/repositories",
                headers=headers
            )
            response.raise_for_status()
            return response.json()

# Usage
radar = RadarAPI()
await radar.login("U123456789", "T987654321")
repositories = await radar.get_repositories()
```

## Monitoring & Debugging

### Health Checks

```bash
GET /health
```

Returns application health status and key metrics.

### Logs

Application logs include:
- Request/response logging
- Webhook processing details
- Retry attempt information
- Error stack traces
- Performance metrics

### PostHog Analytics

The API automatically tracks:
- User authentication events
- Webhook processing metrics
- Notification delivery success rates
- Error occurrences and types
- API endpoint usage patterns

Access analytics data through your PostHog dashboard or via the PostHog API.