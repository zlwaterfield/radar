import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  className,
  disabled,
  ...props
}) => {
  const baseStyles = 'font-medium transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-opacity-50 rounded-md';
  
  const variantStyles = {
    primary: 'bg-gradient-to-r from-marian-blue-600 to-federal-blue-700 text-white hover:from-marian-blue-500 hover:to-federal-blue-600 focus:ring-marian-blue-700 shadow-sm border border-transparent',
    secondary: 'bg-white dark:bg-gray-800 text-marian-blue-400 dark:text-white border border-marian-blue-400 dark:border-white hover:bg-marian-blue-600 hover:text-white dark:hover:bg-white dark:hover:text-marian-blue-500 focus:ring-marian-blue-700',
    ghost: 'bg-transparent text-gray-600 dark:text-gray-300 hover:text-marian-blue-700 dark:hover:text-light-blue hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-gray-200 border border-transparent'
  };
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-8 py-3 text-lg'
  };
  
  const disabledStyles = disabled || loading ? 'opacity-50 cursor-not-allowed' : '';
  
  return (
    <button
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        disabledStyles,
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="mr-2">{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span className="ml-2">{icon}</span>}
        </>
      )}
    </button>
  );
};

export default Button;