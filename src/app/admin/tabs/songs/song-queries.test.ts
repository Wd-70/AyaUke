import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { cacheBulkSongs, cacheSavedSong, detailKey, detailQuery, libraryQuery } from './song-queries';
import { emptySongFields, type SongLibraryDetail } from '@/domains/catalog/song-workspace';
const song = (id = 'one'): SongLibraryDetail => ({ id, title: id, artist: 'artist', titleAlias: '', artistAlias: '', language: '', searchTags: [], imageUrl: '', mrCount: 0, selectedMR: null, hasLyrics: false, clipDuration: null, keyAdjustment: null, status: 'active', sourceType: 'admin', clips: 4, verifiedClips: 2, likeCount: 0, lastSungDate: null, updatedAt: '2026-11-15T00:00:00.000Z', createdAt: null, values: emptySongFields(), deleteReason: '' });
const create = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
describe('song workspace query cache', () => {
  it('updates just the saved record without fetching the library or erasing known statistics', async () => {
    const client = create(), original = song();
    client.setQueryData(libraryQuery('user-a').queryKey, { songs: [original, song('two')] });
    const saved = { ...original, titleAlias: 'new name', clips: 0, verifiedClips: 0, statsLoaded: false, updatedAt: '2026-11-15T01:00:00.000Z' };
    await cacheSavedSong(client, 'user-a', saved);
    expect(client.getQueryData(detailKey('user-a', 'one'))).toEqual(saved);
    const list = client.getQueryData(libraryQuery('user-a').queryKey)!;
    expect(list.songs[0]).toMatchObject({ titleAlias: 'new name', clips: 4, verifiedClips: 2 });
    expect(list.songs[0]).not.toHaveProperty('values');
    expect(list.songs[1].title).toBe('two');
    expect(client.isFetching()).toBe(0);
    client.clear();
  });
  it('recomputes collision flags and archive counts from authoritative save responses', async () => {
    const client = create();
    client.setQueryData(libraryQuery('scope').queryKey, { songs: [song(), song('two')] });
    await cacheSavedSong(client, 'scope', { ...song('two'), titleAlias: 'one' });
    expect(client.getQueryData(libraryQuery('scope').queryKey)!.songs.map(x => x.displayConflicts)).toEqual([1, 1]);
    await cacheSavedSong(client, 'scope', { ...song('two'), titleAlias: 'one', status: 'deleted' });
    expect(client.getQueryData(libraryQuery('scope').queryKey)!.songs.map(x => x.displayConflicts)).toEqual([0, 0]);
    client.clear();
  });
  it('shares fresh prefetch and open reads, without sharing different users caches', async () => {
    const client = create(); let requests = 0;
    const options = { ...detailQuery('a', 'one'), queryFn: async () => { requests++; return song(); } };
    await client.prefetchQuery(options);
    await client.fetchQuery(options);
    expect(requests).toBe(1);
    expect(client.getQueryData(detailKey('b', 'one'))).toBeUndefined();
    client.clear();
  });
  it('cancels a late list read before applying newer save data', async () => {
    const client = create();
    client.setQueryData(libraryQuery('scope').queryKey, { songs: [song()] });
    let finish!: (data: { songs: SongLibraryDetail[] }) => void;
    const late = client.fetchQuery({ ...libraryQuery('scope'), staleTime: 0, queryFn: () => new Promise<{ songs: SongLibraryDetail[] }>(resolve => { finish = resolve; }) }).catch(() => undefined);
    await cacheSavedSong(client, 'scope', { ...song(), titleAlias: 'saved' });
    finish({ songs: [song()] }); await late;
    expect(client.getQueryData(libraryQuery('scope').queryKey)!.songs[0].titleAlias).toBe('saved');
    client.clear();
  });
  it('updates bulk targets and expires only affected detail caches', async () => {
    const client = create();
    client.setQueryData(libraryQuery('scope').queryKey, { songs: [song(), song('two')] });
    for (const id of ['one', 'two']) client.setQueryData(detailKey('scope', id), song(id));
    await cacheBulkSongs(client, 'scope', { changed: ['one'], conflicts: [], updated: [{ ...song(), searchTags: ['tag'] }] });
    expect(client.getQueryData(libraryQuery('scope').queryKey)!.songs[0].searchTags).toEqual(['tag']);
    expect(client.getQueryData(detailKey('scope', 'one'))).toBeUndefined();
    expect(client.getQueryData(detailKey('scope', 'two'))).toBeDefined();
    client.clear();
  });
});
