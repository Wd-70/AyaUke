import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AiTimingBadge from './AiTimingBadge';
import type { WorkflowItem } from './types';

const item: WorkflowItem = {
  id: 'timeline', platform: 'chzzk', videoId: '15045272', videoTitle: 'test', date: '2026-09-05',
  artist: 'artist', songTitle: 'song', startTimeSeconds: 100, endTimeSeconds: 300,
  isRelevant: true, isExcluded: false, isTimeVerified: false, matchedSongId: 'song',
  commentAuthor: 'test', videoUrl: 'https://chzzk.naver.com/video/15045272',
  aiTiming: { version: 1, runId: 'run', method: 'cens-affine-v1', model: 'CENS',
    adjustedAt: '2026-11-03T00:00:00.000Z', songId: 'song', startTimeSeconds: 100,
    endTimeSeconds: 300, previousStartTimeSeconds: 102, previousEndTimeSeconds: null,
    note: '근거 부족: 필수 검토.', evidencePercent: 54.3, evidenceKind: 'cens-similarity',
    reviewTier: 'review-only-provisional', reviewRequired: true,
    referenceYoutubeId: 'envhVMj3mc4', referenceKind: 'mr' },
};

describe('AI timing review badge', () => {
  it('renders evidence and low-evidence warnings without claiming human verification', () => {
    const html = renderToStaticMarkup(<AiTimingBadge item={item} />);
    expect(html).toContain('AI 판단 · 미검증');
    expect(html).toContain('근거 54.3%');
    expect(html).toContain('근거 부족');
    expect(html).toContain('검토용 후보');
    expect(html).not.toContain('href=');
  });
  it('exposes original bounds and a safe reference link only in the detail view', () => {
    const html = renderToStaticMarkup(<AiTimingBadge item={item} detail />);
    expect(html).toContain('원래');
    expect(html).toContain('https://www.youtube.com/watch?v=envhVMj3mc4');
    expect(html).toContain('min-h-11');
    expect(html).toContain('noopener noreferrer');
  });
  it('reflects edits and verification while preserving provenance', () => {
    expect(renderToStaticMarkup(<AiTimingBadge item={{ ...item, startTimeSeconds: 99 }} />)).toContain('AI 판단 후 수정');
    expect(renderToStaticMarkup(<AiTimingBadge item={{ ...item, isTimeVerified: true }} />)).toContain('AI 판단 · 검증 완료');
  });
  it('omits legacy badges and invalid reference IDs', () => {
    expect(renderToStaticMarkup(<AiTimingBadge item={{ ...item, aiTiming: undefined }} />)).toBe('');
    expect(renderToStaticMarkup(<AiTimingBadge item={{ ...item, aiTiming: { ...item.aiTiming!, referenceYoutubeId: 'bad-link' } }} detail />)).not.toContain('href=');
  });
});
