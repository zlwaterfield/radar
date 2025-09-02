'use client'

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Loader from '@/components/Loader';
import Button from '@/components/Button';
import { toast } from 'sonner';
import axios from '@/lib/axios';
import { format } from 'date-fns';

interface DigestSettings {
  digest_enabled: boolean;
  digest_time: string;
}

interface DigestPreview {
  waitingOnUser: number;
  approvedReadyToMerge: number;
  userOpenPRs: number;
  details?: {
    waitingOnUser: Array<{ title: string; url: string; repo: string }>;
    approvedReadyToMerge: Array<{ title: string; url: string; repo: string }>;
    userOpenPRs: Array<{ title: string; url: string; repo: string }>;
  };
}

interface DigestHistory {
  id: string;
  sentAt: string;
  pullRequestCount: number;
  issueCount: number;
}

export default function DigestSettings() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [digestSettings, setDigestSettings] = useState<DigestSettings>({
    digest_enabled: false,
    digest_time: '09:00',
  });
  const [preview, setPreview] = useState<DigestPreview | null>(null);
  const [history, setHistory] = useState<DigestHistory[]>([]);
  const [activeTab, setActiveTab] = useState<'settings' | 'preview' | 'history'>('settings');

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchUserSettings();
      fetchDigestHistory();
    }
  }, [isAuthenticated, user]);

  const fetchUserSettings = async () => {
    try {
      if (!user?.id) return;
      
      const response = await axios.get(`/api/users/me/settings`);
      const data = response.data;
      
      // Update digest settings
      if (data.notificationSchedule) {
        const schedule = data.notificationSchedule;
        
        setDigestSettings({
          digest_enabled: schedule.digest_enabled ?? false,
          digest_time: schedule.digest_time ?? '09:00',
        });
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
      toast.error('Failed to load digest settings.');
    }
  };

  const fetchDigestHistory = async () => {
    try {
      if (!user?.id) return;
      
      const response = await axios.get(`/api/digest/history`);
      
      if (response.data.success) {
        setHistory(response.data.history);
      } else {
        console.error('Failed to fetch digest history:', response.data.error);
      }
    } catch (error) {
      console.error('Error fetching digest history:', error);
      // If API fails, show empty history instead of crashing
      setHistory([]);
    }
  };

  const handleDigestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = e.target;
    
    setDigestSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateSettings = (): boolean => {
    if (digestSettings.digest_enabled && !digestSettings.digest_time) {
      toast.error('Please select a delivery time.');
      return false;
    }
    
    const [hours, minutes] = digestSettings.digest_time.split(':').map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      toast.error('Please enter a valid time.');
      return false;
    }
    
    return true;
  };

  const saveDigestSettings = async () => {
    if (!validateSettings()) return;
    
    setIsSaving(true);
    
    try {
      // Format settings for API
      const settings = {
        notificationSchedule: {
          digest_enabled: digestSettings.digest_enabled,
          digest_time: digestSettings.digest_time
        }
      };
      
      // Save settings to API
      await axios.post(`/api/users/me/settings`, settings);
      
      toast.success('Your digest preferences have been updated.');
      
      // Refresh history after enabling/disabling
      if (digestSettings.digest_enabled) {
        fetchDigestHistory();
      }
    } catch (error) {
      console.error('Error saving digest settings:', error);
      toast.error('Failed to save digest settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const loadPreview = async () => {
    if (!user?.id) return;
    
    setIsPreviewLoading(true);
    try {
      const response = await axios.post(`/api/digest/test/${user.id}`);
      
      if (response.data.success) {
        setPreview(response.data.digest);
      } else {
        toast.error(response.data.error || 'Failed to generate preview');
      }
    } catch (error: any) {
      console.error('Error loading preview:', error);
      toast.error(error.response?.data?.error || 'Failed to generate preview');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const sendTestDigest = async () => {
    if (!user?.id) return;
    
    setIsSendingTest(true);
    try {
      const response = await axios.post(`/api/digest/send/${user.id}`);
      
      if (response.data.success) {
        toast.success('Test digest sent to your Slack! Check your DMs.');
        // Refresh history
        fetchDigestHistory();
      } else {
        toast.error(response.data.error || 'Failed to send test digest');
      }
    } catch (error: any) {
      console.error('Error sending test digest:', error);
      toast.error(error.response?.data?.error || 'Failed to send test digest');
    } finally {
      setIsSendingTest(false);
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  const getNextDeliveryTime = () => {
    if (!digestSettings.digest_enabled) return null;
    
    const [hours, minutes] = digestSettings.digest_time.split(':').map(Number);
    const now = new Date();
    const nextDelivery = new Date();
    nextDelivery.setHours(hours, minutes, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (nextDelivery <= now) {
      nextDelivery.setDate(nextDelivery.getDate() + 1);
    }
    
    return nextDelivery;
  };

  if (loading) {
    return <Loader size="large" />;
  }

  const nextDelivery = getNextDeliveryTime();

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-100 dark:border-gray-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          📊 Daily Digest
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Get a daily summary of GitHub activity that matters to you
        </p>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'settings', label: 'Settings', icon: '⚙️' },
              { key: 'preview', label: 'Preview', icon: '👀' },
              { key: 'history', label: 'History', icon: '📈' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-marian-blue-500 text-marian-blue-600 dark:text-marian-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Enable Toggle */}
            <div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  name="digest_enabled"
                  checked={digestSettings.digest_enabled}
                  onChange={handleDigestChange}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-marian-blue-300 dark:peer-focus:ring-marian-blue-600 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-marian-blue-600"></div>
                <span className="ms-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable daily digest
                </span>
              </label>
              
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Receive a daily summary of PRs waiting for your review, approved PRs ready to merge, and your open PRs.
              </p>
            </div>

            {/* Time Selection */}
            {digestSettings.digest_enabled && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <label htmlFor="digest-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      ⏰ Delivery time
                    </label>
                    <div className="mt-1 flex items-center">
                      <input
                        type="time"
                        name="digest_time"
                        id="digest-time"
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500 dark:focus:ring-marian-blue-500 dark:focus:border-marian-blue-500"
                        value={digestSettings.digest_time}
                        onChange={handleDigestChange}
                      />
                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                        ({formatTime(digestSettings.digest_time)})
                      </span>
                    </div>
                  </div>
                  
                  {nextDelivery && (
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        📅 Next delivery
                      </p>
                      <p className="text-sm text-marian-blue-600 dark:text-marian-blue-400">
                        {format(nextDelivery, 'MMM d, yyyy')} at {formatTime(digestSettings.digest_time)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* What's Included */}
            {digestSettings.digest_enabled && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                  📋 What&apos;s included in your digest
                </h4>
                <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                  <li className="flex items-center">
                    <span className="mr-2">🔍</span>
                    <strong>PRs waiting for your review</strong> - Pull requests where you&apos;ve been asked to review
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✅</span>
                    <strong>Approved PRs ready to merge</strong> - PRs you&apos;ve approved that are now ready to merge
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">🚀</span>
                    <strong>Your open PRs</strong> - Pull requests you&apos;ve created that are still open
                  </li>
                </ul>
                <p className="mt-3 text-xs text-blue-700 dark:text-blue-300">
                  Only includes activity from repositories you&apos;re watching
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="button"
                variant="primary"
                onClick={saveDigestSettings}
                disabled={isSaving}
                loading={isSaving}
                className="flex-1 sm:flex-initial"
              >
                💾 Save Settings
              </Button>
              
              {digestSettings.digest_enabled && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={sendTestDigest}
                  disabled={isSendingTest || !user?.id}
                  loading={isSendingTest}
                  className="flex-1 sm:flex-initial"
                >
                  🧪 Send Test Digest
                </Button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="space-y-6">
            <div className="text-center">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                👀 Preview Your Digest
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                See what your digest would look like based on current GitHub activity
              </p>
              
              <Button
                onClick={loadPreview}
                loading={isPreviewLoading}
                disabled={isPreviewLoading || !digestSettings.digest_enabled}
                variant="primary"
              >
                {isPreviewLoading ? 'Generating...' : '🔍 Generate Preview'}
              </Button>
            </div>

            {!digestSettings.digest_enabled && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Enable daily digest to see preview
                </p>
              </div>
            )}

            {preview && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {preview.waitingOnUser}
                    </div>
                    <div className="text-sm text-orange-800 dark:text-orange-300">
                      🔍 Waiting for Review
                    </div>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {preview.approvedReadyToMerge}
                    </div>
                    <div className="text-sm text-green-800 dark:text-green-300">
                      ✅ Ready to Merge
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {preview.userOpenPRs}
                    </div>
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                      🚀 Your Open PRs
                    </div>
                  </div>
                </div>

                {preview.details && (
                  <div className="space-y-4">
                    {preview.details.waitingOnUser.length > 0 && (
                      <div className="bg-white dark:bg-gray-700 rounded-lg border border-orange-200 dark:border-orange-800 p-4">
                        <h5 className="font-medium text-orange-800 dark:text-orange-200 mb-2">
                          🔍 PRs Waiting for Your Review
                        </h5>
                        <div className="space-y-2">
                          {preview.details.waitingOnUser.slice(0, 3).map((pr, i) => (
                            <div key={i} className="text-sm">
                              <a href={pr.url} target="_blank" rel="noopener noreferrer" 
                                 className="text-marian-blue-600 hover:text-marian-blue-800 dark:text-marian-blue-400 font-medium">
                                {pr.title}
                              </a>
                              <div className="text-gray-500 dark:text-gray-400 text-xs">
                                {pr.repo}
                              </div>
                            </div>
                          ))}
                          {preview.details.waitingOnUser.length > 3 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              ...and {preview.details.waitingOnUser.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {preview.details.approvedReadyToMerge.length > 0 && (
                      <div className="bg-white dark:bg-gray-700 rounded-lg border border-green-200 dark:border-green-800 p-4">
                        <h5 className="font-medium text-green-800 dark:text-green-200 mb-2">
                          ✅ Ready to Merge
                        </h5>
                        <div className="space-y-2">
                          {preview.details.approvedReadyToMerge.slice(0, 3).map((pr, i) => (
                            <div key={i} className="text-sm">
                              <a href={pr.url} target="_blank" rel="noopener noreferrer" 
                                 className="text-marian-blue-600 hover:text-marian-blue-800 dark:text-marian-blue-400 font-medium">
                                {pr.title}
                              </a>
                              <div className="text-gray-500 dark:text-gray-400 text-xs">
                                {pr.repo}
                              </div>
                            </div>
                          ))}
                          {preview.details.approvedReadyToMerge.length > 3 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              ...and {preview.details.approvedReadyToMerge.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {preview.details.userOpenPRs.length > 0 && (
                      <div className="bg-white dark:bg-gray-700 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
                        <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                          🚀 Your Open PRs
                        </h5>
                        <div className="space-y-2">
                          {preview.details.userOpenPRs.slice(0, 3).map((pr, i) => (
                            <div key={i} className="text-sm">
                              <a href={pr.url} target="_blank" rel="noopener noreferrer" 
                                 className="text-marian-blue-600 hover:text-marian-blue-800 dark:text-marian-blue-400 font-medium">
                                {pr.title}
                              </a>
                              <div className="text-gray-500 dark:text-gray-400 text-xs">
                                {pr.repo}
                              </div>
                            </div>
                          ))}
                          {preview.details.userOpenPRs.length > 3 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              ...and {preview.details.userOpenPRs.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {preview.waitingOnUser === 0 && preview.approvedReadyToMerge === 0 && preview.userOpenPRs === 0 && (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-8 text-center">
                        <div className="text-4xl mb-2">🎉</div>
                        <p className="text-gray-600 dark:text-gray-400">
                          No PRs to show right now. Your digest would be skipped today.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                📈 Digest History
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Recent digest deliveries and their contents
              </p>
            </div>

            {history.length > 0 ? (
              <div className="space-y-3">
                {history.map((digest) => (
                  <div key={digest.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          📊 {format(new Date(digest.sentAt), 'MMM d, yyyy')}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Delivered at {format(new Date(digest.sentAt), 'h:mm a')}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-marian-blue-600 dark:text-marian-blue-400">
                            🔄 {digest.pullRequestCount} PRs
                          </span>
                          {digest.issueCount > 0 && (
                            <span className="text-orange-600 dark:text-orange-400">
                              🐛 {digest.issueCount} Issues
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-8 text-center">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  No digest history yet
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  {digestSettings.digest_enabled 
                    ? "Your first digest will appear here after it's delivered"
                    : "Enable daily digest to start receiving summaries"
                  }
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}