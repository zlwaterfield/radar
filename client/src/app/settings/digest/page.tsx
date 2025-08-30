'use client'

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Loader from '@/components/Loader';
import Button from '@/components/Button';
import toast from 'react-hot-toast';

interface DigestSettings {
  digest_enabled: boolean;
  digest_time: string;
}

export default function DigestSettings() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [digestSettings, setDigestSettings] = useState<DigestSettings>({
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
      
      const response = await fetch(`/api/users/me/settings`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user settings');
      }
      
      const data = await response.json();
      
      // Update digest settings
      if (data.notification_schedule) {
        const schedule = data.notification_schedule;
        
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

  const handleDigestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = e.target;
    
    setDigestSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const saveDigestSettings = async () => {
    setIsSaving(true);
    
    try {
      // Format settings for API
      const settings = {
        notification_schedule: {
          digest_enabled: digestSettings.digest_enabled,
          digest_time: digestSettings.digest_time
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
        throw new Error('Failed to save digest settings');
      }
      
      toast.success('Your digest preferences have been updated.');
    } catch (error) {
      console.error('Error saving digest settings:', error);
      toast.error('Failed to save digest settings.');
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
          Daily digest
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Configure your daily summary of GitHub activity.
        </p>
        
        <div className="mt-6 space-y-6">
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
            
            {digestSettings.digest_enabled && (
              <div className="mt-6 max-w-md">
                <div className="flex justify-between items-center">
                  <label htmlFor="digest-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Delivery time:
                  </label>
                </div>
                <div className="mt-2 relative">
                  <div className="flex items-center">
                    <input
                      type="time"
                      name="digest_time"
                      id="digest-time"
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-500 dark:focus:border-primary-500 block w-36"
                      value={digestSettings.digest_time}
                      onChange={handleDigestChange}
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    The digest will be delivered to your Slack at this time each day, summarizing all GitHub activity you care about.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-8">
          <Button
            type="button"
            variant="primary"
            onClick={saveDigestSettings}
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
