'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FlagIcon,
  CheckIcon,
  XMarkIcon,
  NoSymbolIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { AdminBadge, AdminPageHeader, adminButton, adminDangerButton, adminMuted, adminPanel, adminPrimaryButton } from '@/components/admin/AdminPrimitives';
import { useToast } from '@/components/Toast';

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
  const { showSuccess, showError } = useToast();

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
      if (res.ok) {
        await load();
        showSuccess(action === 'dismiss' ? '반려했어요' : action === 'resolve' ? '처리했어요' : '숨기고 처리했어요', '');
      } else {
        const json = await res.json().catch(() => null);
        showError('처리하지 못했어요', json?.error?.message || '잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 text-light-text dark:text-dark-text">
      <AdminPageHeader
        eyebrow="WORKSPACE / REPORTS"
        title="클립 신고"
        count={pendingCount || null}
        description="사용자가 문제를 알려 온 클립을 확인하고 처리합니다."
        actions={
          <div className="flex rounded-xl bg-light-primary/10 p-1 dark:bg-dark-primary/20" role="group" aria-label="신고 상태">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatus(t.key)}
                aria-pressed={status === t.key}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${
                  status === t.key
                    ? "bg-white text-light-text shadow-sm dark:bg-gray-800 dark:text-dark-text"
                    : "text-light-text/60 hover:text-light-text dark:text-dark-text/60 dark:hover:text-dark-text"
                }`}
              >
                {t.label}
                {t.key === "pending" && pendingCount > 0 && <AdminBadge tone="warn">{pendingCount}</AdminBadge>}
              </button>
            ))}
          </div>
        }
      />

      {status === "pending" && (
        <dl className={`${adminPanel} grid gap-3 p-4 text-xs sm:grid-cols-3`}>
          <div>
            <dt className="font-semibold">처리 완료</dt>
            <dd className={adminMuted}>클립 정보·구간을 고쳤을 때. 신고만 닫힙니다.</dd>
          </div>
          <div>
            <dt className="font-semibold">반려</dt>
            <dd className={adminMuted}>확인해 보니 문제가 없을 때. 신고만 닫힙니다.</dd>
          </div>
          <div>
            <dt className="font-semibold text-rose-700 dark:text-rose-300">원본 없음으로 숨기기</dt>
            <dd className={adminMuted}>원본 다시보기가 사라졌을 때. 클립을 노래책에서 숨기고 신고를 닫습니다.</dd>
          </div>
        </dl>
      )}

      {loading && reports.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-light-primary/10 dark:bg-dark-primary/10" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className={`${adminPanel} p-10 text-center`}>
          <FlagIcon className="mx-auto h-8 w-8 text-light-text/30 dark:text-dark-text/30" />
          <p className={`${adminMuted} mt-2`}>
            {status === "pending" ? "대기 중인 신고가 없어요." : `${STATUS_TABS.find((t) => t.key === status)?.label ?? ""} 신고가 없어요.`}
          </p>
        </div>
      ) : (
        <ul className={`${adminPanel} divide-y divide-light-primary/10 overflow-hidden dark:divide-dark-primary/10`}>
          {reports.map((r) => {
            const clip = r.clipId;
            const busy = busyId === r._id;
            return (
              <li key={r._id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-light-primary/10 dark:bg-dark-primary/10">
                    {clip?.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={clip.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    )}
                    {clip?.sourceUnavailable && (
                      <span className="absolute bottom-1 left-1 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">숨김</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminBadge tone="warn">{REASON_LABEL[r.reason]}</AdminBadge>
                      {r.status !== "pending" && <AdminBadge tone="neutral">{r.status === "resolved" ? "처리됨" : "반려"}</AdminBadge>}
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold">
                      {clip ? (
                        <>
                          {clip.title} <span className="font-normal text-light-text/55 dark:text-dark-text/55">· {clip.artist}</span>
                        </>
                      ) : (
                        <span className="font-normal text-light-text/55 dark:text-dark-text/55">삭제된 클립</span>
                      )}
                    </p>
                    {r.detail && <p className="mt-1 line-clamp-2 text-xs text-light-text/75 dark:text-dark-text/75">“{r.detail}”</p>}
                    <p className={`${adminMuted} mt-1 text-xs`}>
                      {r.reportedByName || "익명"} · {new Date(r.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {clip && (
                    <a href={`/clip/${clip._id}`} target="_blank" rel="noopener noreferrer" className={`${adminButton} !min-h-10`}>
                      클립 열기
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    </a>
                  )}
                  {r.status === "pending" && (
                    <>
                      <button onClick={() => act(r._id, "resolve")} disabled={busy} className={`${adminPrimaryButton} !min-h-10`}>
                        <CheckIcon className="h-4 w-4" />
                        처리 완료
                      </button>
                      <button onClick={() => act(r._id, "dismiss")} disabled={busy} className={`${adminButton} !min-h-10`}>
                        <XMarkIcon className="h-4 w-4" />
                        반려
                      </button>
                      {clip && !clip.sourceUnavailable && (
                        <button onClick={() => act(r._id, "mark_unavailable")} disabled={busy} className={`${adminDangerButton} !min-h-10`}>
                          <NoSymbolIcon className="h-4 w-4" />
                          원본 없음으로 숨기기
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
