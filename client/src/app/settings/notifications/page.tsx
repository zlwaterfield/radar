'use client'

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface NotificationSettings {
  reviewer_review_requested: boolean;
  reviewer_commented: boolean;
  reviewer_merged: boolean;
  reviewer_closed: boolean;
  reviewer_check_failed: boolean;
  author_reviewed: boolean;
  author_commented: boolean;
  author_check_failed: boolean;
  author_check_succeeded: boolean;
  mute_own_activity: boolean;
  mute_bot_comments: boolean;
}

export default function NotificationsSettings() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    reviewer_review_requested: true,
    reviewer_commented: true,
    reviewer_merged: true,
    reviewer_closed: true,
    reviewer_check_failed: true,
    author_reviewed: true,
    author_commented: true,
    author_check_failed: true,
    author_check_succeeded: true,
    mute_own_activity: true,
    mute_bot_comments: true,
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
          
          // Reviewer notifications
          reviewer_review_requested: prefs.reviewer_review_requested ?? prev.reviewer_review_requested,
          reviewer_commented: prefs.reviewer_commented ?? prev.reviewer_commented,
          reviewer_merged: prefs.reviewer_merged ?? prev.reviewer_merged,
          reviewer_closed: prefs.reviewer_closed ?? prev.reviewer_closed,
          reviewer_check_failed: prefs.reviewer_check_failed ?? prev.reviewer_check_failed,
          
          // Author notifications
          author_reviewed: prefs.author_reviewed ?? prev.author_reviewed,
          author_commented: prefs.author_commented ?? prev.author_commented,
          author_check_failed: prefs.author_check_failed ?? prev.author_check_failed,
          author_check_succeeded: prefs.author_check_succeeded ?? prev.author_check_succeeded,
          
          // Noise reduction
          mute_own_activity: prefs.mute_own_activity ?? prev.mute_own_activity,
          mute_bot_comments: prefs.mute_bot_comments ?? prev.mute_bot_comments,
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
          // Reviewer notifications
          reviewer_review_requested: notificationSettings.reviewer_review_requested,
          reviewer_commented: notificationSettings.reviewer_commented,
          reviewer_merged: notificationSettings.reviewer_merged,
          reviewer_closed: notificationSettings.reviewer_closed,
          reviewer_check_failed: notificationSettings.reviewer_check_failed,
          
          // Author notifications
          author_reviewed: notificationSettings.author_reviewed,
          author_commented: notificationSettings.author_commented,
          author_check_failed: notificationSettings.author_check_failed,
          author_check_succeeded: notificationSettings.author_check_succeeded,
          
          // Noise reduction
          mute_own_activity: notificationSettings.mute_own_activity,
          mute_bot_comments: notificationSettings.mute_bot_comments,
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
          <p>Configure when you want to be notified based on your relationship to a pull request.</p>
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
