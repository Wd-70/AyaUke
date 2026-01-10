import { formatSeconds } from '@/lib/timeUtils';

interface ProgressStatsProps {
  current: number;
  total: number;
  totalComments: number;
  timelineComments: number;
  estimatedTimeRemaining: number | null;
}

export default function ProgressStats({
  current,
  total,
  totalComments,
  timelineComments,
  estimatedTimeRemaining,
}: ProgressStatsProps) {
  return (
    <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
      <div className="p-3 bg-light-primary/10 dark:bg-dark-primary/10 rounded-lg">
        <p className="text-xs text-light-text/60 dark:text-dark-text/60 mb-1">Videos</p>
        <p className="text-lg font-bold text-light-text dark:text-dark-text">
          {current} / {total}
        </p>
      </div>

      <div className="p-3 bg-light-primary/10 dark:bg-dark-primary/10 rounded-lg">
        <p className="text-xs text-light-text/60 dark:text-dark-text/60 mb-1">Total Comments</p>
        <p className="text-lg font-bold text-light-text dark:text-dark-text">
          {totalComments.toLocaleString()}
        </p>
      </div>

      <div className="p-3 bg-light-accent/10 dark:bg-dark-accent/10 rounded-lg">
        <p className="text-xs text-light-text/60 dark:text-dark-text/60 mb-1">Timeline Comments</p>
        <p className="text-lg font-bold text-light-accent dark:text-dark-accent">
          {timelineComments.toLocaleString()}
        </p>
      </div>

      {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
        <div className="p-3 bg-light-secondary/10 dark:bg-dark-secondary/10 rounded-lg col-span-2 sm:col-span-3">
          <p className="text-xs text-light-text/60 dark:text-dark-text/60 mb-1">Estimated Time Remaining</p>
          <p className="text-lg font-bold text-light-text dark:text-dark-text">
            {formatSeconds(Math.floor(estimatedTimeRemaining / 1000))}
          </p>
        </div>
      )}
    </div>
  );
}
