'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Loader from '@/components/Loader';
import Button from '@/components/Button';
import { FiCreditCard, FiCheck, FiX } from 'react-icons/fi';

interface Subscription {
  planName: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isLegacyPlan: boolean;
  legacyPlanName?: string;
  trialEnd: string | null;
}

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    billing: 'forever',
    features: [
      '2 repositories',
      '1 notification configuration',
      '1 digest configuration',
      '1 keyword (regex matching)',
    ],
    notIncluded: [
      'AI keyword matching',
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '$6',
    billing: 'per month',
    annualPrice: '$60',
    annualBilling: 'per year',
    savings: 'Get 2 months free',
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID,
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID,
    features: [
      '5 repositories',
      '3 notification configurations',
      '3 digest configurations',
      '3 keywords',
      'AI keyword matching',
    ],
    notIncluded: [],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$15',
    billing: 'per month',
    annualPrice: '$150',
    annualBilling: 'per year',
    savings: 'Get 2 months free',
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID,
    features: [
      'Unlimited repositories',
      'Unlimited notification configurations',
      'Unlimited digest configurations',
      'Unlimited keywords',
      'AI keyword matching',
    ],
    notIncluded: [],
  },
];

export default function BillingPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSubscription();
    }
  }, [isAuthenticated]);

  const fetchSubscription = async () => {
    try {
      const res = await fetch('/api/billing/subscription', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch subscription');
      const data = await res.json();
      setSubscription(data);
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
      setError('Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (priceId: string) => {
    try {
      setError(null);

      // If user has an active paid subscription, use change-subscription endpoint
      if (subscription?.planName !== 'free' && subscription?.status === 'active') {
        const res = await fetch('/api/billing/change-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ priceId }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || 'Failed to update subscription');
        }

        // Refresh subscription data
        await fetchSubscription();
        return;
      }

      // For free plan users, use checkout flow
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priceId }),
      });

      if (!res.ok) throw new Error('Failed to create checkout session');
      const { url } = await res.json();
      window.location.href = url;
    } catch (error) {
      console.error('Failed to update subscription:', error);
      setError(error instanceof Error ? error.message : 'Failed to update subscription. Please try again.');
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? It will remain active until the end of your billing period.')) {
      return;
    }

    try {
      setError(null);
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ immediately: false }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to cancel subscription');
      }

      // Refresh subscription data
      await fetchSubscription();
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      setError(error instanceof Error ? error.message : 'Failed to cancel subscription. Please try again.');
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      setError(null);
      const res = await fetch('/api/billing/reactivate', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to reactivate subscription');
      }

      // Refresh subscription data
      await fetchSubscription();
    } catch (error) {
      console.error('Failed to reactivate subscription:', error);
      setError(error instanceof Error ? error.message : 'Failed to reactivate subscription. Please try again.');
    }
  };

  const handleManageSubscription = async () => {
    try {
      setError(null);
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to create portal session');
      const { url } = await res.json();
      window.location.href = url;
    } catch (error) {
      console.error('Failed to create portal session:', error);
      setError('Failed to open billing portal. Please try again.');
    }
  };

  if (authLoading || loading) {
    return <Loader size="large" />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Billing
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your subscription and billing details
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Current Plan */}
      {subscription && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Current Plan: {subscription.planName.toUpperCase()}
                {subscription.isLegacyPlan && (
                  <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                    Legacy Plan
                  </span>
                )}
                {subscription.cancelAtPeriodEnd && (
                  <span className="ml-2 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 px-2 py-1 rounded">
                    Canceling
                  </span>
                )}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Status: {subscription.status}
              </p>
              {subscription.currentPeriodEnd && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {subscription.cancelAtPeriodEnd ? (
                    <>
                      Your subscription will be canceled on{' '}
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </span>
                      . You&apos;ll have access until then.
                    </>
                  ) : (
                    <>
                      Renews on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </>
                  )}
                </p>
              )}
            </div>
            {subscription.planName !== 'free' && (
              <div className="flex gap-2">
                {subscription.cancelAtPeriodEnd ? (
                  <Button
                    onClick={handleReactivateSubscription}
                    variant="primary"
                  >
                    Reactivate Subscription
                  </Button>
                ) : (
                  <Button
                    onClick={handleCancelSubscription}
                    variant="secondary"
                  >
                    Cancel Subscription
                  </Button>
                )}
                <Button
                  onClick={handleManageSubscription}
                  icon={<FiCreditCard />}
                  variant="secondary"
                >
                  Manage Subscription
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Billing Interval Toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setBillingInterval('monthly')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              billingInterval === 'monthly'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval('annual')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              billingInterval === 'annual'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Annual
            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
              Save 16%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Table */}
      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex flex-col justify-between ${
              subscription?.planName === plan.id
                ? 'ring-2 ring-blue-500'
                : ''
            }`}
          >
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {plan.name}
              </h3>
              <div className="mb-4">
                {billingInterval === 'annual' && plan.annualPrice ? (
                  <>
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      {plan.annualPrice}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">/{plan.annualBilling}</span>
                    {plan.savings && (
                      <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                        {plan.savings}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      {plan.price}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {plan.billing ? `/${plan.billing}` : '/month'}
                    </span>
                  </>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <FiCheck className="text-green-500 mr-2 mt-1 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {feature}
                    </span>
                  </li>
                ))}
                {plan.notIncluded.map((feature) => (
                  <li key={feature} className="flex items-start opacity-50">
                    <FiX className="text-gray-400 mr-2 mt-1 flex-shrink-0" />
                    <span className="text-sm text-gray-500">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {subscription?.planName === plan.id ? (
              <Button variant="secondary" disabled className="w-full">
                Current Plan
              </Button>
            ) : plan.monthlyPriceId || plan.annualPriceId ? (
              <Button
                onClick={() => {
                  const priceId = billingInterval === 'annual'
                    ? plan.annualPriceId
                    : plan.monthlyPriceId;
                  if (priceId) handleUpgrade(priceId);
                }}
                className="w-full"
                disabled={subscription?.cancelAtPeriodEnd}
              >
                {subscription?.planName === 'free'
                  ? 'Get Started'
                  : subscription?.planName === 'basic' && plan.id === 'pro'
                  ? 'Upgrade'
                  : subscription?.planName === 'pro' && plan.id === 'basic'
                  ? 'Downgrade'
                  : 'Change Plan'}
              </Button>
            ) : (
              <Button variant="ghost" disabled className="w-full">
                Free Forever
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
