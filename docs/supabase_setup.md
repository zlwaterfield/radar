# Setting Up Supabase for Radar

This guide will walk you through the process of setting up a Supabase project for Radar.

## Prerequisites

- A Supabase account (sign up at [supabase.com](https://supabase.com))
- A development environment with Radar installed

## Step 1: Create a New Supabase Project

1. Log in to your Supabase account
2. Click "New Project"
3. Enter the following details:
   - **Name**: Radar
   - **Database Password**: Create a secure password
   - **Region**: Choose a region closest to your users
4. Click "Create New Project"
5. Wait for your project to be created (this may take a few minutes)

## Step 2: Get Your API Keys

1. Once your project is created, go to the project dashboard
2. In the sidebar, click on "Settings" > "API"
3. You'll find two important keys:
   - **Project URL**: The URL of your Supabase project
   - **API Key**: The anon/public key for your project
4. Copy these values as you'll need them for your environment variables

## Step 3: Set Up Database Tables

Radar requires several tables in your Supabase database. You can create these tables using the SQL editor or the Supabase dashboard.

### Using the SQL Editor

1. In the Supabase dashboard, go to the "SQL Editor" section
2. Create a new query
3. Paste the following SQL code:

```sql
-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR,
    name VARCHAR,
    is_active BOOLEAN DEFAULT TRUE,
    slack_id VARCHAR NOT NULL UNIQUE,
    slack_team_id VARCHAR NOT NULL,
    slack_access_token VARCHAR NOT NULL,
    slack_refresh_token VARCHAR,
    github_id VARCHAR UNIQUE,
    github_login VARCHAR,
    github_access_token VARCHAR,
    github_refresh_token VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_settings table
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_preferences JSONB DEFAULT '{
        "pull_request_opened": true,
        "pull_request_closed": true,
        "pull_request_merged": true,
        "pull_request_reviewed": true,
        "pull_request_commented": true,
        "pull_request_assigned": true,
        "issue_opened": true,
        "issue_closed": true,
        "issue_commented": true,
        "issue_assigned": true
    }'::jsonb,
    notification_schedule JSONB DEFAULT '{
        "real_time": true,
        "digest_time": "09:00",
        "digest_enabled": true,
        "digest_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "second_digest_time": null,
        "second_digest_enabled": false
    }'::jsonb,
    stats_time_window INTEGER DEFAULT 14,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create user_repositories table
CREATE TABLE user_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    github_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    url VARCHAR NOT NULL,
    full_name VARCHAR NOT NULL,
    repo_data JSONB,
    owner_name VARCHAR,
    owner_avatar_url VARCHAR,
    owner_url VARCHAR,
    enabled BOOLEAN DEFAULT FALSE,
    organization VARCHAR,
    is_private BOOLEAN NOT NULL,
    is_fork BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, github_id)
);

-- Create events table to store GitHub events
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR NOT NULL,
    action VARCHAR,
    repository_id VARCHAR NOT NULL,
    repository_name VARCHAR NOT NULL,
    sender_id VARCHAR NOT NULL,
    sender_login VARCHAR NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table to store sent notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    message_type VARCHAR NOT NULL,
    channel VARCHAR NOT NULL,
    message_ts VARCHAR,
    thread_ts VARCHAR,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create functions and triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_repositories_updated_at
BEFORE UPDATE ON user_repositories
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_users_slack_id ON users(slack_id);
CREATE INDEX idx_users_github_id ON users(github_id);
CREATE INDEX idx_user_repositories_user_id ON user_repositories(user_id);
CREATE INDEX idx_events_repository_id ON events(repository_id);
CREATE INDEX idx_events_processed ON events(processed);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_event_id ON notifications(event_id);
```

4. Click "Run" to execute the SQL code

### Using the Dashboard

Alternatively, you can create the tables using the Supabase dashboard:

1. Go to the "Table Editor" section
2. Click "Create a new table"
3. Enter the table name and columns as defined in the SQL above
4. Repeat for each table

## Step 4: Set Up Row-Level Security (RLS)

To secure your data, you should enable Row-Level Security (RLS) on your tables:

1. In the Supabase dashboard, go to the "Authentication" > "Policies" section
2. For each table, click "Enable RLS"
3. Create policies that restrict access to only authenticated users

Here's an example policy for the `users` table:

```sql
CREATE POLICY "Users can only access their own data"
ON users
FOR ALL
USING (auth.uid() = id);
```

## Step 5: Configure Environment Variables

Add the following environment variables to your `.env` file:

```
SUPABASE_URL=your_project_url
SUPABASE_KEY=your_api_key
```

## Step 6: Verify the Setup

1. Start your Radar application
2. Try to authenticate a user through Slack
3. Check your Supabase database to ensure the user is created

## Database Schema Explanation

- **users**: Stores user information including Slack and GitHub credentials
- **user_settings**: Stores user notification preferences and settings
- **user_repositories**: Maps users to their selected GitHub repositories
- **events**: Stores GitHub events received via webhooks
- **notifications**: Tracks notifications sent to users

## Troubleshooting

### Connection Issues

- Verify that your environment variables are set correctly
- Ensure that your IP address is allowed in the Supabase project settings
- Check that your database is online in the Supabase dashboard

### Permission Errors

- Verify that Row-Level Security (RLS) is configured correctly
- Ensure that your policies allow the necessary operations
- Check that you're using the correct API key

### Performance Issues

- Monitor your database performance in the Supabase dashboard
- Consider adding additional indexes for frequently queried columns
- Implement caching for frequently accessed data

## Next Steps

- [Set up your Slack App](./slack_setup.md)
- [Set up your GitHub App](./github_setup.md)
- [Start using Radar](./user_guide.md)
