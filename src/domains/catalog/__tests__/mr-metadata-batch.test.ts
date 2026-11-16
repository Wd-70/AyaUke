import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
beforeEach(() => { vi.resetModules(); vi.stubEnv('YOUTUBE_API_KEY', 'fixture-key'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('server MR metadata cache', () => {
  it('fetches multiple IDs once and serves different subsequent batches from the per-ID cache', async () => {
    const fetcher = vi.fn(async () => Response.json({ items: ['abcdefghijk', 'lmnopqrstuv'].map(id => ({ id, snippet: { title: id, channelTitle: 'channel' } })) }));
    vi.stubGlobal('fetch', fetcher);
    const { batchMRMetadata } = await import('../mr-metadata.service');
    await batchMRMetadata(['abcdefghijk', 'lmnopqrstuv']);
    expect((await batchMRMetadata(['abcdefghijk'])).abcdefghijk.title).toBe('abcdefghijk');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('shares concurrent batches and short-caches unavailable IDs without blocking valid ones', async () => {
    const fetcher = vi.fn(async () => Response.json({ items: [{ id: 'abcdefghijk', snippet: { title: 'valid' } }] }));
    vi.stubGlobal('fetch', fetcher);
    const { batchMRMetadata } = await import('../mr-metadata.service');
    const [first, second] = await Promise.all([batchMRMetadata(['abcdefghijk', 'lmnopqrstuv']), batchMRMetadata(['lmnopqrstuv', 'abcdefghijk'])]);
    expect(first).toEqual(second); expect(first.lmnopqrstuv).toBeUndefined();
    await batchMRMetadata(['lmnopqrstuv']); expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
