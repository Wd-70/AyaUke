/** Shared, platform-independent range rules. Times are absolute source seconds. */
export const RANGE_STEPS = [0.1, 0.5, 1, 5, 10, 30] as const;
export const RANGE_DEFAULT_STEPS = { start: 0.5, end: 5 };
export type ClipRange = { startTime: number; endTime: number | null };
export type RangeOrigin = 'personal' | 'official' | 'community' | 'original';
export const roundTime = (time: number) => Math.round(time * 10) / 10;

export function validRange(range: ClipRange, duration?: number): boolean {
  return Number.isFinite(range.startTime) && range.startTime >= 0 &&
    (range.endTime === null || (Number.isFinite(range.endTime) && range.endTime > range.startTime)) &&
    (duration === undefined || (range.startTime < duration && (range.endTime === null || range.endTime <= duration)));
}

export function resolveRange(
  official: ClipRange & { isVerified: boolean; sourceVersion: number; rangeVersion: number },
  personal?: (ClipRange & { sourceVersion: number }) | null,
  community?: (ClipRange & { sourceVersion: number; baseVersion: number }) | null,
): ClipRange & { origin: RangeOrigin } {
  if (personal && personal.sourceVersion === official.sourceVersion && validRange(personal))
    return { startTime: personal.startTime, endTime: personal.endTime, origin: 'personal' };
  if (official.isVerified) return { startTime: official.startTime, endTime: official.endTime, origin: 'official' };
  if (community && community.sourceVersion === official.sourceVersion && community.baseVersion === official.rangeVersion && validRange(community))
    return { startTime: community.startTime, endTime: community.endTime, origin: 'community' };
  return { startTime: official.startTime, endTime: official.endTime, origin: 'original' };
}

export type Candidate = { id: string; support: number; objections: number; createdAt: Date };
/** New candidates need three complete confirmations and no objection. One objection
 * does not allow a single account to take down an existing recommendation. */
export function chooseRecommendation(candidates: Candidate[], current?: string): string | null {
  const eligible = candidates.filter(c => c.support >= 3 && c.objections < (c.id === current ? 2 : 1));
  eligible.sort((a, b) => b.support - a.support || Number(b.id === current) - Number(a.id === current) ||
    a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  return eligible[0]?.id ?? null;
}

export type RangeProposalDTO = ClipRange & {
  id: string; mine: boolean; support: number; objections: number;
  vote: { start: number; end: number } | null;
};
export type ClipRangeDTO = {
  clipId: string; platform: 'youtube' | 'chzzk'; videoId: string;
  sourceVersion: number; rangeVersion: number; isVerified: boolean;
  official: ClipRange; personal: ClipRange | null;
  effective: ClipRange & { origin: RangeOrigin };
  recommendationId: string | null; proposals: RangeProposalDTO[];
};
