# Slack Message Testing Service

This document describes how to use the Slack message testing service to manually trigger and test different types of Slack notifications from Radar.

## Overview

The testing service allows you to:
- Send test messages to Slack channels without triggering actual GitHub webhooks
- Test different message types (pull requests, reviews, comments, issues, digests, stats)
- Iterate quickly on message formatting and design
- Validate Slack integrations before deploying

## Getting Started

### Prerequisites

1. **Slack Access Token**: You need a Slack access token that has permission to post messages to your target channel
2. **Running Radar API**: The Radar FastAPI server must be running (usually on `http://localhost:8000`)
3. **Python Dependencies**: If using the CLI script, ensure `httpx` is installed: `pip install httpx`

### Quick Start with CLI

The easiest way to test messages is using the provided CLI script:

```bash
# Send a pull request notification
python test_slack_message.py --token xoxb-YOUR-TOKEN --channel "#general" --type pull_request --pr-number 123 --pr-title "Fix authentication bug"

# Send a review approval
python test_slack_message.py --token xoxb-YOUR-TOKEN --channel "#general" --type pull_request_review --pr-number 123 --review-state approved --review-comment "LGTM!"

# Send an issue notification
python test_slack_message.py --token xoxb-YOUR-TOKEN --channel "#general" --type issue --issue-number 456 --issue-title "Feature request: Dark mode"

# Send a daily digest
python test_slack_message.py --token xoxb-YOUR-TOKEN --channel "#general" --type digest
```

### Using the API Directly

You can also call the testing API directly:

```bash
curl -X POST "http://localhost:8000/api/testing/send-test-message" \
  -H "Content-Type: application/json" \
  -d '{
    "slack_access_token": "xoxb-YOUR-TOKEN",
    "channel": "#general",
    "message_type": "pull_request",
    "pr_number": 123,
    "pr_title": "Fix authentication bug",
    "pr_action": "opened",
    "repository": "myorg/myapp",
    "user": "developer123"
  }'
```

## Message Types

> 📋 **Complete Command Reference**: See [TESTING_COMMANDS.md](TESTING_COMMANDS.md) for a comprehensive list of all supported actions and example commands.

### Pull Request Messages

Test pull request notifications (opened, closed, merged, etc.):

```bash
python test_slack_message.py --token TOKEN --channel CHANNEL --type pull_request \
  --pr-number 123 \
  --pr-title "Add user authentication" \
  --pr-action opened \
  --repository "myorg/myapp" \
  --user "developer123"
```

**Parameters:**
- `pr_number` (required): Pull request number
- `pr_title` (required): Pull request title
- `pr_action` (required): Action taken (opened, closed, merged, reopened, assigned, review_requested)
- `pr_url` (optional): Pull request URL (defaults to generated GitHub URL)
- `repository` (optional): Repository name (default: "test/repo")
- `user` (optional): GitHub username (default: "testuser")

### Pull Request Review Messages

Test review notifications:

```bash
python test_slack_message.py --token TOKEN --channel CHANNEL --type pull_request_review \
  --pr-number 123 \
  --pr-title "Add user authentication" \
  --review-state approved \
  --review-comment "Looks good to me! Great work on the tests."
```

**Parameters:**
- `pr_number` (required): Pull request number
- `pr_title` (required): Pull request title
- `review_state` (required): Review state (approved, changes_requested, commented, dismissed)
- `review_comment` (optional): Review comment text
- `pr_url` (optional): Pull request URL
- `repository` (optional): Repository name
- `user` (optional): GitHub username

### Pull Request Comment Messages

Test comment notifications:

```bash
python test_slack_message.py --token TOKEN --channel CHANNEL --type pull_request_comment \
  --pr-number 123 \
  --pr-title "Add user authentication" \
  --comment "Have you considered using bcrypt for password hashing?"
```

**Parameters:**
- `pr_number` (required): Pull request number
- `pr_title` (required): Pull request title
- `comment` (required): Comment text
- `pr_url` (optional): Pull request URL
- `repository` (optional): Repository name
- `user` (optional): GitHub username

### Issue Messages

Test issue notifications:

```bash
python test_slack_message.py --token TOKEN --channel CHANNEL --type issue \
  --issue-number 456 \
  --issue-title "Add dark mode support" \
  --issue-action opened
```

**Parameters:**
- `issue_number` (required): Issue number
- `issue_title` (required): Issue title
- `issue_action` (required): Action taken (opened, closed, reopened, assigned)
- `issue_url` (optional): Issue URL
- `repository` (optional): Repository name
- `user` (optional): GitHub username

### Issue Comment Messages

Test issue comment notifications:

```bash
python test_slack_message.py --token TOKEN --channel CHANNEL --type issue_comment \
  --issue-number 456 \
  --issue-title "Add dark mode support" \
  --comment "I'd be happy to work on this feature!"
```

**Parameters:**
- `issue_number` (required): Issue number
- `issue_title` (required): Issue title
- `comment` (required): Comment text
- `issue_url` (optional): Issue URL
- `repository` (optional): Repository name
- `user` (optional): GitHub username

### Digest Messages

Test daily/weekly digest notifications:

```bash
python test_slack_message.py --token TOKEN --channel CHANNEL --type digest --date "2023-12-01"
```

**Parameters:**
- `date` (optional): Date for the digest (default: current date)

The digest will include sample pull requests and issues to demonstrate the format.

### Stats Messages

Test GitHub activity statistics:

```bash
python test_slack_message.py --token TOKEN --channel CHANNEL --type stats --date "2023-12-01"
```

**Parameters:**
- `date` (optional): Date for the stats (default: current date)

The stats message includes sample metrics for pull requests and reviews.

## API Endpoints

### POST /api/testing/send-test-message

Send a test message to Slack.

**Request Body:**
```json
{
  "slack_access_token": "xoxb-...",
  "channel": "#general",
  "message_type": "pull_request",
  "pr_number": 123,
  "pr_title": "Fix bug",
  "pr_action": "opened",
  "repository": "myorg/myapp",
  "user": "developer"
}
```

**Response:**
```json
{
  "success": true,
  "message_ts": "1671234567.123456",
  "channel": "C1234567890"
}
```

### GET /api/testing/message-types

Get information about supported message types and their parameters.

**Response:**
```json
{
  "supported_types": {
    "pull_request": {
      "description": "Pull request notifications",
      "required": ["pr_number", "pr_title", "pr_url", "pr_action"],
      "optional": ["repository", "user"]
    },
    // ... other types
  },
  "common_parameters": {
    "slack_access_token": "Your Slack access token (required)",
    "channel": "Slack channel ID or name (required)",
    // ... other common parameters
  }
}
```

## CLI Usage

### List Message Types

```bash
python test_slack_message.py --list-types
```

### Get Help

```bash
python test_slack_message.py --help
```

### Custom API URL

If running the API on a different host or port:

```bash
python test_slack_message.py --api-url http://localhost:3000/api/testing --token TOKEN --channel CHANNEL --type pull_request
```

## Common Use Cases

### Testing Message Formatting

1. Start with a basic message:
   ```bash
   python test_slack_message.py --token TOKEN --channel "#test" --type pull_request --pr-number 1 --pr-title "Test"
   ```

2. Iterate on the message content by modifying the title, action, or other parameters
3. Test different message types to see how they render
4. Verify colors, icons, and layout in your Slack workspace

### Validating Slack Integration

1. Test with different channel types (public channels, private channels, DMs)
2. Verify that your bot token has the necessary permissions
3. Test error handling by using invalid tokens or channels

### Development Workflow

1. Make changes to the Slack message formatting code
2. Restart the Radar API server
3. Send test messages to verify your changes
4. Repeat until satisfied with the formatting

## Troubleshooting

### Common Errors

**"Invalid token"**: Your Slack access token is incorrect or expired
- Verify the token in your Slack app settings
- Ensure the token starts with `xoxb-` for bot tokens

**"Channel not found"**: The channel doesn't exist or your bot doesn't have access
- Try using a channel ID instead of name (e.g., `C1234567890`)
- Ensure your bot is added to the channel

**"Missing scope"**: Your bot token doesn't have the required permissions
- Add the `chat:write` scope to your Slack app
- Reinstall the app to your workspace

**"Connection refused"**: The Radar API server isn't running
- Start the server with: `uvicorn app.main:app --reload`
- Check that it's running on the expected port

### Debug Tips

1. Use the `--list-types` flag to see supported message types
2. Start with simple messages and add complexity gradually
3. Check the Radar API logs for detailed error information
4. Test in a private channel or DM first to avoid spamming team channels

## Security Notes

- Never commit Slack tokens to version control
- Use environment variables or secure secret management for tokens
- Consider using user tokens vs bot tokens based on your needs
- Be mindful of rate limits when testing frequently

## Quick Reference - All Supported Actions

### Pull Request Actions
- `opened` - PR was opened
- `closed` - PR was closed (not merged)
- `merged` - PR was merged
- `reopened` - PR was reopened
- `assigned` - User was assigned to PR
- `unassigned` - User was unassigned from PR
- `review_requested` - Review was requested from user
- `review_request_removed` - Review request was removed
- `edited` - PR title/description was edited

### Review States
- `approved` - Review approved the changes
- `changes_requested` - Review requested changes
- `commented` - Review left comments without approval/rejection
- `dismissed` - Review was dismissed

### Issue Actions
- `opened` - Issue was opened
- `closed` - Issue was closed
- `reopened` - Issue was reopened
- `assigned` - User was assigned to issue
- `unassigned` - User was unassigned from issue
- `edited` - Issue title/description was edited

### Batch Testing
```bash
# Test all PR actions quickly
for action in opened closed merged reopened assigned review_requested; do
  python test_slack_message.py --token TOKEN --channel "#test" --type pull_request --pr-action $action --pr-number $((RANDOM % 1000))
done

# Test all review states
for state in approved changes_requested commented dismissed; do
  python test_slack_message.py --token TOKEN --channel "#test" --type pull_request_review --review-state $state --pr-number $((RANDOM % 1000))
done

# Test all issue actions
for action in opened closed reopened assigned; do
  python test_slack_message.py --token TOKEN --channel "#test" --type issue --issue-action $action --issue-number $((RANDOM % 1000))
done
```

## Contributing

If you add new message types or modify existing ones:

1. Update the testing API endpoint to support the new parameters
2. Add CLI arguments for the new parameters
3. Update this documentation with examples
4. Update TESTING_COMMANDS.md with new test commands
5. Test thoroughly with different parameter combinations