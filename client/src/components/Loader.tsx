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
        <div className={`${sizeClasses[size]} rounded-full border-4 border-gray-200 dark:border-gray-700`}></div>
        {/* Spinning ring */}
        <div className={`absolute top-0 left-0 ${sizeClasses[size]} rounded-full border-4 border-blue-400 border-t-transparent animate-spin [animation-duration:1s]`}></div>
      </div>
    </div>
  );

  return loader;
};

export default Loader;