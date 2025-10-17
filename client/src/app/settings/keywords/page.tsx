'use client'

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Loader from '@/components/Loader';
import Button from '@/components/Button';
import Switch from '@/components/Switch';
import { toast } from 'sonner';

interface KeywordSettings {
  enabled: boolean;
  keywords: string[];
  threshold?: number;
}

export default function KeywordsSettings() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [isSavingKeywords, setIsSavingKeywords] = useState(false);
  const [keywordSettings, setKeywordSettings] = useState<KeywordSettings>({
    enabled: false,
    keywords: [],
    threshold: 0.7
  });
  const [keywordInput, setKeywordInput] = useState('');

  const fetchUserSettings = useCallback(async () => {
    try {
      if (!user?.id) return;
      
      const response = await fetch(`/api/users/me/settings`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user settings');
      }
      
      const data = await response.json();
      
      // Update keyword notification settings from keywordPreferences field
      if (data.keywordPreferences && typeof data.keywordPreferences === 'object' && data.keywordPreferences.enabled !== undefined) {
        const keywordPrefs = data.keywordPreferences;
        
        setKeywordSettings({
          enabled: keywordPrefs.enabled ?? false,
          keywords: keywordPrefs.keywords ?? [],
          threshold: keywordPrefs.threshold ?? 0.7
        });
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
      toast.error('Failed to load keyword settings.');
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchUserSettings();
    }
  }, [isAuthenticated, user, fetchUserSettings]);

  const handleKeywordToggle = (checked: boolean) => {
    setKeywordSettings(prev => ({
      ...prev,
      enabled: checked
    }));
  };

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setKeywordInput(value);
  };

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setKeywordSettings(prev => ({
      ...prev,
      threshold: value
    }));
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

  const saveKeywordSettings = async () => {
    setIsSavingKeywords(true);
    
    try {
      // Format settings for API
      const settings = {
        keywordPreferences: {
          enabled: keywordSettings.enabled,
          keywords: keywordSettings.keywords,
          threshold: keywordSettings.threshold
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

  if (loading) {
    return <Loader size="large" />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="px-6 py-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          Keyword notifications
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Get notified when pull requests contain content matching your keywords of interest.
        </p>
        
        <div className="mt-6 space-y-6">
          <div className="flex items-center">
            <Switch
              checked={keywordSettings.enabled}
              onChange={handleKeywordToggle}
              label="Enable AI-powered keyword notifications"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            />
          </div>
          
          <div className="space-y-3">
            <label htmlFor="keywords" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Add keywords you want to be notified about
            </label>
            <div className="flex max-w-md">
              <input
                id="keywords"
                type="text"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-500 dark:focus:border-primary-500 sm:text-sm"
                value={keywordInput}
                onChange={handleKeywordChange}
                disabled={!keywordSettings.enabled}
                placeholder="e.g., security, performance, team name"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
              />
              <Button
                type="button"
                variant="primary"
                size="md"
                className="rounded-l-none"
                onClick={addKeyword}
                disabled={!keywordSettings.enabled || keywordInput.trim() === ''}
              >
                Add
              </Button>
            </div>
          </div>
          
          {keywordSettings.keywords.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current keywords:
              </label>
              <div className="flex flex-wrap gap-2">
                {keywordSettings.keywords.map((keyword, index) => (
                  <div 
                    key={index} 
                    className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-md px-3 py-1.5 border border-gray-200 dark:border-gray-600"
                  >
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{keyword}</span>
                    <button
                      type="button"
                      className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none transition-colors"
                      onClick={() => removeKeyword(keyword)}
                      disabled={!keywordSettings.enabled}
                      aria-label={`Remove ${keyword}`}
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
          
          <div className="max-w-md">
            <div className="flex justify-between items-center">
              <label htmlFor="threshold" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Matching threshold
              </label>
              <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                {keywordSettings.threshold?.toFixed(1)}
              </span>
            </div>
            <div className="mt-2">
              <input
                id="threshold"
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                value={keywordSettings.threshold}
                onChange={handleThresholdChange}
                disabled={!keywordSettings.enabled}
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  height: '8px',
                  borderRadius: '4px',
                  outline: 'none',
                  opacity: keywordSettings.enabled ? '1' : '0.5',
                  transition: 'opacity 0.2s'
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                <span>Loose matching</span>
                <span>Exact matching</span>
              </div>
            </div>
          </div>
          
          <div className="pt-4">
            <Button
              type="button"
              variant="primary"
              onClick={saveKeywordSettings}
              disabled={isSavingKeywords}
              loading={isSavingKeywords}
            >
              {isSavingKeywords ? 'Saving...' : 'Save preferences'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
