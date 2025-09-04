'use client'

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Loader from '@/components/Loader';
import Button from '@/components/Button';
import Switch from '@/components/Switch';
import { toast } from 'sonner';
import axios from '@/lib/axios';
import { format } from 'date-fns';
import { 
  DigestConfig, 
  CreateDigestConfig, 
  DigestPreview, 
  DigestHistory,
  Repository,
  Team,
  DigestScopeType,
  DigestDeliveryType 
} from '@/types/digest';

export default function DigestSettings() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  
  // State management
  const [digestConfigs, setDigestConfigs] = useState<DigestConfig[]>([]);
  const [history, setHistory] = useState<DigestHistory[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'configs' | 'history'>('configs');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<DigestConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for create/edit
  const [formData, setFormData] = useState<CreateDigestConfig>({
    name: '',
    description: '',
    isEnabled: true,
    digestTime: '09:00',
    timezone: 'UTC',
    scopeType: 'user',
    scopeValue: undefined,
    repositoryFilter: { type: 'all' },
    deliveryType: 'dm',
    deliveryTarget: undefined,
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        loadDigestConfigs(),
        loadDigestHistory(),
        loadRepositories(),
        loadTeams(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load digest settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadData();
    }
  }, [isAuthenticated, user, loadData]);

  const loadDigestConfigs = async () => {
    try {
      const response = await axios.get('/api/digest-configs');
      setDigestConfigs(response.data);
    } catch (error) {
      console.error('Error loading digest configs:', error);
    }
  };

  const loadDigestHistory = async () => {
    try {
      const response = await axios.get('/api/digest/history');
      if (response.data.success) {
        setHistory(response.data.history);
      }
    } catch (error) {
      console.error('Error loading digest history:', error);
      setHistory([]);
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

  const handleCreateConfig = () => {
    setEditingConfig(null);
    setFormData({
      name: '',
      description: '',
      isEnabled: true,
      digestTime: '09:00',
      timezone: 'UTC',
      scopeType: 'user',
      scopeValue: undefined,
      repositoryFilter: { type: 'all' },
      deliveryType: 'dm',
      deliveryTarget: undefined,
    });
    setShowCreateForm(true);
  };

  const handleEditConfig = (config: DigestConfig) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      description: config.description || '',
      isEnabled: config.isEnabled,
      digestTime: config.digestTime,
      timezone: config.timezone,
      scopeType: config.scopeType,
      scopeValue: config.scopeValue || undefined,
      repositoryFilter: config.repositoryFilter,
      deliveryType: config.deliveryType,
      deliveryTarget: config.deliveryTarget || undefined,
    });
    setShowCreateForm(true);
  };

  const handleSaveConfig = async () => {
    try {
      setIsSaving(true);
      
      if (editingConfig) {
        // Update existing config
        await axios.put(`/api/digest-configs/${editingConfig.id}`, formData);
        toast.success('Digest configuration updated successfully');
      } else {
        // Create new config
        await axios.post('/api/digest-configs', formData);
        toast.success('Digest configuration created successfully');
      }
      
      await loadDigestConfigs();
      setShowCreateForm(false);
      setEditingConfig(null);
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error(error.response?.data?.message || 'Failed to save digest configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this digest configuration?')) {
      return;
    }

    try {
      await axios.delete(`/api/digest-configs/${configId}`);
      toast.success('Digest configuration deleted successfully');
      await loadDigestConfigs();
    } catch (error: any) {
      console.error('Error deleting config:', error);
      toast.error('Failed to delete digest configuration');
    }
  };

  const handleToggleConfig = async (config: DigestConfig) => {
    try {
      await axios.put(`/api/digest-configs/${config.id}`, {
        isEnabled: !config.isEnabled
      });
      await loadDigestConfigs();
      toast.success(`Digest configuration ${!config.isEnabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      console.error('Error toggling config:', error);
      toast.error('Failed to update digest configuration');
    }
  };

  const handleTestDigest = async (configId: string) => {
    try {
      const response = await axios.post(`/api/digest-configs/${configId}/test`);
      if (response.data.success) {
        toast.success('Test digest sent successfully! Check your Slack.');
      } else {
        toast.error(response.data.error || 'Failed to send test digest');
      }
    } catch (error: any) {
      console.error('Error sending test digest:', error);
      toast.error('Failed to send test digest');
    }
  };

  const handlePreviewDigest = async (configId: string) => {
    try {
      const response = await axios.post(`/api/digest-configs/${configId}/preview`);
      if (response.data.success) {
        // You could show a modal with preview data here
        const digest = response.data.digest;
        const totalPRs = digest.waitingOnUser + digest.approvedReadyToMerge + digest.userOpenPRs;
        if (totalPRs > 0) {
          toast.success(`Preview: ${totalPRs} PRs would be included in this digest`);
        } else {
          toast.info('No PRs would be included in this digest right now');
        }
      } else {
        toast.error('Failed to generate preview');
      }
    } catch (error: any) {
      console.error('Error generating preview:', error);
      toast.error('Failed to generate preview');
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  const getDeliveryDisplay = (config: DigestConfig) => {
    if (config.deliveryType === 'dm') {
      return 'Direct message';
    } else {
      return `Channel: ${config.deliveryTarget || 'Not specified'}`;
    }
  };

  const getScopeDisplay = (config: DigestConfig) => {
    if (config.scopeType === 'user') {
      return 'Your activity';
    } else {
      const team = teams.find(t => t.teamId === config.scopeValue);
      return `Team: ${team ? team.teamName : 'Unknown team'}`;
    }
  };

  const getRepositoryDisplay = (config: DigestConfig) => {
    if (config.repositoryFilter.type === 'all') {
      return 'All repositories';
    } else {
      const count = config.repositoryFilter.repoIds?.length || 0;
      return `${count} selected repositories`;
    }
  };

  if (loading || isLoading) {
    return <Loader size="large" />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-100 dark:border-gray-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          Digests
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Manage multiple digest configurations with different schedules and delivery options
        </p>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'configs', label: 'Configurations' },
              { key: 'history', label: 'History' }
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
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'configs' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Digest configurations
              </h4>
              <Button
                type="button"
                variant="primary"
                onClick={handleCreateConfig}
                className="flex items-center gap-2"
              >
                Create digest
              </Button>
            </div>

            {/* Configurations List */}
            {digestConfigs.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-8 text-center">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No digest configurations yet
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                  Create your first digest to start receiving GitHub activity summaries
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {digestConfigs.map((config) => (
                  <div key={config.id} className="bg-gray-100 shadow-sm dark:bg-gray-700 rounded-lg px-7 py-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <h5 className="font-medium text-gray-900 dark:text-white">
                            {config.name}
                          </h5>
                          <Switch
                            checked={config.isEnabled}
                            onChange={() => handleToggleConfig(config)}
                            label={config.isEnabled ? 'Enabled' : 'Disabled'}
                          />
                        </div>
                        
                        {config.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {config.description}
                          </p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">⏰ Time:</span>
                            <span className="ml-1 text-gray-900 dark:text-white">
                              {formatTime(config.digestTime)}
                            </span>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">👤 Scope:</span>
                              <span className="ml-1 text-gray-900 dark:text-white">
                                {getScopeDisplay(config)}
                              </span>
                            </div>
                            
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">📁 Repos:</span>
                              <span className="ml-1 text-gray-900 dark:text-white">
                                {getRepositoryDisplay(config)}
                              </span>
                            </div>
                            
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">📤 Delivery:</span>
                              <span className="ml-1 text-gray-900 dark:text-white">
                                {getDeliveryDisplay(config)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleTestDigest(config.id)}
                          className="text-xs"
                        >
                          Test
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleEditConfig(config)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDeleteConfig(config.id)}
                          className="text-xs text-red-600 border-red-600 hover:bg-red-600 hover:text-white"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
              Digest history
            </h4>
            
            {history.length > 0 ? (
              <div className="space-y-3">
                {history.map((digest) => (
                  <div key={digest.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {format(new Date(digest.sentAt), 'MMM d, yyyy')}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Delivered at {format(new Date(digest.sentAt), 'h:mm a')}
                        </p>
                        {digest.digestConfig && (
                          <p className="text-sm text-gray-500 dark:text-gray-500">
                            Configuration: {digest.digestConfig.name}
                          </p>
                        )}
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
                          <span className="text-gray-500 dark:text-gray-400">
                            📤 {digest.deliveryType === 'dm' ? 'DM' : `Channel: ${digest.deliveryTarget}`}
                          </span>
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
                  Create and enable digest configurations to start receiving summaries
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingConfig ? 'Edit' : 'Create'} Digest Configuration
              </h3>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Settings */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 dark:text-white">Basic Settings</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500"
                    placeholder="e.g., Morning Team Updates"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500"
                    rows={2}
                    placeholder="Optional description for this digest"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Delivery Time
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="time"
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500"
                      value={formData.digestTime}
                      onChange={(e) => setFormData({...formData, digestTime: e.target.value})}
                    />
                    <select
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500"
                      value={formData.timezone}
                      onChange={(e) => setFormData({...formData, timezone: e.target.value})}
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Scope Settings */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 dark:text-white">Scope</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Activity Scope
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="scopeType"
                        value="user"
                        checked={formData.scopeType === 'user'}
                        onChange={(e) => setFormData({...formData, scopeType: e.target.value as DigestScopeType, scopeValue: undefined})}
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
                        onChange={(e) => setFormData({...formData, scopeType: e.target.value as DigestScopeType})}
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
                        onChange={(e) => setFormData({...formData, scopeValue: e.target.value})}
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
                        onChange={(e) => setFormData({...formData, repositoryFilter: { type: 'all' }})}
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
                        onChange={(e) => setFormData({...formData, repositoryFilter: { type: 'selected', repoIds: [] }})}
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
                              setFormData({
                                ...formData,
                                repositoryFilter: { ...formData.repositoryFilter, repoIds: newIds }
                              });
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
                        onChange={(e) => setFormData({...formData, deliveryType: e.target.value as DigestDeliveryType, deliveryTarget: undefined})}
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
                        onChange={(e) => setFormData({...formData, deliveryType: e.target.value as DigestDeliveryType})}
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
                        onChange={(e) => setFormData({...formData, deliveryTarget: e.target.value})}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        You can find the channel ID in Slack by right-clicking on the channel name
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSaveConfig}
                disabled={isSaving || !formData.name.trim()}
                loading={isSaving}
              >
                {editingConfig ? 'Update' : 'Create'} Configuration
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}