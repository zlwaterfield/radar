import React from 'react';

interface DigestStatusCardProps {
  enabled: boolean;
  nextDelivery?: Date;
  lastDigest?: string;
  className?: string;
}

const DigestStatusCard: React.FC<DigestStatusCardProps> = ({
  enabled,
  nextDelivery,
  lastDigest,
  className = ''
}) => {
  if (!enabled) {
    return (
      <div className={`bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border-l-4 border-gray-300 dark:border-gray-600 ${className}`}>
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="text-2xl">⏸️</span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Daily digest is disabled
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Enable it to start receiving daily PR summaries
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border-l-4 border-green-400 dark:border-green-600 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="text-2xl">✅</span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Daily digest is active
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              {nextDelivery ? (
                <>Next delivery: {nextDelivery.toLocaleDateString()} at {nextDelivery.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
              ) : (
                'Scheduled for daily delivery'
              )}
            </p>
          </div>
        </div>
        
        {lastDigest && (
          <div className="text-right">
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              Last sent
            </p>
            <p className="text-xs text-green-700 dark:text-green-300">
              {new Date(lastDigest).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DigestStatusCard;