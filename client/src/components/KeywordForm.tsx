import React, { useState, useEffect } from 'react';
import { FiLock } from 'react-icons/fi';
import type { Keyword, CreateKeywordData } from '../types/keyword';
import Button from './Button';
import Modal from './Modal';
import Switch from './Switch';

interface KeywordFormProps {
  keyword?: Keyword | null;
  onClose: () => void;
  onSubmit: (data: CreateKeywordData) => Promise<void>;
  hasAIMatching: boolean;
}

export function KeywordForm({ keyword, onClose, onSubmit, hasAIMatching }: KeywordFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateKeywordData>({
    term: '',
    llmEnabled: true,
    isEnabled: true,
    description: '',
  });

  useEffect(() => {
    if (keyword) {
      setFormData({
        term: keyword.term,
        llmEnabled: keyword.llmEnabled,
        isEnabled: keyword.isEnabled,
        description: keyword.description || '',
      });
    }
  }, [keyword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      // Error is handled by parent component
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {keyword ? 'Edit' : 'Create'} keyword
        </h3>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Term *
            </label>
            <input
              type="text"
              value={formData.term}
              onChange={(e) => setFormData({ ...formData, term: e.target.value })}
              placeholder="e.g., security, performance, bug"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Why is this keyword important?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500 sm:text-sm"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.llmEnabled}
                  onChange={(checked) => setFormData({ ...formData, llmEnabled: checked })}
                  label={`AI Matching ${!hasAIMatching ? '(Pro)' : ''}`}
                  disabled={!hasAIMatching}
                />
                {!hasAIMatching && (
                  <FiLock className="text-gray-400" />
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formData.llmEnabled
                ? 'AI matching uses semantic understanding to match keywords contextually'
                : 'Regex matching looks for exact substring matches in the text'}
            </p>
          </div>

          <div className="flex items-center">
            <Switch
              checked={formData.isEnabled}
              onChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
              label="Enabled"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            size="md"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !formData.term.trim()}
            variant="primary"
            size="md"
            loading={loading}
          >
            {keyword ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
