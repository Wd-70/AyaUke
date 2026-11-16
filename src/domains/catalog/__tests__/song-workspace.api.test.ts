import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { revalidatePath } from 'next/cache';
import { GET as list, POST as create } from '@/app/api/admin/song-library/route';
import { PATCH as change } from '@/app/api/admin/song-library/[id]/route';
import { POST as bulk } from '@/app/api/admin/song-library/bulk/route';
import * as service from '../song-workspace.service';
import { emptySongFields } from '../song-workspace';
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/authOptions', () => ({ authOptions: {} }));
vi.mock('@/shared/db/mongodb', () => ({ connectDB: vi.fn() }));
vi.mock('../song-workspace.service', () => ({
  songLibrary: vi.fn(), songLibraryDetail: vi.fn(), createLibrarySong: vi.fn(), changeLibrarySong: vi.fn(), bulkLibrarySongs: vi.fn(),
}));
const request = (body?: unknown) => new NextRequest('https://example.test/api/admin/song-library', body ? { method: 'POST', body: JSON.stringify(body) } : {});
const context = { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) };
const session = (role: string, adminScopes?: string[]) => vi.mocked(getServerSession).mockResolvedValue({ user: { role, adminScopes, channelId: 'actor' } } as never);
beforeEach(() => vi.resetAllMocks());
describe('song library API boundaries', () => {
  it('requires song access and never queries data for anonymous or clip-only users', async () => {
    expect((await list(request(), context)).status).toBe(401);
    session('user', ['clips']);
    expect((await list(request(), context)).status).toBe(403);
    expect(service.songLibrary).not.toHaveBeenCalled();
    session('user', ['songs']);
    vi.mocked(service.songLibrary).mockResolvedValue({ songs: [] });
    expect((await list(request(), context)).headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('retains legacy editor restrictions on creating or archiving songs', async () => {
    session('song_editor');
    expect((await create(request({ title: 'new', artist: 'artist', values: emptySongFields() }), context)).status).toBe(403);
    expect((await change(request({ action: 'archive', expectedUpdatedAt: null }), context)).status).toBe(403);
    expect(service.createLibrarySong).not.toHaveBeenCalled();
    expect(service.changeLibrarySong).not.toHaveBeenCalled();
  });
  it('rejects untrusted fields and impossible representative MR indexes before a write', async () => {
    session('user', ['songs']);
    for (const values of [{ ...emptySongFields(), title: 'overwrite' }, { ...emptySongFields(), sungCount: 100 }, { ...emptySongFields(), selectedMRIndex: 7 }]) {
      expect((await change(request({ action: 'edit', expectedUpdatedAt: null, values }), context)).status).toBe(400);
    }
    expect(service.changeLibrarySong).not.toHaveBeenCalled();
  });
  it('updates only validated metadata and invalidates the public songbook after success', async () => {
    session('user', ['songs']);
    vi.mocked(service.changeLibrarySong).mockResolvedValue({ id: 'song' } as never);
    expect((await change(request({ action: 'edit', expectedUpdatedAt: null, values: emptySongFields() }), context)).status).toBe(200);
    expect(service.changeLibrarySong).toHaveBeenCalledWith('507f1f77bcf86cd799439011', expect.objectContaining({ action: 'edit' }), 'actor', false);
    expect(revalidatePath).toHaveBeenCalledWith('/songbook');
  });
  it('blocks bulk mass-assignment and revoked legacy access', async () => {
    session('user', ['songs']);
    expect((await bulk(request({ targets: [{ id: '507f1f77bcf86cd799439011', updatedAt: null }], change: { field: 'status', value: 'deleted' } }), context)).status).toBe(400);
    session('song_admin', []);
    expect((await change(request({ action: 'edit', expectedUpdatedAt: null, values: emptySongFields() }), context)).status).toBe(403);
    expect(service.bulkLibrarySongs).not.toHaveBeenCalled();
  });
});
