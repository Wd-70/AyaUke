'use client';

import { useEffect, useState, useRef } from 'react';
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';

/**
 * Debounced Input Component
 * Prevents excessive API calls during search input
 */

export interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  isLoading?: boolean;
  showClearButton?: boolean;
  onClear?: () => void;
}

export function DebouncedInput({
  value,
  onChange,
  debounceMs = 300,
  isLoading = false,
  showClearButton = false,
  onClear,
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
        aria-label={props['aria-label'] || props.placeholder}
        className={className}
        {...props}
      />

      {/* Clear button */}
      {showClearButton && localValue && !showSpinner && (
        <button
          onClick={() => {
            setLocalValue('');
            onChange('');
            onClear?.();
          }}
          aria-label="검색어 지우기"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/30 dark:hover:bg-gray-800/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-light-purple dark:focus-visible:outline-dark-accent"
        >
          <XMarkIcon className="w-4 h-4 text-light-text/40 dark:text-dark-text/40" aria-hidden="true" />
        </button>
      )}

      {/* Loading spinner */}
      {showSpinner && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
          <ArrowPathIcon className="w-5 h-5 text-light-text/40 dark:text-dark-text/40 animate-spin" />
        </div>
      )}
    </div>
  );
}
