'use client'

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Loader from '@/components/Loader';
import Button from '@/components/Button';
import Switch from '@/components/Switch';
import DigestConfigModal from '@/components/DigestConfigModal';
import { toast } from 'sonner';
import axios from '@/lib/axios';
import { format } from 'date-fns';
import { 
  DigestConfig, 
  CreateDigestConfig, 
  DigestHistory,
  Repository,
} from '@/types/digest';

export default function DigestSettings() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  
  // State management
  const [digestConfigs, setDigestConfigs] = useState<DigestConfig[]>([]);
  const [history, setHistory] = useState<DigestHistory[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  // const [teams, setTeams] = useState<Team[]>([]);
  
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
        // loadTeams(),
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

  // const loadTeams = async () => {
  //   try {
  //     const response = await axios.get('/api/users/me/teams');
  //     if (response.data && response.data.data) {
  //       setTeams(response.data.data);
  //     }
  //   } catch (error) {
  //     console.error('Error loading teams:', error);
  //   }
  // };

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
        const totalPRs = digest.waitingOnUser + digest.approvedReadyToMerge + digest.userOpenPRs + digest.userDraftPRs;
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

  // const getScopeDisplay = (config: DigestConfig) => {
  //   if (config.scopeType === 'user') {
  //     return 'Your activity';
  //   } else {
  //     const team = teams.find(t => t.teamId === config.scopeValue);
  //     return `Team: ${team ? team.teamName : 'Unknown team'}`;
  //   }
  // };

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
                              {formatTime(config.digestTime)} ({config.timezone})
                            </span>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            {/* <div>
                              <span className="text-gray-500 dark:text-gray-400">👤 Scope:</span>
                              <span className="ml-1 text-gray-900 dark:text-white">
                                {getScopeDisplay(config)}
                              </span>
                            </div> */}
                            
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

      <DigestConfigModal
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSave={handleSaveConfig}
        editingConfig={editingConfig}
        formData={formData}
        setFormData={setFormData}
        repositories={repositories}
        // teams={teams}
        isSaving={isSaving}
      />
    </div>
  );
}