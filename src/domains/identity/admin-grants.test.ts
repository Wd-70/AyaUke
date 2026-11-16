import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import User from '@/models/User';
import SongDetail from '@/domains/catalog/song.schema';
import { GET as collections } from '@/app/api/admin/maintenance/collections/route';
import { POST as restore } from '@/app/api/admin/maintenance/local-backup/restore/route';
import { restoreBackup } from '@/domains/operations/local-backup.service';
import { assertAdmin as assertClipAdmin } from '@/app/api/admin/clip-workflow/_guard';
import { PUT as updateUser } from '@/app/api/admin/users/[userId]/route';
import { PUT as duration } from '@/app/api/songdetails/[id]/clip-duration/route';
import { PUT as editSong, DELETE as deleteSong } from '@/app/api/songdetails/[id]/route';
import type { AdminScope } from '@/lib/permissions';
vi.mock('@/domains/operations/backup.service', () => ({ getCollectionSummary: vi.fn().mockResolvedValue([]) }));
vi.mock('@/domains/operations/local-backup.service', () => ({ restoreBackup: vi.fn() }));
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/authOptions', () => ({ authOptions: {} }));
vi.mock('@/shared/db/mongodb', () => ({ default: vi.fn(), connectDB: vi.fn() }));
vi.mock('@/models/User', () => ({ default: { findById: vi.fn(), findByIdAndUpdate: vi.fn() } }));
vi.mock('@/domains/catalog/song.schema', () => ({ default: { findByIdAndUpdate: vi.fn(), findByIdAndDelete: vi.fn() } }));
const id = '507f1f77bcf86cd799439011';
const context = { params: Promise.resolve({ userId: id, id }) };
const request = (body: unknown) => new NextRequest('https://test.example/api', { method: 'PUT', body: JSON.stringify(body) });
const session = (role: string, adminScopes?: AdminScope[]) => vi.mocked(getServerSession).mockResolvedValue({ user: { role, adminScopes, channelId: 'actor' } } as never);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(User.findById).mockResolvedValue({ role: 'user' } as never);
  vi.mocked(User.findByIdAndUpdate).mockReturnValue({ select: () => ({ lean: async () => ({ role: 'user' }) }) } as never);
  vi.mocked(SongDetail.findByIdAndUpdate).mockResolvedValue({ _id: id } as never);
});
describe('administrative writes', () => {
  it("gates system operations and reserves permission-restoring DB recovery for root", async () => {
    session("user", ["users"]);
    expect((await collections(request({}), context)).status).toBe(403);
    session("user", ["system"]);
    expect((await collections(request({}), context)).status).toBe(200);
    expect((await restore(request({name:"snapshot",confirm:"snapshot"}), context)).status).toBe(403);
    expect(restoreBackup).not.toHaveBeenCalled();
    session("super_admin");
    expect((await restore(request({name:"snapshot",confirm:"snapshot"}), context)).status).toBe(200);
    expect(restoreBackup).toHaveBeenCalledWith("snapshot");
  });
  it("protects every workflow operation with the shared clip guard", () => {
    for (const scope of ["songs", "users", "system"]) expect(() => assertClipAdmin({user:{role:"user",adminScopes:[scope]}} as never)).toThrow();
    expect(() => assertClipAdmin({user:{role:"user",adminScopes:["clips"]}} as never)).not.toThrow();
    expect(() => assertClipAdmin({user:{role:"song_admin",adminScopes:[]}} as never)).toThrow();
  });
  it('allows ordinary profile changes, but blocks self escalation by user managers', async () => {
    session('user', ['users']);
    expect((await updateUser(request({ displayName: '새 이름' }), context)).status).toBe(200);
    vi.mocked(User.findByIdAndUpdate).mockClear();
    expect((await updateUser(request({ adminScopes: ['users', 'system'] }), context)).status).toBe(403);
    expect((await updateUser(request({ role: 'super_admin' }), context)).status).toBe(400);
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });
  it('lets only root grant and revoke scopes', async () => {
    session('super_admin');
    expect((await updateUser(request({ adminScopes: ['songs', 'clips'] }), context)).status).toBe(200);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(id, expect.objectContaining({ adminScopes: ['songs', 'clips'], grantedBy: 'actor' }), expect.anything());
    expect((await updateUser(request({ adminScopes: [] }), context)).status).toBe(200);
    vi.mocked(User.findById).mockResolvedValue({ role: 'super_admin' } as never);
    expect((await updateUser(request({ adminScopes: [] }), context)).status).toBe(403);
    session('user', ['users']);
    expect((await updateUser(request({ displayName: 'root changed' }), context)).status).toBe(403);
  });
  it.each(['songs', 'clips', 'system'] as const)('denies user writes to %s-only admins', async scope => {
    session('user', [scope]);
    expect((await updateUser(request({ displayName: 'no' }), context)).status).toBe(403);
    expect(User.findById).not.toHaveBeenCalled();
  });
  it('limits clip admins to validated duration updates, not song edits or deletions', async () => {
    session('user', ['clips']);
    expect((await duration(request({ clipDuration: 240 }), context)).status).toBe(200);
    expect(SongDetail.findByIdAndUpdate).toHaveBeenCalledWith(id, { $set: { clipDuration: 240 } }, expect.anything());
    expect((await duration(request({ clipDuration: null }), context)).status).toBe(200);
    expect((await duration(request({ clipDuration: 0 }), context)).status).toBe(400);
    expect((await duration(request({ clipDuration: 240, title: 'injection' }), context)).status).toBe(400);
    expect((await editSong(request({ title: 'no' }), context)).status).toBe(403);
    expect((await deleteSong(request({}), context)).status).toBe(403);
  });
  it('revokes legacy song API access when an explicit empty scope set is saved', async () => {
    session('song_admin', []);
    expect((await editSong(request({ title: 'no' }), context)).status).toBe(403);
    session('song_editor');
    expect((await deleteSong(request({}), context)).status).toBe(403);
    session('user', ['songs']);
    expect((await editSong(request({ title: 'yes' }), context)).status).toBe(200);
  });
});
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
