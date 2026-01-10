'use client';

import { motion } from 'framer-motion';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

/**
 * Retry Banner Component
 * Displays retry status and progress during retry attempts
 */

export interface RetryBannerProps {
  currentAttempt: number;
  maxAttempts: number;
  nextRetryDelay: number; // milliseconds
  onCancel: () => void;
}

export function RetryBanner({
  currentAttempt,
  maxAttempts,
  nextRetryDelay,
  onCancel
}: RetryBannerProps) {
  const [countdown, setCountdown] = useState(Math.ceil(nextRetryDelay / 1000));

  useEffect(() => {
    setCountdown(Math.ceil(nextRetryDelay / 1000));

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [nextRetryDelay]);

  const progress = (currentAttempt / maxAttempts) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        {/* Warning icon */}
        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
              재시도 중... ({currentAttempt}/{maxAttempts})
            </h4>
            <button
              onClick={onCancel}
              className="p-1 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-800/30 transition-colors"
              aria-label="재시도 취소"
            >
              <XMarkIcon className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            </button>
          </div>

          <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3">
            {countdown > 0 ? (
              <>다음 시도까지 {countdown}초...</>
            ) : (
              <>재시도 중...</>
            )}
          </p>

          {/* Progress bar */}
          <div className="w-full bg-yellow-100 dark:bg-yellow-900/40 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
              className="h-full bg-yellow-500 dark:bg-yellow-400 rounded-full"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
