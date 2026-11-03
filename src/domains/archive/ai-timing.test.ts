import { describe, expect, it } from 'vitest';
import { aiTimingLabel, aiTimingEvidenceLabel, type AiTimingAdjustment } from './ai-timing';

const aiTiming: AiTimingAdjustment = { version: 1, runId: 'test', method: 'separated-alignment', model: 'test', adjustedAt: '2026-11-02T00:00:00.000Z', songId: 'song', startTimeSeconds: 100, endTimeSeconds: 300, previousStartTimeSeconds: 102, previousEndTimeSeconds: 302, note: '종료 여운 검토 필요', reviewRequired: true };
const item = { startTimeSeconds: 100, endTimeSeconds: 300, matchedSongId: 'song', isTimeVerified: false, aiTiming };
describe('AI timing provenance', () => {
  it('does not imply human verification', () => expect(aiTimingLabel(item)).toBe('AI 판단 · 미검증'));
  it('distinguishes subsequent human verification', () => expect(aiTimingLabel({ ...item, isTimeVerified: true })).toBe('AI 판단 · 검증 완료'));
  it('retains provenance without attributing later time edits to AI', () => expect(aiTimingLabel({ ...item, endTimeSeconds: 301 })).toBe('AI 판단 후 수정'));
  it('detects song reassignment and missing end times', () => {
    expect(aiTimingLabel({ ...item, matchedSongId: 'other' })).toBe('AI 판단 후 수정');
    expect(aiTimingLabel({ ...item, endTimeSeconds: null })).toBe('AI 판단 후 수정');
  });
  it('leaves legacy timelines unlabeled', () => expect(aiTimingLabel({ ...item, aiTiming: undefined })).toBeNull());
  it('labels a measured evidence score without calling it confidence', () => {
    expect(aiTimingEvidenceLabel({ ...aiTiming, evidencePercent: 63.9, evidenceKind: 'cens-similarity' })).toBe('근거 63.9%');
    expect(aiTimingEvidenceLabel(aiTiming)).toBeNull();
    expect(aiTimingEvidenceLabel({ ...aiTiming, evidencePercent: NaN })).toBeNull();
    expect(aiTimingEvidenceLabel({ ...aiTiming, evidencePercent: 101 })).toBeNull();
  });
});
