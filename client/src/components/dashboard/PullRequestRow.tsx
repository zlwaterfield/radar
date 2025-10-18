import React from 'react';
import { PullRequest } from '@/lib/api/pull-requests';
import { FiGitPullRequest, FiGitMerge, FiClock, FiCheckCircle, FiXCircle, FiAlertCircle } from 'react-icons/fi';

interface PullRequestRowProps {
  pr: PullRequest;
  onClick?: () => void;
}

export function PullRequestRow({ pr, onClick }: PullRequestRowProps) {
  // Calculate relative time
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 604800)}w ago`;
  };

  // Calculate check status
  const getCheckStatus = () => {
    if (!pr.checks || pr.checks.length === 0) return null;

    const completed = pr.checks.filter(c => c.status === 'completed');
    const passing = completed.filter(c => c.conclusion === 'success').length;
    const failing = completed.filter(c => c.conclusion === 'failure').length;
    const pending = pr.checks.filter(c => c.status !== 'completed').length;
    const total = pr.checks.length;

    if (failing > 0) {
      return { icon: FiXCircle, color: 'text-red-600 dark:text-red-400', text: `${passing}/${total} passing, ${failing} failing` };
    }
    if (pending > 0) {
      return { icon: FiClock, color: 'text-yellow-600 dark:text-yellow-400', text: `${passing}/${total} completed` };
    }
    return { icon: FiCheckCircle, color: 'text-green-600 dark:text-green-400', text: `${passing}/${total} passing` };
  };

  // Get reviewer status counts
  const getReviewerStatus = () => {
    if (!pr.reviewers || pr.reviewers.length === 0) return null;

    const approved = pr.reviewers.filter(r => r.reviewState === 'approved').length;
    const changesRequested = pr.reviewers.filter(r => r.reviewState === 'changes_requested').length;
    const pending = pr.reviewers.filter(r => r.reviewState === 'pending').length;
    const total = pr.reviewers.length;

    return { approved, changesRequested, pending, total };
  };

  const checkStatus = getCheckStatus();
  const reviewStatus = getReviewerStatus();

  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-gray-800
        border border-gray-200 dark:border-gray-700
        rounded-lg p-4
        hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600
        transition-all duration-200
        flex justify-between
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {/* Header: Title and PR number */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 mt-1">
          {pr.isDraft ? (
            <FiGitPullRequest className="text-gray-400 dark:text-gray-500" size={20} />
          ) : pr.isMerged ? (
            <FiGitMerge className="text-purple-600 dark:text-purple-400" size={20} />
          ) : (
            <FiGitPullRequest className="text-green-600 dark:text-green-400" size={20} />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
            {pr.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-mono">#{pr.number}</span>
            <span>•</span>
            <span className="truncate">{pr.repositoryName}</span>
            <span>•</span>
            <span>{pr.authorLogin}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Opened {getRelativeTime(pr.openedAt)}</span>
            <span>•</span>
            <span>Updated {getRelativeTime(pr.updatedAt)}</span>
          </div>
          {/* Change stats */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-600 dark:text-green-400">+{pr.additions}</span>
            <span>•</span>
            <span className="text-red-600 dark:text-red-400">-{pr.deletions}</span>
            <span>•</span>
            <span className="text-gray-500 dark:text-gray-400">
              {pr.changedFiles} {pr.changedFiles === 1 ? 'file' : 'files'}
            </span>
          </div>
        </div>
      </div>

      <div>
        {pr.isDraft && (
          <span className="flex-shrink-0 px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
            Draft
          </span>
        )}
        
        {/* Reviewers */}
        {reviewStatus && reviewStatus.total > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Reviewers:</span>
            <div className="flex items-center gap-1">
              {pr.reviewers?.slice(0, 5).map((reviewer) => {
                let icon = '⏳';
                let color = 'text-gray-500 dark:text-gray-400';

                if (reviewer.reviewState === 'approved') {
                  icon = '✅';
                  color = 'text-green-600 dark:text-green-400';
                } else if (reviewer.reviewState === 'changes_requested') {
                  icon = '❌';
                  color = 'text-red-600 dark:text-red-400';
                } else if (reviewer.reviewState === 'commented') {
                  icon = '💬';
                  color = 'text-blue-600 dark:text-blue-400';
                }

                return (
                  <span
                    key={reviewer.githubId}
                    className={`text-xs ${color} flex items-center gap-1`}
                    title={`${reviewer.login} - ${reviewer.reviewState}`}
                  >
                    {icon} {reviewer.avatarUrl ? <img src={reviewer.avatarUrl} alt={reviewer.login} className="w-4 h-4 rounded-full" /> : null}
                  </span>
                );
              })}
              {reviewStatus.total > 5 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  +{reviewStatus.total - 5}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {reviewStatus.approved > 0 && `${reviewStatus.approved}/${reviewStatus.total} approved`}
              {reviewStatus.changesRequested > 0 && ` • ${reviewStatus.changesRequested} changes requested`}
            </span>
          </div>
        )}

        {/* Bottom row: CI status, stats, labels */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* CI Status */}
          {checkStatus && (
            <div className="flex items-center gap-1.5">
              <checkStatus.icon className={checkStatus.color} size={14} />
              <span className="text-xs text-gray-600 dark:text-gray-400">{checkStatus.text}</span>
            </div>
          )}

          {/* Labels */}
          {pr.labels && pr.labels.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {pr.labels.slice(0, 3).map((label) => (
                <span
                  key={label.name}
                  className="px-2 py-0.5 text-xs font-medium rounded"
                  style={{
                    backgroundColor: `#${label.color}20`,
                    color: `#${label.color}`,
                    borderColor: `#${label.color}40`,
                    borderWidth: '1px',
                  }}
                >
                  {label.name}
                </span>
              ))}
              {pr.labels.length > 3 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  +{pr.labels.length - 3}
                </span>
              )}
            </div>
          )}
      </div>
      </div>
    </div>
  );
}
