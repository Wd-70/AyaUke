'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePortalHost, useWorkflowOverlay } from './WorkflowWorkspace';
import { workflowRequest } from './workflow-client';
import { fmt } from './itemUtils';
import type { WorkflowItem, UnmatchedTimelineCandidates } from './types';

export function candidateVideoUrl(item: WorkflowItem): string | null {
  const time = Number.isFinite(item.startTimeSeconds) ? Math.max(0, Math.floor(item.startTimeSeconds)) : 0;
  if (item.platform === 'chzzk' && /^\d+$/.test(item.videoId)) return `https://chzzk.naver.com/video/${item.videoId}?t=${time}`;
  if (item.platform === 'youtube' && /^[\w-]{11}$/.test(item.videoId)) return `https://www.youtube.com/watch?v=${item.videoId}&t=${time}`;
  return null;
}

/** Mounted only after an explicit click. Editing the query does not run a search. */
function CandidatesDialog({ item, onClose }: { item: WorkflowItem; onClose: () => void }) {
  const host = usePortalHost();
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId(), descriptionId = useId(), inputId = useId();
  const initialQuery = item.songTitle.trim().slice(0, 200);
  const [draft, setDraft] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<UnmatchedTimelineCandidates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ sequence: number; controller?: AbortController }>({ sequence: 0 });
  useWorkflowOverlay(true, host, dialog, onClose);

  const search = useCallback(async (text: string, page: number) => {
    const value = text.trim();
    if (!value) { setError('검색어를 입력해주세요.'); return; }
    request.current.controller?.abort();
    const controller = new AbortController();
    const sequence = ++request.current.sequence;
    request.current.controller = controller;
    setQuery(value); setLoading(true); setError(null); setResult(null);
    try {
      const response = await workflowRequest<{ data: UnmatchedTimelineCandidates }>(
        `/api/admin/clip-workflow/item/${encodeURIComponent(item.id)}/candidates?q=${encodeURIComponent(value)}&page=${page}`,
        { signal: controller.signal },
      );
      if (sequence === request.current.sequence) setResult(response.data);
    } catch (failure) {
      if (!controller.signal.aborted && sequence === request.current.sequence) setError(failure instanceof Error ? failure.message : '후보를 불러오지 못했습니다.');
    } finally {
      if (sequence === request.current.sequence) setLoading(false);
    }
  }, [item.id]);

  useEffect(() => {
    if (initialQuery) void search(initialQuery, 1);
    return () => { request.current.sequence++; request.current.controller?.abort(); };
  }, [initialQuery, search]);

  if (!host) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-3 sm:p-6" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} className="flex max-h-[90dvh] w-full max-w-3xl min-w-0 flex-col overflow-hidden rounded-xl border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-900 text-light-text dark:text-dark-text shadow-2xl outline-none">
        <header className="shrink-0 border-b border-light-primary/20 dark:border-dark-primary/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-base font-semibold">다른 미매칭 후보</h2>
            <button type="button" onClick={onClose} aria-label="미매칭 후보 닫기" className="min-h-11 min-w-11 rounded border border-light-primary/20 dark:border-dark-primary/20 text-sm">닫기</button>
          </div>
          <p className="mt-1 break-words text-sm">현재 항목: {item.artist} - {item.songTitle}</p>
          <p id={descriptionId} className="mt-1 text-xs text-light-text/70 dark:text-dark-text/70">현재 항목·매칭된 항목·제외된 항목은 집계하지 않습니다. 검색 결과는 같은 곡으로 확정된 목록이 아니며, 자동 매칭하거나 저장하지 않습니다.</p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <form onSubmit={event => { event.preventDefault(); if (!loading) void search(draft, 1); }}>
            <label htmlFor={inputId} className="block text-sm">후보 검색어 (곡명·가수)</label>
            <div className="mt-1 flex gap-2">
              <input id={inputId} value={draft} maxLength={200} onChange={event => setDraft(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 px-3 text-base" />
              <button type="submit" disabled={loading || !draft.trim()} className="min-h-11 shrink-0 rounded border border-light-primary/30 dark:border-dark-primary/30 px-3 text-sm disabled:opacity-50">검색</button>
            </div>
          </form>
          {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error} 검색 버튼으로 다시 시도할 수 있습니다.</p>}
          <div role="status" aria-live="polite" className="my-3 text-sm">
            {loading ? '미매칭 후보 검색 중…' : result ? <>다른 미매칭 후보 총 {result.total}건{result.total > 0 && ` · ${(result.page - 1) * result.pageSize + 1}~${Math.min(result.page * result.pageSize, result.total)}건 표시`}</> : '검색 버튼을 눌러 후보를 확인하세요.'}
          </div>
          {result && result.total === 0 && <p className="py-5 text-sm text-light-text/70 dark:text-dark-text/70">일치하는 다른 미매칭 타임라인이 없습니다.</p>}
          {result && <ul className="space-y-2">
            {result.items.map(candidate => {
              const url = candidateVideoUrl(candidate);
              return <li key={candidate.id} className="rounded-lg border border-light-primary/20 dark:border-dark-primary/20 p-3 text-sm">
                <div className="break-words font-medium">{candidate.artist} - {candidate.songTitle}</div>
                <div className="mt-1 break-words text-light-text/70 dark:text-dark-text/70">{candidate.date || '날짜 미상'} · {candidate.platform === 'chzzk' ? '치지직' : '유튜브'} · {candidate.videoTitle || candidate.videoId}</div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono">{fmt(candidate.startTimeSeconds)}~{fmt(candidate.endTimeSeconds)}</span>
                  {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">원본 영상 보기</a>}
                </div>
              </li>;
            })}
          </ul>}
          {result && result.total > result.pageSize && <nav aria-label="미매칭 후보 페이지" className="mt-4 flex items-center justify-between gap-2">
            <button type="button" disabled={loading || result.page <= 1} onClick={() => { void search(query, result.page - 1); }} className="min-h-11 rounded border border-light-primary/20 dark:border-dark-primary/20 px-3 disabled:opacity-50">이전 페이지</button>
            <span className="text-sm">{result.page} / {Math.ceil(result.total / result.pageSize)}</span>
            <button type="button" disabled={loading || result.page * result.pageSize >= result.total} onClick={() => { void search(query, result.page + 1); }} className="min-h-11 rounded border border-light-primary/20 dark:border-dark-primary/20 px-3 disabled:opacity-50">다음 페이지</button>
          </nav>}
        </div>
      </div>
    </div>, host,
  );
}

export default function UnmatchedCandidates({ item, active = true }: { item: WorkflowItem; active?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!active) setOpen(false); }, [active]);
  return <div className="my-2">
    <button type="button" aria-haspopup="dialog" aria-expanded={open && active} onClick={() => setOpen(true)} className="min-h-11 rounded border border-light-primary/30 dark:border-dark-primary/30 px-3 text-sm text-light-text dark:text-dark-text">다른 미매칭 후보 보기</button>
    {open && active && <CandidatesDialog item={item} onClose={() => setOpen(false)} />}
  </div>;
}
