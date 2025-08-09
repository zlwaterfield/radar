-- Migration: Update notification preferences to use activity-based structure
-- Date: 2025-01-XX
-- Description: Adds new activity-based notification preferences while keeping legacy fields for compatibility

-- Update the default notification_preferences in user_settings table
ALTER TABLE user_settings 
ALTER COLUMN notification_preferences 
SET DEFAULT '{
    "_schema_version": 2,
    "_migration_date": "2025-01-XX",
    
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
    "keyword_notifications_enabled": false,
    "keywords": [],
    "keyword_notification_threshold": 0.7,
    
    "mute_own_activity": true,
    "mute_bot_comments": true,
    "mute_draft_prs": true,
    
    "digest_enabled": false,
    "digest_time": "09:00",
    
    "_legacy_fields": {
        "author_reviewed": true,
        "author_commented": true,
        "author_merged": true,
        "author_closed": true,
        "author_check_failed": true,
        "author_check_succeeded": true,
        "reviewer_review_requested": true,
        "reviewer_commented": true,
        "reviewer_merged": true,
        "reviewer_closed": true,
        "reviewer_check_failed": true,
        "reviewer_check_succeeded": true,
        "assignee_assigned": true,
        "assignee_unassigned": true,
        "assignee_commented": true,
        "assignee_merged": true,
        "assignee_closed": true,
        "assignee_check_failed": true,
        "assignee_check_succeeded": true
    }
}'::jsonb;

-- Update existing user settings to include new preferences
-- This preserves existing preferences while adding new ones with defaults
UPDATE user_settings 
SET notification_preferences = notification_preferences || '{
    "_schema_version": 2,
    "_migration_date": "2025-01-XX",
    
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
    "mute_draft_prs": true,
    "digest_enabled": false,
    "digest_time": "09:00"
}'::jsonb
WHERE notification_preferences IS NOT NULL;

-- Create index for better performance on notification preference queries
CREATE INDEX IF NOT EXISTS idx_user_settings_notification_preferences 
ON user_settings USING GIN (notification_preferences);

-- Add a comment to track this migration
COMMENT ON TABLE user_settings IS 'User settings including notification preferences. Schema version 2 includes activity-based notification structure.';

-- Optional: Create a function to migrate old preferences to new structure
-- This can be used to intelligently map old role-based preferences to new activity-based ones
CREATE OR REPLACE FUNCTION migrate_notification_preferences()
RETURNS void AS $$
DECLARE
    user_record RECORD;
    old_prefs jsonb;
    new_prefs jsonb;
BEGIN
    -- Loop through all users with existing preferences
    FOR user_record IN 
        SELECT id, user_id, notification_preferences 
        FROM user_settings 
        WHERE notification_preferences IS NOT NULL
        AND (notification_preferences->>'_schema_version')::int < 2 OR notification_preferences->>'_schema_version' IS NULL
    LOOP
        old_prefs := user_record.notification_preferences;
        
        -- Build new preferences based on old ones
        new_prefs := jsonb_build_object(
            '_schema_version', 2,
            '_migration_date', CURRENT_DATE::text,
            
            -- Map old preferences to new activity-based ones
            -- Use the most permissive setting from the old role-based preferences
            'pr_comments', COALESCE(
                (old_prefs->>'author_commented')::boolean OR 
                (old_prefs->>'reviewer_commented')::boolean OR 
                (old_prefs->>'assignee_commented')::boolean,
                true
            ),
            'pr_reviews', COALESCE((old_prefs->>'author_reviewed')::boolean, true),
            'pr_status_changes', COALESCE(
                (old_prefs->>'author_merged')::boolean OR 
                (old_prefs->>'reviewer_merged')::boolean OR 
                (old_prefs->>'assignee_merged')::boolean OR
                (old_prefs->>'author_closed')::boolean OR 
                (old_prefs->>'reviewer_closed')::boolean OR 
                (old_prefs->>'assignee_closed')::boolean,
                true
            ),
            'pr_assignments', COALESCE(
                (old_prefs->>'reviewer_review_requested')::boolean OR
                (old_prefs->>'assignee_assigned')::boolean,
                true
            ),
            'pr_opened', true,
            
            'issue_comments', COALESCE((old_prefs->>'issues')::boolean, true),
            'issue_status_changes', true,
            'issue_assignments', true,
            
            'check_failures', COALESCE(
                (old_prefs->>'author_check_failed')::boolean OR
                (old_prefs->>'reviewer_check_failed')::boolean OR
                (old_prefs->>'assignee_check_failed')::boolean,
                true
            ),
            'check_successes', COALESCE(
                (old_prefs->>'author_check_succeeded')::boolean OR
                (old_prefs->>'reviewer_check_succeeded')::boolean OR
                (old_prefs->>'assignee_check_succeeded')::boolean,
                false
            ),
            
            'mentioned_in_comments', true,
            'keyword_notifications_enabled', COALESCE((old_prefs->>'keyword_notifications_enabled')::boolean, false),
            'keywords', COALESCE(old_prefs->'keywords', '[]'::jsonb),
            'keyword_notification_threshold', COALESCE((old_prefs->>'keyword_notification_threshold')::numeric, 0.7),
            
            'mute_own_activity', COALESCE((old_prefs->>'mute_own_activity')::boolean, true),
            'mute_bot_comments', COALESCE((old_prefs->>'mute_bot_comments')::boolean, true),
            'mute_draft_prs', true,
            
            'digest_enabled', false,
            'digest_time', '09:00'
        );
        
        -- Merge with existing preferences, preserving any other fields
        new_prefs := old_prefs || new_prefs;
        
        -- Update the user's preferences
        UPDATE user_settings 
        SET notification_preferences = new_prefs
        WHERE id = user_record.id;
        
        RAISE NOTICE 'Migrated notification preferences for user %', user_record.user_id;
    END LOOP;
    
    RAISE NOTICE 'Notification preferences migration completed';
END;
$$ LANGUAGE plpgsql;

-- Uncomment the line below to run the migration function
-- SELECT migrate_notification_preferences();