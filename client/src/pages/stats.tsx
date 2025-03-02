import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { FiGithub, FiAlertCircle } from 'react-icons/fi';

interface NotificationStats {
  totalNotifications: number;
  pullRequests: number;
  reviews: number;
  comments: number;
  issues: number;
  byRepository: {
    [key: string]: {
      name: string;
      count: number;
    };
  };
  byDay: {
    date: string;
    count: number;
  }[];
}

export default function Stats() {
  const { user, isAuthenticated, loading, connectGithub } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.github_id) {
      fetchStats();
    }
  }, [isAuthenticated, user]);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const response = await axios.get(`/api/users/${user?.id}/stats/detailed`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setStatsLoading(false);
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
    <Layout title="Statistics">
      {!user?.github_id ? (
        <div className="card bg-yellow-50 border border-yellow-200">
          <div className="flex items-start">
            <FiAlertCircle className="text-yellow-500 text-xl mr-4 mt-1" />
            <div>
              <h3 className="text-lg font-medium">GitHub account not connected</h3>
              <p className="mb-4">Connect your GitHub account to view statistics.</p>
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
      ) : statsLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
        </div>
      ) : stats ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
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
            <div className="card">
              <h3 className="text-lg font-medium">Issues</h3>
              <p className="text-3xl font-bold">{stats.issues}</p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xl font-semibold mb-4">Notifications by Repository</h3>
            {Object.keys(stats.byRepository).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(stats.byRepository)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([repoId, data]) => (
                    <div key={repoId} className="flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-4 mr-2">
                        <div 
                          className="bg-primary-600 h-4 rounded-full" 
                          style={{ width: `${(data.count / stats.totalNotifications) * 100}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center w-48">
                        <span className="text-sm truncate">{data.name}</span>
                        <span className="text-sm font-medium">{data.count}</span>
                      </div>
                    </div>
                  ))
                }
              </div>
            ) : (
              <p className="text-center py-4 text-gray-500">No repository data available</p>
            )}
          </div>

          <div className="card">
            <h3 className="text-xl font-semibold mb-4">Notifications by Day</h3>
            {stats.byDay && stats.byDay.length > 0 ? (
              <div className="h-64 flex items-end space-x-2">
                {stats.byDay.map((day) => {
                  const maxCount = Math.max(...stats.byDay.map(d => d.count));
                  const height = (day.count / maxCount) * 100;
                  
                  return (
                    <div key={day.date} className="flex flex-col items-center flex-1">
                      <div 
                        className="w-full bg-primary-500 rounded-t"
                        style={{ height: `${height}%` }}
                      ></div>
                      <div className="text-xs mt-2 transform -rotate-45 origin-top-left">
                        {new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center py-4 text-gray-500">No daily data available</p>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <p className="text-center py-4 text-gray-500">No statistics available</p>
        </div>
      )}
    </Layout>
  );
}
