# Setting Up Your Slack App

This guide will walk you through the process of creating and configuring a Slack app for Radar.

## Prerequisites

- A Slack workspace where you have admin privileges
- A development environment with Radar installed
- A publicly accessible URL for your application (or a tunneling service like ngrok for development)

## Step 1: Create a New Slack App

1. Go to the [Slack API website](https://api.slack.com/apps)
2. Click on "Create New App"
3. Choose "From scratch"
4. Enter "Radar" as the app name
5. Select your development workspace
6. Click "Create App"

## Step 2: Configure App Features

### Basic Information

After creating your app, you'll be taken to the "Basic Information" page. Here you'll find important credentials:

- **App ID**: Used to identify your app
- **Client ID**: Used for OAuth authentication
- **Client Secret**: Used for OAuth authentication
- **Signing Secret**: Used to verify requests from Slack

Save these values as you'll need them for your environment variables.

### OAuth & Permissions

1. Navigate to "OAuth & Permissions" in the sidebar
2. Under "Redirect URLs", add your callback URL:
   ```
   https://your-domain.com/api/auth/slack/callback
   ```
   For local development, you can use ngrok to create a public URL that forwards to your local server:
   ```
   https://your-ngrok-url.ngrok.io/api/auth/slack/callback
   ```

3. Under "Bot Token Scopes", add the following scopes:
   - `chat:write` - Send messages as the app
   - `chat:write.public` - Send messages to channels the app isn't in
   - `commands` - Add slash commands to the app
   - `users:read` - View basic information about users
   - `users:read.email` - View email addresses of users
   - `team:read` - View basic information about the workspace
   - `im:history` - View direct message history
   - `im:read` - View direct messages
   - `im:write` - Send direct messages

4. After adding all the required scopes, scroll up to the "OAuth Tokens for Your Workspace" section
5. Click "Install to Workspace" (or reinstall if you've already installed it)
6. Authorize the app with the requested permissions
7. After authorization, you'll be redirected back to the "OAuth & Permissions" page
8. Copy the "Bot User OAuth Token" that starts with `xoxb-`
9. Save this token as you'll need it for your environment variables

### Event Subscriptions

1. Navigate to "Event Subscriptions" in the sidebar
2. Toggle "Enable Events" to On
3. Enter your Request URL:
   ```
   https://your-domain.com/api/slack/events
   ```
   For local development, use your ngrok URL:
   ```
   https://your-ngrok-url.ngrok.io/api/slack/events
   ```
   
4. Under "Subscribe to bot events", add:
   - `app_home_opened` - User opened the app home
   - `app_mention` - User mentioned the app in a message

5. Under "Subscribe to events on behalf of users", add:
   - `message.im` - Message was posted in a direct message

6. Click "Save Changes"

### Slash Commands

1. Navigate to "Slash Commands" in the sidebar
2. Click "Create New Command"
3. Fill in the following details:
   - Command: `/radar`
   - Request URL: `https://your-domain.com/api/slack/commands`
   - Short Description: "Interact with Radar"
   - Usage Hint: "[help|settings|stats]"
4. Click "Save"

### App Home

1. Navigate to "App Home" in the sidebar
2. Under "Your App's Presence in Slack", customize the display name and icon if desired
3. Under "App Home", toggle "Show Tabs" to On
4. Enable both the "Home Tab" and "Messages Tab"
5. Check "Allow users to send Slash commands and messages from the messages tab"
6. Under "App Display Name", set a friendly name like "Radar"
7. Optionally, upload a custom app icon (recommended size: 512x512px)
8. Click "Save Changes"

#### App Home Permissions
For the App Home to render properly, ensure you have these additional scopes:
- `app_mentions:read` - Allow the app to see when it's mentioned
- `users:read` - View users in the workspace (needed for personalization)

#### Testing App Home
To test if your App Home is working:
1. Make sure your app is running and accessible via the configured URL
2. In Slack, click on your app name in the Apps section of the sidebar
3. You should see the Home tab with your custom content
4. If the Home tab doesn't appear or is empty, check your logs for errors

### Interactivity & Shortcuts

1. Navigate to "Interactivity & Shortcuts" in the sidebar
2. Toggle "Interactivity" to On
3. Enter your Request URL:
   ```
   https://your-domain.com/api/slack/interactions
   ```
   For local development, use your ngrok URL:
   ```
   https://your-ngrok-url.ngrok.io/api/slack/interactions
   ```
4. Under "Select Menus", use the same Request URL
5. Click "Save Changes"

## Step 3: Install the App to Your Workspace

1. Navigate to "OAuth & Permissions" in the sidebar
2. Click "Install to Workspace"
3. Review the permissions and click "Allow"
4. You'll be redirected back to the app configuration page
5. Note the "Bot User OAuth Token" - you'll need this for your environment variables

## Step 4: Configure Environment Variables

Add the following environment variables to your `.env` file:

```
SLACK_APP_CLIENT_ID=your_client_id
SLACK_APP_CLIENT_SECRET=your_client_secret
SLACK_SIGNING_SECRET=your_signing_secret
SLACK_BOT_TOKEN=xoxb-your-bot-token
```

### Token Types and Their Uses

- **SLACK_BOT_TOKEN**: Starts with `xoxb-` and contains all the permissions your bot needs to interact with Slack workspaces (posting messages, reading channels, etc.).
- **SLACK_APP_CLIENT_ID** and **SLACK_APP_CLIENT_SECRET**: Used for OAuth flows when users install your app.
- **SLACK_SIGNING_SECRET**: Used to verify that requests are coming from Slack.

## Step 5: Setting Up ngrok for Local Development

For local development, you'll need to expose your local server to the internet so Slack can send events to it. ngrok is a popular tool for this:

1. Install ngrok from [https://ngrok.com/download](https://ngrok.com/download)
2. Start your Radar application on port 8000
3. In a separate terminal, run:
   ```
   ngrok http 8000
   ```
4. ngrok will provide you with a public URL (e.g., `https://abc123.ngrok.io`)
5. Update all your Slack app's Request URLs to use this ngrok URL
6. Remember that ngrok URLs change each time you restart ngrok, so you'll need to update your Slack app settings accordingly

## Step 6: Verify the Installation

1. Start your Radar application
2. Ensure ngrok is running and forwarding to your application (for local development)
3. In your Slack workspace, try using the `/radar help` command
4. You should receive a response from the bot

## Troubleshooting

### App Not Responding to Events

- Ensure your server is running and accessible from the internet
- Verify that your Request URL is correct
- Check the Slack event logs in the "Event Subscriptions" page
- For local development, make sure ngrok is running and the URLs in your Slack app settings match your current ngrok URL

### App Home Not Displaying

- Verify that you've subscribed to the `app_home_opened` event
- Check that your app has the necessary scopes (`app_mentions:read`, `users:read`)
- Ensure your event handler for `app_home_opened` is working correctly
- Look for errors in your application logs when a user opens the App Home
- Try reinstalling the app to your workspace to refresh permissions

### Authentication Errors

- Verify that your environment variables are set correctly
- Ensure that your app has the necessary scopes
- Check that your redirect URL is correctly configured

### Rate Limiting

Slack has rate limits for API calls. If you're experiencing issues:

- Implement retry logic with exponential backoff
- Cache responses where appropriate
- Batch requests when possible

## Next Steps

- [Set up your GitHub App](./github_setup.md)
- [Configure Supabase](./supabase_setup.md)
- [Start using Radar](./user_guide.md)
