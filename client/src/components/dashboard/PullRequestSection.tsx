import React from 'react';
import { PullRequest } from '@/lib/api/pull-requests';
import { PullRequestRow } from './PullRequestRow';

interface PullRequestSectionProps {
  title: string;
  icon?: string;
  prs: PullRequest[];
  emptyMessage?: string;
  loading?: boolean;
  onPRClick?: (pr: PullRequest) => void;
}

export function PullRequestSection({
  title,
  icon,
  prs,
  emptyMessage = 'No pull requests',
  loading = false,
  onPRClick,
}: PullRequestSectionProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {icon && <span>{icon}</span>}
          {title}
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">(Loading...)</span>
        </h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse"
            >
              <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!prs || prs.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {icon && <span>{icon}</span>}
          {title}
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">(0)</span>
        </h2>
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {title}
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({prs.length})</span>
      </h2>
      <div className="space-y-3">
        {prs.map((pr) => (
          <PullRequestRow
            key={pr.id}
            pr={pr}
            onClick={onPRClick ? () => onPRClick(pr) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
