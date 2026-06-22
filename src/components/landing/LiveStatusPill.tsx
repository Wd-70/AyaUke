'use client';

import { motion } from 'framer-motion';
import { useLiveStatus } from '@/hooks/useLiveStatus';

const CHZZK_LIVE = 'https://chzzk.naver.com/live/abe8aa82baf3d3ef54ad8468ee73e7fc';

function relativeTime(openDate: string | null): string | null {
  if (!openDate) return null;
  // "2026-06-20 17:59:58" → 로컬 Date
  const t = new Date(openDate.replace(' ', 'T')).getTime();
  if (Number.isNaN(t)) return null;
  const diff = Date.now() - t;
  const day = Math.floor(diff / 86400000);
  if (day >= 1) return `${day}일 전`;
  const hr = Math.floor(diff / 3600000);
  if (hr >= 1) return `${hr}시간 전`;
  const min = Math.floor(diff / 60000);
  return min >= 1 ? `${min}분 전` : '방금';
}

export default function LiveStatusPill() {
  const { data } = useLiveStatus();

  // 로딩/실패 시엔 자리만 차지하지 않도록 null
  if (!data) return null;

  if (data.isLive) {
    return (
      <motion.a
        href={CHZZK_LIVE}
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="group inline-flex items-center gap-2.5 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 backdrop-blur-sm
                   shadow-[0_0_24px_-4px_rgba(239,68,68,0.6)] hover:bg-red-500/20 transition-colors"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        <span className="text-sm font-bold tracking-wide text-red-500">LIVE</span>
        {data.concurrentUserCount != null && (
          <span className="text-sm font-medium text-light-text/80 dark:text-dark-text/80">
            👁 {data.concurrentUserCount.toLocaleString()}
          </span>
        )}
        <span className="max-w-[40vw] truncate text-sm text-light-text/70 dark:text-dark-text/70 sm:max-w-[260px]">
          {data.liveTitle}
        </span>
      </motion.a>
    );
  }

  const rel = relativeTime(data.openDate);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="inline-flex items-center gap-2.5 rounded-full border border-light-primary/25 bg-white/40 px-4 py-2 backdrop-blur-sm dark:border-dark-primary/25 dark:bg-gray-800/40"
    >
      <span className="h-2.5 w-2.5 rounded-full bg-light-text/30 dark:bg-dark-text/30" />
      <span className="text-sm font-semibold text-light-text/70 dark:text-dark-text/70">
        오프라인
      </span>
      {data.liveTitle && (
        <span className="max-w-[40vw] truncate text-sm text-light-text/55 dark:text-dark-text/55 sm:max-w-[260px]">
          최근 방송 · {data.liveTitle}
          {rel ? ` (${rel})` : ''}
        </span>
      )}
    </motion.div>
  );
}
