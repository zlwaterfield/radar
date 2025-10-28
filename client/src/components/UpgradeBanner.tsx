import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiAlertCircle, FiX } from 'react-icons/fi';

interface UpgradeBannerProps {
  limitType: 'notification_profiles' | 'digest_configs' | 'repository_limit';
  currentLimit: number;
  children?: React.ReactNode;
}

export function UpgradeBanner({ limitType, currentLimit, children }: UpgradeBannerProps) {
  const storageKey = `radar_banner_dismissed_${limitType}`;
  const [isDismissed, setIsDismissed] = useState(false);
  const paymentEnabled = process.env.NEXT_PUBLIC_PAYMENT_ENABLED !== 'false';

  useEffect(() => {
    // Check if banner was previously dismissed
    const dismissed = localStorage.getItem(storageKey);
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey, 'true');
    setIsDismissed(true);
  };

  // Don't show banner if payment is disabled (open-source mode)
  if (isDismissed || !paymentEnabled) {
    return null;
  }

  const messages = {
    notification_profiles: {
      title: 'Notification limit reached',
      description: `You've reached your notification limit of ${currentLimit}.`
    },
    digest_configs: {
      title: 'Digest configuration limit reached',
      description: `You've reached your digest configuration limit of ${currentLimit}.`
    },
    repository_limit: {
      title: 'Repository limit reached',
      description: `You've reached your repository limit of ${currentLimit} enabled repositories.`
    }
  };

  const message = messages[limitType];

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
      <div className="flex items-start">
        <FiAlertCircle className="text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5 flex-shrink-0" size={20} />
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            {message.title}
          </p>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            {message.description}{' '}
            {children || (
              <>
                <Link
                  href="/settings/billing"
                  className="font-medium underline hover:text-yellow-900 dark:hover:text-yellow-100"
                >
                  Upgrade your plan
                </Link>
                {' '}to {limitType === 'repository_limit' ? 'add more repositories' : `create more ${limitType.replace('_', ' ')}`}.
              </>
            )}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="ml-3 flex-shrink-0 text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 transition-colors"
          aria-label="Dismiss banner"
        >
          <FiX size={20} />
        </button>
      </div>
    </div>
  );
}
