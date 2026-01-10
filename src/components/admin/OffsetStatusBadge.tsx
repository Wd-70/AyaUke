'use client';

import React from 'react';
import { ClockIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { formatOffset } from '@/lib/timeUtils';

interface OffsetStatusBadgeProps {
  timeOffset: number | null | undefined;
  syncSetAt?: Date | string | null;
  className?: string;
}

export default function OffsetStatusBadge({ timeOffset, syncSetAt, className = '' }: OffsetStatusBadgeProps) {
  const isSet = timeOffset !== null && timeOffset !== undefined;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        isSet
          ? 'bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[#10B981]/20'
          : 'bg-[rgba(156,163,175,0.1)] text-[#6B7280] border border-[#6B7280]/20'
      } ${className}`}
    >
      {isSet ? (
        <CheckCircleIcon className="w-4 h-4" />
      ) : (
        <XCircleIcon className="w-4 h-4" />
      )}
      <ClockIcon className="w-4 h-4" />
      <span>
        {isSet ? (
          <>
            오프셋: <strong>{formatOffset(timeOffset)}</strong>
            {syncSetAt && (
              <span className="ml-2 text-xs opacity-75">
                ({new Date(syncSetAt).toLocaleString('ko-KR')})
              </span>
            )}
          </>
        ) : (
          '오프셋 미설정'
        )}
      </span>
    </div>
  );
}
