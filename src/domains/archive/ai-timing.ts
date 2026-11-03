/** AI time adjustments are provenance, never human verification. */
export interface AiTimingAdjustment {
  version: 1;
  runId: string;
  method: string;
  model: string;
  adjustedAt: string;
  songId: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  previousStartTimeSeconds: number;
  previousEndTimeSeconds: number | null;
  note: string;
  /** Evidence similarity/coverage, NOT a calibrated probability of correctness. */
  evidencePercent?: number;
  evidenceKind?: 'cens-similarity' | 'fingerprint-coverage';
  reviewTier?: 'audio-supported' | 'duration-supported-provisional' | 'review-only-provisional';
  referenceYoutubeId?: string;
  referenceKind?: 'mr' | 'cover';
  endPolicy?: 'song-default-duration' | 'detected-ending-plus-padding';
  defaultClipDuration?: number;
  reviewRequired: true;
}

export function aiTimingEvidenceLabel(ai?: AiTimingAdjustment): string | null {
  if (!ai || typeof ai.evidencePercent !== 'number' || !Number.isFinite(ai.evidencePercent) || ai.evidencePercent < 0 || ai.evidencePercent > 100) return null;
  return `근거 ${ai.evidencePercent}%`;
}

export function aiTimingLabel(item: {
  startTimeSeconds: number; endTimeSeconds?: number | null;
  matchedSongId?: string; isTimeVerified: boolean; aiTiming?: AiTimingAdjustment;
}): string | null {
  const ai = item.aiTiming;
  if (!ai) return null;
  const current = item.matchedSongId === ai.songId
    && Math.abs(item.startTimeSeconds - ai.startTimeSeconds) < 0.01
    && item.endTimeSeconds != null && Math.abs(item.endTimeSeconds - ai.endTimeSeconds) < 0.01;
  if (!current) return 'AI 판단 후 수정';
  return item.isTimeVerified ? 'AI 판단 · 검증 완료' : 'AI 판단 · 미검증';
}
