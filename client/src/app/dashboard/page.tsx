'use client'

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { FiGithub, FiAlertCircle, FiRefreshCw, FiGitPullRequest, FiMessageSquare, FiEye } from 'react-icons/fi';
import Link from 'next/link';

interface Notification {
  id: string;
  event_type: string;
  title: string;
  description: string;
  repository?: string;
  pull_request_number?: number;
  pull_request_title?: string;
  created_at: string;
}

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const [stats, setStats] = useState({
    total_notifications: 0,
    pull_requests: 0,
    reviews: 0,
    comments: 0
  });
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [error, setError] = useState('');
  const [notificationsError, setNotificationsError] = useState('');

  const fetchStats = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      const response = await axios.get(`/api/users/${user.id}/stats`);
      setStats(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Failed to load statistics. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentNotifications = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoadingNotifications(true);
      const response = await axios.get(`/api/users/${user.id}/notifications/recent?limit=5`);
      setRecentNotifications(response.data);
      setNotificationsError('');
    } catch (err) {
      console.error('Error fetching recent notifications:', err);
      setNotificationsError('Failed to load recent activity. Please try again later.');
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const refreshData = () => {
    fetchStats();
    fetchRecentNotifications();
  };

  useEffect(() => {
    if (user?.id) {
      fetchStats();
      fetchRecentNotifications();
    }
  }, [user?.id]);

  if (!isAuthenticated) {
    return null; // The layout will handle redirecting if not authenticated
  }

  // Helper function to get the appropriate icon for a notification
  const getNotificationIcon = (eventType: string) => {
    switch (eventType) {
      case 'pull_request':
        return <FiGitPullRequest className="h-5 w-5 text-purple-500" />;
      case 'review':
        return <FiEye className="h-5 w-5 text-blue-500" />;
      case 'comment':
        return <FiMessageSquare className="h-5 w-5 text-green-500" />;
      default:
        return <FiAlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  // Format date to a readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: 'numeric',
      hour12: true 
    }).format(date);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Welcome, {user?.name || 'User'}!</h1>
        <button 
          onClick={refreshData}
          disabled={isLoading || isLoadingNotifications}
          className="flex items-center px-3 py-2 bg-primary-50 text-primary-600 rounded-md hover:bg-primary-100 transition-colors disabled:opacity-50"
        >
          <FiRefreshCw className={`mr-2 h-4 w-4 ${isLoading || isLoadingNotifications ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {!user?.github_id && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiAlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Connect your GitHub account to start receiving notifications.
                <Link href="/auth/github" className="ml-2 font-medium underline">
                  Connect now
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiAlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Total Notifications</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {isLoading ? '...' : stats.total_notifications}
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Pull Requests</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {isLoading ? '...' : stats.pull_requests}
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Reviews</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {isLoading ? '...' : stats.reviews}
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Comments</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {isLoading ? '...' : stats.comments}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Recent Activity</h2>
        
        {notificationsError && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <FiAlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{notificationsError}</p>
              </div>
            </div>
          </div>
        )}
        
        {!user?.github_id ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <FiGithub className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Connect your GitHub account to see your recent activity.</p>
            <Link 
              href="/auth/github"
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <FiGithub className="mr-2 -ml-1 h-4 w-4" />
              Connect GitHub
            </Link>
          </div>
        ) : isLoadingNotifications ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-pulse flex space-x-4 w-full">
              <div className="flex-1 space-y-4 py-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : recentNotifications.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No recent activity found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentNotifications.map((notification) => (
              <div key={notification.id} className="py-4 flex">
                <div className="mr-4 flex-shrink-0">
                  {getNotificationIcon(notification.event_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    {notification.title}
                    {notification.repository && (
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        in {notification.repository}
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {notification.description}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formatDate(notification.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
