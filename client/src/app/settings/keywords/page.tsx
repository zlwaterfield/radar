'use client'

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Loader from '@/components/Loader';
import Button from '@/components/Button';
import Switch from '@/components/Switch';
import { KeywordForm } from '@/components/KeywordForm';
import { toast } from 'sonner';
import { FiPlus, FiEdit2, FiTrash2, FiLock, FiUnlock } from 'react-icons/fi';
import type { Keyword, CreateKeywordData, UpdateKeywordData } from '@/types/keyword';

export default function KeywordsSettings() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(true);
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [entitlements, setEntitlements] = useState<any>(null);

  const fetchKeywords = useCallback(async () => {
    try {
      setIsLoadingKeywords(true);
      const response = await fetch('/api/keywords', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch keywords');
      }

      const data = await response.json();
      setKeywords(data);
    } catch (error) {
      console.error('Error fetching keywords:', error);
      toast.error('Failed to load keywords.');
    } finally {
      setIsLoadingKeywords(false);
    }
  }, []);

  const fetchEntitlements = useCallback(async () => {
    try {
      const response = await fetch('/api/users/me/entitlements', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setEntitlements(data);
      }
    } catch (error) {
      console.error('Error fetching entitlements:', error);
    }
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchKeywords();
      fetchEntitlements();
    }
  }, [isAuthenticated, user, fetchKeywords, fetchEntitlements]);

  const hasAIMatching = entitlements?.find((e: any) => e.featureLookupKey === 'ai_keyword_matching')?.value === 'true';
  const keywordLimit = parseInt(entitlements?.find((e: any) => e.featureLookupKey === 'keyword_limit')?.value || '0', 10);
  const hasKeywordMatching = keywordLimit > 0 || keywordLimit === -1;

  const handleSubmit = async (data: CreateKeywordData) => {
    try {
      const url = editingKeyword
        ? `/api/keywords/${editingKeyword.id}`
        : '/api/keywords';

      const response = await fetch(url, {
        method: editingKeyword ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to ${editingKeyword ? 'update' : 'create'} keyword`);
      }

      toast.success(`Keyword ${editingKeyword ? 'updated' : 'created'} successfully`);
      setShowForm(false);
      setEditingKeyword(null);
      await fetchKeywords();
    } catch (error: any) {
      console.error(`Error ${editingKeyword ? 'updating' : 'creating'} keyword:`, error);
      toast.error(error.message || `Failed to ${editingKeyword ? 'update' : 'create'} keyword`);
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this keyword?')) {
      return;
    }

    try {
      const response = await fetch(`/api/keywords/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete keyword');
      }

      toast.success('Keyword deleted successfully');
      await fetchKeywords();
    } catch (error) {
      console.error('Error deleting keyword:', error);
      toast.error('Failed to delete keyword');
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/keywords/${id}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle keyword');
      }

      toast.success(`Keyword ${enabled ? 'enabled' : 'disabled'}`);
      await fetchKeywords();
    } catch (error) {
      console.error('Error toggling keyword:', error);
      toast.error('Failed to toggle keyword');
    }
  };

  if (loading || isLoadingKeywords) {
    return <Loader size="large" />;
  }

  if (!hasKeywordMatching) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Keywords
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Keyword matching is not available in your current plan. Upgrade to unlock this feature.
        </p>
      </div>
    );
  }

  return (
    <>
      {showForm && (
        <KeywordForm
          keyword={editingKeyword}
          onClose={() => {
            setShowForm(false);
            setEditingKeyword(null);
          }}
          onSubmit={handleSubmit}
          hasAIMatching={hasAIMatching}
        />
      )}

      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-100 dark:border-gray-700">
          <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Keywords
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Manage reusable keywords for notification filtering. Keywords can be used across multiple notifications.
                </p>
              </div>
              <Button
                onClick={() => setShowForm(true)}
                variant="primary"
                icon={<FiPlus />}
              >
                Add Keyword
              </Button>
            </div>
          </div>

          <div className="px-6 py-4">
          {keywords.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No keywords yet. Create your first keyword to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {keywords.map((keyword) => (
                <div
                  key={keyword.id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {keyword.term}
                      </span>
                      {keyword.llmEnabled ? (
                        <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                          AI
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                          Regex
                        </span>
                      )}
                      {!keyword.isEnabled && (
                        <span className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                    {keyword.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {keyword.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={keyword.isEnabled}
                      onChange={(checked) => handleToggle(keyword.id, checked)}
                      label=""
                    />
                    <Button
                      onClick={() => {
                        setEditingKeyword(keyword);
                        setShowForm(true);
                      }}
                      variant="ghost"
                      size="sm"
                      icon={<FiEdit2 />}
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDelete(keyword.id)}
                      variant="ghost"
                      size="sm"
                      icon={<FiTrash2 />}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </>
  );
}
