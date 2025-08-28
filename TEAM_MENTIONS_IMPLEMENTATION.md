# GitHub Team Mentions Implementation

## Overview

This document summarizes the implementation of GitHub team mention notifications in the Radar application. Users will now receive notifications when their GitHub teams are mentioned in pull requests, issues, or comments.

## Features Implemented

### 1. Database Schema
- **`github_teams`** table: Stores GitHub team information
- **`user_team_memberships`** table: Tracks which users belong to which teams
- Proper indexing and foreign key relationships
- Row Level Security (RLS) enabled

### 2. Team Mention Detection
- **Text-based mentions**: Detects `@org/team-name` patterns in PR/issue content
- **Webhook-based detection**: Handles `requested_teams` field in PR webhooks  
- **Regex patterns**: Properly distinguishes between user mentions (`@user`) and team mentions (`@org/team`)

### 3. GitHub API Integration
- `get_organization_teams()`: Fetch all teams in an organization
- `get_team_members()`: Get members of a specific team
- `get_user_teams_in_org()`: Get teams a user belongs to
- Rate limiting and error handling

### 4. Notification System
- New `WatchingReason.TEAM_MENTIONED` enum value
- New `NotificationTrigger.TEAM_MENTIONED` enum value  
- Updated `NotificationPreferences` model with `team_mentioned: bool` setting
- Integration with existing notification routing and Slack delivery

### 5. Team Synchronization Service
- `TeamSyncService`: Periodically sync team data from GitHub
- User-level sync: Sync teams for individual users
- Organization-level sync: Sync all teams in an organization
- Bulk sync: Process all active users with GitHub tokens

## How It Works

### Mention Detection Flow

1. **Webhook Reception**: GitHub sends webhook for PR/issue/comment events
2. **Content Analysis**: Extract team mentions from:
   - PR/issue title and body text using `@org/team-name` pattern
   - `requested_teams` field in PR webhooks (when teams are formally requested as reviewers)
   - Comment bodies for `@org/team-name` mentions

3. **User Lookup**: For each mentioned team:
   - Query local database for team members
   - Add team members to notification recipient list

4. **Notification Processing**: For each potential recipient:
   - Check if user is actually a member of mentioned teams  
   - Respect user's `team_mentioned` notification preference
   - Send notification via existing Slack integration

### Database Operations

```sql
-- Teams are stored with organization context
INSERT INTO github_teams (team_id, team_slug, team_name, organization_login, ...)

-- User memberships link users to teams
INSERT INTO user_team_memberships (user_id, team_id, github_team_id, role)

-- Efficient queries with proper indexing
SELECT users.* FROM users 
JOIN user_team_memberships ON users.id = user_team_memberships.user_id
JOIN github_teams ON user_team_memberships.team_id = github_teams.id
WHERE github_teams.organization_login = ? AND github_teams.team_slug = ?
```

## Configuration

### User Settings
Users can control team mention notifications via the existing settings UI:
- `team_mentioned: true/false` - Enable/disable team mention notifications
- Integrates with existing notification preference system

### Team Data Sync
Team memberships should be periodically synchronized:
```python
# Sync teams for a specific user
await TeamSyncService.sync_user_teams(user_id, github_token)

# Sync all teams in an organization  
await TeamSyncService.sync_organization_teams(org_login, github_token)

# Bulk sync for all active users
await TeamSyncService.sync_all_active_users()
```

## Testing

The implementation includes comprehensive tests:
- **Regex validation**: Ensures proper team/user mention extraction
- **Real-world examples**: Tests with actual PR/issue content
- **Edge cases**: Handles malformed mentions, mixed content, etc.

Run tests with:
```bash
python3 test_team_mentions_standalone.py
```

## Files Changed

### Database
- `database/schema.sql` - Added team tables and indexes

### Core Logic  
- `app/api/routes/webhooks.py` - Team mention detection and webhook processing
- `app/services/notification_service.py` - Team mention notification logic
- `app/services/github_service.py` - GitHub API methods for teams
- `app/db/supabase.py` - Database operations for teams

### Models
- `app/models/notifications.py` - Added team mention enums and preferences
- `app/utils/validation.py` - Added team mention preference validation

### New Services
- `app/services/team_sync_service.py` - Team data synchronization

## Integration Points

1. **Existing Notification Flow**: Team mentions integrate seamlessly with existing PR/issue/comment notification processing
2. **Slack Delivery**: Uses existing SlackService for message delivery
3. **User Preferences**: Respects existing notification preference system
4. **Monitoring**: Integrates with existing MonitoringService for metrics

## Next Steps

1. **Schedule Team Sync**: Set up periodic job to sync team data (e.g., daily)
2. **Rate Limit Management**: Monitor GitHub API usage for team queries
3. **Team Management UI**: Consider adding team management interface
4. **Performance Optimization**: Add caching for frequently accessed team data
5. **Metrics**: Track team mention notification effectiveness

## Examples

### Team Mention in PR Body
```
@myorg/frontend-team please review the UI changes
@myorg/security-team please audit the auth logic
```
→ All members of `frontend-team` and `security-team` get notified

### Requested Reviewers
```json
{
  "requested_teams": [
    {
      "slug": "backend-team", 
      "name": "Backend Team",
      "organization": {"login": "myorg"}
    }
  ]
}
```
→ All members of `backend-team` get notified

### Issue Comment
```
Hey @myorg/devops-team, this is blocking deployment
```
→ All members of `devops-team` get notified