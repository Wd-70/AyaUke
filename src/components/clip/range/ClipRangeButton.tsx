'use client';

import { ScissorsIcon } from '@heroicons/react/24/outline';
import { useClipRangeEditor } from './ClipRangeProvider';

const styles = {
  action: 'gap-1.5 rounded-lg border border-current/20 px-3 text-sm hover:bg-current/5',
  pill: 'gap-2 rounded-full border border-current/20 px-4 text-sm hover:bg-current/5',
  toolbar: 'gap-1.5 rounded-full px-3 text-xs hover:bg-current/10',
  compact: 'gap-1.5 rounded-lg px-2 text-xs hover:bg-current/10',
  icon: 'w-11 rounded-full hover:bg-current/10',
};

/** Presentation only; editor, account isolation and playback suspension are shared. */
export default function ClipRangeButton({ clipId, sessionId, title, variant = 'action', disabled = false }: {
  clipId: string; sessionId?: string; title?: string; variant?: keyof typeof styles; disabled?: boolean;
}) {
  const editor = useClipRangeEditor();
  return <button type="button" aria-haspopup="dialog" aria-label={`${title ? `${title} ` : ''}재생 구간 조정`}
    title="재생 구간 조정" disabled={disabled || !editor.available || editor.isOpen}
    className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${styles[variant]}`}
    onClick={event => { event.stopPropagation(); editor.open(clipId, sessionId); }}>
    <ScissorsIcon aria-hidden="true" className="h-4 w-4" />
    {variant !== 'icon' && <span className={variant === 'toolbar' ? 'hidden sm:inline' : undefined}>구간 조정</span>}
  </button>;
}
