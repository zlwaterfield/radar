'use client'

import React, { useEffect, useState } from 'react';
import { FiGithub, FiStar } from 'react-icons/fi';

interface GitHubStarButtonProps {
  repo: string; // Format: "owner/repo"
  className?: string;
}

export default function GitHubStarButton({ repo, className = '' }: GitHubStarButtonProps) {
  const [starCount, setStarCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStarCount = async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${repo}`);
        if (response.ok) {
          const data = await response.json();
          setStarCount(data.stargazers_count);
        }
      } catch (error) {
        console.error('Failed to fetch GitHub stars:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStarCount();
  }, [repo]);

  const formatStarCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <a
      href={`https://github.com/${repo}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 bg-white/90 dark:bg-gray-800 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${className}`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-r border-gray-200 dark:border-gray-700">
        <FiGithub size={18} />
        <span className="text-sm font-medium">Star</span>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2">
        <FiStar size={14} className="text-yellow-500" />
        {loading ? (
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 w-8 text-center">
            ...
          </span>
        ) : starCount !== null ? (
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {formatStarCount(starCount)}
          </span>
        ) : (
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            -
          </span>
        )}
      </div>
    </a>
  );
}
