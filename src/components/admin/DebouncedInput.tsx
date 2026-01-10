'use client';

import { useEffect, useState, useRef } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

/**
 * Debounced Input Component
 * Prevents excessive API calls during search input
 */

export interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  isLoading?: boolean;
}

export function DebouncedInput({
  value,
  onChange,
  debounceMs = 300,
  isLoading = false,
  className = '',
  ...props
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [isPending, setIsPending] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update local value when prop value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce the onChange callback
  useEffect(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Don't debounce if local value matches prop value
    if (localValue === value) {
      setIsPending(false);
      return;
    }

    setIsPending(true);

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      onChange(localValue);
      setIsPending(false);
    }, debounceMs);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [localValue, debounceMs, onChange, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const showSpinner = isPending || isLoading;

  return (
    <div className="relative">
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        className={className}
        {...props}
      />

      {/* Loading spinner */}
      {showSpinner && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <ArrowPathIcon className="w-5 h-5 text-light-text/40 dark:text-dark-text/40 animate-spin" />
        </div>
      )}
    </div>
  );
}
