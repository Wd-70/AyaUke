import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { POST } from '@/app/api/youtube-search/route';
import { searchMRCandidates } from '../mr-search.service';
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/authOptions', () => ({ authOptions: {} }));
vi.mock('../mr-search.service', () => ({ searchMRCandidates: vi.fn(), MRSearchError: class extends Error {} }));
const request = (body: unknown = { title: 'Song', artist: 'Artist', language: 'Japanese' }) => new NextRequest('https://example.test/api/youtube-search', { method: 'POST', body: JSON.stringify(body) });
const session = (role: string, adminScopes?: string[]) => vi.mocked(getServerSession).mockResolvedValue({ user: { role, adminScopes } } as never);
beforeEach(() => vi.resetAllMocks());
describe('MR search API', () => {
  it('rejects anonymous, clip-only and revoked users before consuming quota', async () => {
    expect((await POST(request())).status).toBe(401);
    session('user', ['clips']); expect((await POST(request())).status).toBe(403);
    session('song_admin', []); expect((await POST(request())).status).toBe(403);
    expect(searchMRCandidates).not.toHaveBeenCalled();
  });
  it.each([['song_editor', undefined], ['user', ['songs']]])('allows authorized song editors: %s', async (role, scopes) => {
    session(role as string, scopes as string[] | undefined);
    vi.mocked(searchMRCandidates).mockResolvedValue({ results: [], searchQuery: 'q', excludedCount: 0, warnings: [] });
    const response = await POST(request());
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).not.toHaveProperty('selectedResult');
  });
  it('rejects malformed or excessive inputs before invoking YouTube', async () => {
    session('user', ['songs']);
    for (const body of [null, { title: [], artist: 'x' }, { title: 'T', artist: 'A', channelId: 'override' }, { title: 'T', artist: 'A', query: 'x'.repeat(501) }]) expect((await POST(request(body))).status).toBe(400);
    expect(searchMRCandidates).not.toHaveBeenCalled();
  });
});
