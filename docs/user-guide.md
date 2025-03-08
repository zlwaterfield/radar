# Radar User Guide

Radar is an intelligent notification system for GitHub that helps engineers stay informed about relevant pull requests, reviews, and comments while reducing notification noise.

## Table of Contents

- [Getting Started](#getting-started)
  - [Connecting Your GitHub Account](#connecting-your-github-account)
  - [Connecting Your Slack Account](#connecting-your-slack-account)
- [Dashboard](#dashboard)
  - [Statistics](#statistics)
  - [Recent Activity](#recent-activity)
- [Notification Types](#notification-types)
  - [Pull Request Notifications](#pull-request-notifications)
  - [Review Notifications](#review-notifications)
  - [Comment Notifications](#comment-notifications)
- [Notification Settings](#notification-settings)
  - [Relationship-Based Notifications](#relationship-based-notifications)
  - [Noise Reduction](#noise-reduction)
  - [Keyword Notifications](#keyword-notifications)
  - [Notification Schedule](#notification-schedule)
- [Troubleshooting](#troubleshooting)

## Getting Started

### Connecting Your GitHub Account

Radar requires a connection to your GitHub account to track pull requests, reviews, and comments.

1. From the dashboard, click the "Connect GitHub" button.
2. You'll be redirected to GitHub's authorization page.
3. Review the requested permissions and click "Authorize".
4. After authorization, you'll be redirected back to Radar.

Once connected, Radar will automatically start tracking your GitHub activity and display relevant notifications based on your settings.

### Connecting Your Slack Account

For Slack notifications:

1. Navigate to the Settings page.
2. In the "Integrations" section, click "Connect Slack".
3. You'll be redirected to Slack's authorization page.
4. Select the workspace where you want to receive notifications.
5. Review the permissions and click "Allow".
6. After authorization, you'll be redirected back to Radar.

## Dashboard

The dashboard provides an overview of your GitHub activity and recent notifications.

### Statistics

The dashboard displays key statistics about your GitHub activity:

- **Total Notifications**: The total number of notifications you've received.
- **Pull Requests**: The number of pull request notifications.
- **Reviews**: The number of review notifications.
- **Comments**: The number of comment notifications.

You can refresh these statistics by clicking the "Refresh" button in the top-right corner of the dashboard.

### Recent Activity

The Recent Activity section displays your most recent notifications, including:

- Pull request updates
- Reviews on your pull requests
- Comments on pull requests you're watching

Each notification includes:
- The type of activity (indicated by an icon)
- The title of the notification
- A brief description
- The repository where the activity occurred
- The time the activity occurred

## Notification Types

Radar tracks several types of GitHub events and generates notifications based on your relationship to the pull request and your notification preferences.

### Pull Request Notifications

Pull request notifications are triggered when:

- A new pull request is created
- A pull request is updated
- A pull request is merged
- A pull request is closed
- CI checks pass or fail on a pull request

### Review Notifications

Review notifications are triggered when:

- A review is requested
- A review is submitted
- A review request is removed

### Comment Notifications

Comment notifications are triggered when:

- A comment is added to a pull request
- A comment is added to a review
- A comment is added to a specific line of code
- You are mentioned in a comment

## Notification Settings

Radar offers granular control over which notifications you receive. You can access these settings from the Settings page.

### Relationship-Based Notifications

Radar understands your relationship to a pull request and allows you to customize notifications based on that relationship:

#### As a Reviewer

- Review requested
- PR commented on
- PR merged
- PR closed
- CI checks failed

#### As an Author

- PR reviewed
- PR commented on
- CI checks failed
- CI checks succeeded

#### As an Assignee

- PR commented on
- PR merged
- PR closed
- CI checks failed

#### Other

- When mentioned in a PR or comment
- When a team you're part of is mentioned

### Noise Reduction

Radar includes several features to reduce notification noise:

- **Mute Own Activity**: Don't receive notifications for your own actions
- **Mute Bot Comments**: Don't receive notifications for comments from bots
- **Group Similar Notifications**: Combine similar notifications into a single notification

### Keyword Notifications

Radar's AI-powered keyword notification system allows you to receive notifications when specific keywords are mentioned in pull requests or comments:

1. Navigate to the Settings page.
2. Under "Keyword Notifications", toggle the feature on.
3. Add keywords that are relevant to your work.
4. Adjust the confidence threshold if needed.

Radar will analyze pull request titles, descriptions, and comments to identify mentions of your keywords, even if they're not exact matches.

### Notification Schedule

You can customize when you receive notifications:

- **Real-time notifications**: Receive notifications as events occur
- **Daily digest**: Receive a summary of notifications once per day
- **Custom schedule**: Specify days of the week and times to receive notifications

## Troubleshooting

### GitHub Connection Issues

If you're experiencing issues with your GitHub connection:

1. Go to the Settings page.
2. Click "Reconnect GitHub".
3. Follow the authorization process again.

If problems persist, check that your GitHub token hasn't expired or been revoked.

### Missing Notifications

If you're not receiving expected notifications:

1. Check your notification settings to ensure you've enabled the relevant notification types.
2. Verify that the repository where the activity occurred is enabled in your repository settings.
3. Check that you have the correct relationship to the pull request (author, reviewer, etc.).

### Slack Notification Issues

If Slack notifications aren't working:

1. Go to the Settings page.
2. Verify that Slack is connected.
3. Check your Slack notification preferences.
4. Click "Reconnect Slack" if needed.

For additional help, contact support at support@radar.com.
