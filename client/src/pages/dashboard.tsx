import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { FiRefreshCw, FiGithub, FiMessageSquare, FiGitPullRequest, FiEye } from 'react-icons/fi';

interface UserStats {
  totalNotifications: number;
  pullRequests: number;
  reviews: number;
  comments: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!user) return;
    
    setStatsLoading(true);
    setStatsError(null);
    
    try {
      const response = await axios.get(`/api/users/${user.id}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching user stats:', error);
      setStatsError('Failed to load statistics. Please try again.');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  return (
    <Layout title="Dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="section-header">Activity Overview</h1>
          <button 
            onClick={fetchStats} 
            disabled={statsLoading} 
            className="btn btn-outline-secondary flex items-center text-sm"
          >
            <FiRefreshCw className={`mr-2 h-4 w-4 ${statsLoading ? 'animate-spin' : ''}`} />
            {statsLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {statsError && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{statsError}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="stat-card-title">Total Notifications</h3>
              <span className="text-gray-400 dark:text-gray-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </span>
            </div>
            {statsLoading ? (
              <div className="animate-pulse h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ) : (
              <p className="stat-card-value">{stats?.totalNotifications || 0}</p>
            )}
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="stat-card-title">Pull Requests</h3>
              <span className="text-primary-500 dark:text-primary-400">
                <FiGitPullRequest className="w-5 h-5" />
              </span>
            </div>
            {statsLoading ? (
              <div className="animate-pulse h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ) : (
              <p className="stat-card-value">{stats?.pullRequests || 0}</p>
            )}
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="stat-card-title">Reviews</h3>
              <span className="text-green-500 dark:text-green-400">
                <FiEye className="w-5 h-5" />
              </span>
            </div>
            {statsLoading ? (
              <div className="animate-pulse h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ) : (
              <p className="stat-card-value">{stats?.reviews || 0}</p>
            )}
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="stat-card-title">Comments</h3>
              <span className="text-yellow-500 dark:text-yellow-400">
                <FiMessageSquare className="w-5 h-5" />
              </span>
            </div>
            {statsLoading ? (
              <div className="animate-pulse h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ) : (
              <p className="stat-card-value">{stats?.comments || 0}</p>
            )}
          </div>
        </div>

        <div className="mt-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-card border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center mb-4">
              <FiGithub className="w-5 h-5 mr-2 text-gray-700 dark:text-gray-300" />
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">GitHub Connection</h2>
            </div>
            
            {user?.github_id ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Connected to GitHub</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Your GitHub account is connected. You will receive notifications for your repositories.
                  </p>
                </div>
                <span className="badge badge-success">Connected</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Not connected to GitHub</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Connect your GitHub account to start receiving notifications.
                  </p>
                </div>
                <a href="/connect-github" className="btn btn-primary text-sm">
                  Connect
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-card border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Recent Activity</h2>
            
            {statsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center">
                    <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-10 w-10"></div>
                    <div className="ml-4 flex-1">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : stats && stats.totalNotifications > 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Activity data will be displayed here in a future update.
              </p>
            ) : (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-300">No activity yet</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Once you start receiving notifications, your activity will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
