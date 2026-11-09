import { beforeEach, describe, expect, it, vi } from 'vitest';
import ParsedTimeline from './schemas/parsed-timeline.schema';
import { getUnmatchedTimelineCandidates, searchUnmatchedTimelines } from './clip-workflow.service';

vi.mock('./schemas/parsed-timeline.schema', () => ({ default: { find: vi.fn() } }));
const source = { id: 'source', platform: 'chzzk', videoId: '123', artist: '가수', songTitle: '새 노래',
  startTimeSeconds: 100, isRelevant: true, isExcluded: false, isTimeVerified: false };
let current: Record<string, unknown>[], candidates: Record<string, unknown>[];
beforeEach(() => {
  current = [source]; candidates = Array.from({ length: 351 }, (_, index) => ({ ...source, id: `other-${index}` }));
  vi.mocked(ParsedTimeline.find).mockReset();
  vi.mocked(ParsedTimeline.find).mockImplementation(((filter: { id?: unknown }) => ({
    sort: () => ({ lean: async () => typeof filter.id === 'string' ? current : candidates }),
  })) as never);
});
describe('item candidate service (read-only)', () => {
  it('counts all other candidates and returns a bounded page', async () => {
    const result = await getUnmatchedTimelineCandidates('source', '새 노래', 8);
    expect(result).toMatchObject({ total: 351, page: 8, pageSize: 50 });
    expect(result.items).toHaveLength(1);
    expect(ParsedTimeline.find).toHaveBeenLastCalledWith(expect.objectContaining({
      id: { $ne: 'source' }, isRelevant: true, isExcluded: { $ne: true },
      'matchedSong.songId': { $in: [null, ''] },
    }), expect.any(Object));
  });
  it('rejects missing, already matched, excluded or non-song sources', async () => {
    current = [];
    await expect(getUnmatchedTimelineCandidates('missing', '새')).rejects.toThrow('찾을 수 없습니다');
    for (const patch of [{ matchedSong: { songId: 'song' } }, { isExcluded: true }, { isRelevant: false }]) {
      current = [{ ...source, ...patch }];
      await expect(getUnmatchedTimelineCandidates('source', '새')).rejects.toThrow('미매칭 항목');
    }
  });
  it('does not scan candidates for a query with no searchable tokens', async () => {
    expect(await getUnmatchedTimelineCandidates('source', '!!!')).toMatchObject({ total: 0 });
    expect(ParsedTimeline.find).toHaveBeenCalledTimes(1);
  });
  it('keeps the existing song-unit discovery response capped at 300', async () => {
    expect(await searchUnmatchedTimelines('새 노래')).toHaveLength(300);
  });
});
