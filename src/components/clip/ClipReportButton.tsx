'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { FlagIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/components/Toast';

const REASONS = [
  { key: 'broken', label: '재생이 안 돼요' },
  { key: 'wrong_song', label: '곡 정보가 틀려요' },
  { key: 'wrong_time', label: '구간(시작/끝)이 이상해요' },
  { key: 'inappropriate', label: '부적절한 내용이에요' },
  { key: 'other', label: '기타' },
] as const;

type ReasonKey = (typeof REASONS)[number]['key'];

interface ClipReportButtonProps {
  clipId: string;
  size?: 'sm' | 'lg';
  className?: string;
}

/** 클립 문제 신고 — 사유 선택 다이얼로그. 비로그인 시 안내. */
export default function ClipReportButton({ clipId, size = 'sm', className = '' }: ClipReportButtonProps) {
  const { data: session } = useSession();
  const { showSuccess, showError, showInfo } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReasonKey>('broken');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const lg = size === 'lg';

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clips/${clipId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, detail: detail.trim() || undefined }),
      });
      if (res.ok) {
        showSuccess('신고 접수됨', '검토 후 조치할게요. 감사합니다!');
        setOpen(false);
        setDetail('');
      } else {
        const data = await res.json().catch(() => null);
        showError('신고 실패', data?.error?.message || '잠시 후 다시 시도해주세요.');
      }
    } catch {
      showError('신고 실패', '네트워크 오류가 발생했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="클립 신고"
        title="문제 신고"
        onClick={(e) => {
          e.stopPropagation();
          if (!session) {
            showInfo('로그인이 필요해요', '신고는 로그인 후 이용할 수 있어요.');
            return;
          }
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1 rounded-full transition-all duration-200 ${
          lg
            ? 'border border-light-primary/30 bg-white/60 px-4 py-2 text-base font-semibold hover:-translate-y-0.5 hover:border-amber-400/60 dark:border-dark-primary/30 dark:bg-gray-800/60'
            : 'px-1.5 py-0.5 text-xs'
        } text-light-text/45 hover:text-amber-500 dark:text-dark-text/45 ${className}`}
      >
        <FlagIcon className={lg ? 'h-5 w-5' : 'h-4 w-4'} />
        {lg && <span>신고</span>}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-light-primary/20 bg-white p-5 shadow-2xl dark:border-dark-primary/20 dark:bg-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-1 text-base font-bold text-light-text dark:text-dark-text">클립 문제 신고</h3>
              <p className="mb-4 text-xs text-light-text/55 dark:text-dark-text/55">어떤 문제가 있나요?</p>

              <div className="space-y-1.5">
                {REASONS.map((r) => (
                  <label
                    key={r.key}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      reason === r.key
                        ? 'border-light-accent/50 bg-light-accent/10 text-light-text dark:border-dark-accent/50 dark:bg-dark-accent/10 dark:text-dark-text'
                        : 'border-light-primary/20 text-light-text/70 hover:bg-light-primary/5 dark:border-dark-primary/20 dark:text-dark-text/70 dark:hover:bg-dark-primary/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      checked={reason === r.key}
                      onChange={() => setReason(r.key)}
                      className="accent-light-accent dark:accent-dark-accent"
                    />
                    {r.label}
                  </label>
                ))}
              </div>

              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="자세한 내용(선택)"
                className="mt-3 w-full resize-none rounded-lg border border-light-primary/20 bg-white px-3 py-2 text-sm text-light-text placeholder:text-light-text/40 focus:border-light-accent/50 focus:outline-none dark:border-dark-primary/20 dark:bg-gray-900 dark:text-dark-text dark:placeholder:text-dark-text/40"
              />

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-light-text/60 transition-colors hover:bg-light-primary/10 dark:text-dark-text/60 dark:hover:bg-dark-primary/10"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="rounded-lg bg-gradient-to-r from-light-accent to-light-purple px-4 py-2 text-sm font-bold text-white shadow transition-all hover:shadow-lg disabled:opacity-60 dark:from-dark-primary dark:to-dark-secondary"
                >
                  {submitting ? '접수 중…' : '신고하기'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
