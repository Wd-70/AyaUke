import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/youtube/metadata/route';
const request = (url: string) => new NextRequest(`https://example.test/api/youtube/metadata?url=${encodeURIComponent(url)}`);
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('MR metadata', () => {
  it('rejects lookalike hosts and malformed video IDs without any upstream call', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    for (const url of ['https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://youtu.be/invalid', 'file:///watch?v=abcdefghijk']) {
      expect((await GET(request(url))).status).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('loads title and channel for manual short/embedded URLs using only the parsed video ID', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'test');
    const fetcher = vi.fn().mockResolvedValue(Response.json({ items: [{ snippet: { title: 'MR title', channelTitle: 'MR channel', thumbnails: {} } }] }));
    vi.stubGlobal('fetch', fetcher);
    const response = await GET(request('https://youtube.com/embed/abcdefghijk?start=30'));
    expect((await response.json()).metadata).toMatchObject({ videoId: 'abcdefghijk', title: 'MR title', channelTitle: 'MR channel' });
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('id')).toBe('abcdefghijk');
  });
});
