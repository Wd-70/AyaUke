import { describe, expect, it } from 'vitest';
import { filterUnmatchedTimelines, paginateUnmatchedTimelines } from './unmatched-timeline-candidates';
import { candidateVideoUrl } from '@/app/admin/tabs/clip-workflow/UnmatchedCandidates';
import type { WorkflowItem } from '@/app/admin/tabs/clip-workflow/types';

const item: WorkflowItem = { id: 'source', platform: 'chzzk', videoId: '15045272', videoUrl: '',
  artist: '가수', songTitle: '같은 곡!', startTimeSeconds: 100, endTimeSeconds: 300,
  date: '2026-09-05', isRelevant: true, isExcluded: false, isTimeVerified: false, commentAuthor: '' };

describe('unmatched timeline discovery', () => {
  it('excludes the current item, matched songs, excluded items and non-song content', () => {
    const items = [item, { ...item, id: 'other' }, { ...item, id: 'matched', matchedSongId: 'song' },
      { ...item, id: 'excluded', isExcluded: true }, { ...item, id: 'speech', isRelevant: false }];
    expect(filterUnmatchedTimelines(items, '같은 곡', item.id).map(row => row.id)).toEqual(['other']);
  });
  it('uses the existing normalized AND search and date/time ordering', () => {
    const items = [{ ...item, id: 'late', startTimeSeconds: 200 }, { ...item, id: 'newer', date: '2026-10-01' }, item];
    expect(filterUnmatchedTimelines(items, '가수 같은-곡').map(row => row.id)).toEqual(['newer', 'source', 'late']);
    expect(filterUnmatchedTimelines(items, '다른 가수')).toEqual([]);
    expect(filterUnmatchedTimelines(items, '!!')).toEqual([]);
    expect(filterUnmatchedTimelines(items, '日本語')).toEqual([]);
  });
  it('counts more than 300 results accurately before pagination', () => {
    const items = Array.from({ length: 351 }, (_, i) => ({ ...item, id: `candidate-${i}` }));
    const page = paginateUnmatchedTimelines(filterUnmatchedTimelines(items, '같은'), 7);
    expect(page.total).toBe(351);
    expect(page.items).toHaveLength(50);
    expect(page.pageSize).toBe(50);
    expect(paginateUnmatchedTimelines(items, 999)).toMatchObject({ total: 351, page: 8 });
    expect(paginateUnmatchedTimelines([], 7)).toEqual({ items: [], total: 0, page: 1, pageSize: 50 });
  });
  it('builds safe timestamped source links without trusting stored videoUrl', () => {
    expect(candidateVideoUrl({ ...item, startTimeSeconds: 100.9, videoUrl: 'javascript:alert(1)' })).toBe('https://chzzk.naver.com/video/15045272?t=100');
    expect(candidateVideoUrl({ ...item, platform: 'youtube', videoId: 'envhVMj3mc4' })).toBe('https://www.youtube.com/watch?v=envhVMj3mc4&t=100');
    expect(candidateVideoUrl({ ...item, videoId: '../bad' })).toBeNull();
  });
});
