'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { RANGE_STEPS, RANGE_DEFAULT_STEPS, validRange, type ClipRange } from '@/domains/archive/clip-range.policy';
import { editRangeBoundary } from './editor-policy';
import { parseRangeTime } from './editor-experience';
import { formatPreciseTime, formatRelativeClipTime, toClipRelativeTime, toClipSourceTime } from '@/shared/utils/clip-time';

export const rangeButton = 'min-h-11 rounded-lg border border-purple-300 px-3 py-2 text-sm text-purple-800 hover:bg-purple-50 disabled:opacity-40 dark:border-purple-700 dark:text-purple-200 dark:hover:bg-purple-900/30';

// Keep incomplete input (especially a leading minus) local until blur/Enter.
function TimeInput({ value, onCommit, onDraftChange, onValidityChange, clock, allowEmpty }: {
  value: number | null; onCommit: (value: number | null) => void;
  onDraftChange?: (value: number | null) => void;
  onValidityChange: (valid: boolean) => void; clock: boolean; allowEmpty: boolean;
}) {
  const format = (time: number | null) => time === null ? '' : clock ? formatRelativeClipTime(time, 0) : String(time);
  const [draft, setDraft] = useState(format(value));
  const [error, setError] = useState(false);
  const validity = useRef(onValidityChange);
  validity.current = onValidityChange;
  const hintId = useId();
  useEffect(() => {
    setDraft(value === null ? '' : clock ? formatRelativeClipTime(value, 0) : String(value));
    setError(false); validity.current(true);
  }, [value, clock]);
  return <><input type="text" inputMode="text" value={draft} aria-invalid={error} aria-describedby={hintId}
    onChange={e => {
      setDraft(e.target.value);
      const parsed = parseRangeTime(e.target.value);
      const valid = parsed !== undefined && (parsed !== null || allowEmpty);
      onValidityChange(valid);
      if (valid) setError(false);
      onDraftChange?.(valid ? parsed! : value);
    }}
    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    onBlur={() => {
      const parsed = parseRangeTime(draft);
      if (parsed === undefined || (parsed === null && !allowEmpty)) { setError(true); onValidityChange(false); return; }
      onCommit(parsed); setDraft(format(value)); setError(false); onValidityChange(true);
    }}
    className="mt-1 min-h-11 w-full rounded-lg border border-purple-200 bg-transparent px-2 font-mono dark:border-purple-700" />
    <span id={hintId} role={error ? 'alert' : undefined} className="mt-1 block text-xs">{error ? '시간을 확인해주세요. 예: 205, 3:25, -0:02.5' : '초 또는 분:초 입력 가능'}</span>
  </>;
}

export default function RangeControls({ value, onChange, onDraftChange, capture, preview, previewContext, maxTime, timeOrigin, compact = false, onInputValidityChange }: {
  value: ClipRange; onChange: (range: ClipRange) => void; capture?: () => number;
  /** Optional local autosave of numeric input before blur; does not change playback or undo history. */
  onDraftChange?: (range: ClipRange) => void;
  preview?: (edge: 'start' | 'end') => void; maxTime?: number;
  previewContext?: (edge: 'start' | 'end') => void;
  compact?: boolean;
  onInputValidityChange?: (valid: boolean) => void;
  /** Omit for the administrator's original-source editor. */
  timeOrigin?: number;
}) {
  const [steps, setSteps] = useState(RANGE_DEFAULT_STEPS);
  const [activeEdge, setActiveEdge] = useState<'start' | 'end'>('end');
  const [inputErrors, setInputErrors] = useState({ start: false, end: false });
  const inputValid = !inputErrors.start && !inputErrors.end;
  useEffect(() => { onInputValidityChange?.(inputValid); }, [inputValid, onInputValidityChange]);
  const change = (edge: 'start' | 'end', next: number) => {
    onChange(editRangeBoundary(value, edge, next, maxTime));
  };
  return <div className="space-y-2">
    {compact && <div role="group" aria-label="조정할 경계" className="grid grid-cols-2 gap-2 sm:hidden">
      {(['start', 'end'] as const).map(edge => <button key={edge} type="button" aria-pressed={activeEdge === edge}
        className={`${rangeButton} ${activeEdge === edge ? 'font-bold ring-2 ring-purple-500' : ''}`} onClick={() => setActiveEdge(edge)}>
        {edge === 'start' ? '시작 조정' : '끝 조정'}{inputErrors[edge] ? ' · 입력 확인' : ''}
      </button>)}
    </div>}
    <div className="grid gap-3 sm:grid-cols-2">
    {(['start', 'end'] as const).map(edge => {
      const time = edge === 'start' ? value.startTime : value.endTime;
      const label = edge === 'start' ? '시작' : '종료';
      return <fieldset key={edge} className={`min-w-0 rounded-xl border border-purple-200 p-3 dark:border-purple-800 ${compact && activeEdge !== edge ? 'hidden sm:block' : ''}`}>
        <legend className="px-1 text-sm font-semibold">{label} · {time === null ? '미설정' : timeOrigin === undefined ? formatPreciseTime(time) : formatRelativeClipTime(time, timeOrigin)}</legend>
        <div className="mb-2 flex flex-wrap gap-2">
          <button type="button" className={rangeButton} disabled={!capture} onClick={() => capture && change(edge, capture())}>현재 위치를 {label}으로</button>
          {previewContext && <button type="button" className={rangeButton} disabled={!preview || !inputValid || time === null || !validRange(value, maxTime)} onClick={() => previewContext(edge)}>{label} 경계 전후 듣기</button>}
          <button type="button" className={rangeButton} disabled={!preview || !inputValid || time === null || !validRange(value, maxTime)} onClick={() => preview?.(edge)}>{edge === 'start' ? '시작부터' : '끝 직전'} 10초 듣기</button>
        </div>
        <div className="flex items-start gap-2">
        <label className="block min-w-0 flex-1 text-xs">{label} 시각 ({timeOrigin === undefined ? '원본 기준 초' : '클립 기준'})
          <TimeInput value={time === null || timeOrigin === undefined ? time : toClipRelativeTime(time, timeOrigin)}
            clock={timeOrigin !== undefined} allowEmpty={edge === 'end'}
            onValidityChange={valid => setInputErrors(previous => previous[edge] === !valid ? previous : { ...previous, [edge]: !valid })}
            onDraftChange={onDraftChange ? next => onDraftChange(next === null
              ? edge === 'end' ? { ...value, endTime: null } : value
              : editRangeBoundary(value, edge, timeOrigin === undefined ? next : toClipSourceTime(next, timeOrigin), maxTime)) : undefined}
            onCommit={next => {
              if (next !== null) change(edge, timeOrigin === undefined ? next : toClipSourceTime(next, timeOrigin));
              else if (edge === 'end') onChange({ ...value, endTime: null });
            }} />
        </label>
          <label className="block w-24 shrink-0 text-xs">조정 단위
            <select aria-label={`${label} 조정 단위`} value={steps[edge]} onChange={e => setSteps(s => ({ ...s, [edge]: Number(e.target.value) }))}
              className="mt-1 block min-h-11 w-full rounded-lg border border-purple-200 bg-white px-2 dark:border-purple-700 dark:bg-gray-900">
              {RANGE_STEPS.map(step => <option value={step} key={step}>{step}초</option>)}
            </select>
          </label>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" className={rangeButton} disabled={time === null} aria-label={`${label} ${steps[edge]}초 앞당기기`} onClick={() => change(edge, (time ?? 0) - steps[edge])}>{steps[edge]}초 앞당기기</button>
          <button type="button" className={rangeButton} disabled={time === null} aria-label={`${label} ${steps[edge]}초 늦추기`} onClick={() => change(edge, (time ?? 0) + steps[edge])}>{steps[edge]}초 늦추기</button>
        </div>
      </fieldset>;
    })}
    </div>
  </div>;
}
