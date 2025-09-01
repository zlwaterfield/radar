# GitHub Events → Slack Notifications

This document maps all GitHub webhook events that generate Slack notifications, their trigger conditions, and user settings that control them.

## Event Processing Flow

1. GitHub webhook received → `webhooks.controller.ts:38`
2. Event validated and filtered → `webhooks.service.ts:89`
3. Event stored in database → `webhooks.service.ts:173`
4. Trigger.dev task queued → `trigger-queue.service.ts`
5. Event processed and notifications sent → `process-github-event.ts:33`

## Pull Request Events

### pull_request
**GitHub Actions**: `opened`, `closed`, `reopened`, `ready_for_review`, `review_requested`, `assigned`, `unassigned`

**User Settings**:
- `pull_request_opened` - New PRs opened
- `pull_request_closed` - PRs closed/merged
- `pull_request_assigned` - PR assignments

**Trigger Conditions**:
- Repository must be tracked by user
- User must be watching the PR (author, reviewer, assigned, mentioned, team involved)
- User setting enabled for the specific action
- Not muted by user preferences (`mute_own_activity`, `mute_bot_comments`, `mute_draft_pull_requests`)

### pull_request_review
**GitHub Actions**: `submitted` (with states: approved, changes_requested, commented)

**User Settings**:
- `pull_request_reviewed` - Reviews submitted on PRs

**Trigger Conditions**:
- Repository tracked by user
- User involved with the PR
- Review state determines notification urgency
- User setting enabled

### pull_request_review_comment
**GitHub Actions**: `created`

**User Settings**:
- `pull_request_commented` - Comments on PR reviews

**Trigger Conditions**:
- Repository tracked by user
- User involved with the PR
- Only for new comments (not edits)
- User setting enabled

## Issue Events

### issues
**GitHub Actions**: `opened`, `closed`, `reopened`, `assigned`, `unassigned`

**User Settings**:
- `issue_opened` - New issues opened
- `issue_closed` - Issues closed
- `issue_assigned` - Issue assignments

**Trigger Conditions**:
- Repository tracked by user
- User involved with issue (author, assigned, mentioned, team involved)
- User setting enabled for the specific action
- Not muted by user preferences

### issue_comment
**GitHub Actions**: `created`

**User Settings**:
- `issue_commented` - Comments on issues

**Trigger Conditions**:
- Repository tracked by user
- User involved with the issue
- Only for new comments (not edits)
- User setting enabled
- Handles both issue comments and PR comments (GitHub treats PR comments as issue comments)

## Special Events

### membership
**GitHub Actions**: `added`, `removed`

**Processing**: Updates user team memberships in database, no Slack notification sent

**Trigger Conditions**:
- User exists in Radar with matching GitHub ID
- Team membership change in organization

### installation
**GitHub Actions**: `created`

**Processing**: Updates user installation ID and triggers full GitHub data sync, no Slack notification sent

**Trigger Conditions**:
- GitHub App installed by user with Radar account
- Installation creator matches user's GitHub ID

## User Settings Control

### Noise Control Settings
- `mute_own_activity` - Skip notifications for user's own actions
- `mute_bot_comments` - Skip bot-generated events (configurable)
- `mute_draft_pull_requests` - Skip draft PR notifications

### Mention Settings
- `mention_in_comment` - @mentions in comments
- `mention_in_pull_request` - @mentions in PR descriptions
- `mention_in_issue` - @mentions in issue descriptions

### Team Settings
- `team_assignments` - Team assigned to PRs/issues
- `team_mentions` - Team mentioned in PRs/issues
- `team_review_requests` - Team requested for review

### CI/CD Settings
- `check_failures` - Failed status checks
- `check_successes` - Successful status checks

## Watching Reasons

Users receive notifications when they are "watching" a PR/issue for these reasons:
- `AUTHOR` - Created the PR/issue
- `REVIEWER` - Requested for review
- `ASSIGNED` - Assigned to PR/issue
- `MENTIONED` - @mentioned in content
- `TEAM_ASSIGNED` - Team is assigned
- `TEAM_MENTIONED` - Team is mentioned
- `TEAM_REVIEWER` - Team requested for review
- `SUBSCRIBED` - Explicitly subscribed
- `MANUAL` - Manually added to notifications