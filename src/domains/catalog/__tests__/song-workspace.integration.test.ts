import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import SongDetail from '../song.schema';
import SongVideo from '@/domains/archive/schemas/song-video.schema';
import { songLibrary, songLibraryDetail, createLibrarySong, changeLibrarySong, bulkLibrarySongs } from '../song-workspace.service';
import { emptySongFields } from '../song-workspace';
let mongo: MongoMemoryServer;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri());
  await SongDetail.init();
}, 60000);
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
beforeEach(async () => { await SongDetail.deleteMany({}); await SongVideo.deleteMany({}); });
const create = () => createLibrarySong({ title: '原題', artist: '原歌手', values: emptySongFields() });
describe('song workspace persistence', () => {
  it('returns editable detail and write responses without touching clip statistics', async () => {
    const original = await create();
    const aggregate = vi.spyOn(SongVideo, 'aggregate');
    try {
      const fast = await songLibraryDetail(original.id, false);
      expect(fast.statsLoaded).toBe(false); expect(fast.values).toEqual(original.values);
      const saved = await changeLibrarySong(original.id, { action: 'edit', expectedUpdatedAt: original.updatedAt, values: { ...original.values, titleAlias: 'fast' } }, 'admin', false);
      expect(saved).toMatchObject({ titleAlias: 'fast', statsLoaded: false });
      expect(aggregate).not.toHaveBeenCalled();
    } finally { aggregate.mockRestore(); }
  });
  it('reuses clip aggregation but manual freshness bypasses it; list excludes heavy text', async () => {
    const original = await create();
    await SongDetail.collection.updateOne({ _id: new mongoose.Types.ObjectId(original.id) }, { $set: { lyrics: 'large lyrics', personalNotes: 'private heavy content' } });
    const aggregate = vi.spyOn(SongVideo, 'aggregate');
    try {
      const first = await songLibrary('fresh');
      const second = await songLibrary(true);
      expect(aggregate).toHaveBeenCalledTimes(1);
      expect(first.songs[0].hasLyrics).toBe(true);
      expect(first.songs[0]).not.toHaveProperty('lyrics');
      expect(first.songs[0]).not.toHaveProperty('personalNotes');
      expect(second.songs).toEqual(first.songs);
      await songLibrary('fresh'); expect(aggregate).toHaveBeenCalledTimes(2);
    } finally { aggregate.mockRestore(); }
  });
  it('loads legacy records and real clip counts without accepting unrelated suggestions', async () => {
    const id = new mongoose.Types.ObjectId();
    await SongDetail.collection.insertOne({ _id: id, title: 'legacy', artist: 'artist', lyrics: '가사', mrLinks: [] });
    await SongDetail.create({ title: '추천곡', artist: 'artist', sourceType: 'user_suggestion', status: 'pending' });
    await SongVideo.collection.insertMany([{ songId: String(id), isVerified: true }, { songId: String(id), isVerified: false }]);
    expect((await songLibrary()).songs).toHaveLength(1);
    expect(await songLibraryDetail(String(id))).toMatchObject({ clips: 2, verifiedClips: 1, sourceType: 'sheet', updatedAt: null, hasLyrics: true });
  });
  it('persists all editable metadata without changing identity, counters or unknown legacy fields', async () => {
    const original = await create();
    await SongDetail.collection.updateOne({ _id: new mongoose.Types.ObjectId(original.id) }, { $set: { sungCount: 20, lyricsLinks: ['legacy-link'] } });
    const values = { ...original.values, titleAlias: '표시 제목', artistAlias: '표시 가수', clipDuration: 239.5, keyAdjustment: 0,
      language: 'Japanese' as const, personalNotes: '다른 버전', searchTags: ['일본어', '일본어'], lyrics: 'line1\nline2',
      mrLinks: [{ url: 'https://youtu.be/abcdefghijk', label: '커버', duration: '4:00', skipSeconds: 2.5 }] };
    const saved = await changeLibrarySong(original.id, { action: 'edit', expectedUpdatedAt: original.updatedAt, values }, 'admin');
    expect(saved.values).toMatchObject({ ...values, searchTags: ['일본어'] });
    expect(saved.title).toBe('原題');
    const raw = await SongDetail.collection.findOne({ _id: new mongoose.Types.ObjectId(original.id) });
    expect(raw).toMatchObject({ sungCount: 20, lyricsLinks: ['legacy-link'] });
    const cleared = await changeLibrarySong(original.id, { action: 'edit', expectedUpdatedAt: saved.updatedAt, values: emptySongFields() }, 'admin');
    expect(cleared.values).toEqual(emptySongFields());
  });
  it('rejects stale writes instead of overwriting another clip duration or MR edit', async () => {
    const original = await create();
    await SongDetail.collection.updateOne({ _id: new mongoose.Types.ObjectId(original.id) }, { $set: { clipDuration: 250, updatedAt: new Date(Date.now() + 5000) } });
    await expect(changeLibrarySong(original.id, { action: 'edit', expectedUpdatedAt: original.updatedAt, values: original.values }, 'admin')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await songLibraryDetail(original.id)).clipDuration).toBe(250);
  });
  it('archives and restores without deleting clips and preserves audit data', async () => {
    const original = await create();
    await SongVideo.collection.insertOne({ songId: original.id, isVerified: true });
    const archived = await changeLibrarySong(original.id, { action: 'archive', expectedUpdatedAt: original.updatedAt, reason: '확인 필요' }, 'admin');
    expect(archived).toMatchObject({ status: 'deleted', deleteReason: '확인 필요', clips: 1 });
    const restored = await changeLibrarySong(original.id, { action: 'restore', expectedUpdatedAt: archived.updatedAt }, 'admin');
    expect(restored).toMatchObject({ status: 'active', deleteReason: '', clips: 1 });
  });
  it('reports partial bulk conflicts explicitly and adds tags without replacement', async () => {
    const first = await create();
    const second = await createLibrarySong({ title: 'second', artist: 'artist', values: { ...emptySongFields(), searchTags: ['old'] } });
    await SongDetail.collection.updateOne({ _id: new mongoose.Types.ObjectId(first.id) }, { $set: { updatedAt: new Date(Date.now() + 5000) } });
    const result = await bulkLibrarySongs({ targets: [{ id: first.id, updatedAt: first.updatedAt }, { id: second.id, updatedAt: second.updatedAt }], change: { field: 'searchTags', value: ['new'] } });
    expect(result).toEqual({ changed: [second.id], conflicts: [first.id] });
    expect((await songLibraryDetail(second.id)).searchTags).toEqual(['old', 'new']);
  });
  it('detects display-name collisions with the same normalization as the songbook', async () => {
    const a = await create();
    await createLibrarySong({ title: 'second', artist: 'second', values: { ...emptySongFields(), titleAlias: a.title, artistAlias: a.artist } });
    const list = await songLibrary();
    expect(list.songs.map(song => song.displayConflicts)).toEqual([1, 1]);
  });
  it('advances the revision even when the stored clock is ahead and refuses reuse', async () => {
    const original = await create();
    const future = new Date(Date.now() + 60000);
    await SongDetail.collection.updateOne({ _id: new mongoose.Types.ObjectId(original.id) }, { $set: { updatedAt: future } });
    const body = { action: 'edit' as const, expectedUpdatedAt: future.toISOString(), values: original.values };
    const updated = await changeLibrarySong(original.id, body, 'admin');
    expect(new Date(updated.updatedAt!).getTime()).toBeGreaterThan(future.getTime());
    await expect(changeLibrarySong(original.id, body, 'admin')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('retains the title/artist uniqueness constraint on creation', async () => {
    await create(); await expect(create()).rejects.toMatchObject({ code: 11000 });
  });
});
