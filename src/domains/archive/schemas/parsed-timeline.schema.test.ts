import { describe, expect, it } from 'vitest';
import ParsedTimeline from './parsed-timeline.schema';

describe('AI timing persistence schema', () => {
  it('preserves AI provenance without setting human verification', async () => {
    const doc = new ParsedTimeline({ id: 'test', platform: 'chzzk', videoId: '15022094', videoTitle: 'test', uploadedDate: new Date(), artist: 'test', songTitle: 'test', videoUrl: 'https://chzzk.naver.com/video/15022094', startTimeSeconds: 98, endTimeSeconds: 305, commentAuthor: 'test', commentId: 'test', aiTiming: { version: 1, runId: 'run', method: 'test', model: 'test', adjustedAt: '2026-11-02T00:00:00.000Z', songId: 'song', startTimeSeconds: 98, endTimeSeconds: 305, previousStartTimeSeconds: 100, previousEndTimeSeconds: null, note: 'review', reviewRequired: true } });
    await expect(doc.validate()).resolves.toBeUndefined();
    expect(doc.toObject().aiTiming?.previousEndTimeSeconds).toBeNull();
    expect(doc.isTimeVerified).toBe(false);
    if (doc.aiTiming) {
      doc.aiTiming.referenceYoutubeId = 'envhVMj3mc4';
      doc.aiTiming.referenceKind = 'cover';
      doc.aiTiming.reviewTier = 'review-only-provisional';
    }
    await expect(doc.validate()).resolves.toBeUndefined();
    expect(doc.toObject().aiTiming?.referenceKind).toBe('cover');
    expect(doc.toObject().aiTiming?.referenceYoutubeId).toBe('envhVMj3mc4');
    doc.startTimeSeconds = 97;
    expect(doc.toObject().aiTiming?.startTimeSeconds).toBe(98);
  });
  it('does not create empty metadata on old timeline documents', () => {
    expect(new ParsedTimeline({}).toObject().aiTiming).toBeUndefined();
  });
});
