import { roundTime, type ClipRange, type ClipRangeDTO } from '@/domains/archive/clip-range.policy';

export const sameRange = (a: ClipRange, b: ClipRange) => a.startTime === b.startTime && a.endTime === b.endTime;

/** Editing a boundary never shifts the other boundary or preserves the duration. */
export function editRangeBoundary(value: ClipRange, edge: 'start' | 'end', next: number, maxTime?: number): ClipRange {
  if (!Number.isFinite(next)) return value;
  const bounded = roundTime(Math.max(0, Math.min(next, maxTime ?? Infinity)));
  return { ...value, [edge === 'start' ? 'startTime' : 'endTime']: bounded };
}

export function planRangeSave(data: ClipRangeDTO, baseline: ClipRange, draft: ClipRange, loggedIn: boolean, share: boolean) {
  if (!loggedIn) return { share: false, savePersonal: false, confirmPin: false };
  const confirmPin = !data.personal && (sameRange(draft, baseline) || sameRange(draft, data.effective));
  return {
    // Official-identical ranges are not improvement proposals; avoid a failed share after saving.
    share: share && !data.isVerified && !sameRange(draft, data.official),
    savePersonal: confirmPin || !sameRange(draft, data.personal ?? data.effective),
    confirmPin,
  };
}
