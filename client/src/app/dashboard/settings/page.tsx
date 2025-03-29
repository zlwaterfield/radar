
'use client'

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { FiGithub, FiSave, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import RepositoryTable from '@/components/RepositoryTable';

interface Repository {
  id: string;
  name: string;
  full_name: string;
  description: string;
  enabled: boolean;
  owner_avatar_url: string;
  owner_name: string;
  organization: string;
}

interface NotificationSettings {
  pull_requests: boolean;
  reviews: boolean;
  comments: boolean;
  digest_enabled: boolean;
  digest_time: string;
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

interface KeywordSettings {
  enabled: boolean;
  keywords: string[];
}

export default function Settings() {
  const { user, isAuthenticated, loading, connectGithub } = useAuth();
  const router = useRouter();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [repoLoading, setRepoLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggleAllLoading, setToggleAllLoading] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    pull_requests: true,
    reviews: true,
    comments: true,
    digest_enabled: false,
    digest_time: '09:00',
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

  const [keywordSettings, setKeywordSettings] = useState<KeywordSettings>({
    enabled: false,
    keywords: []
  });

  const [keywordInput, setKeywordInput] = useState('');
  const [isSavingKeywords, setIsSavingKeywords] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRepos, setTotalRepos] = useState(0);
  const [enabledFilter, setEnabledFilter] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [togglingRepos, setTogglingRepos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.github_id) {
      fetchRepositories();
      fetchUserSettings();
    }
  }, [isAuthenticated, user]);

  // Fetch repositories when filters or pagination changes
  useEffect(() => {
    if (user?.id) {
      fetchRepositories();
    }
  }, [currentPage, pageSize, enabledFilter, debouncedSearchTerm]);

  // Debounced search effect
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    
    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const fetchRepositories = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setRepoLoading(true);
      const response = await axios.get(`/api/settings/user/${user.id}/repositories`, {
        params: {
          page: currentPage,
          page_size: pageSize,
          enabled: enabledFilter !== null ? enabledFilter : undefined,
          search: debouncedSearchTerm || undefined
        }
      });
      
      // Handle the paginated response
      if (response.data) {
        setRepositories(response.data.items || []);
        setTotalPages(response.data.total_pages || 1);
        setTotalRepos(response.data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
    } finally {
      setRepoLoading(false);
    }
  }, [user?.id, currentPage, pageSize, enabledFilter, debouncedSearchTerm]);

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
      
      // Update digest settings
      if (data.notification_schedule) {
        const schedule = data.notification_schedule;
        
        setNotificationSettings(prev => ({
          ...prev,
          digest_enabled: schedule.digest_enabled ?? prev.digest_enabled,
          digest_time: schedule.digest_time ?? prev.digest_time,
        }));
      }
      
      // Update keyword notification settings
      if (data.keyword_notification_preferences) {
        const keywordPrefs = data.keyword_notification_preferences;
        
        setKeywordSettings({
          enabled: keywordPrefs.enabled ?? false,
          keywords: keywordPrefs.keywords ?? []
        });
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
      toast.error('Failed to load notification settings.');
    }
  };

  const refreshRepositories = async () => {
    try {
      setRefreshing(true);
      await axios.post(`/api/users/${user?.id}/repositories/refresh`);
      await fetchRepositories();
    } catch (error) {
      console.error('Error refreshing repositories:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleRepository = async (repoId: string) => {
    try {
      const repo = repositories.find(r => r.id === repoId);
      if (!repo) return;
      
      const newEnabledState = !repo.enabled;
      
      // Set toggling state for this repo
      setTogglingRepos(prev => {
        const newSet = new Set(prev);
        newSet.add(repoId);
        return newSet;
      });
      
      // Update UI optimistically
      setRepositories(prevRepositories => 
        prevRepositories.map(r => 
          r.id === repoId ? { ...r, enabled: newEnabledState } : r
        )
      );
      
      // Call API to update enabled status
      await axios.patch(`/api/settings/user/${user?.id}/repositories/${repoId}/toggle`, {
        enabled: newEnabledState
      });
      
      // No need to refresh repositories here, we've already updated the UI
    } catch (error) {
      console.error('Error toggling repository:', error);
      // Revert UI if there was an error
      fetchRepositories();
      toast.error('Failed to update repository status');
    } finally {
      // Remove toggling state for this repo
      setTogglingRepos(prev => {
        const newSet = new Set(prev);
        newSet.delete(repoId);
        return newSet;
      });
    }
  };

  const toggleAllRepositories = async (enabled: boolean) => {
    try {
      setToggleAllLoading(true);
      
      // Update UI optimistically
      setRepositories(prevRepositories => 
        prevRepositories.map(r => ({ ...r, enabled }))
      );
      
      // Call API to toggle all repositories
      await axios.patch(`/api/settings/user/${user?.id}/repositories/toggle-all`, {
        enabled
      });
      
      toast.success(`All repositories ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error toggling all repositories:', error);
      // Revert UI if there was an error
      fetchRepositories();
      toast.error('Failed to update repositories');
    } finally {
      setToggleAllLoading(false);
    }
  };

  const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = e.target;
    
    setNotificationSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleKeywordToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    setKeywordSettings(prev => ({
      ...prev,
      enabled: checked
    }));
  };

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setKeywordInput(value);
  };

  const addKeyword = () => {
    if (keywordInput.trim() === '') return;
    
    setKeywordSettings(prev => ({
      ...prev,
      keywords: [...prev.keywords, keywordInput.trim()]
    }));
    
    setKeywordInput('');
  };

  const removeKeyword = (keyword: string) => {
    setKeywordSettings(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword)
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
        },
        
        // Daily digest settings
        notification_schedule: {
          digest_enabled: notificationSettings.digest_enabled,
          digest_time: notificationSettings.digest_time
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

  const saveKeywordSettings = async () => {
    setIsSavingKeywords(true);
    
    try {
      // Format settings for API
      const settings = {
        keyword_notification_preferences: {
          enabled: keywordSettings.enabled,
          keywords: keywordSettings.keywords
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
        throw new Error('Failed to save keyword settings');
      }
      
      toast.success('Your keyword notification preferences have been updated.');
    } catch (error) {
      console.error('Error saving keyword settings:', error);
      toast.error('Failed to save keyword settings.');
    } finally {
      setIsSavingKeywords(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      
      // Save notification settings
      await saveNotificationSettings();
      
      // Save repository settings
      const enabledRepos = repositories
        .filter(repo => repo.enabled)
        .map(repo => repo.id);
        
      await axios.put(`/api/users/${user?.id}/repositories`, { repositories: enabledRepos });
      
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold mb-4">GitHub Integration</h2>
        
        {!user?.github_id ? (
          <div className="card bg-yellow-50 border border-yellow-200">
            <div className="flex items-start">
              <div>
                <h3 className="text-lg font-medium">GitHub account not connected</h3>
                <p className="mb-4">Connect your GitHub account to start receiving notifications.</p>
                <button 
                  onClick={connectGithub}
                  className="btn btn-primary flex items-center"
                >
                  <FiGithub className="mr-2" />
                  Connect GitHub Account
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 mt-8 bg-white dark:bg-gray-800 shadow rounded-lg">
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
                          defaultChecked={notificationSettings.reviewer_review_requested}
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
                          defaultChecked={notificationSettings.reviewer_commented}
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
                          defaultChecked={notificationSettings.reviewer_merged}
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
                          defaultChecked={notificationSettings.reviewer_closed}
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
                          defaultChecked={notificationSettings.reviewer_check_failed}
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
                          defaultChecked={notificationSettings.author_reviewed}
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
                          defaultChecked={notificationSettings.author_commented}
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
                          defaultChecked={notificationSettings.author_check_failed}
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
                          defaultChecked={notificationSettings.author_check_succeeded}
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
                  
                  {/* Daily Digest */}
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Daily Digest</h4>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center">
                        <input
                          id="digest-enabled"
                          name="digest_enabled"
                          type="checkbox"
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          checked={notificationSettings.digest_enabled}
                          onChange={handleNotificationChange}
                        />
                        <label htmlFor="digest-enabled" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                          Enable daily digest
                        </label>
                      </div>
                      {notificationSettings.digest_enabled && (
                        <div className="mt-3">
                          <label htmlFor="digest-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Time:
                          </label>
                          <div className="mt-1">
                            <input
                              type="time"
                              name="digest_time"
                              id="digest-time"
                              className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                              value={notificationSettings.digest_time}
                              onChange={handleNotificationChange}
                            />
                          </div>
                        </div>
                      )}
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
            
            {/* Keyword Notifications */}
            <div className="mb-6 mt-8 bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
                  AI-Powered Keyword Notifications
                </h3>
                <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                  <p>Get notified when pull requests contain content matching your keywords of interest.</p>
                </div>
                
                <div className="mt-5 space-y-4">
                  <div className="flex items-center">
                    <input
                      id="keyword-notifications-enabled"
                      name="keyword_notifications_enabled"
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      checked={keywordSettings.enabled}
                      onChange={handleKeywordToggle}
                    />
                    <label htmlFor="keyword-notifications-enabled" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Enable AI-powered keyword notifications
                    </label>
                  </div>
                  
                  <div className="mt-4">
                    <label htmlFor="keywords" className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Add keywords you want to be notified about (e.g., "security", "performance", "your team name")
                    </label>
                    <div className="flex">
                      <input
                        id="keywords"
                        type="text"
                        className="flex-1 border-gray-300 rounded-l-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        value={keywordInput}
                        onChange={handleKeywordChange}
                        disabled={!keywordSettings.enabled}
                        placeholder="Enter a keyword"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addKeyword();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                        onClick={addKeyword}
                        disabled={!keywordSettings.enabled || keywordInput.trim() === ''}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  
                  {keywordSettings.keywords.length > 0 && (
                    <div className="mt-4">
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                        Current keywords:
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {keywordSettings.keywords.map((keyword, index) => (
                          <div key={index} className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-md px-2 py-1">
                            <span className="text-sm text-gray-700 dark:text-gray-300">{keyword}</span>
                            <button
                              type="button"
                              className="ml-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              onClick={() => removeKeyword(keyword)}
                              disabled={!keywordSettings.enabled}
                            >
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    <p>Our AI will analyze pull request content and notify you when it matches your keywords.</p>
                  </div>
                </div>
                
                <div className="mt-5">
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    onClick={saveKeywordSettings}
                    disabled={isSavingKeywords}
                  >
                    {isSavingKeywords ? 'Saving...' : 'Save Keyword Settings'}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="bg-white shadow-md rounded-lg p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Monitored Repositories</h3>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => toggleAllRepositories(true)}
                    disabled={toggleAllLoading || refreshing}
                    className="btn btn-outline-primary flex items-center"
                  >
                    Enable All
                  </button>
                  <button 
                    onClick={() => toggleAllRepositories(false)}
                    disabled={toggleAllLoading || refreshing}
                    className="btn btn-outline-danger flex items-center"
                  >
                    Disable All
                  </button>
                  <button 
                    onClick={refreshRepositories}
                    disabled={refreshing || toggleAllLoading}
                    className="btn btn-outline-primary flex items-center"
                  >
                    <FiRefreshCw className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Refreshing...' : 'Refresh Repositories'}
                  </button>
                </div>
              </div>
              
              <div className="mb-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full p-2 pl-8 border rounded-md"
                        placeholder="Search repositories..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          if (e.target.value === '' && debouncedSearchTerm !== '') {
                            setCurrentPage(1);
                          }
                        }}
                      />
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-2 top-2.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              
              {repoLoading ? (
                <div className="flex justify-center items-center min-h-[300px]">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <>
                  {repositories.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 min-h-[300px] flex items-center justify-center">
                      No repositories found. Add repositories to monitor them.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <RepositoryTable 
                        repositories={repositories}
                        togglingRepos={togglingRepos}
                        toggleRepository={toggleRepository}
                      />
                    </div>
                  )}
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-4">
                      <div className="text-sm text-gray-700">
                        Showing <span className="font-medium">{repositories.length}</span> of{' '}
                        <span className="font-medium">{totalRepos}</span> repositories
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            if (currentPage > 1) {
                              setCurrentPage(currentPage - 1);
                            }
                          }}
                          disabled={currentPage === 1}
                          className="px-2 py-1 border rounded-md disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => {
                            if (currentPage < totalPages) {
                              setCurrentPage(currentPage + 1);
                            }
                          }}
                          disabled={currentPage === totalPages}
                          className="px-2 py-1 border rounded-md disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="mt-8 flex justify-end">
              <button 
                onClick={saveSettings}
                disabled={saving}
                className="btn btn-primary flex items-center"
              >
                <FiSave className="mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
