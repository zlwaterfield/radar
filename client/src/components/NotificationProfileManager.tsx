import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiBell, FiAlertCircle } from 'react-icons/fi';
import { useNotificationProfiles } from '../hooks/useNotificationProfiles';
import { NotificationProfileForm } from './NotificationProfileForm';
import Button from './Button';
import Switch from './Switch';
import { toast } from 'sonner';
import type { NotificationProfile, NotificationPreferences } from '../types/notification-profile';
import { NOTIFICATION_UI_GROUPS } from '../constants/notification-preferences.constants';
import axios from '@/lib/axios';
import { useEntitlements } from '@/hooks/useEntitlements';
import { UpgradeBanner } from './UpgradeBanner';

interface Team {
  teamId: string;
  teamName: string;
  organization: string;
}

interface NotificationProfileManagerProps {
  className?: string;
}

export function NotificationProfileManager({ className = '' }: NotificationProfileManagerProps) {
  const { profiles, loading, error, deleteProfile, createProfile, updateProfile } = useNotificationProfiles();
  const { canAddMore, getFeatureValue, loading: entitlementsLoading } = useEntitlements();
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<NotificationProfile | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const response = await axios.get('/api/users/me/teams');
      if (response.data && response.data.data) {
        setTeams(response.data.data);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FiBell className="h-5 w-5" />
            Notification profiles
          </h2>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FiBell className="h-5 w-5" />
          Notification profiles
        </h2>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const handleEditProfile = (profile: NotificationProfile) => {
    setEditingProfile(profile);
    setShowForm(true);
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (window.confirm('Are you sure you want to delete this notification profile?')) {
      try {
        await deleteProfile(profileId);
      } catch (error) {
        console.error('Failed to delete profile:', error);
        // You might want to show a toast notification here
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingProfile(null);
  };

  const handleToggleProfile = async (profile: NotificationProfile) => {
    try {
      await updateProfile(profile.id!, { isEnabled: !profile.isEnabled });
      toast.success(`Notification profile ${!profile.isEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle profile:', error);
      toast.error('Failed to update notification profile');
    }
  };

  const getScopeDisplay = (profile: NotificationProfile) => {
    if (profile.scopeType === 'user') {
      return 'Just your activity';
    } else if (profile.scopeType === 'team') {
      const team = teams.find(t => t.teamId === profile.scopeValue);
      return team ? `Team: ${team.teamName}` : 'Team: Unknown team';
    }
    return 'Not specified';
  };

  const getRepositoryDisplay = (profile: NotificationProfile) => {
    if (profile.repositoryFilter.type === 'all') {
      return 'All repositories';
    } else {
      const count = profile.repositoryFilter.repoIds?.length || 0;
      return `${count} selected repositories`;
    }
  };

  const getDeliveryDisplay = (profile: NotificationProfile) => {
    if (profile.deliveryType === 'dm') {
      return 'Direct message';
    } else {
      return `Channel: ${profile.deliveryTarget || 'Not specified'}`;
    }
  };

  const getEnabledPreferences = (preferences: NotificationPreferences) => {
    const enabled: string[] = [];
    
    // Collect all enabled preferences with their labels
    Object.values(NOTIFICATION_UI_GROUPS).forEach(group => {
      Object.values(group.sections).forEach(section => {
        section.fields.forEach(([key, label]: [keyof NotificationPreferences, string]) => {
          if (preferences[key as keyof NotificationPreferences]) {
            enabled.push(label);
          }
        });
      });
    });
    
    return enabled;
  };

  const handleCreateProfile = () => {
    // Check entitlement limit
    if (!canAddMore('notification_profiles', profiles.length)) {
      const limit = getFeatureValue('notification_profiles') as number;
      toast.error(`You've reached your notification profile limit (${limit}). Upgrade your plan to create more profiles.`);
      return;
    }
    setShowForm(true);
  };

  const profileLimit = getFeatureValue('notification_profiles') as number;
  const atLimit = profileLimit !== -1 && profiles.length >= profileLimit;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FiBell className="h-5 w-5" />
            Notification profiles
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Create multiple notification configurations for different scenarios
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={handleCreateProfile}
          className="flex items-center gap-2"
        >
          Create profile
        </Button>
      </div>

      {/* Upgrade Banner */}
      {!entitlementsLoading && atLimit && (
        <div className="mb-6">
          <UpgradeBanner limitType="notification_profiles" currentLimit={profileLimit} />
        </div>
      )}

      {profiles.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-8 text-center">
          <div className="text-4xl mb-2">🔔</div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No notification profiles yet
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
            Create your first notification profile to customize how you receive GitHub notifications
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="bg-gray-100 shadow-sm dark:bg-gray-700 rounded-lg px-7 py-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="font-medium text-gray-900">{profile.name}</h3>
                      {profile.priority > 0 && (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          Priority {profile.priority}
                        </span>
                      )}
                      <Switch
                        checked={profile.isEnabled}
                        onChange={() => handleToggleProfile(profile)}
                        label={profile.isEnabled ? 'Enabled' : 'Disabled'}
                      />
                    </div>
                    
                    {profile.description && (
                      <p className="text-sm text-gray-600 mb-3">{profile.description}</p>
                    )}
                    
                    <div className="flex flex-col gap-2 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">🎯 Scope:</span>
                        <span className="ml-1 text-gray-900 dark:text-white">
                          {getScopeDisplay(profile)}
                        </span>
                      </div>

                      <div>
                        <span className="text-gray-500 dark:text-gray-400">📤 Delivery:</span>
                        <span className="ml-1 text-gray-900 dark:text-white">
                          {getDeliveryDisplay(profile)}
                        </span>
                      </div>

                      <div>
                        <span className="text-gray-500 dark:text-gray-400">📁 Repos:</span>
                        <span className="ml-1 text-gray-900 dark:text-white">
                          {getRepositoryDisplay(profile)}
                        </span>
                      </div>

                      <div>
                        <span className="text-gray-500 dark:text-gray-400">🎪 Keywords:</span>
                        <span className="ml-1 text-gray-900 dark:text-white">
                          {profile.keywords.length > 0
                            ? `${profile.keywords.length} keyword${profile.keywords.length !== 1 ? 's' : ''}`
                            : 'No keywords'
                          }
                        </span>
                      </div>

                      <div>
                        <span className="text-gray-500 dark:text-gray-400">🔔 Events:</span>
                        <span className="ml-1 text-gray-900 dark:text-white">
                          {getEnabledPreferences(profile.notificationPreferences).length > 0
                            ? `${getEnabledPreferences(profile.notificationPreferences).length} event${getEnabledPreferences(profile.notificationPreferences).length !== 1 ? 's' : ''} enabled`
                            : 'No events enabled'
                          }
                        </span>
                      </div>
                    </div>
                    
                    {/* Keywords display */}
                    {profile.keywords.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-gray-500 mb-1">Keywords:</div>
                        <div className="flex flex-wrap gap-1">
                          {profile.keywords.slice(0, 5).map((keyword) => (
                            <span
                              key={keyword}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                            >
                              {keyword}
                            </span>
                          ))}
                          {profile.keywords.length > 5 && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                              +{profile.keywords.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Event preferences display */}
                    {getEnabledPreferences(profile.notificationPreferences).length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-gray-500 mb-1">Enabled events:</div>
                        <div className="flex flex-wrap gap-1">
                          {getEnabledPreferences(profile.notificationPreferences).slice(0, 6).map((eventLabel) => (
                            <span
                              key={eventLabel}
                              className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded"
                            >
                              {eventLabel}
                            </span>
                          ))}
                          {getEnabledPreferences(profile.notificationPreferences).length > 6 && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                              +{getEnabledPreferences(profile.notificationPreferences).length - 6} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleEditProfile(profile)}
                    className="text-xs"
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDeleteProfile(profile.id!)}
                    className="text-xs text-red-600 border-red-600 hover:bg-red-600 hover:text-white"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <NotificationProfileForm
          profile={editingProfile}
          onClose={handleFormClose}
          createProfile={createProfile}
          updateProfile={updateProfile}
        />
      )}
    </div>
  );
}