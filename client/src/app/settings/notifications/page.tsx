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
  
  // Mentions & Keywords
  mentioned_in_comments: boolean;
  keyword_notifications_enabled: boolean;
  keywords: string[];
  keyword_notification_threshold: number;
  
  // Noise Control
  mute_own_activity: boolean;
  mute_bot_comments: boolean;
  mute_draft_prs: boolean;
  
  // Daily digest
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
    
    // Mentions & Keywords
    mentioned_in_comments: true,
    keyword_notifications_enabled: false,
    keywords: [],
    keyword_notification_threshold: 0.7,
    
    // Noise Control
    mute_own_activity: true,
    mute_bot_comments: true,
    mute_draft_prs: true,
    
    // Daily digest
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
          
          // Mentions & Keywords
          mentioned_in_comments: prefs.mentioned_in_comments ?? prev.mentioned_in_comments,
          keyword_notifications_enabled: prefs.keyword_notifications_enabled ?? prev.keyword_notifications_enabled,
          keywords: prefs.keywords ?? prev.keywords,
          keyword_notification_threshold: prefs.keyword_notification_threshold ?? prev.keyword_notification_threshold,
          
          // Noise Control
          mute_own_activity: prefs.mute_own_activity ?? prev.mute_own_activity,
          mute_bot_comments: prefs.mute_bot_comments ?? prev.mute_bot_comments,
          mute_draft_prs: prefs.mute_draft_prs ?? prev.mute_draft_prs,
          
          // Daily digest
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
          
          // Mentions & Keywords
          mentioned_in_comments: notificationSettings.mentioned_in_comments,
          keyword_notifications_enabled: notificationSettings.keyword_notifications_enabled,
          keywords: notificationSettings.keywords,
          keyword_notification_threshold: notificationSettings.keyword_notification_threshold,
          
          // Noise Control
          mute_own_activity: notificationSettings.mute_own_activity,
          mute_bot_comments: notificationSettings.mute_bot_comments,
          mute_draft_prs: notificationSettings.mute_draft_prs,
          
          // Daily digest
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
          {/* When you're a reviewer */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">When you're a reviewer</h4>
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <input
                  id="reviewer-review-requested"
                  name="reviewer_review_requested"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.reviewer_review_requested}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="reviewer-review-requested" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Review is requested
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="reviewer-commented"
                  name="reviewer_commented"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.reviewer_commented}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="reviewer-commented" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Someone comments on the PR
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="reviewer-merged"
                  name="reviewer_merged"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.reviewer_merged}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="reviewer-merged" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  PR is merged
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="reviewer-closed"
                  name="reviewer_closed"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.reviewer_closed}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="reviewer-closed" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  PR is closed without merging
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="reviewer-check-failed"
                  name="reviewer_check_failed"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.reviewer_check_failed}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="reviewer-check-failed" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  CI checks fail
                </label>
              </div>
            </div>
          </div>
          
          {/* When you're the author */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">When you're the author</h4>
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <input
                  id="author-reviewed"
                  name="author_reviewed"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.author_reviewed}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="author-reviewed" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Someone reviews your PR
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="author-commented"
                  name="author_commented"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.author_commented}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="author-commented" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Someone comments on your PR
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="author-check-failed"
                  name="author_check_failed"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.author_check_failed}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="author-check-failed" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  CI checks fail
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="author-check-succeeded"
                  name="author_check_succeeded"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={notificationSettings.author_check_succeeded}
                  onChange={handleNotificationChange}
                />
                <label htmlFor="author-check-succeeded" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  CI checks succeed
                </label>
              </div>
            </div>
          </div>
          
          {/* Noise reduction */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Noise reduction</h4>
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
