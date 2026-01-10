'use client';

import { ClockIcon } from '@heroicons/react/24/outline';

interface InlineTimeoutMessageProps {
  action?: string;
}

export default function InlineTimeoutMessage({
  action = 'load this data'
}: InlineTimeoutMessageProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-[#F59E0B] dark:text-[#D97706]">
      <ClockIcon className="w-4 h-4" />
      <span>Request timeout while trying to {action}</span>
    </div>
  );
}
