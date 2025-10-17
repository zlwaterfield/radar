'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { pullRequestsApi, PullRequestStats, PullRequest } from '@/lib/api/pull-requests';
import { PullRequestSection } from '@/components/dashboard/PullRequestSection';

export default function DashboardPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<PullRequestStats | null>(null);
  const [waitingOnMe, setWaitingOnMe] = useState<PullRequest[]>([]);
  const [readyToMerge, setReadyToMerge] = useState<PullRequest[]>([]);
  const [myOpenPRs, setMyOpenPRs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPRs, setLoadingPRs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [isAuthenticated, router]);

  // Fetch PR stats
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await pullRequestsApi.getStats();
        setStats(data);
      } catch (err: any) {
        console.error('Error fetching PR stats:', err);
        setError(err.response?.data?.message || 'Failed to load PR statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isAuthenticated]);

  // Fetch PR lists
  useEffect(() => {
    if (!isAuthenticated || !stats) return;

    const fetchPRLists = async () => {
      try {
        setLoadingPRs(true);

        // Fetch waiting on me PRs
        if (stats.waitingOnMe > 0) {
          const waitingResponse = await pullRequestsApi.list({
            reviewRequested: true,
            state: 'open',
            limit: 20,
          });
          setWaitingOnMe(waitingResponse.pullRequests);
        }

        // Fetch ready to merge PRs (this would need custom backend logic)
        // For now, we'll skip this as it requires complex filtering
        // You would need a backend endpoint that filters by:
        // - All reviewers approved
        // - All checks passing
        // - State is open

        // Fetch my open PRs
        if (stats.myOpenPRs > 0) {
          const myPRsResponse = await pullRequestsApi.list({
            authorMe: true,
            state: 'open',
            limit: 20,
          });
          setMyOpenPRs(myPRsResponse.pullRequests);
        }
      } catch (err: any) {
        console.error('Error fetching PR lists:', err);
      } finally {
        setLoadingPRs(false);
      }
    };

    fetchPRLists();
  }, [isAuthenticated, stats]);

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6 animate-pulse">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24 mb-3"></div>
              <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-16 mb-2"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-red-800 dark:text-red-400 font-semibold mb-2">Error Loading Dashboard</h3>
        <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
      </div>
    );
  }

  const hasAnyPRs = stats && (
    stats.waitingOnMe > 0 ||
    stats.approvedReadyToMerge > 0 ||
    stats.myOpenPRs > 0 ||
    stats.myDraftPRs > 0 ||
    stats.assignedToMe > 0
  );

  const handlePRClick = (pr: PullRequest) => {
    // Open PR in new tab
    window.open(pr.url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Waiting on Me"
          count={stats?.waitingOnMe || 0}
          subtitle="Review requested"
          color="red"
        />
        <StatCard
          title="Ready to Merge"
          count={stats?.approvedReadyToMerge || 0}
          subtitle="Approved & checks pass"
          color="green"
        />
        <StatCard
          title="My Open PRs"
          count={stats?.myOpenPRs || 0}
          subtitle="Active pull requests"
          color="blue"
        />
        <StatCard
          title="My Drafts"
          count={stats?.myDraftPRs || 0}
          subtitle="Draft pull requests"
          color="gray"
        />
      </div>

      {/* Empty State */}
      {!hasAnyPRs && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Pull Requests Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your pull request dashboard will appear here once PR data is synced from your repositories.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              PR data will be automatically synced when you receive GitHub webhooks or during the periodic background sync.
            </p>
          </div>
        </div>
      )}

      {/* PR Sections */}
      {hasAnyPRs && (
        <div className="space-y-8">
          {/* Waiting on Me */}
          {(stats?.waitingOnMe || 0) > 0 && (
            <PullRequestSection
              title="Waiting on Me"
              icon="🚨"
              prs={waitingOnMe}
              loading={loadingPRs}
              emptyMessage="No PRs waiting on your review"
              onPRClick={handlePRClick}
            />
          )}

          {/* Ready to Merge */}
          {(stats?.approvedReadyToMerge || 0) > 0 && (
            <PullRequestSection
              title="Ready to Merge"
              icon="✅"
              prs={readyToMerge}
              loading={loadingPRs}
              emptyMessage="No PRs ready to merge"
              onPRClick={handlePRClick}
            />
          )}

          {/* My Open PRs */}
          {(stats?.myOpenPRs || 0) > 0 && (
            <PullRequestSection
              title="My Open PRs"
              icon="📝"
              prs={myOpenPRs}
              loading={loadingPRs}
              emptyMessage="No open PRs"
              onPRClick={handlePRClick}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  title: string;
  count: number;
  subtitle: string;
  color: 'red' | 'green' | 'blue' | 'gray';
}

function StatCard({ title, count, subtitle, color }: StatCardProps) {
  const colorClasses = {
    red: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20',
    green: 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20',
    blue: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20',
    gray: 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50',
  };

  const textColorClasses = {
    red: 'text-red-600 dark:text-red-400',
    green: 'text-green-600 dark:text-green-400',
    blue: 'text-blue-600 dark:text-blue-400',
    gray: 'text-gray-600 dark:text-gray-400',
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${colorClasses[color]}`}>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
          {title}
        </span>
        <span className={`text-3xl font-bold ${textColorClasses[color]} mb-1`}>
          {count}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-500">
          {subtitle}
        </span>
      </div>
    </div>
  );
}
