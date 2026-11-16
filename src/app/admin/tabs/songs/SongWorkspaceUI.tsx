"use client";
import { useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useMobileViewport, usePortalHost, useWorkflowOverlay } from '../clip-workflow/WorkflowWorkspace';
import { secondary, muted } from '@/components/song-editor/SongEditorUI';
export { Field, Notice, control, secondary, primary, muted } from '@/components/song-editor/SongEditorUI';
export class SongRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function songRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) throw new SongRequestError(json?.error?.message || '요청을 처리하지 못했습니다.', response.status);
  return json.data;
}
export function SongDialog({ title, subtitle, onClose, children, footer, wide = false }: {
  title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const viewportHeight = useMobileViewport();
  const host = usePortalHost(), ref = useRef<HTMLDivElement>(null), titleId = useId();
  useWorkflowOverlay(true, host, ref, onClose);
  return host && createPortal(<div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 backdrop-blur-sm sm:p-5" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
      style={{ "--song-dialog-height": viewportHeight ? `${viewportHeight}px` : "100dvh" } as CSSProperties}
      className={`flex h-[var(--song-dialog-height)] w-full flex-col overflow-hidden bg-white text-slate-900 shadow-2xl outline-none dark:bg-slate-950 dark:text-slate-100 sm:h-auto sm:max-h-[92dvh] sm:rounded-3xl ${wide ? 'sm:max-w-[1600px]' : 'sm:max-w-lg'}`}>
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-7">
        <div className="min-w-0"><h2 id={titleId} className="break-words text-xl font-semibold">{title}</h2>{subtitle && <p className={`mt-1 ${muted}`}>{subtitle}</p>}</div>
        <button type="button" onClick={onClose} aria-label="편집창 닫기" className={`${secondary} shrink-0 !px-3`}><XMarkIcon className="h-5 w-5" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">{children}</div>
      {footer && <footer className="shrink-0 border-t border-slate-100 bg-white px-5 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-950 sm:px-7">{footer}</footer>}
    </div>
  </div>, host);
}
