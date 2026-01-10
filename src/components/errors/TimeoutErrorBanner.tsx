'use client';

import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface TimeoutErrorBannerProps {
  message?: string;
  onRetry?: () => void;
  showRetry?: boolean;
}

export default function TimeoutErrorBanner({
  message = 'The request took too long to complete. Please try again.',
  onRetry,
  showRetry = true
}: TimeoutErrorBannerProps) {
  return (
    <div className="rounded-lg border p-4 bg-[#FEF3C7] dark:bg-[#78350F] border-[#F59E0B] dark:border-[#D97706]">
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon className="w-5 h-5 text-[#F59E0B] dark:text-[#D97706] flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-[#991B1B] dark:text-[#FCA5A5] mb-1">
            Request Timeout
          </h3>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            {message}
          </p>
          {showRetry && onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#F59E0B] dark:bg-[#D97706] text-white hover:opacity-90 transition-opacity"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Retry Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
