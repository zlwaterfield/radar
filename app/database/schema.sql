-- Radar Database Schema for Supabase
-- This file contains the complete database schema for the Radar application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR,
    name VARCHAR,
    is_active BOOLEAN DEFAULT TRUE,
    slack_id VARCHAR NOT NULL UNIQUE,
    slack_team_id VARCHAR NOT NULL,
    slack_access_token TEXT NOT NULL,
    slack_refresh_token TEXT,
    github_id VARCHAR UNIQUE,
    github_login VARCHAR,
    github_access_token TEXT,
    github_refresh_token TEXT,
    github_installation_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_preferences JSONB DEFAULT '{
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
        
        "mute_own_activity": true,
        "mute_bot_comments": true,
        "mute_draft_prs": true
    }'::jsonb,
    notification_schedule JSONB DEFAULT '{
        "real_time": true,
        "digest_enabled": false,
        "digest_time": "09:00",
        "digest_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "second_digest_enabled": false,
        "second_digest_time": null
    }'::jsonb,
    keyword_notification_preferences JSONB DEFAULT '{
        "enabled": false,
        "keywords": []
    }'::jsonb,
    stats_time_window INTEGER DEFAULT 14,
    watched_prs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create user_repositories table
CREATE TABLE IF NOT EXISTS user_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    github_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    description TEXT,
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
CREATE TABLE IF NOT EXISTS events (
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
CREATE TABLE IF NOT EXISTS notifications (
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

-- Create user_digests table to track sent digest notifications
CREATE TABLE IF NOT EXISTS user_digests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    message_ts VARCHAR,
    pull_request_count INTEGER DEFAULT 0,
    issue_count INTEGER DEFAULT 0,
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

-- Create triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_repositories_updated_at ON user_repositories;
CREATE TRIGGER update_user_repositories_updated_at
BEFORE UPDATE ON user_repositories
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_slack_id ON users(slack_id);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_user_repositories_user_id ON user_repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_repositories_github_id ON user_repositories(github_id);
CREATE INDEX IF NOT EXISTS idx_user_repositories_enabled ON user_repositories(enabled);
CREATE INDEX IF NOT EXISTS idx_events_repository_id ON events(repository_id);
CREATE INDEX IF NOT EXISTS idx_events_processed ON events(processed);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON notifications(event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_user_digests_user_id ON user_digests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_digests_sent_at ON user_digests(sent_at);
CREATE INDEX IF NOT EXISTS idx_user_settings_notification_preferences ON user_settings USING GIN (notification_preferences);

-- Row Level Security (RLS) - Uncomment to enable
-- Note: RLS policies must be implemented before enabling RLS, otherwise all queries are blocked
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (customize based on your authentication approach)
-- CREATE POLICY "Users can view their own data" ON users
--     FOR SELECT USING (id = auth.uid());
-- 
-- CREATE POLICY "Users can update their own data" ON users
--     FOR UPDATE USING (id = auth.uid());
-- 
-- CREATE POLICY "Users can view their own settings" ON user_settings
--     FOR ALL USING (user_id = auth.uid());
-- 
-- CREATE POLICY "Users can manage their own repositories" ON user_repositories
--     FOR ALL USING (user_id = auth.uid());
-- 
-- CREATE POLICY "Users can view their own notifications" ON notifications
--     FOR SELECT USING (user_id = auth.uid());
-- 
-- CREATE POLICY "Users can view their own digests" ON user_digests
--     FOR SELECT USING (user_id = auth.uid());