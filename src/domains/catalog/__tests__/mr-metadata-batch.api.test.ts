import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { POST } from '@/app/api/youtube/metadata/batch/route';
import { batchMRMetadata } from '../mr-metadata.service';
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/authOptions', () => ({ authOptions: {} }));
vi.mock('../mr-metadata.service', () => ({ batchMRMetadata: vi.fn() }));
const request = (ids: unknown = ['abcdefghijk']) => new NextRequest('https://example.test/api/youtube/metadata/batch', { method: 'POST', body: JSON.stringify({ ids }) });
beforeEach(() => vi.resetAllMocks());
describe('batch MR metadata API boundaries', () => {
  it('does not consume quota for anonymous or unrelated administrators', async () => {
    expect((await POST(request())).status).toBe(401);
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'user', adminScopes: ['clips'] } } as never);
    expect((await POST(request())).status).toBe(403);
    expect(batchMRMetadata).not.toHaveBeenCalled();
  });
  it('validates bounded video IDs before fetching and only returns metadata to song administrators', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'user', adminScopes: ['songs'] } } as never);
    for (const ids of [[], ['https://evil.test'], Array(31).fill('abcdefghijk')]) expect((await POST(request(ids))).status).toBe(400);
    expect(batchMRMetadata).not.toHaveBeenCalled();
    vi.mocked(batchMRMetadata).mockResolvedValue({ abcdefghijk: { title: 'MR', channelTitle: 'channel' } });
    const response = await POST(request());
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect((await response.json()).metadata.abcdefghijk.title).toBe('MR');
  });
});
