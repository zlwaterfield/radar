import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { FiGithub, FiAlertCircle, FiCheckCircle, FiSettings, FiChevronLeft, FiChevronRight, FiEdit, FiList } from 'react-icons/fi';

interface Repository {
  id: string;
  name: string;
  full_name: string;
  description: string;
  enabled: boolean;
}

interface PaginationInfo {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export default function Dashboard() {
  const { user, isAuthenticated, loading, connectGithub, reconnectGithub, manageGithubRepoAccess } = useAuth();
  const router = useRouter();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [repoLoading, setRepoLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    page_size: 10,
    total_items: 0,
    total_pages: 0
  });
  const [stats, setStats] = useState({
    totalNotifications: 0,
    pullRequests: 0,
    reviews: 0,
    comments: 0
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.github_id) {
      fetchRepositories(pagination.page, pagination.page_size);
      fetchStats();
    }
  }, [isAuthenticated, user, pagination.page, pagination.page_size]);

  const fetchRepositories = async (page: number, pageSize: number) => {
    try {
      setRepoLoading(true);
      const response = await axios.get(`/api/settings/user/${user?.id}/repositories`, {
        params: {
          page: page,
          page_size: pageSize,
          enabled: true    // Only get enabled repositories
        }
      });
      
      // Handle the paginated response
      if (response.data) {
        setRepositories(response.data.items || []);
        setPagination({
          page: response.data.page || 1,
          page_size: response.data.page_size || 10,
          total_items: response.data.total_items || 0,
          total_pages: response.data.total_pages || 0
        });
      } else {
        setRepositories([]);
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
    } finally {
      setRepoLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`/api/users/${user?.id}/stats`);
      setStats(response.data || {
        totalNotifications: 0,
        pullRequests: 0,
        reviews: 0,
        comments: 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      fetchRepositories(newPage, pagination.page_size);
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
    <Layout title="Dashboard">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="card bg-primary-500 text-white">
          <h3 className="text-lg font-medium">Total Notifications</h3>
          <p className="text-3xl font-bold">{stats.totalNotifications}</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-medium">Pull Requests</h3>
          <p className="text-3xl font-bold">{stats.pullRequests}</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-medium">Reviews</h3>
          <p className="text-3xl font-bold">{stats.reviews}</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-medium">Comments</h3>
          <p className="text-3xl font-bold">{stats.comments}</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">GitHub Integration</h2>
        
        {!user?.github_id ? (
          <div className="card bg-yellow-50 border border-yellow-200">
            <div className="flex items-start">
              <FiAlertCircle className="text-yellow-500 text-xl mr-4 mt-1" />
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
            <div className="card bg-green-50 border border-green-200 mb-6">
              <div className="flex flex-col space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start">
                    <FiCheckCircle className="text-green-500 text-xl mr-4 mt-1" />
                    <div>
                      <h3 className="text-lg font-medium">GitHub account connected</h3>
                      <p>Your GitHub account is successfully connected to Radar.</p>
                    </div>
                  </div>
                  <button 
                    onClick={manageGithubRepoAccess}
                    className="btn btn-outline-primary flex items-center"
                    title="Update GitHub permissions"
                  >
                    <FiEdit className="mr-2" />
                    Manage Repository Access
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Monitored Repositories</h3>
              <button 
                onClick={() => router.push('/settings')}
                className="btn btn-secondary flex items-center"
              >
                <FiSettings className="mr-2" />
                Manage Settings
              </button>
            </div>
            
            {repoLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
              </div>
            ) : repositories.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {repositories.map(repo => (
                    <div key={repo.id} className={`card ${repo.enabled ? 'border-l-4 border-green-500' : 'border-l-4 border-gray-300'}`}>
                      <div className="flex justify-between">
                        <h4 className="font-medium">{repo.name}</h4>
                        <span className={`px-2 py-1 text-xs rounded-full ${repo.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {repo.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{repo.description || 'No description'}</p>
                    </div>
                  ))}
                </div>
                
                {/* Pagination Controls */}
                {pagination.total_pages > 1 && (
                  <div className="flex justify-center items-center mt-6 space-x-2">
                    <button 
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className={`p-2 rounded-md ${pagination.page === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-primary-600 hover:bg-primary-50'}`}
                    >
                      <FiChevronLeft />
                    </button>
                    
                    {/* Page Numbers */}
                    <div className="flex space-x-1">
                      {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                        // Show pages around current page
                        let pageNum;
                        if (pagination.total_pages <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1;
                        } else if (pagination.page >= pagination.total_pages - 2) {
                          pageNum = pagination.total_pages - 4 + i;
                        } else {
                          pageNum = pagination.page - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`w-8 h-8 rounded-md ${
                              pagination.page === pageNum 
                                ? 'bg-primary-600 text-white' 
                                : 'text-gray-700 hover:bg-primary-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button 
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.total_pages}
                      className={`p-2 rounded-md ${pagination.page === pagination.total_pages ? 'text-gray-400 cursor-not-allowed' : 'text-primary-600 hover:bg-primary-50'}`}
                    >
                      <FiChevronRight />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="card bg-gray-50 border border-gray-200">
                <p className="text-center py-4">No repositories configured. Go to settings to add repositories.</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
