'use client'

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface NotificationSettings {
  // PR & Issue Activity
  pr_comments: boolean;
  pr_reviews: boolean;
  pr_status_changes: boolean;
  pr_assignments: boolean;
  pr_opened: boolean;
  
  issue_comments: boolean;
  issue_status_changes: boolean;
  issue_assignments: boolean;
  
  // CI/CD
  check_failures: boolean;
  check_successes: boolean;
  
  // Mentions
  mentioned_in_comments: boolean;
  
  // Keywords (managed on separate page, but still part of notification_preferences)
  keyword_notifications_enabled: boolean;
  keywords: string[];
  keyword_notification_threshold: number;
  
  // Noise Control
  mute_own_activity: boolean;
  mute_bot_comments: boolean;
  mute_draft_prs: boolean;
  
  // Daily digest (managed on separate page, but still part of notification_preferences)
  digest_enabled: boolean;
  digest_time: string;
}

export default function NotificationsSettings() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    // PR & Issue Activity
    pr_comments: true,
    pr_reviews: true,
    pr_status_changes: true,
    pr_assignments: true,
    pr_opened: true,
    
    issue_comments: true,
    issue_status_changes: true,
    issue_assignments: true,
    
    // CI/CD
    check_failures: true,
    check_successes: false,
    
    // Mentions
    mentioned_in_comments: true,
    
    // Keywords (managed on separate page, but still part of notification_preferences)
    keyword_notifications_enabled: false,
    keywords: [],
    keyword_notification_threshold: 0.7,
    
    // Noise Control
    mute_own_activity: true,
    mute_bot_comments: true,
    mute_draft_prs: true,
    
    // Daily digest (managed on separate page, but still part of notification_preferences)
    digest_enabled: false,
    digest_time: '09:00',
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
      
      const response = await fetch(`/api/users/${user.id}/settings`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user settings');
      }
      
      const data = await response.json();
      
      // Update notification settings
      if (data.notification_preferences) {
        const prefs = data.notification_preferences;
        
        setNotificationSettings(prev => ({
          ...prev,
          
          // PR & Issue Activity
          pr_comments: prefs.pr_comments ?? prev.pr_comments,
          pr_reviews: prefs.pr_reviews ?? prev.pr_reviews,
          pr_status_changes: prefs.pr_status_changes ?? prev.pr_status_changes,
          pr_assignments: prefs.pr_assignments ?? prev.pr_assignments,
          pr_opened: prefs.pr_opened ?? prev.pr_opened,
          
          issue_comments: prefs.issue_comments ?? prev.issue_comments,
          issue_status_changes: prefs.issue_status_changes ?? prev.issue_status_changes,
          issue_assignments: prefs.issue_assignments ?? prev.issue_assignments,
          
          // CI/CD
          check_failures: prefs.check_failures ?? prev.check_failures,
          check_successes: prefs.check_successes ?? prev.check_successes,
          
          // Mentions
          mentioned_in_comments: prefs.mentioned_in_comments ?? prev.mentioned_in_comments,
          
          // Keywords (managed on separate page, but still part of notification_preferences)
          keyword_notifications_enabled: prefs.keyword_notifications_enabled ?? prev.keyword_notifications_enabled,
          keywords: prefs.keywords ?? prev.keywords,
          keyword_notification_threshold: prefs.keyword_notification_threshold ?? prev.keyword_notification_threshold,
          
          // Noise Control
          mute_own_activity: prefs.mute_own_activity ?? prev.mute_own_activity,
          mute_bot_comments: prefs.mute_bot_comments ?? prev.mute_bot_comments,
          mute_draft_prs: prefs.mute_draft_prs ?? prev.mute_draft_prs,
          
          // Daily digest (managed on separate page, but still part of notification_preferences)
          digest_enabled: prefs.digest_enabled ?? prev.digest_enabled,
          digest_time: prefs.digest_time ?? prev.digest_time,
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
        notification_preferences: {
          // PR & Issue Activity
          pr_comments: notificationSettings.pr_comments,
          pr_reviews: notificationSettings.pr_reviews,
          pr_status_changes: notificationSettings.pr_status_changes,
          pr_assignments: notificationSettings.pr_assignments,
          pr_opened: notificationSettings.pr_opened,
          
          issue_comments: notificationSettings.issue_comments,
          issue_status_changes: notificationSettings.issue_status_changes,
          issue_assignments: notificationSettings.issue_assignments,
          
          // CI/CD
          check_failures: notificationSettings.check_failures,
          check_successes: notificationSettings.check_successes,
          
          // Mentions
          mentioned_in_comments: notificationSettings.mentioned_in_comments,
          
          // Keywords (managed on separate page, but still part of notification_preferences)
          keyword_notifications_enabled: notificationSettings.keyword_notifications_enabled,
          keywords: notificationSettings.keywords,
          keyword_notification_threshold: notificationSettings.keyword_notification_threshold,
          
          // Noise Control
          mute_own_activity: notificationSettings.mute_own_activity,
          mute_bot_comments: notificationSettings.mute_bot_comments,
          mute_draft_prs: notificationSettings.mute_draft_prs,
          
          // Daily digest (managed on separate page, but still part of notification_preferences)
          digest_enabled: notificationSettings.digest_enabled,
          digest_time: notificationSettings.digest_time,
        }
      };
      
      // Save settings to API
      const response = await fetch(`/api/users/${user?.id}/settings`, {
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
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
          Advanced Notification Preferences
        </h3>
        <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
          <p>Configure when you want to be notified about GitHub activity. These settings apply regardless of your role on each PR or issue.</p>
        </div>
        
        <div className="mt-5 space-y-6">
          {/* PR & Issue Activity */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Pull Request Activity</h4>
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <input
                  id="pr-comments"
                  name="pr_comments"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.pr_comments}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="pr-comments" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Comments on PRs you're involved with
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="pr-reviews"
                  name="pr_reviews"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.pr_reviews}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="pr-reviews" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Reviews on PRs you're involved with
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="pr-status-changes"
                  name="pr_status_changes"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.pr_status_changes}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="pr-status-changes" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  PR status changes (merged, closed, reopened)
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="pr-assignments"
                  name="pr_assignments"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.pr_assignments}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="pr-assignments" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  PR assignments and review requests
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="pr-opened"
                  name="pr_opened"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.pr_opened}
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
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Issue Activity</h4>
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <input
                  id="issue-comments"
                  name="issue_comments"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.issue_comments}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="issue-comments" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Comments on issues you're involved with
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="issue-status-changes"
                  name="issue_status_changes"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.issue_status_changes}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="issue-status-changes" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Issue status changes (opened, closed, reopened)
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="issue-assignments"
                  name="issue_assignments"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.issue_assignments}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="issue-assignments" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Issue assignments
                </label>
              </div>
            </div>
          </div>
          
          {/* CI/CD */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">CI/CD</h4>
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
                  id="mentioned-in-comments"
                  name="mentioned_in_comments"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.mentioned_in_comments}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="mentioned-in-comments" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  When you're mentioned in comments
                </label>
              </div>
            </div>
          </div>
          
          {/* Noise Control */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Noise Control</h4>
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
                  name="mute_draft_prs"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.mute_draft_prs}
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
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            onClick={saveNotificationSettings}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
