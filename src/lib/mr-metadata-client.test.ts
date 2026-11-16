import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('MR metadata batching', () => {
  it('batches multiple previews, deduplicates IDs and reuses results', async () => {
    const fetcher = vi.fn(async (_url: string, _options: RequestInit) => Response.json({ success: true, metadata: { abcdefghijk: { title: 'first' }, lmnopqrstuv: { title: 'second' } } }));
    vi.stubGlobal('fetch', fetcher);
    const { loadMRMetadata } = await import('./mr-metadata-client');
    const first = loadMRMetadata('abcdefghijk'), same = loadMRMetadata('abcdefghijk'), second = loadMRMetadata('lmnopqrstuv');
    expect(first).toBe(same); await vi.advanceTimersByTimeAsync(20);
    expect(await Promise.all([first, second])).toEqual([{ title: 'first' }, { title: 'second' }]);
    await loadMRMetadata('abcdefghijk'); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body as string).ids).toEqual(['abcdefghijk', 'lmnopqrstuv']);
  });
  it('uses search result metadata immediately without another request', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const { seedMRMetadata, loadMRMetadata } = await import('./mr-metadata-client');
    seedMRMetadata('abcdefghijk', { title: 'selected result', channelTitle: 'channel' });
    expect((await loadMRMetadata('abcdefghijk')).title).toBe('selected result');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
