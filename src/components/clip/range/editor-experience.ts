import { roundTime, validRange, type ClipRange } from '@/domains/archive/clip-range.policy';

/** null = empty, undefined = malformed; never silently interpret invalid input as zero. */
export function parseRangeTime(input: string): number | null | undefined {
  const text = input.trim();
  if (!text) return null;
  if (/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
    const value = Number(text);
    return Number.isFinite(value) ? roundTime(value) : undefined;
  }
  const match = /^(-)?(?:(\d+):)?(\d+):([0-5]?\d(?:\.\d+)?)$/.exec(text);
  if (!match || (match[2] !== undefined && Number(match[3]) >= 60)) return undefined;
  const value = (Number(match[2] ?? 0) * 3600 + Number(match[3]) * 60 + Number(match[4])) * (match[1] ? -1 : 1);
  return Number.isFinite(value) ? roundTime(value) : undefined;
}

export function durationWords(seconds: number): string {
  const value = roundTime(Math.abs(seconds));
  const minutes = Math.floor(value / 60);
  const rest = roundTime(value % 60);
  return [minutes ? `${minutes}분` : '', rest || !minutes ? `${rest}초` : ''].filter(Boolean).join(' ');
}

export function describeRangeChanges(value: ClipRange, baseline: ClipRange): string {
  const start = roundTime(value.startTime - baseline.startTime);
  const end = value.endTime !== null && baseline.endTime !== null ? roundTime(value.endTime - baseline.endTime) : null;
  return [
    start === 0 ? '시작 유지' : `앞부분 ${durationWords(start)} ${start > 0 ? '줄임' : '추가'}`,
    end === null ? value.endTime === null ? '종료 미설정' : '종료 지정' : end === 0 ? '종료 유지' : `끝부분 ${durationWords(end)} ${end < 0 ? '줄임' : '추가'}`,
    value.endTime !== null && validRange(value) ? `최종 길이 ${durationWords(value.endTime - value.startTime)}` : '종료를 시작 뒤로 지정해주세요',
  ].join(' · ');
}

export type PreviewSegment = { from: number; to: number; boundary?: number; edge?: 'start' | 'end'; label: string; key?: string };

export function boundaryPreview(value: ClipRange, edge: 'start' | 'end', context: boolean, duration = Infinity): PreviewSegment | null {
  if (!validRange(value, Number.isFinite(duration) ? duration : undefined)) return null;
  const boundary = edge === 'start' ? value.startTime : value.endTime;
  if (boundary === null) return null;
  const from = context ? Math.max(0, boundary - (edge === 'start' ? 2 : 5))
    : edge === 'start' ? boundary : Math.max(value.startTime, boundary - 10);
  const to = Math.min(duration, context ? boundary + (edge === 'start' ? 5 : 2) : Math.min(value.endTime ?? from + 10, from + 10));
  if (to <= from) return null;
  return { from, to, ...(context ? { boundary, edge } : {}), label: `${edge === 'start' ? '시작' : '끝'} ${context ? '경계 전후' : '10초'} 듣기` };
}

export function timelineSelection(windowStart: number, windowEnd: number, range: ClipRange) {
  if (windowEnd <= windowStart || range.endTime === null || !validRange(range)) return null;
  const percent = (time: number) => Math.min(100, Math.max(0, (time - windowStart) / (windowEnd - windowStart) * 100));
  return { start: percent(range.startTime), end: percent(range.endTime) };
}

/** Match playback bounds: start is included; end is excluded. Never round before comparing. */
export function rangePosition(current: number, range: ClipRange): 'before' | 'inside' | 'after' | 'unknown' {
  if (!Number.isFinite(current) || range.endTime === null || !validRange(range)) return 'unknown';
  if (current < range.startTime) return 'before';
  return current >= range.endTime ? 'after' : 'inside';
}
