import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import Link from 'next/link';
import type {
  NotificationProfile,
  CreateNotificationProfileRequest,
  UpdateNotificationProfileRequest,
  NotificationPreferences,
} from '../types/notification-profile';
import type { Keyword } from '../types/keyword';
import { DEFAULT_NOTIFICATION_PREFERENCES, NOTIFICATION_UI_GROUPS } from '../constants/notification-preferences.constants';
import type { DigestDeliveryType, DigestScopeType, RepositoryFilter } from '../types/digest';
import axios from '@/lib/axios';
import Button from './Button';
import Modal from './Modal';
import { useEntitlements } from '@/hooks/useEntitlements';

interface Team {
  teamId: string;
  teamName: string;
  organization: string;
}

interface Repository {
  githubId: string;
  fullName: string;
  enabled: boolean;
}

interface NotificationProfileFormProps {
  profile?: NotificationProfile | null;
  onClose: () => void;
  createProfile: (data: CreateNotificationProfileRequest) => Promise<NotificationProfile>;
  updateProfile: (id: string, data: UpdateNotificationProfileRequest) => Promise<NotificationProfile>;
}

export function NotificationProfileForm({ profile, onClose, createProfile, updateProfile }: NotificationProfileFormProps) {
  // Using passed-in functions instead of hook to avoid multiple hook instances
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const { getFeatureValue, loading: entitlementsLoading } = useEntitlements();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isEnabled: true,
    scopeType: 'user' as DigestScopeType,
    scopeValue: '',
    repositoryFilter: { type: 'all', repoIds: [] } as RepositoryFilter,
    deliveryType: 'dm' as DigestDeliveryType,
    deliveryTarget: '',
    notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    keywordIds: [] as string[],
  });

  useEffect(() => {
    loadTeams();
    loadRepositories();
    loadKeywords();
  }, []);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name,
        description: profile.description || '',
        isEnabled: profile.isEnabled,
        scopeType: profile.scopeType,
        scopeValue: profile.scopeValue || '',
        repositoryFilter: profile.repositoryFilter,
        deliveryType: profile.deliveryType,
        deliveryTarget: profile.deliveryTarget || '',
        notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, ...profile.notificationPreferences },
        keywordIds: profile.keywords?.map(k => k.id) || [],
      });
    }
  }, [profile]);

  const loadTeams = async () => {
    try {
      const response = await axios.get('/api/users/me/teams');
      if (response.data && response.data.data) {
        setTeams(response.data.data);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const loadRepositories = async () => {
    try {
      const response = await axios.get('/api/users/me/repositories');
      if (response.data && response.data.data) {
        setRepositories(response.data.data);
      }
    } catch (error) {
      console.error('Error loading repositories:', error);
    }
  };

  const loadKeywords = async () => {
    try {
      const response = await axios.get('/api/keywords');
      if (response.data) {
        setKeywords(response.data);
      }
    } catch (error) {
      console.error('Error loading keywords:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = {
        ...formData,
        description: formData.description || undefined,
        scopeValue: (formData.scopeType === 'user' || formData.scopeType === 'user_and_teams') ? undefined : formData.scopeValue,
        deliveryTarget: formData.deliveryType === 'dm' ? undefined : formData.deliveryTarget,
      };

      if (profile) {
        await updateProfile(profile.id!, data as UpdateNotificationProfileRequest);
      } else {
        await createProfile(data as CreateNotificationProfileRequest);
      }
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notification');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleKeyword = (keywordId: string) => {
    setFormData(prev => ({
      ...prev,
      keywordIds: prev.keywordIds.includes(keywordId)
        ? prev.keywordIds.filter(id => id !== keywordId)
        : [...prev.keywordIds, keywordId]
    }));
  };

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      notificationPreferences: {
        ...prev.notificationPreferences,
        [key]: value
      }
    }));
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    if (!profile) {
      return;
    }
    
    setFormData(prev => ({ ...prev, isEnabled: enabled }));
    
    try {
      const result = await updateProfile(profile.id!, { isEnabled: enabled });
    } catch (err) {
      console.error('Update failed:', err);
      // Revert the toggle if the update fails
      setFormData(prev => ({ ...prev, isEnabled: !enabled }));
      setError(err instanceof Error ? err.message : 'Failed to update notification');
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {profile ? 'Edit' : 'Create'} notification
        </h3>
      </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Basic Settings */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500 sm:text-sm"
                placeholder="e.g., Security Alerts"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500 sm:text-sm"
                rows={2}
                placeholder="Optional description for this notification"
              />
            </div>
          </div>

          {/* Scope Settings */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white">Scope</h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                What notifications to receive
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="scopeType"
                    value="user"
                    checked={formData.scopeType === 'user'}
                    onChange={(e) => setFormData(prev => ({ ...prev, scopeType: 'user', scopeValue: '' }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Just your activity
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="scopeType"
                    value="user_and_teams"
                    checked={formData.scopeType === 'user_and_teams'}
                    onChange={(e) => setFormData(prev => ({ ...prev, scopeType: 'user_and_teams', scopeValue: '' }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    You and your teams
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="scopeType"
                    value="team"
                    checked={formData.scopeType === 'team'}
                    onChange={(e) => setFormData(prev => ({ ...prev, scopeType: 'team' }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Specific team&apos;s activity
                  </span>
                </label>
              </div>

              {formData.scopeType === 'team' && (
                <div className="mt-2">
                  <select
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500 sm:text-sm"
                    value={formData.scopeValue || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, scopeValue: e.target.value }))}
                  >
                    <option value="">Select a team</option>
                    {teams.map((team) => (
                      <option key={team.teamId} value={team.teamId}>
                        {team.teamName} ({team.organization})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Receive notifications when any team member is involved
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Repository Settings */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white">Repositories</h4>
            
            <div>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="repositoryType"
                    value="all"
                    checked={formData.repositoryFilter.type === 'all'}
                    onChange={(e) => setFormData(prev => ({ ...prev, repositoryFilter: { type: 'all' } }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    All repositories
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="repositoryType"
                    value="selected"
                    checked={formData.repositoryFilter.type === 'selected'}
                    onChange={(e) => setFormData(prev => ({ ...prev, repositoryFilter: { type: 'selected', repoIds: [] } }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Selected repositories
                  </span>
                </label>
              </div>
              
              {formData.repositoryFilter.type === 'selected' && (
                <div className="mt-3 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md p-3">
                  {repositories.filter(repo => repo.enabled).map((repo) => (
                    <label key={repo.githubId} className="flex items-center py-1">
                      <input
                        type="checkbox"
                        checked={formData.repositoryFilter.repoIds?.includes(repo.githubId) || false}
                        onChange={(e) => {
                          const currentIds = formData.repositoryFilter.repoIds || [];
                          const newIds = e.target.checked
                            ? [...currentIds, repo.githubId]
                            : currentIds.filter(id => id !== repo.githubId);
                          setFormData(prev => ({
                            ...prev,
                            repositoryFilter: { ...prev.repositoryFilter, repoIds: newIds }
                          }));
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {repo.fullName}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Delivery Settings */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white">Delivery</h4>
            
            <div>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="deliveryType"
                    value="dm"
                    checked={formData.deliveryType === 'dm'}
                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryType: e.target.value as any, deliveryTarget: '' }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Direct Message
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="deliveryType"
                    value="channel"
                    checked={formData.deliveryType === 'channel'}
                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryType: e.target.value as any }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Slack Channel
                  </span>
                </label>
              </div>
              
              {formData.deliveryType === 'channel' && (
                <div className="mt-2">
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500 sm:text-sm"
                    placeholder="Channel ID (e.g., C1234567890)"
                    value={formData.deliveryTarget || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryTarget: e.target.value }))}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    You can find the channel ID in Slack by right-clicking on the channel name
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Event preferences</h3>
            
            <div className="space-y-8">
              {/* Direct Actions */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{NOTIFICATION_UI_GROUPS.DIRECT_ACTIONS.title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{NOTIFICATION_UI_GROUPS.DIRECT_ACTIONS.description}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Direct Actions - Pull Requests */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-gray-800 dark:text-gray-200 text-sm">{NOTIFICATION_UI_GROUPS.DIRECT_ACTIONS.sections.PULL_REQUESTS.title}</h5>
                    {NOTIFICATION_UI_GROUPS.DIRECT_ACTIONS.sections.PULL_REQUESTS.fields.map(([key, label]) => (
                      <label key={key} className="flex items-center text-sm">
                        <input
                          type="checkbox"
                          checked={formData.notificationPreferences[key as keyof NotificationPreferences] ?? false}
                          onChange={(e) => handlePreferenceChange(key as keyof NotificationPreferences, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                        />
                        <span className="text-gray-700 dark:text-gray-300">{label}</span>
                      </label>
                    ))}
                  </div>
                  
                  {/* Direct Actions - Issues */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-gray-800 dark:text-gray-200 text-sm">{NOTIFICATION_UI_GROUPS.DIRECT_ACTIONS.sections.ISSUES.title}</h5>
                    {NOTIFICATION_UI_GROUPS.DIRECT_ACTIONS.sections.ISSUES.fields.map(([key, label]) => (
                      <label key={key} className="flex items-center text-sm">
                        <input
                          type="checkbox"
                          checked={formData.notificationPreferences[key as keyof NotificationPreferences] ?? false}
                          onChange={(e) => handlePreferenceChange(key as keyof NotificationPreferences, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                        />
                        <span className="text-gray-700 dark:text-gray-300">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Activity Updates */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{NOTIFICATION_UI_GROUPS.ACTIVITY_UPDATES.title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{NOTIFICATION_UI_GROUPS.ACTIVITY_UPDATES.description}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Activity Updates - Pull Requests */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-gray-800 dark:text-gray-200 text-sm">{NOTIFICATION_UI_GROUPS.ACTIVITY_UPDATES.sections.PULL_REQUESTS.title}</h5>
                    {NOTIFICATION_UI_GROUPS.ACTIVITY_UPDATES.sections.PULL_REQUESTS.fields.map(([key, label]) => (
                      <label key={key} className="flex items-center text-sm">
                        <input
                          type="checkbox"
                          checked={formData.notificationPreferences[key as keyof NotificationPreferences] ?? false}
                          onChange={(e) => handlePreferenceChange(key as keyof NotificationPreferences, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                        />
                        <span className="text-gray-700 dark:text-gray-300">{label}</span>
                      </label>
                    ))}
                  </div>
                  
                  {/* Activity Updates - Issues */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-gray-800 dark:text-gray-200 text-sm">{NOTIFICATION_UI_GROUPS.ACTIVITY_UPDATES.sections.ISSUES.title}</h5>
                    {NOTIFICATION_UI_GROUPS.ACTIVITY_UPDATES.sections.ISSUES.fields.map(([key, label]) => (
                      <label key={key} className="flex items-center text-sm">
                        <input
                          type="checkbox"
                          checked={formData.notificationPreferences[key as keyof NotificationPreferences] ?? false}
                          onChange={(e) => handlePreferenceChange(key as keyof NotificationPreferences, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                        />
                        <span className="text-gray-700 dark:text-gray-300">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
        <Button
          type="button"
          onClick={onClose}
          variant="secondary"
          size="md"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={
            loading ||
            !formData.name.trim() ||
            (formData.scopeType === 'team' && !formData.scopeValue)
          }
          variant="primary"
          size="md"
          loading={loading}
        >
          {profile ? 'Update' : 'Create'}
        </Button>
      </div>
    </Modal>
  );
}