'use client';

import { motion } from 'framer-motion';
import { LoadingButton } from './LoadingButton';

/**
 * Empty State Component
 * Provides consistent empty state UI with icon, message, and CTA button
 */

export interface EmptyStateProps {
  icon?: React.ReactNode; // Heroicon component
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  className = ''
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        flex flex-col items-center justify-center
        py-12 px-6 text-center
        ${className}
      `}
    >
      {/* Icon */}
      {icon && (
        <div className="w-16 h-16 mb-4 text-light-text/40 dark:text-dark-text/40">
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 className="text-lg font-semibold text-light-text/60 dark:text-dark-text/60 mb-2">
        {title}
      </h3>

      {/* Message */}
      {message && (
        <p className="text-sm text-light-text/50 dark:text-dark-text/50 mb-6 max-w-md">
          {message}
        </p>
      )}

      {/* Action button */}
      {actionLabel && onAction && (
        <LoadingButton
          onClick={onAction}
          variant="accent"
          className="mt-2"
        >
          {actionLabel}
        </LoadingButton>
      )}
    </motion.div>
  );
}
