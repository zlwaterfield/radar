import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { FiGithub, FiSave, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';

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
  issues: boolean;
  digest_enabled: boolean;
  digest_time: string;
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
    issues: true,
    digest_enabled: false,
    digest_time: '09:00'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRepos, setTotalRepos] = useState(0);
  const [enabledFilter, setEnabledFilter] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.github_id) {
      fetchRepositories();
      fetchSettings();
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

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`/api/users/${user?.id}/settings`);
      if (response.data) {
        setNotificationSettings(response.data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
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
    const { name, checked, value, type } = e.target;
    setNotificationSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      
      // Save notification settings
      await axios.put(`/api/users/${user?.id}/settings`, notificationSettings);
      
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
    <Layout title="Settings">
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
              <div className="card mb-6">
                <h3 className="text-xl font-semibold mb-4">Notification Preferences</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="pull_requests"
                        checked={notificationSettings.pull_requests}
                        onChange={handleNotificationChange}
                        className="h-4 w-4 text-primary-600 rounded"
                      />
                      <span>Pull Requests</span>
                    </label>
                  </div>
                  
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="reviews"
                        checked={notificationSettings.reviews}
                        onChange={handleNotificationChange}
                        className="h-4 w-4 text-primary-600 rounded"
                      />
                      <span>Reviews</span>
                    </label>
                  </div>
                  
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="comments"
                        checked={notificationSettings.comments}
                        onChange={handleNotificationChange}
                        className="h-4 w-4 text-primary-600 rounded"
                      />
                      <span>Comments</span>
                    </label>
                  </div>
                  
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="issues"
                        checked={notificationSettings.issues}
                        onChange={handleNotificationChange}
                        className="h-4 w-4 text-primary-600 rounded"
                      />
                      <span>Issues</span>
                    </label>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h4 className="font-medium mb-2">Daily Digest</h4>
                  
                  <div className="flex items-center mb-4">
                    <label className="flex items-center space-x-2 mr-6">
                      <input
                        type="checkbox"
                        name="digest_enabled"
                        checked={notificationSettings.digest_enabled}
                        onChange={handleNotificationChange}
                        className="h-4 w-4 text-primary-600 rounded"
                      />
                      <span>Enable daily digest</span>
                    </label>
                    
                    <div className="flex items-center">
                      <span className="mr-2">Time:</span>
                      <input
                        type="time"
                        name="digest_time"
                        value={notificationSettings.digest_time}
                        onChange={handleNotificationChange}
                        disabled={!notificationSettings.digest_enabled}
                        className="border rounded p-1"
                      />
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-500">
                    The daily digest will send a summary of all activity at the specified time.
                  </p>
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
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <>
                    {repositories.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No repositories found. Add repositories to monitor them.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repository</th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {repositories.map((repo) => (
                              <tr key={repo.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    {repo.owner_avatar_url && (
                                      <img className="h-8 w-8 rounded-full mr-3" src={repo.owner_avatar_url} alt={repo.owner_name || ''} />
                                    )}
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{repo.name}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {repo.organization || repo.owner_name || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <label className="inline-flex items-center cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={repo.enabled}
                                        onChange={() => toggleRepository(repo.id)}
                                      />
                                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                      <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                                        {repo.enabled ? 'Enabled' : 'Disabled'}
                                      </span>
                                    </label>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  {/* <button
                                    onClick={() => removeRepository(repo.id)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    Remove
                                  </button> */}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
    </Layout>
  );
}
