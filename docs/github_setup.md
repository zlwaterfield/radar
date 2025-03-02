# Setting Up Your GitHub App

This guide will walk you through the process of creating and configuring a GitHub App for Radar.

## Prerequisites

- A GitHub account
- Admin access to the repositories you want to monitor
- A development environment with Radar installed

## Step 1: Create a New GitHub App

1. Go to your GitHub account settings
2. Navigate to "Developer settings" > "GitHub Apps"
3. Click "New GitHub App"
4. Fill in the following details:
   - **GitHub App name**: Radar
   - **Homepage URL**: Your application's URL or GitHub repository URL
   - **Webhook URL**: `https://your-domain.com/api/webhooks/github`
   - **Webhook secret**: Generate a secure random string (you'll need this later)
   - **Description**: A Slack app that notifies you about GitHub activity in real-time

## Step 2: Set Permissions

Configure the following permissions for your GitHub App:

### Repository Permissions

- **Contents**: Read-only (to access repository content)
- **Issues**: Read-only (to access issue information)
- **Metadata**: Read-only (required for all API access)
- **Pull requests**: Read-only (to access PR information)
- **Commit statuses**: Read-only (to access status information)
- **Webhooks**: Read & write (to manage webhook subscriptions)

### Organization Permissions

- **Members**: Read-only (to access organization member information)

### User Permissions

- **Email addresses**: Read-only (to match GitHub users with Slack users)

## Step 3: Subscribe to Events

Subscribe to the following webhook events:

- **Repository**
  - Issues
  - Issue comment
  - Pull request
  - Pull request review
  - Pull request review comment
  - Push

- **Organization**
  - Member

## Step 4: Generate a Private Key

1. After creating the app, scroll down to the "Private keys" section
2. Click "Generate a private key"
3. A .pem file will be downloaded to your computer
4. Store this file securely - you'll need it for your application

## Step 5: Install the GitHub App

1. Click "Install App" in the sidebar
2. Choose the account where you want to install the app
3. Select the repositories you want to monitor
   - You can select "All repositories" or "Only select repositories"
4. Click "Install"

## Step 6: Configure OAuth

1. In your GitHub App settings, navigate to "Optional features"
2. Check "Request user authorization (OAuth) during installation"
3. Add the following OAuth callback URL:
   ```
   https://your-domain.com/api/github/oauth/callback
   ```
4. Under "User permissions", add:
   - **Email addresses**: Read-only

## Step 7: Note Important Information

Take note of the following information from your GitHub App settings:

- **App ID**: Displayed near the top of the page
- **Client ID**: Under the "OAuth credentials" section
- **Client Secret**: Under the "OAuth credentials" section
- **Webhook Secret**: The secret you created earlier
- **Private Key**: The .pem file you downloaded

## Step 8: Configure Environment Variables

Add the following environment variables to your `.env` file:

```
GITHUB_APP_ID=your_app_id
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_PRIVATE_KEY_PATH=/path/to/your/private-key.pem
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

## Step 9: Verify the Installation

1. Make a change to one of your repositories (e.g., create an issue)
2. Check your application logs to ensure the webhook is received
3. Verify that the notification appears in Slack

## Troubleshooting

### Webhook Delivery Issues

- Check the "Advanced" section of your GitHub App settings to see recent webhook deliveries
- Verify that your webhook URL is accessible from the internet
- Ensure your webhook secret is correctly configured

### Authentication Errors

- Verify that your environment variables are set correctly
- Ensure that the private key is valid and accessible
- Check that your app has the necessary permissions

### Rate Limiting

GitHub has rate limits for API calls. If you're experiencing issues:

- Implement retry logic with exponential backoff
- Cache responses where appropriate
- Use conditional requests with ETags

## GitHub App vs. OAuth App

We're using a GitHub App instead of a traditional OAuth App for several reasons:

1. **Fine-grained permissions**: GitHub Apps allow for more specific permission scopes
2. **Higher rate limits**: GitHub Apps have higher rate limits than OAuth Apps
3. **Webhook events**: GitHub Apps can receive webhook events directly
4. **Installation-based**: Users can install the app on specific repositories

## Next Steps

- [Set up your Slack App](./slack_setup.md)
- [Configure Supabase](./supabase_setup.md)
- [Start using Radar](./user_guide.md)
