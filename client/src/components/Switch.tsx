import React from 'react';

interface SwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  className?: string;
  showStatusText?: boolean;
}

const Switch: React.FC<SwitchProps> = ({
  id,
  checked,
  onChange,
  disabled = false,
  loading = false,
  label,
  className = '',
  showStatusText = false
}) => {
  const switchId = id || `switch-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="flex items-center space-x-3">
      <label className={`relative inline-flex items-center cursor-pointer ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <input
          id={switchId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled || loading}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 border border-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 dark:border-gray-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-gray-500 peer-checked:bg-marian-blue-600 peer-checked:border-marian-blue-600"></div>
      </label>
      
      {(label || showStatusText) && (
        <span className={`text-sm font-medium flex items-center ${className}`}>
          {loading ? (
            <div className="flex items-center">
              <div className="relative h-4 w-4 mr-2">
                <div className="h-4 w-4 rounded-full border-2 border-gray-200 dark:border-gray-600"></div>
                <div className="absolute top-0 left-0 h-4 w-4 rounded-full border-2 border-marian-blue-600 border-t-transparent animate-spin"></div>
              </div>
              <span className="dark:text-white text-marian-blue-500">
                {label || (checked ? 'Enabled' : 'Disabled')}
              </span>
            </div>
          ) : (
            <span className="dark:text-white text-marian-blue-500">
              {label || (showStatusText ? (checked ? 'Enabled' : 'Disabled') : '')}
            </span>
          )}
        </span>
      )}
    </div>
  );
};

export default Switch;