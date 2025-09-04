import React, { useState } from 'react';
import { FiPlus, FiSettings, FiBell, FiBellOff, FiTarget, FiHash, FiMessageSquare, FiTrash2 } from 'react-icons/fi';
import { useNotificationProfiles } from '../hooks/useNotificationProfiles';
import { NotificationProfileForm } from './NotificationProfileForm';
import Button from './Button';
import Switch from './Switch';
import { toast } from 'sonner';
import type { NotificationProfile } from '../types/notification-profile';

interface NotificationProfileManagerProps {
  className?: string;
}

export function NotificationProfileManager({ className = '' }: NotificationProfileManagerProps) {
  const { profiles, loading, error, deleteProfile, createProfile, updateProfile } = useNotificationProfiles();
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<NotificationProfile | null>(null);

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

  const getDeliveryIcon = (deliveryType: string) => {
    switch (deliveryType) {
      case 'dm':
        return <FiMessageSquare className="h-4 w-4" />;
      case 'channel':
        return <FiHash className="h-4 w-4" />;
      default:
        return <FiMessageSquare className="h-4 w-4" />;
    }
  };

  const getScopeIcon = (scopeType: string) => {
    switch (scopeType) {
      case 'user':
        return <FiTarget className="h-4 w-4" />;
      case 'team':
        return <FiTarget className="h-4 w-4" />;
      default:
        return <FiTarget className="h-4 w-4" />;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
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
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2"
        >
          Create profile
        </Button>
      </div>

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
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        {getScopeIcon(profile.scopeType)}
                        <span>
                          {profile.scopeType === 'user' ? 'Personal' : 'Team'} notifications
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {getDeliveryIcon(profile.deliveryType)}
                        <span>
                          {profile.deliveryType === 'dm' ? 'Direct messages' : 'Channel'}
                          {profile.deliveryTarget && ` (${profile.deliveryTarget})`}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <span>🎪</span>
                        <span>
                          {profile.keywords.length > 0 
                            ? `${profile.keywords.length} keyword${profile.keywords.length !== 1 ? 's' : ''}`
                            : 'No keywords'
                          }
                        </span>
                      </div>
                    </div>
                    
                    {profile.keywords.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {profile.keywords.slice(0, 5).map((keyword) => (
                          <span
                            key={keyword}
                            className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded"
                          >
                            {keyword}
                          </span>
                        ))}
                        {profile.keywords.length > 5 && (
                          <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">
                            +{profile.keywords.length - 5} more
                          </span>
                        )}
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