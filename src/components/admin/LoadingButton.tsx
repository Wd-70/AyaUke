'use client';

import { motion } from 'framer-motion';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { forwardRef } from 'react';

/**
 * Loading Button Component
 * Standardizes button loading states with spinner and disabled state management
 */

export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: 'primary' | 'accent' | 'danger' | 'ghost';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ isLoading = false, variant = 'primary', icon, children, className = '', disabled, ...props }, ref) => {
    const variantStyles = {
      primary: 'bg-light-primary dark:bg-dark-primary text-light-text dark:text-dark-text hover:opacity-90',
      accent: 'bg-light-accent dark:bg-dark-accent text-white hover:opacity-90',
      danger: 'bg-red-500 text-white hover:bg-red-600',
      ghost: 'bg-transparent hover:bg-white/30 dark:hover:bg-gray-800/30 text-light-text dark:text-dark-text'
    };

    const isDisabled = disabled || isLoading;

    return (
      <motion.button
        ref={ref}
        whileTap={!isDisabled ? { scale: 0.97 } : {}}
        transition={{ duration: 0.2 }}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={isLoading}
        className={`
          relative px-4 py-2 rounded-xl font-medium
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-2
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-light-purple dark:focus-visible:outline-dark-accent
          ${variantStyles[variant]}
          ${className}
        `}
        {...props}
      >
        {/* Show spinner when loading, otherwise show icon */}
        {isLoading ? (
          <>
            <ArrowPathIcon className="w-5 h-5 animate-spin flex-shrink-0" aria-hidden="true" />
            <span className="sr-only">로딩 중</span>
          </>
        ) : icon ? (
          <span className="flex-shrink-0" aria-hidden="true">{icon}</span>
        ) : null}

        {/* Button text - preserve width during loading */}
        <span className={isLoading ? 'opacity-75' : ''}>
          {children}
        </span>
      </motion.button>
    );
  }
);

LoadingButton.displayName = 'LoadingButton';
