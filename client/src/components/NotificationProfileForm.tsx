import React, { useState, useEffect } from 'react';
import { FiX, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useNotificationProfiles } from '../hooks/useNotificationProfiles';
import type { 
  NotificationProfile, 
  CreateNotificationProfileRequest,
  UpdateNotificationProfileRequest,
  NotificationPreferences,
} from '../types/notification-profile';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../types/notification-profile';
import type { DigestScopeType, DigestDeliveryType, RepositoryFilter } from '../types/digest';
import axios from '@/lib/axios';

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
  console.log('NotificationProfileForm rendered with profile:', profile);
  // Using passed-in functions instead of hook to avoid multiple hook instances
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  
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
    keywords: [] as string[],
    keywordLLMEnabled: true,
  });

  const [newKeyword, setNewKeyword] = useState('');

  useEffect(() => {
    loadTeams();
    loadRepositories();
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
        notificationPreferences: profile.notificationPreferences,
        keywords: [...profile.keywords],
        keywordLLMEnabled: profile.keywordLLMEnabled,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = {
        ...formData,
        description: formData.description || undefined,
        scopeValue: formData.scopeType === 'user' ? undefined : formData.scopeValue,
        deliveryTarget: formData.deliveryType === 'dm' ? undefined : formData.deliveryTarget,
      };

      if (profile) {
        await updateProfile(profile.id!, data as UpdateNotificationProfileRequest);
      } else {
        await createProfile(data as CreateNotificationProfileRequest);
      }
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !formData.keywords.includes(newKeyword.trim())) {
      setFormData(prev => ({
        ...prev,
        keywords: [...prev.keywords, newKeyword.trim()]
      }));
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword)
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
    console.log('handleToggleEnabled called:', { enabled, profile: !!profile, profileId: profile?.id });
    if (!profile) {
      console.log('No profile, skipping toggle');
      return;
    }
    
    setFormData(prev => ({ ...prev, isEnabled: enabled }));
    
    try {
      console.log('Making update request with:', { isEnabled: enabled });
      const result = await updateProfile(profile.id!, { isEnabled: enabled });
      console.log('Update successful:', result);
    } catch (err) {
      console.error('Update failed:', err);
      // Revert the toggle if the update fails
      setFormData(prev => ({ ...prev, isEnabled: !enabled }));
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {profile ? 'Edit' : 'Create'} notification profile
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500"
                rows={2}
                placeholder="Optional description for this profile"
              />
            </div>
          </div>

          {/* Scope Settings */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white">Scope</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Activity scope
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="scopeType"
                    value="user"
                    checked={formData.scopeType === 'user'}
                    onChange={(e) => setFormData(prev => ({ ...prev, scopeType: e.target.value as any, scopeValue: '' }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Your activity (includes your teams)
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="scopeType"
                    value="team"
                    checked={formData.scopeType === 'team'}
                    onChange={(e) => setFormData(prev => ({ ...prev, scopeType: e.target.value as any }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Specific team activity
                  </span>
                </label>
              </div>
              
              {formData.scopeType === 'team' && (
                <div className="mt-2">
                  <select
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500"
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

          {/* Keywords */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Keywords</h3>
            
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                id="keywordLLMEnabled"
                checked={formData.keywordLLMEnabled}
                onChange={(e) => setFormData(prev => ({ ...prev, keywordLLMEnabled: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="keywordLLMEnabled" className="ml-2 text-sm text-gray-700">
                Enable AI-powered keyword matching
              </label>
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddKeyword();
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add a keyword..."
              />
              <button
                type="button"
                onClick={handleAddKeyword}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <FiPlus className="h-4 w-4" />
              </button>
            </div>
            
            {formData.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {keyword}
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(keyword)}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <FiTrash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notification Preferences */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Event preferences</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* PR Events */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Pull requests</h4>
                {[
                  ['pull_request_opened', 'PR opened'],
                  ['pull_request_closed', 'PR closed/merged'],
                  ['pull_request_reviewed', 'PR reviewed'],
                  ['pull_request_commented', 'PR commented'],
                  ['pull_request_assigned', 'PR assigned'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={formData.notificationPreferences[key as keyof NotificationPreferences] ?? false}
                      onChange={(e) => handlePreferenceChange(key as keyof NotificationPreferences, e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                    />
                    {label}
                  </label>
                ))}
              </div>
              
              {/* Issue Events */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Issues</h4>
                {[
                  ['issue_opened', 'Issue opened'],
                  ['issue_closed', 'Issue closed'],
                  ['issue_commented', 'Issue commented'],
                  ['issue_assigned', 'Issue assigned'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={formData.notificationPreferences[key as keyof NotificationPreferences] ?? false}
                      onChange={(e) => handlePreferenceChange(key as keyof NotificationPreferences, e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                    />
                    {label}
                  </label>
                ))}
              </div>
              
              {/* Other Events */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Other</h4>
                {[
                  ['mentioned_in_comments', 'Mentions'],
                  ['team_mentions', 'Team mentions'],
                  ['team_assignments', 'Team assignments'],
                  ['check_failures', 'CI failures'],
                  ['check_successes', 'CI successes'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={formData.notificationPreferences[key as keyof NotificationPreferences] ?? false}
                      onChange={(e) => handlePreferenceChange(key as keyof NotificationPreferences, e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !formData.name.trim()}
            className="px-4 py-2 bg-marian-blue-600 text-white rounded-md hover:bg-marian-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : (profile ? 'Update' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}