'use client';

import type { ClipRange } from '@/domains/archive/clip-range.policy';
import { formatRelativeClipTime, toClipRelativeTime, toClipSourceTime } from '@/shared/utils/clip-time';
import { rangePosition, timelineSelection } from './editor-experience';

export default function RangeTimeline({ start, end, range, current, timeOrigin, disabled, ready = true, inputValid = true, onSeek }: {
  start: number; end: number; range: ClipRange; current: number; timeOrigin: number;
  disabled: boolean; ready?: boolean; inputValid?: boolean; onSeek: (position: number) => void;
}) {
  const selection = timelineSelection(start, end, range);
  const position = Math.max(start, Math.min(end, current));
  const progress = end > start ? (position - start) / (end - start) * 100 : 0;
  const state = ready && inputValid ? rangePosition(current, range) : 'unknown';
  const status = !ready ? '재생 위치 확인 중' : !inputValid ? '시간 입력을 확인해주세요' : {
    before: '구간 밖 · 시작 전 (제외)', inside: '구간 안 · 저장에 포함', after: '구간 밖 · 종료 이후 (제외)', unknown: '시작·종료 시각을 확인해주세요',
  }[state];
  return <div className="space-y-1 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span role="status" aria-live="polite" aria-atomic="true" data-range-position={state}
        className={`rounded-lg border px-3 py-2 text-sm font-semibold ${state === 'inside' ? 'border-purple-300 bg-purple-100 text-purple-900' : 'border-gray-400 bg-gray-200 text-gray-900'}`}>{status}</span>
      <span className="font-mono tabular-nums">현재 {ready ? formatRelativeClipTime(current, timeOrigin) : '—'}</span>
    </div>
    <div className="flex flex-wrap justify-between gap-1">
      <span>남길 구간 <span className="font-mono">{formatRelativeClipTime(range.startTime, timeOrigin)} ~ {range.endTime === null ? '미설정' : formatRelativeClipTime(range.endTime, timeOrigin)}</span></span>
      <span>보라색: 유지 · 회색 사선: 제외</span>
    </div>
    <div className="relative flex h-11 items-center rounded-lg focus-within:ring-2 focus-within:ring-purple-500">
      <div aria-hidden="true" data-range-track="excluded" className="absolute inset-x-0 h-3 rounded-full bg-gray-400"
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(0, 0, 0, 0.2) 4px, rgba(0, 0, 0, 0.2) 6px)' }} />
      {selection && <div aria-hidden="true" className="pointer-events-none absolute h-3 bg-purple-600" style={{ left: `${selection.start}%`, width: `${selection.end - selection.start}%` }}>
        <span className="absolute -left-px -top-1 h-5 border-l-2 border-purple-500" />
        <span className="absolute -right-px -top-1 h-5 border-r-2 border-purple-500" />
      </div>}
      {ready && <span aria-hidden="true" className="pointer-events-none absolute h-6 w-2 -translate-x-1/2 rounded-full border-2 border-purple-950 bg-white" style={{ left: `${progress}%` }} />}
      <input type="range" min={toClipRelativeTime(start, timeOrigin)} max={toClipRelativeTime(end, timeOrigin)}
        step={0.1} value={toClipRelativeTime(position, timeOrigin)} disabled={disabled || end <= start}
        onChange={event => onSeek(toClipSourceTime(Number(event.target.value), timeOrigin))}
        aria-label="편집 미리듣기 위치" aria-valuetext={`${formatRelativeClipTime(position, timeOrigin)} · ${status}`}
        className="absolute inset-0 h-11 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
    </div>
    <div className="flex justify-between gap-2 font-mono">
      <span>{formatRelativeClipTime(start, timeOrigin)}</span><span>{formatRelativeClipTime(end, timeOrigin)}</span>
    </div>
  </div>;
}
