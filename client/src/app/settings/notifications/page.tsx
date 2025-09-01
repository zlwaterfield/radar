'use client'

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Loader from '@/components/Loader';
import Button from '@/components/Button';
import { toast } from 'sonner';

interface NotificationSettings {
  // PR Activity
  pull_request_opened: boolean;
  pull_request_closed: boolean;
  pull_request_merged: boolean;
  pull_request_reviewed: boolean;
  pull_request_commented: boolean;
  pull_request_assigned: boolean;
  
  // Issue Activity
  issue_opened: boolean;
  issue_closed: boolean;
  issue_commented: boolean;
  issue_assigned: boolean;
  
  // CI/CD
  check_failures: boolean;
  check_successes: boolean;
  
  // Mentions
  mention_in_comment: boolean;
  mention_in_pull_request: boolean;
  mention_in_issue: boolean;
  
  // Team notifications
  team_assignments: boolean;
  team_mentions: boolean;
  team_review_requests: boolean;
  
  // Noise Control
  mute_own_activity: boolean;
  mute_bot_comments: boolean;
  mute_draft_pull_requests: boolean;
}

export default function NotificationsSettings() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    // PR Activity
    pull_request_opened: true,
    pull_request_closed: true,
    pull_request_merged: true,
    pull_request_reviewed: true,
    pull_request_commented: true,
    pull_request_assigned: true,
    
    // Issue Activity
    issue_opened: true,
    issue_closed: true,
    issue_commented: true,
    issue_assigned: true,
    
    // CI/CD
    check_failures: true,
    check_successes: false,
    
    // Mentions
    mention_in_comment: true,
    mention_in_pull_request: true,
    mention_in_issue: true,
    
    // Team notifications
    team_assignments: true,
    team_mentions: true,
    team_review_requests: true,
    
    // Noise Control
    mute_own_activity: true,
    mute_bot_comments: true,
    mute_draft_pull_requests: true,
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchUserSettings();
    }
  }, [isAuthenticated, user]);

  const fetchUserSettings = async () => {
    try {
      if (!user?.id) return;
      
      const response = await fetch(`/api/users/me/settings`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user settings');
      }
      
      const data = await response.json();
      
      // Update notification settings
      if (data.notificationPreferences) {
        const prefs = data.notificationPreferences;
        
        setNotificationSettings(prev => ({
          ...prev,
          
          // PR Activity
          pull_request_opened: prefs.pull_request_opened ?? prev.pull_request_opened,
          pull_request_closed: prefs.pull_request_closed ?? prev.pull_request_closed,
          pull_request_merged: prefs.pull_request_merged ?? prev.pull_request_merged,
          pull_request_reviewed: prefs.pull_request_reviewed ?? prev.pull_request_reviewed,
          pull_request_commented: prefs.pull_request_commented ?? prev.pull_request_commented,
          pull_request_assigned: prefs.pull_request_assigned ?? prev.pull_request_assigned,
          
          // Issue Activity
          issue_opened: prefs.issue_opened ?? prev.issue_opened,
          issue_closed: prefs.issue_closed ?? prev.issue_closed,
          issue_commented: prefs.issue_commented ?? prev.issue_commented,
          issue_assigned: prefs.issue_assigned ?? prev.issue_assigned,
          
          // CI/CD
          check_failures: prefs.check_failures ?? prev.check_failures,
          check_successes: prefs.check_successes ?? prev.check_successes,
          
          // Mentions
          mention_in_comment: prefs.mention_in_comment ?? prev.mention_in_comment,
          mention_in_pull_request: prefs.mention_in_pull_request ?? prev.mention_in_pull_request,
          mention_in_issue: prefs.mention_in_issue ?? prev.mention_in_issue,
          
          // Team notifications
          team_assignments: prefs.team_assignments ?? prev.team_assignments,
          team_mentions: prefs.team_mentions ?? prev.team_mentions,
          team_review_requests: prefs.team_review_requests ?? prev.team_review_requests,
          
          // Noise Control
          mute_own_activity: prefs.mute_own_activity ?? prev.mute_own_activity,
          mute_bot_comments: prefs.mute_bot_comments ?? prev.mute_bot_comments,
          mute_draft_pull_requests: prefs.mute_draft_pull_requests ?? prev.mute_draft_pull_requests,
        }));
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
      toast.error('Failed to load notification settings.');
    }
  };

  const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = e.target;
    
    setNotificationSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const saveNotificationSettings = async () => {
    setIsSaving(true);
    
    try {
      // Format settings for API
      const settings = {
        notificationPreferences: {
          // PR Activity
          pull_request_opened: notificationSettings.pull_request_opened,
          pull_request_closed: notificationSettings.pull_request_closed,
          pull_request_merged: notificationSettings.pull_request_merged,
          pull_request_reviewed: notificationSettings.pull_request_reviewed,
          pull_request_commented: notificationSettings.pull_request_commented,
          pull_request_assigned: notificationSettings.pull_request_assigned,
          
          // Issue Activity
          issue_opened: notificationSettings.issue_opened,
          issue_closed: notificationSettings.issue_closed,
          issue_commented: notificationSettings.issue_commented,
          issue_assigned: notificationSettings.issue_assigned,
          
          // CI/CD
          check_failures: notificationSettings.check_failures,
          check_successes: notificationSettings.check_successes,
          
          // Mentions
          mention_in_comment: notificationSettings.mention_in_comment,
          mention_in_pull_request: notificationSettings.mention_in_pull_request,
          mention_in_issue: notificationSettings.mention_in_issue,
          
          // Team notifications
          team_assignments: notificationSettings.team_assignments,
          team_mentions: notificationSettings.team_mentions,
          team_review_requests: notificationSettings.team_review_requests,
          
          // Noise Control
          mute_own_activity: notificationSettings.mute_own_activity,
          mute_bot_comments: notificationSettings.mute_bot_comments,
          mute_draft_pull_requests: notificationSettings.mute_draft_pull_requests,
        }
      };
      
      // Save settings to API
      const response = await fetch(`/api/users/me/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save notification settings');
      }
      
      toast.success('Your notification preferences have been updated.');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error('Failed to save notification settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <Loader size="large" />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="px-6 py-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          Advanced notification preferences
        </h3>
        <div className="mt-2 max-w-xl text-sm text-gray-600 dark:text-gray-300">
          <p>Configure when you want to be notified about GitHub activity.</p>
          <p className="mt-1 text-xs">
            <strong>You&apos;re involved with</strong> a PR/issue when you&apos;re the author, assigned to it, requested for review, or mentioned in it.
          </p>
        </div>
        
        <div className="mt-5 space-y-6">
          {/* PR & Issue Activity */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Pull request activity</h4>
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <input
                  id="pr-comments"
                  name="pull_request_commented"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.pull_request_commented}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="pr-comments" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Comments on PRs you&apos;re involved with
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="pr-reviews"
                  name="pull_request_reviewed"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.pull_request_reviewed}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="pr-reviews" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Reviews on PRs you&apos;re involved with
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="pr-closed"
                  name="pull_request_closed"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.pull_request_closed}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="pr-closed" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  PRs closed that you&apos;re involved with
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="pr-merged"
                  name="pull_request_merged"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.pull_request_merged}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="pr-merged" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  PRs merged that you&apos;re involved with
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="pr-assignments"
                  name="pull_request_assigned"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.pull_request_assigned}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="pr-assignments" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  When you&apos;re assigned to PRs or requested for review
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="pr-opened"
                  name="pull_request_opened"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.pull_request_opened}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="pr-opened" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  New PRs opened in watched repositories
                </label>
              </div>
            </div>
          </div>
          
          {/* Issue Activity */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Issue activity</h4>
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <input
                  id="issue-opened"
                  name="issue_opened"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.issue_opened}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="issue-opened" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  New issues opened in watched repositories
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="issue-closed"
                  name="issue_closed"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.issue_closed}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="issue-closed" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Issues closed in watched repositories
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="issue-comments"
                  name="issue_commented"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.issue_commented}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="issue-comments" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Comments on issues you&apos;re involved with
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="issue-assignments"
                  name="issue_assigned"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.issue_assigned}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="issue-assignments" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  When you&apos;re assigned to issues
                </label>
              </div>
            </div>
          </div>
          
          {/* CI/CD */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">CI/CD</h4>
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <input
                  id="check-failures"
                  name="check_failures"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.check_failures}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="check-failures" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  CI check failures
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="check-successes"
                  name="check_successes"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.check_successes}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="check-successes" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  CI check successes
                </label>
              </div>
            </div>
          </div>
          
          {/* Mentions */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Mentions</h4>
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <input
                  id="mention-in-comment"
                  name="mention_in_comment"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.mention_in_comment}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="mention-in-comment" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  When you&apos;re mentioned in comments
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="mention-in-pull-request"
                  name="mention_in_pull_request"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.mention_in_pull_request}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="mention-in-pull-request" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  When you&apos;re mentioned in pull requests
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="mention-in-issue"
                  name="mention_in_issue"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.mention_in_issue}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="mention-in-issue" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  When you&apos;re mentioned in issues
                </label>
              </div>
            </div>
          </div>
          
          {/* Team Notifications */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Team notifications</h4>
            <div className="mt-1 mb-2 text-xs text-gray-500 dark:text-gray-400">
              These work in addition to your individual notification settings above
            </div>
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <input
                  id="team-assignments"
                  name="team_assignments"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.team_assignments}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="team-assignments" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  When your team is assigned to PRs or issues
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="team-mentions"
                  name="team_mentions"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.team_mentions}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="team-mentions" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  When your team is mentioned in PRs or issues
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="team-review-requests"
                  name="team_review_requests"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.team_review_requests}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="team-review-requests" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  When your team is requested to review PRs
                </label>
              </div>
            </div>
          </div>
          
          {/* Noise Control */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Noise control</h4>
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <input
                  id="mute-own-activity"
                  name="mute_own_activity"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.mute_own_activity}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="mute-own-activity" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Mute notifications for your own activity
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="mute-bot-comments"
                  name="mute_bot_comments"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.mute_bot_comments}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="mute-bot-comments" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Mute notifications from bot comments
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="mute-draft-prs"
                  name="mute_draft_pull_requests"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.mute_draft_pull_requests}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="mute-draft-prs" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Mute notifications for draft PRs
                </label>
              </div>
            </div>
          </div>
          
        </div>
        
        <div className="mt-5">
          <Button
            type="button"
            variant="primary"
            onClick={saveNotificationSettings}
            disabled={isSaving}
            loading={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save preferences'}
          </Button>
        </div>
      </div>
    </div>
  );
}
