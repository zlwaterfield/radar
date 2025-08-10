import React from 'react';

interface LoaderProps {
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
  className?: string;
}

const Loader: React.FC<LoaderProps> = ({ 
  size = 'medium', 
  fullScreen = false,
  className = ''
}) => {
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8',
    large: 'h-12 w-12'
  };

  const containerClasses = fullScreen
    ? 'flex items-center justify-center min-h-screen'
    : 'flex items-center justify-center min-h-[300px]';

  const loader = (
    <div className={`${containerClasses} ${className}`}>
      <div className="relative">
        {/* Outer ring */}
        <div className={`${sizeClasses[size]} rounded-full border-2 border-gray-200 dark:border-gray-700`}></div>
        {/* Spinning ring */}
        <div className={`absolute top-0 left-0 ${sizeClasses[size]} rounded-full border-2 border-primary-600 border-t-transparent animate-spin`}></div>
        {/* Inner pulse dot */}
        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${
          size === 'small' ? 'h-1 w-1' : size === 'medium' ? 'h-2 w-2' : 'h-3 w-3'
        } bg-primary-600 rounded-full animate-pulse`}></div>
      </div>
    </div>
  );

  return loader;
};

export default Loader;