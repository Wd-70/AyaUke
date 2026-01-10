'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';

export interface AccessibleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string; // Required for icon-only buttons
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({ 'aria-label': ariaLabel, isLoading = false, disabled, children, className = '', ...props }, ref) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        aria-label={ariaLabel}
        aria-disabled={isDisabled}
        aria-busy={isLoading}
        disabled={isDisabled}
        className={`
          focus-visible:outline focus-visible:outline-2
          focus-visible:outline-offset-2
          focus-visible:outline-light-purple dark:focus-visible:outline-dark-accent
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';
