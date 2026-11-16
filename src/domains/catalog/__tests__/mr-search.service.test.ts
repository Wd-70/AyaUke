import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DDEOK_MR_CHANNEL_ID } from '../mr-search';
const video = (id: string, channelId = 'other', channelTitle = 'Independent') => ({ id: { videoId: id }, snippet: { title: 'Song', channelId, channelTitle } });
const reply = (items: unknown[]) => Response.json({ items });
beforeEach(() => {
  vi.resetModules();
  for (let i = 1; i <= 5; i++) vi.stubEnv(i === 1 ? 'YOUTUBE_API_KEY' : `YOUTUBE_API_KEY_${i}`, i === 1 ? 'test-key' : '');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('YouTube MR search service', () => {
  it('merges dedicated channel/global results, orders/deduplicates and caches repeated requests', async () => {
    const fetcher = vi.fn(async (url: string) => new URL(url).searchParams.has('channelId') ? reply([video('lmnopqrstuv', DDEOK_MR_CHANNEL_ID)]) : reply([video('abcdefghijk'), video('lmnopqrstuv', DDEOK_MR_CHANNEL_ID)]));
    vi.stubGlobal('fetch', fetcher);
    const { searchMRCandidates } = await import('../mr-search.service');
    const input = { title: 'Song', artist: 'Artist', language: 'Japanese' as const };
    const [result, same] = await Promise.all([searchMRCandidates(input), searchMRCandidates(input)]);
    expect(same).toEqual(result); expect(result.results.map(c => c.videoId)).toEqual(['lmnopqrstuv', 'abcdefghijk']);
    expect(new URL(fetcher.mock.calls[1][0]).searchParams.get('q')).toBe('Song Artist');
    expect(new URL(fetcher.mock.calls[1][0]).searchParams.get('channelId')).toBe(DDEOK_MR_CHANNEL_ID);
    await searchMRCandidates(input); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('applies Korean exclusion after searching and returns an empty list as a success', async () => {
    const fetcher = vi.fn(async () => reply([video('abcdefghijk', 'official', 'TJ노래방')]));
    vi.stubGlobal('fetch', fetcher);
    const { searchMRCandidates } = await import('../mr-search.service');
    const result = await searchMRCandidates({ title: '곡', artist: '가수', language: 'Korean' });
    expect(result.results).toEqual([]); expect(result.excludedCount).toBe(1); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not promote unrelated songs by the same preferred-channel artist', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply([
      { ...video('abcdefghijk', DDEOK_MR_CHANNEL_ID), snippet: { title: '[노래방] Lemon - 米津玄師', channelId: DDEOK_MR_CHANNEL_ID } },
      { ...video('lmnopqrstuv', DDEOK_MR_CHANNEL_ID), snippet: { title: '[노래방] LADY - 米津玄師', channelId: DDEOK_MR_CHANNEL_ID } },
    ])));
    const { searchMRCandidates } = await import('../mr-search.service');
    const result = await searchMRCandidates({ title: 'Lemon', artist: '米津玄師', language: 'Japanese' });
    expect(result.results.map(c => c.videoId)).toEqual(['abcdefghijk']);
  });
  it('rotates exhausted keys without returning keys or auto-selected results', async () => {
    vi.stubEnv('YOUTUBE_API_KEY_2', 'second-key');
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ error: { errors: [{ reason: 'quotaExceeded' }] } }, { status: 403 })).mockResolvedValueOnce(reply([video('abcdefghijk')]));
    vi.stubGlobal('fetch', fetcher);
    const { searchMRCandidates } = await import('../mr-search.service');
    const result = await searchMRCandidates({ title: 'T', artist: 'A', language: '' });
    expect(new URL(fetcher.mock.calls[1][0]).searchParams.get('key')).toBe('second-key');
    expect(result).not.toHaveProperty('selectedResult'); expect(JSON.stringify(result)).not.toContain('key');
  });
  it('keeps useful partial results with an explicit warning and retries uncached failures', async () => {
    const fetcher = vi.fn(async (url: string) => new URL(url).searchParams.has('channelId') ? Response.json({}, { status: 503 }) : reply([video('abcdefghijk')]));
    vi.stubGlobal('fetch', fetcher);
    const { searchMRCandidates } = await import('../mr-search.service');
    const input = { title: 'T', artist: 'A', language: 'Japanese' as const };
    expect((await searchMRCandidates(input)).warnings).toHaveLength(1);
    await searchMRCandidates(input); expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it('reports missing configuration and provider failures without leaking upstream details', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', ''); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const { searchMRCandidates } = await import('../mr-search.service');
    await expect(searchMRCandidates({ title: 'T', artist: 'A', language: '' })).rejects.toMatchObject({ status: 503 });
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv('YOUTUBE_API_KEY', 'test-key'); fetcher.mockRejectedValue(new Error('secret upstream url'));
    await expect(searchMRCandidates({ title: 'T', artist: 'A', language: '' })).rejects.toThrow('연결이 지연');
  });
});
