'use client'

import React from 'react';
import { format } from 'date-fns';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import {
  DigestConfig,
  CreateDigestConfig,
  Repository,
  Team,
  DigestDeliveryType
} from '@/types/digest';

interface DigestConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingConfig: DigestConfig | null;
  formData: CreateDigestConfig;
  setFormData: (data: CreateDigestConfig) => void;
  repositories: Repository[];
  teams: any[];
  isSaving: boolean;
}

export default function DigestConfigModal({
  isOpen,
  onClose,
  onSave,
  editingConfig,
  formData,
  setFormData,
  repositories,
  teams,
  isSaving
}: DigestConfigModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {editingConfig ? 'Edit' : 'Create'} digest configuration
        </h3>
      </div>

        <div className="p-6 space-y-6">
          {/* Basic Settings */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500 sm:text-sm"
                placeholder="e.g., Morning Team Updates"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500 sm:text-sm"
                rows={2}
                placeholder="Optional description for this digest"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Delivery time
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Digests are sent in 15-minute intervals
              </p>
              <div className="flex gap-3">
                <select
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500 sm:text-sm"
                  value={formData.digestTime}
                  onChange={(e) => setFormData({...formData, digestTime: e.target.value})}
                >
                  {Array.from({ length: 96 }, (_, i) => {
                    const hours = Math.floor(i / 4);
                    const minutes = (i % 4) * 15;
                    const timeValue = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                    const displayTime = format(new Date().setHours(hours, minutes), 'h:mm a');
                    return (
                      <option key={timeValue} value={timeValue}>
                        {displayTime}
                      </option>
                    );
                  })}
                </select>
                <select
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500 sm:text-sm"
                  value={formData.timezone}
                  onChange={(e) => setFormData({...formData, timezone: e.target.value})}
                >
                  <option value="UTC">UTC</option>
                  
                  <optgroup label="North America">
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="America/Phoenix">Arizona (MST)</option>
                    <option value="America/Anchorage">Alaska Time (AKST)</option>
                    <option value="Pacific/Honolulu">Hawaii Time (HST)</option>
                    <option value="America/Toronto">Toronto (ET)</option>
                    <option value="America/Vancouver">Vancouver (PT)</option>
                  </optgroup>
                  
                  <optgroup label="Europe">
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Europe/Paris">Paris (CET)</option>
                    <option value="Europe/Berlin">Berlin (CET)</option>
                    <option value="Europe/Madrid">Madrid (CET)</option>
                    <option value="Europe/Rome">Rome (CET)</option>
                    <option value="Europe/Amsterdam">Amsterdam (CET)</option>
                    <option value="Europe/Stockholm">Stockholm (CET)</option>
                    <option value="Europe/Zurich">Zurich (CET)</option>
                    <option value="Europe/Vienna">Vienna (CET)</option>
                    <option value="Europe/Prague">Prague (CET)</option>
                    <option value="Europe/Warsaw">Warsaw (CET)</option>
                    <option value="Europe/Helsinki">Helsinki (EET)</option>
                    <option value="Europe/Athens">Athens (EET)</option>
                    <option value="Europe/Istanbul">Istanbul (TRT)</option>
                    <option value="Europe/Moscow">Moscow (MSK)</option>
                  </optgroup>
                  
                  <optgroup label="Asia Pacific">
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                    <option value="Asia/Seoul">Seoul (KST)</option>
                    <option value="Asia/Shanghai">Shanghai (CST)</option>
                    <option value="Asia/Hong_Kong">Hong Kong (HKT)</option>
                    <option value="Asia/Singapore">Singapore (SGT)</option>
                    <option value="Asia/Bangkok">Bangkok (ICT)</option>
                    <option value="Asia/Jakarta">Jakarta (WIB)</option>
                    <option value="Asia/Manila">Manila (PHT)</option>
                    <option value="Asia/Kolkata">Mumbai/Delhi (IST)</option>
                    <option value="Asia/Dubai">Dubai (GST)</option>
                    <option value="Asia/Karachi">Karachi (PKT)</option>
                    <option value="Asia/Dhaka">Dhaka (BST)</option>
                    <option value="Australia/Sydney">Sydney (AEDT)</option>
                    <option value="Australia/Melbourne">Melbourne (AEDT)</option>
                    <option value="Australia/Perth">Perth (AWST)</option>
                    <option value="Pacific/Auckland">Auckland (NZDT)</option>
                  </optgroup>
                  
                  <optgroup label="South America">
                    <option value="America/Sao_Paulo">São Paulo (BRT)</option>
                    <option value="America/Argentina/Buenos_Aires">Buenos Aires (ART)</option>
                    <option value="America/Santiago">Santiago (CLT)</option>
                    <option value="America/Lima">Lima (PET)</option>
                    <option value="America/Bogota">Bogotá (COT)</option>
                    <option value="America/Caracas">Caracas (VET)</option>
                  </optgroup>
                  
                  <optgroup label="Africa">
                    <option value="Africa/Cairo">Cairo (EET)</option>
                    <option value="Africa/Lagos">Lagos (WAT)</option>
                    <option value="Africa/Johannesburg">Johannesburg (SAST)</option>
                    <option value="Africa/Nairobi">Nairobi (EAT)</option>
                    <option value="Africa/Casablanca">Casablanca (WET)</option>
                  </optgroup>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Days of week
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Select which days to receive digests
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Sun', value: 0 },
                  { label: 'Mon', value: 1 },
                  { label: 'Tue', value: 2 },
                  { label: 'Wed', value: 3 },
                  { label: 'Thu', value: 4 },
                  { label: 'Fri', value: 5 },
                  { label: 'Sat', value: 6 },
                ].map((day) => {
                  const daysOfWeek = formData.daysOfWeek || [];
                  const isSelected = daysOfWeek.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const currentDays = formData.daysOfWeek || [];
                        const newDays = isSelected
                          ? currentDays.filter(d => d !== day.value)
                          : [...currentDays, day.value].sort((a, b) => a - b);
                        setFormData({ ...formData, daysOfWeek: newDays });
                      }}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-marian-blue-500 text-white hover:bg-marian-blue-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              {(!formData.daysOfWeek || formData.daysOfWeek.length === 0) && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                  Please select at least one day
                </p>
              )}
            </div>
          </div>

          {/* Scope Settings */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white">Scope</h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                What PRs to include
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="scopeType"
                    value="user"
                    checked={formData.scopeType === 'user'}
                    onChange={(e) => setFormData({...formData, scopeType: 'user', scopeValue: undefined})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Just your PRs
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="scopeType"
                    value="team"
                    checked={formData.scopeType === 'team'}
                    onChange={(e) => setFormData({...formData, scopeType: 'team'})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Specific team&apos;s PRs
                  </span>
                </label>
              </div>

              {formData.scopeType === 'team' && (
                <div className="mt-2">
                  <select
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500 sm:text-sm"
                    value={formData.scopeValue || ''}
                    onChange={(e) => setFormData({...formData, scopeValue: e.target.value})}
                  >
                    <option value="">Select a team</option>
                    {teams.map((team) => (
                      <option key={team.teamId} value={team.teamId}>
                        {team.teamName} ({team.organization})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Includes PRs where any team member is involved
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Repository Settings */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white">Repositories</h4>
            
            <div>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="repositoryType"
                    value="all"
                    checked={formData.repositoryFilter.type === 'all'}
                    onChange={(e) => setFormData({...formData, repositoryFilter: { type: 'all' }})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    All repositories
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="repositoryType"
                    value="selected"
                    checked={formData.repositoryFilter.type === 'selected'}
                    onChange={(e) => setFormData({...formData, repositoryFilter: { type: 'selected', repoIds: [] }})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Selected repositories
                  </span>
                </label>
              </div>
              
              {formData.repositoryFilter.type === 'selected' && (
                <div className="mt-3 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md p-3">
                  {repositories.filter(repo => repo.enabled).map((repo) => (
                    <label key={repo.githubId} className="flex items-center py-1">
                      <input
                        type="checkbox"
                        checked={formData.repositoryFilter.repoIds?.includes(repo.githubId) || false}
                        onChange={(e) => {
                          const currentIds = formData.repositoryFilter.repoIds || [];
                          const newIds = e.target.checked
                            ? [...currentIds, repo.githubId]
                            : currentIds.filter(id => id !== repo.githubId);
                          setFormData({
                            ...formData,
                            repositoryFilter: { ...formData.repositoryFilter, repoIds: newIds }
                          });
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {repo.fullName}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Delivery Settings */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white">Delivery</h4>

            <div>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="deliveryType"
                    value="dm"
                    checked={formData.deliveryType === 'dm'}
                    onChange={(e) => setFormData({...formData, deliveryType: e.target.value as DigestDeliveryType, deliveryTarget: undefined})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Slack Direct Message
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="deliveryType"
                    value="channel"
                    checked={formData.deliveryType === 'channel'}
                    onChange={(e) => setFormData({...formData, deliveryType: e.target.value as DigestDeliveryType})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Slack Channel
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="deliveryType"
                    value="email"
                    checked={formData.deliveryType === 'email'}
                    onChange={(e) => setFormData({...formData, deliveryType: e.target.value as DigestDeliveryType, deliveryTarget: undefined})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Email
                  </span>
                </label>
              </div>

              {formData.deliveryType === 'channel' && (
                <div className="mt-2">
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-marian-blue-500 focus:border-marian-blue-500 sm:text-sm"
                    placeholder="Channel ID (e.g., C1234567890)"
                    value={formData.deliveryTarget || ''}
                    onChange={(e) => setFormData({...formData, deliveryTarget: e.target.value})}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    You can find the channel ID in Slack by right-clicking on the channel name
                  </p>
                </div>
              )}
              {formData.deliveryType === 'email' && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Digest will be sent to your account email address
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={onSave}
          disabled={
            isSaving ||
            !formData.name.trim() ||
            !formData.daysOfWeek ||
            formData.daysOfWeek.length === 0 ||
            (formData.scopeType === 'team' && !formData.scopeValue)
          }
          loading={isSaving}
        >
          {editingConfig ? 'Update' : 'Create'}
        </Button>
      </div>
    </Modal>
  );
}