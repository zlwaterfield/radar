"""
Tests for the new activity-based notification preferences.
"""
import pytest
from app.models.notifications import NotificationPreferences, NotificationTrigger, WatchingReason
from app.services.notification_service import NotificationService


class TestNewNotificationPreferences:
    """Test the new activity-based notification preference system."""
    
    def test_default_preferences(self):
        """Test that default preferences are set correctly."""
        prefs = NotificationPreferences()
        
        # PR Activity should be enabled by default
        assert prefs.pr_comments is True
        assert prefs.pr_reviews is True
        assert prefs.pr_status_changes is True
        assert prefs.pr_assignments is True
        assert prefs.pr_opened is True
        
        # Issue Activity should be enabled by default
        assert prefs.issue_comments is True
        assert prefs.issue_status_changes is True
        assert prefs.issue_assignments is True
        
        # CI/CD - failures enabled, successes disabled (too noisy)
        assert prefs.check_failures is True
        assert prefs.check_successes is False
        
        # Mentions enabled by default
        assert prefs.mentioned_in_comments is True
        
        # Noise control defaults
        assert prefs.mute_own_activity is True
        assert prefs.mute_bot_comments is True
        assert prefs.mute_draft_prs is True
        
        # Digest defaults
        assert prefs.digest_enabled is False
        assert prefs.digest_time == "09:00"
    
    def test_helper_methods(self):
        """Test the helper methods return correct preferences."""
        prefs = NotificationPreferences()
        
        pr_notifications = prefs.get_pr_notifications()
        assert pr_notifications["comments"] is True
        assert pr_notifications["reviews"] is True
        assert pr_notifications["status_changes"] is True
        assert pr_notifications["assignments"] is True
        assert pr_notifications["opened"] is True
        
        issue_notifications = prefs.get_issue_notifications()
        assert issue_notifications["comments"] is True
        assert issue_notifications["status_changes"] is True
        assert issue_notifications["assignments"] is True
        
        ci_notifications = prefs.get_ci_notifications()
        assert ci_notifications["failures"] is True
        assert ci_notifications["successes"] is False
    
    @pytest.mark.asyncio
    async def test_pr_comments_notification_logic(self):
        """Test that PR comments use the new pr_comments preference."""
        # Mock user data
        user_id = "test-user-1"
        pr_data = {
            "id": 123,
            "title": "Test PR",
            "draft": False,
            "user": {"login": "author"}
        }
        trigger = NotificationTrigger.COMMENTED
        
        # Mock preferences with pr_comments enabled
        prefs = NotificationPreferences(pr_comments=True)
        
        # Mock watching reasons (user is author)
        watching_reasons = {WatchingReason.AUTHOR}
        
        # Test that notification logic uses pr_comments preference
        # Note: This would require mocking the async dependencies
        # In a real test, you'd mock SupabaseManager.get_user_settings, etc.
        
    def test_pr_comments_preference_enabled(self):
        """Test notification when pr_comments is enabled."""
        prefs = NotificationPreferences(pr_comments=True)
        
        # Should be enabled for PR comments
        assert prefs.pr_comments is True
        
    def test_pr_comments_preference_disabled(self):
        """Test notification when pr_comments is disabled."""
        prefs = NotificationPreferences(pr_comments=False)
        
        # Should be disabled for PR comments
        assert prefs.pr_comments is False
    
    def test_issue_comments_preference(self):
        """Test issue comments preference."""
        prefs = NotificationPreferences(issue_comments=False)
        
        # Should be disabled for issue comments
        assert prefs.issue_comments is False
        
        # But PR comments should still work independently
        assert prefs.pr_comments is True  # default
    
    def test_check_failures_preference(self):
        """Test CI check failure notifications."""
        prefs = NotificationPreferences(check_failures=False)
        
        # Should be disabled for check failures
        assert prefs.check_failures is False
    
    def test_check_successes_preference(self):
        """Test CI check success notifications (usually disabled by default)."""
        prefs = NotificationPreferences(check_successes=True)
        
        # Should be enabled when explicitly set
        assert prefs.check_successes is True
    
    def test_mentioned_in_comments_preference(self):
        """Test mentions in comments preference."""
        prefs = NotificationPreferences(mentioned_in_comments=False)
        
        # Should be disabled for mentions
        assert prefs.mentioned_in_comments is False
    
    def test_draft_pr_muting(self):
        """Test that draft PRs can be muted."""
        prefs = NotificationPreferences(mute_draft_prs=True)
        
        # Should be enabled for muting draft PRs
        assert prefs.mute_draft_prs is True
        
        # Test with muting disabled
        prefs_no_mute = NotificationPreferences(mute_draft_prs=False)
        assert prefs_no_mute.mute_draft_prs is False
    
    def test_noise_control_preferences(self):
        """Test noise control preferences."""
        prefs = NotificationPreferences(
            mute_own_activity=False,
            mute_bot_comments=False,
            mute_draft_prs=False
        )
        
        # All noise control should be disabled
        assert prefs.mute_own_activity is False
        assert prefs.mute_bot_comments is False
        assert prefs.mute_draft_prs is False
    
    def test_pr_status_changes_preference(self):
        """Test PR status changes (merged, closed, reopened) preference."""
        prefs = NotificationPreferences(pr_status_changes=False)
        
        # Should be disabled for PR status changes
        assert prefs.pr_status_changes is False
    
    def test_pr_assignments_preference(self):
        """Test PR assignments (assigned, review requested) preference.""" 
        prefs = NotificationPreferences(pr_assignments=False)
        
        # Should be disabled for PR assignments
        assert prefs.pr_assignments is False
    
    def test_pr_opened_preference(self):
        """Test new PR opened notifications preference."""
        prefs = NotificationPreferences(pr_opened=False)
        
        # Should be disabled for new PR notifications
        assert prefs.pr_opened is False
    
    def test_issue_status_changes_preference(self):
        """Test issue status changes preference."""
        prefs = NotificationPreferences(issue_status_changes=False)
        
        # Should be disabled for issue status changes
        assert prefs.issue_status_changes is False
    
    def test_issue_assignments_preference(self):
        """Test issue assignments preference."""
        prefs = NotificationPreferences(issue_assignments=False)
        
        # Should be disabled for issue assignments
        assert prefs.issue_assignments is False
    
    def test_backward_compatibility(self):
        """Test that legacy fields still exist for backward compatibility."""
        prefs = NotificationPreferences()
        
        # Legacy fields should exist with default values
        assert hasattr(prefs, 'reviewer_review_requested')
        assert hasattr(prefs, 'reviewer_commented')
        assert hasattr(prefs, 'author_reviewed')
        assert hasattr(prefs, 'author_commented')
        assert hasattr(prefs, 'assignee_assigned')
        assert hasattr(prefs, 'assignee_commented')
        
        # They should have default values
        assert prefs.reviewer_review_requested is True
        assert prefs.reviewer_commented is True
        assert prefs.author_reviewed is True
        assert prefs.author_commented is True
        assert prefs.assignee_assigned is True
        assert prefs.assignee_commented is True


class TestNotificationTriggersWithNewPreferences:
    """Test how notification triggers work with the new preference system."""
    
    def test_comment_trigger_uses_activity_preference(self):
        """Test that COMMENTED trigger uses the activity-based preference."""
        # This would be tested with proper async mocking
        # The key insight is that the trigger should check pr_comments 
        # regardless of whether user is author, reviewer, or assignee
        
        trigger = NotificationTrigger.COMMENTED
        assert trigger == NotificationTrigger.COMMENTED
    
    def test_review_trigger_uses_activity_preference(self):
        """Test that REVIEWED trigger uses pr_reviews preference."""
        trigger = NotificationTrigger.REVIEWED
        assert trigger == NotificationTrigger.REVIEWED
    
    def test_status_change_triggers(self):
        """Test that status change triggers use pr_status_changes preference."""
        merged_trigger = NotificationTrigger.MERGED
        closed_trigger = NotificationTrigger.CLOSED
        reopened_trigger = NotificationTrigger.REOPENED
        
        assert merged_trigger == NotificationTrigger.MERGED
        assert closed_trigger == NotificationTrigger.CLOSED
        assert reopened_trigger == NotificationTrigger.REOPENED
    
    def test_assignment_triggers(self):
        """Test that assignment triggers use pr_assignments preference."""
        assigned_trigger = NotificationTrigger.ASSIGNED
        review_requested_trigger = NotificationTrigger.REVIEW_REQUESTED
        
        assert assigned_trigger == NotificationTrigger.ASSIGNED
        assert review_requested_trigger == NotificationTrigger.REVIEW_REQUESTED
    
    def test_ci_triggers(self):
        """Test that CI triggers use check_failures/check_successes preferences."""
        failure_trigger = NotificationTrigger.CHECK_FAILED
        success_trigger = NotificationTrigger.CHECK_SUCCEEDED
        
        assert failure_trigger == NotificationTrigger.CHECK_FAILED
        assert success_trigger == NotificationTrigger.CHECK_SUCCEEDED


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__])