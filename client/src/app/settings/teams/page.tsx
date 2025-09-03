'use client'

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import Loader from '@/components/Loader';
import Button from '@/components/Button';
import { FiRefreshCw } from 'react-icons/fi';
import { toast } from 'sonner';
import TeamTable from '@/components/TeamTable';
import type { PaginatedResponse } from '@/types/pagination';

interface Team {
  id: string;
  teamSlug: string;
  teamName: string;
  organization: string;
  permission: string;
  enabled: boolean;
}

export default function TeamsSettings() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toggleAllLoading, setToggleAllLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTeams, setTotalTeams] = useState(0);
  const [enabledFilter, setEnabledFilter] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [togglingTeams, setTogglingTeams] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  // Fetch teams when user is authenticated or filters/pagination changes
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchTeams();
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

  const fetchTeams = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setTeamsLoading(true);
      const response = await axios.get<PaginatedResponse<Team>>(`/api/users/me/teams`, {
        params: {
          page: currentPage,
          per_page: pageSize,
          enabled: enabledFilter !== null ? enabledFilter : undefined,
          search: debouncedSearchTerm || undefined
        }
      });
      
      // Handle the paginated response
      if (response.data) {
        setTeams(response.data.data || []);
        setTotalPages(response.data.meta.total_pages || 1);
        setTotalTeams(response.data.meta.total || 0);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast.error('Failed to load teams');
    } finally {
      setTeamsLoading(false);
    }
  }, [user?.id, currentPage, pageSize, enabledFilter, debouncedSearchTerm]);

  const refreshTeams = async () => {
    try {
      setRefreshing(true);
      await axios.post(`/api/users/me/teams/sync`);
      await fetchTeams();
      toast.success('Teams refreshed successfully');
    } catch (error) {
      console.error('Error refreshing teams:', error);
      toast.error('Failed to refresh teams');
    } finally {
      setRefreshing(false);
    }
  };

  const toggleTeam = async (teamId: string) => {
    try {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;
      
      const newEnabledState = !team.enabled;
      
      // Set toggling state for this team
      setTogglingTeams(prev => {
        const newSet = new Set(prev);
        newSet.add(teamId);
        return newSet;
      });
      
      // Update UI optimistically
      setTeams(prevTeams => 
        prevTeams.map(t => 
          t.id === teamId ? { ...t, enabled: newEnabledState } : t
        )
      );
      
      // Call API to update enabled status
      await axios.patch(`/api/users/me/teams/${teamId}/toggle`, {
        enabled: newEnabledState
      });
      
      // No need to refresh teams here, we've already updated the UI
    } catch (error) {
      console.error('Error toggling team:', error);
      // Revert UI if there was an error
      fetchTeams();
      toast.error('Failed to update team status');
    } finally {
      // Remove toggling state for this team
      setTogglingTeams(prev => {
        const newSet = new Set(prev);
        newSet.delete(teamId);
        return newSet;
      });
    }
  };

  const toggleAllTeams = async (enabled: boolean) => {
    try {
      setToggleAllLoading(true);
      
      // Update UI optimistically
      setTeams(prevTeams => 
        prevTeams.map(t => ({ ...t, enabled }))
      );
      
      // Call API to toggle all teams
      await axios.patch(`/api/users/me/teams/toggle-all`, {
        enabled
      });
      
      toast.success(`All teams ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error toggling all teams:', error);
      // Revert UI if there was an error
      fetchTeams();
      toast.error('Failed to update teams');
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
            GitHub Teams
          </h3>
          <Button 
            onClick={refreshTeams}
            disabled={refreshing || toggleAllLoading}
            variant="primary"
            size="sm"
            icon={<FiRefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />}
          >
            {refreshing ? 'Refreshing...' : 'Refresh teams'}
          </Button>
        </div>
        
        <div className="mb-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  className="w-full p-2 pl-8 border rounded-md"
                  placeholder="Search teams..."
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
        
        {teamsLoading ? (
          <Loader size="medium" />
        ) : (
          <>
            {teams.length === 0 ? (
              <div className="text-center py-8 text-gray-500 min-h-[300px] flex items-center justify-center">
                No teams found. Connect your GitHub account and join some teams to see them here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <TeamTable 
                  teams={teams}
                  togglingTeams={togglingTeams}
                  toggleTeam={toggleTeam}
                />
              </div>
            )}
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{teams.length}</span> of{' '}
                  <span className="font-medium">{totalTeams}</span> teams
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
        
        {teams.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Bulk actions for all teams
              </p>
              <div className="flex space-x-2">
                <Button 
                  onClick={() => toggleAllTeams(true)}
                  disabled={toggleAllLoading || refreshing}
                  variant="secondary"
                  size="sm"
                >
                  Enable all
                </Button>
                <Button 
                  onClick={() => toggleAllTeams(false)}
                  disabled={toggleAllLoading || refreshing}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:text-red-500 dark:hover:bg-red-100"
                >
                  Disable all
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}