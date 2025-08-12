'use client'

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import Loader from '@/components/Loader';
import Button from '@/components/Button';
import { FiRefreshCw } from 'react-icons/fi';
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

export default function RepositoriesSettings() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [repoLoading, setRepoLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toggleAllLoading, setToggleAllLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRepos, setTotalRepos] = useState(0);
  const [enabledFilter, setEnabledFilter] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [togglingRepos, setTogglingRepos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  // Fetch repositories when user is authenticated or filters/pagination changes
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchRepositories();
    }
  }, [isAuthenticated, user?.id, currentPage, pageSize, enabledFilter, debouncedSearchTerm]);

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

  const refreshRepositories = async () => {
    try {
      setRefreshing(true);
      await axios.post(`/api/users/${user?.id}/repositories/refresh`);
      await fetchRepositories();
      toast.success('Repositories refreshed successfully');
    } catch (error) {
      console.error('Error refreshing repositories:', error);
      toast.error('Failed to refresh repositories');
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

  if (loading) {
    return <Loader size="large" />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="px-6 py-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Monitored Repositories
          </h3>
          <div className="flex space-x-2">
            <Button 
              onClick={() => toggleAllRepositories(true)}
              disabled={toggleAllLoading || refreshing}
              variant="secondary"
              size="sm"
            >
              Enable All
            </Button>
            <Button 
              onClick={() => toggleAllRepositories(false)}
              disabled={toggleAllLoading || refreshing}
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Disable All
            </Button>
            <Button 
              onClick={refreshRepositories}
              disabled={refreshing || toggleAllLoading}
              variant="secondary"
              size="sm"
              icon={<FiRefreshCw className={refreshing ? 'animate-spin' : ''} />}
            >
              {refreshing ? 'Refreshing...' : 'Refresh Repositories'}
            </Button>
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
          <Loader size="medium" />
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
                  <Button
                    onClick={() => {
                      if (currentPage > 1) {
                        setCurrentPage(currentPage - 1);
                      }
                    }}
                    disabled={currentPage === 1}
                    variant="ghost"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() => {
                      if (currentPage < totalPages) {
                        setCurrentPage(currentPage + 1);
                      }
                    }}
                    disabled={currentPage === totalPages}
                    variant="ghost"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
