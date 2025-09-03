import { useState, useEffect } from 'react';
import type {
  NotificationProfile,
  CreateNotificationProfileRequest,
  UpdateNotificationProfileRequest,
} from '../types/notification-profile';

const API_BASE = '/api/notification-profiles';

interface UseNotificationProfilesReturn {
  profiles: NotificationProfile[];
  loading: boolean;
  error: string | null;
  createProfile: (data: CreateNotificationProfileRequest) => Promise<NotificationProfile>;
  updateProfile: (id: string, data: UpdateNotificationProfileRequest) => Promise<NotificationProfile>;
  deleteProfile: (id: string) => Promise<void>;
  migrateFromSettings: () => Promise<NotificationProfile | null>;
  refetch: () => Promise<void>;
}

export function useNotificationProfiles(): UseNotificationProfilesReturn {
  const [profiles, setProfiles] = useState<NotificationProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(API_BASE, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch profiles: ${response.statusText}`);
      }
      
      const data = await response.json();
      setProfiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profiles');
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async (data: CreateNotificationProfileRequest): Promise<NotificationProfile> => {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to create profile: ${response.statusText}`);
    }
    
    const newProfile = await response.json();
    setProfiles(prev => [...prev, newProfile].sort((a, b) => b.priority - a.priority));
    return newProfile;
  };

  const updateProfile = async (
    id: string, 
    data: UpdateNotificationProfileRequest
  ): Promise<NotificationProfile> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to update profile: ${response.statusText}`);
    }
    
    const updatedProfile = await response.json();
    setProfiles(prev => 
      prev
        .map(profile => profile.id === id ? updatedProfile : profile)
        .sort((a, b) => b.priority - a.priority)
    );
    return updatedProfile;
  };

  const deleteProfile = async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to delete profile: ${response.statusText}`);
    }
    
    setProfiles(prev => prev.filter(profile => profile.id !== id));
  };

  const migrateFromSettings = async (): Promise<NotificationProfile | null> => {
    const response = await fetch(`${API_BASE}/migrate-from-settings`, {
      method: 'POST',
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to migrate settings: ${response.statusText}`);
    }
    
    const result = await response.json();
    if (result) {
      setProfiles(prev => [...prev, result].sort((a, b) => b.priority - a.priority));
    }
    return result;
  };

  const refetch = async () => {
    await fetchProfiles();
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  return {
    profiles,
    loading,
    error,
    createProfile,
    updateProfile,
    deleteProfile,
    migrateFromSettings,
    refetch,
  };
}