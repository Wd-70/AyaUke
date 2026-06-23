'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FlagIcon,
  CheckIcon,
  XMarkIcon,
  NoSymbolIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

type ReasonKey = 'broken' | 'wrong_song' | 'wrong_time' | 'inappropriate' | 'other';
type StatusKey = 'pending' | 'resolved' | 'dismissed' | 'all';

const REASON_LABEL: Record<ReasonKey, string> = {
  broken: '재생 불가',
  wrong_song: '곡 정보 오류',
  wrong_time: '구간 오류',
  inappropriate: '부적절',
  other: '기타',
};

interface ReportClip {
  _id: string;
  title?: string;
  artist?: string;
  platform?: string;
  videoId?: string;
  thumbnailUrl?: string;
  sourceUnavailable?: boolean;
}
interface Report {
  _id: string;
  reason: ReasonKey;
  detail?: string;
  reportedByName?: string;
  status: StatusKey;
  createdAt: string;
  clipId?: ReportClip | null;
}

const STATUS_TABS: { key: StatusKey; label: string }[] = [
  { key: 'pending', label: '대기' },
  { key: 'resolved', label: '처리됨' },
  { key: 'dismissed', label: '반려' },
  { key: 'all', label: '전체' },
];

export default function ClipReportsTab() {
  const [status, setStatus] = useState<StatusKey>('pending');
  const [reports, setReports] = useState<Report[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clip-reports?status=${status}&limit=50`);
      if (res.ok) {
        const { data } = await res.json();
        setReports(data.reports);
        setPendingCount(data.pendingCount);
      }
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: 'resolve' | 'dismiss' | 'mark_unavailable') => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/clip-reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-xl border border-light-primary/20 bg-white/30 p-4 backdrop-blur-sm dark:border-dark-primary/20 dark:bg-gray-900/30 xl:p-6">
      <div className="mb-4 flex items-center gap-2">
        <FlagIcon className="h-5 w-5 text-amber-500" />
        <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">클립 신고</h3>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">{pendingCount} 대기</span>
        )}
      </div>

      {/* 상태 필터 */}
      <div className="mb-4 flex gap-1 rounded-lg bg-light-primary/10 p-1 text-sm dark:bg-dark-primary/10 w-fit">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              status === t.key
                ? 'bg-white text-light-accent shadow-sm dark:bg-gray-700 dark:text-dark-accent'
                : 'text-light-text/55 hover:text-light-accent dark:text-dark-text/55'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-light-primary/10 dark:bg-dark-primary/10" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="py-16 text-center text-light-text/50 dark:text-dark-text/50">
          {status === 'pending' ? '대기 중인 신고가 없습니다.' : '신고가 없습니다.'}
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const clip = r.clipId;
            return (
              <div
                key={r._id}
                className="flex flex-col gap-3 rounded-xl border border-light-primary/15 bg-white/50 p-3 dark:border-dark-primary/15 dark:bg-gray-800/40 sm:flex-row sm:items-center"
              >
                {/* 썸네일 */}
                <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-light-primary/10 dark:bg-dark-primary/10">
                  {clip?.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={clip.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )}
                  {clip?.sourceUnavailable && (
                    <span className="absolute bottom-1 left-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">불가</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {REASON_LABEL[r.reason]}
                    </span>
                    {clip ? (
                      <span className="truncate text-sm font-semibold text-light-text dark:text-dark-text">
                        {clip.title} <span className="font-normal text-light-text/50 dark:text-dark-text/50">— {clip.artist}</span>
                      </span>
                    ) : (
                      <span className="text-sm text-light-text/50 dark:text-dark-text/50">삭제된 클립</span>
                    )}
                    {r.status !== 'pending' && (
                      <span className="rounded-full bg-light-primary/15 px-2 py-0.5 text-[11px] text-light-text/55 dark:bg-dark-primary/15 dark:text-dark-text/55">
                        {r.status === 'resolved' ? '처리됨' : '반려'}
                      </span>
                    )}
                  </div>
                  {r.detail && <p className="mt-1 line-clamp-2 text-xs text-light-text/65 dark:text-dark-text/65">{r.detail}</p>}
                  <div className="mt-1 text-[11px] text-light-text/45 dark:text-dark-text/45">
                    {r.reportedByName || '익명'} · {new Date(r.createdAt).toLocaleString('ko-KR')}
                  </div>
                </div>

                {/* 액션 */}
                <div className="flex shrink-0 items-center gap-1.5">
                  {clip && (
                    <a
                      href={`/clip/${clip._id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-2 text-light-text/50 transition-colors hover:bg-light-primary/10 hover:text-light-accent dark:text-dark-text/50 dark:hover:bg-dark-primary/10"
                      title="클립 열기"
                    >
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    </a>
                  )}
                  {r.status === 'pending' && (
                    <>
                      <button
                        onClick={() => act(r._id, 'mark_unavailable')}
                        disabled={busyId === r._id}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/40 dark:text-red-400"
                        title="원본 불가 표시(노래책 숨김) + 처리"
                      >
                        <NoSymbolIcon className="h-3.5 w-3.5" />
                        숨김
                      </button>
                      <button
                        onClick={() => act(r._id, 'resolve')}
                        disabled={busyId === r._id}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-200 disabled:opacity-50 dark:bg-emerald-900/40 dark:text-emerald-400"
                        title="처리됨"
                      >
                        <CheckIcon className="h-3.5 w-3.5" />
                        처리
                      </button>
                      <button
                        onClick={() => act(r._id, 'dismiss')}
                        disabled={busyId === r._id}
                        className="inline-flex items-center gap-1 rounded-lg bg-light-primary/10 px-2.5 py-1.5 text-xs font-medium text-light-text/55 transition-colors hover:bg-light-primary/20 disabled:opacity-50 dark:bg-dark-primary/10 dark:text-dark-text/55"
                        title="반려"
                      >
                        <XMarkIcon className="h-3.5 w-3.5" />
                        반려
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
