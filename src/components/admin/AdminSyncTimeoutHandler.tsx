'use client';

import { useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import TimeoutErrorBanner from '@/components/errors/TimeoutErrorBanner';

interface AdminSyncTimeoutHandlerProps {
  onSync: () => Promise<void>;
  operationName: string;
  timeout?: number;
}

export default function AdminSyncTimeoutHandler({
  onSync,
  operationName,
  timeout = 60000 // Longer timeout for admin operations
}: AdminSyncTimeoutHandlerProps) {
  const [syncing, setSyncing] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setTimedOut(false);
    setError(null);

    try {
      await onSync();
    } catch (err: any) {
      if (err.message?.includes('timeout')) {
        setTimedOut(true);
        setError(`${operationName} timed out after ${timeout / 1000} seconds`);
      } else {
        setError(err.message);
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      {timedOut && (
        <TimeoutErrorBanner
          message={`${operationName} is taking longer than expected. This may indicate a large dataset or network issues. Try reducing the date range or checking your connection.`}
          onRetry={handleSync}
        />
      )}

      {error && !timedOut && (
        <div className="p-4 rounded-lg bg-[#FEF2F2] dark:bg-[#7F1D1D] border border-[#FCA5A5] dark:border-[#991B1B]">
          <p className="text-[#DC2626] dark:text-[#EF4444]">{error}</p>
        </div>
      )}

      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary hover:opacity-90 disabled:opacity-50"
      >
        <ArrowPathIcon className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? `${operationName}...` : `Start ${operationName}`}
      </button>
    </div>
  );
}
