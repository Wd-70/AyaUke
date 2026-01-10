'use client';

import { InputHTMLAttributes, forwardRef, useId } from 'react';

interface AccessibleFormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  showLabel?: boolean;
}

export const AccessibleFormField = forwardRef<HTMLInputElement, AccessibleFormFieldProps>(
  ({ label, error, helperText, showLabel = true, className = '', ...props }, ref) => {
    const inputId = useId();
    const errorId = useId();
    const helperId = useId();

    const describedBy = [
      error ? errorId : null,
      helperText ? helperId : null
    ].filter(Boolean).join(' ');

    return (
      <div className="space-y-1">
        <label
          htmlFor={inputId}
          className={showLabel ? 'block text-sm font-medium text-light-text dark:text-dark-text' : 'sr-only'}
        >
          {label}
        </label>

        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy || undefined}
          className={`
            focus-visible:outline focus-visible:outline-2
            focus-visible:outline-offset-2
            focus-visible:outline-light-purple dark:focus-visible:outline-dark-accent
            ${error ? 'border-red-500 focus-visible:outline-red-500' : ''}
            ${className}
          `}
          {...props}
        />

        {helperText && (
          <p id={helperId} className="text-xs text-light-text/50 dark:text-dark-text/50">
            {helperText}
          </p>
        )}

        {error && (
          <p id={errorId} className="text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AccessibleFormField.displayName = 'AccessibleFormField';
