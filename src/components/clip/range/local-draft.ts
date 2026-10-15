import type { ClipRange, ClipRangeDTO } from '@/domains/archive/clip-range.policy';

type Source = Pick<ClipRangeDTO, 'clipId' | 'platform' | 'videoId' | 'sourceVersion'>;
export type LocalRangeDraft = ClipRange & { timeOrigin: number; baseline?: ClipRange };

// One small entry per account/clip; never store proposals, history, or player data.
const key = (owner: string, clipId: string) => `clip-range-draft:v1:${JSON.stringify([owner, clipId])}`;
const finiteTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function readLocalDraft(owner: string, source: Source): { draft: LocalRangeDraft | null; available: boolean } {
  try {
    const storage = window.localStorage;
    const raw = storage.getItem(key(owner, source.clipId));
    if (!raw) return { draft: null, available: true };
    let value;
    try { value = JSON.parse(raw); } catch { value = null; }
    if (!value || value.sourceVersion !== source.sourceVersion || value.platform !== source.platform || value.videoId !== source.videoId ||
      !finiteTime(value.startTime) || !(value.endTime === null || finiteTime(value.endTime)) || !finiteTime(value.timeOrigin) ||
      (value.baseline !== undefined && (!value.baseline || !finiteTime(value.baseline.startTime) || !(value.baseline.endTime === null || finiteTime(value.baseline.endTime))))) {
      storage.removeItem(key(owner, source.clipId));
      return { draft: null, available: true };
    }
    // Incomplete/inverted ranges are valid drafts, but cannot be submitted to the server.
    return { draft: { startTime: value.startTime, endTime: value.endTime, timeOrigin: value.timeOrigin,
      ...(value.baseline ? { baseline: { startTime: value.baseline.startTime, endTime: value.baseline.endTime } } : {}),
    }, available: true };
  } catch { return { draft: null, available: false }; }
}

export function writeLocalDraft(owner: string, source: Source, range: ClipRange, timeOrigin: number, baseline?: ClipRange): boolean {
  try {
    window.localStorage.setItem(key(owner, source.clipId), JSON.stringify({
      sourceVersion: source.sourceVersion, platform: source.platform, videoId: source.videoId,
      startTime: range.startTime, endTime: range.endTime, timeOrigin,
      ...(baseline ? { baseline: { startTime: baseline.startTime, endTime: baseline.endTime } } : {}),
    }));
    return true;
  } catch { return false; }
}

export function clearLocalDraft(owner: string, source: Source): boolean {
  try { window.localStorage.removeItem(key(owner, source.clipId)); return true; }
  catch { return false; }
}
