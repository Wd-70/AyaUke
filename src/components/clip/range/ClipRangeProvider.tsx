'use client';

import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import type { ClipRangeDTO } from '@/domains/archive/clip-range.policy';
import { loadDetail, rangeKey } from './range-client';
const ClipRangeEditor = lazy(() => import('./ClipRangeEditor'));

export type RangePlayback = {
  clipId: string;
  owner: string;
  snapshot: () => ClipRangeDTO | null;
  /** Pause without changing the queue. The returned callback restores this playback session. */
  suspend: () => (range?: ClipRangeDTO) => void;
};
type Request = { clipId: string; owner: string; initial?: ClipRangeDTO; error?: string };
type Operation = Request & { releases: Map<string, { playback: RangePlayback; resume: (range?: ClipRangeDTO) => void }>; afterClose?: () => void; trigger: Element | null };
const Context = createContext<{
  isOpen: boolean; available: boolean;
  open: (clipId: string, sessionId?: string) => void;
  register: (sessionId: string, playback: RangePlayback) => () => void;
  applied: (clipId: string) => ClipRangeDTO | undefined;
} | null>(null);

/** One editor for all entry points. Opening a row never starts/reorders the queue. */
export function ClipRangeProvider({ children, beforeOpen }: { children: React.ReactNode; beforeOpen?: () => (() => void) | undefined }) {
  const { data: session, status } = useSession();
  const owner = session?.user.userId || 'guest';
  const ownerRef = useRef(owner); ownerRef.current = owner;
  const client = useQueryClient();
  const registry = useRef(new Map<string, RangePlayback>());
  const operation = useRef<Operation | null>(null);
  const saved = useRef(new Map<string, ClipRangeDTO>());
  const before = useRef(beforeOpen); before.current = beforeOpen;
  const [request, setRequest] = useState<Request | null>(null);

  const register = useCallback((id: string, playback: RangePlayback) => {
    registry.current.set(id, playback);
    if (operation.current) operation.current.releases.set(id, { playback, resume: playback.suspend() });
    return () => { if (registry.current.get(id) === playback) registry.current.delete(id); };
  }, []);
  const finish = useCallback((range?: ClipRangeDTO, expected?: Operation | null) => {
    const active = operation.current;
    if (!active || (expected !== undefined && active !== expected)) return;
    operation.current = null;
    const result = active.owner === ownerRef.current && range?.clipId === active.clipId ? range : undefined;
    if (result) {
      saved.current.set(result.clipId, result);
      if (active.owner !== 'guest') client.setQueryData(rangeKey(active.owner, result.clipId), result);
    }
    for (const [id, { playback, resume }] of active.releases) {
      if (registry.current.get(id) === playback) resume(playback.clipId === result?.clipId ? result : undefined);
    }
    active.afterClose?.();
    setRequest(null);
    requestAnimationFrame(() => { if (!operation.current && active.trigger instanceof HTMLElement && active.trigger.isConnected) active.trigger.focus(); });
  }, [client]);
  const open = useCallback(async (clipId: string, sessionId?: string) => {
    if (operation.current || status === 'loading') return;
    const active: Operation = { clipId, owner, releases: new Map(), afterClose: before.current?.(), trigger: document.activeElement };
    operation.current = active;
    setRequest({ clipId, owner });
    const preferred = sessionId ? registry.current.get(sessionId) : undefined;
    const playback = preferred?.clipId === clipId && preferred.owner === owner ? preferred
      : [...registry.current.values()].find(value => value.clipId === clipId && value.owner === owner);
    const snapshot = playback?.snapshot();
    for (const [id, value] of registry.current) active.releases.set(id, { playback: value, resume: value.suspend() });
    try {
      const latest = snapshot ?? await loadDetail(clipId);
      if (operation.current !== active || ownerRef.current !== owner) return;
      const applied = saved.current.get(clipId);
      const initial = !snapshot && owner === 'guest' && applied?.sourceVersion === latest.sourceVersion && applied.videoId === latest.videoId
        ? { ...latest, effective: applied.effective } : latest;
      setRequest({ clipId, owner, initial });
    } catch (error) {
      if (operation.current === active) setRequest({ clipId, owner, error: (error as Error).message });
    }
  }, [owner, status]);
  const previousOwner = useRef(owner);
  useEffect(() => {
    if (previousOwner.current === owner) return;
    saved.current.clear(); finish(); previousOwner.current = owner;
  }, [owner, finish]);
  const applied = useCallback((id: string) => saved.current.get(id), []);
  const value = useMemo(() => ({ isOpen: !!request, available: status !== 'loading', open, register, applied }), [request, status, open, register, applied]);
  const activeOperation = operation.current;
  const closeRequest = () => finish(undefined, activeOperation);
  return <Context.Provider value={value}>
    {children}
    {request?.owner === owner && (request.initial
      ? <Suspense fallback={<RangeRequestDialog onClose={closeRequest} />}><ClipRangeEditor key={`${owner}:${request.clipId}`} initial={request.initial} owner={owner} loggedIn={owner !== 'guest'} onClose={closeRequest} onApply={range => finish(range, activeOperation)} /></Suspense>
      : <RangeRequestDialog error={request.error} onClose={closeRequest} onRetry={() => { if (operation.current !== activeOperation) return; const id = request.clipId; closeRequest(); void open(id); }} />)}
  </Context.Provider>;
}

function RangeRequestDialog({ error, onClose, onRetry }: { error?: string; onClose: () => void; onRetry?: () => void }) {
  return <Dialog open onClose={onClose} className="relative z-[200]">
        <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-sm space-y-4 rounded-2xl border border-current/20 bg-light-background p-5 text-light-text dark:bg-dark-background dark:text-dark-text">
            <DialogTitle className="font-semibold">재생 구간 조정</DialogTitle>
            <p role={error ? 'alert' : 'status'}>{error || '구간 정보를 불러오는 중…'}</p>
            <div className="flex gap-2">
              {error && <button className="min-h-11 rounded-lg border border-current/20 px-3" onClick={onRetry}>다시 시도</button>}
              <button className="min-h-11 rounded-lg border border-current/20 px-3" onClick={onClose}>닫기</button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>;
}

export function useClipRangeEditor() {
  const context = useContext(Context);
  if (!context) throw new Error('useClipRangeEditor must be used within ClipRangeProvider');
  return context;
}
