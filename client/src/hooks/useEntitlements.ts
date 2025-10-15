import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Entitlement {
  featureLookupKey: string;
  featureName: string;
  value: string;
  isActive: boolean;
}

export function useEntitlements() {
  const { user } = useAuth();
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchEntitlements();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchEntitlements = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/billing/entitlements`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch entitlements');
      const data = await res.json();
      setEntitlements(data);
    } catch (error) {
      console.error('Failed to fetch entitlements:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasFeature = (lookupKey: string): boolean => {
    return entitlements.some(
      (ent) => ent.featureLookupKey === lookupKey && ent.isActive
    );
  };

  const getFeatureValue = (lookupKey: string): number | boolean | null => {
    const ent = entitlements.find((e) => e.featureLookupKey === lookupKey);
    if (!ent) return null;

    if (ent.value === 'true') return true;
    if (ent.value === 'false') return false;
    if (ent.value === '-1') return -1; // unlimited
    const num = parseInt(ent.value, 10);
    return isNaN(num) ? null : num;
  };

  const canAddMore = (lookupKey: string, currentCount: number): boolean => {
    const limit = getFeatureValue(lookupKey);
    if (limit === null) return false;
    if (limit === -1) return true; // unlimited
    return currentCount < (limit as number);
  };

  return {
    entitlements,
    loading,
    hasFeature,
    getFeatureValue,
    canAddMore,
    refresh: fetchEntitlements,
  };
}
