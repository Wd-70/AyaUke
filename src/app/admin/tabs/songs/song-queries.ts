'use client';
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { createSongKey } from '@/domains/catalog/merge';
import type { SongLibrary, SongLibraryDetail, SongLibraryItem } from '@/domains/catalog/song-workspace';
import { songRequest } from './SongWorkspaceUI';

export const libraryKey = (scope: string) => ['admin-song-library', scope] as const;
export const detailKey = (scope: string, id: string) => [...libraryKey(scope), 'detail', id] as const;
export const statsKey = (scope: string, id: string) => [...libraryKey(scope), 'stats', id] as const;
export const libraryQuery = (scope: string) => queryOptions({
  queryKey: [...libraryKey(scope), 'list'],
  queryFn: ({ signal }) => songRequest<SongLibrary>('/api/admin/song-library', { signal }),
  staleTime: 30000, gcTime: 10 * 60000, refetchOnWindowFocus: false, retry: 1,
});
export const detailQuery = (scope: string, id: string) => queryOptions({
  queryKey: detailKey(scope, id),
  queryFn: ({ signal }) => songRequest<SongLibraryDetail>(`/api/admin/song-library/${id}`, { signal }),
  staleTime: 30000, gcTime: 10 * 60000, refetchOnWindowFocus: false, retry: 1,
});
export const statsQuery = (scope: string, id: string) => queryOptions({
  queryKey: statsKey(scope, id),
  queryFn: ({ signal }) => songRequest<{ clips: number; verifiedClips: number }>(`/api/admin/song-library/${id}/stats`, { signal }),
  staleTime: 30000, gcTime: 10 * 60000, refetchOnWindowFocus: false, retry: 1,
});
export function reconcileLibrary(songs: SongLibraryItem[]) {
  const counts = new Map<string, number>();
  for (const song of songs) if (song.status !== 'deleted') {
    const key = createSongKey(song.titleAlias || song.title, song.artistAlias || song.artist);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return songs.map(song => ({ ...song, displayConflicts: song.status === 'deleted' ? 0 : Math.max(0, (counts.get(createSongKey(song.titleAlias || song.title, song.artistAlias || song.artist)) || 0) - 1) }));
}
export async function cacheSavedSong(client: QueryClient, scope: string, song: SongLibraryDetail) {
  // Cancel earlier reads before publishing the newer revision; never let a prefetch overwrite a save.
  await client.cancelQueries({ queryKey: libraryKey(scope) });
  client.setQueryData(detailKey(scope, song.id), song);
  client.setQueryData<SongLibrary>(libraryQuery(scope).queryKey, old => {
    if (!old) return old;
    const previous = old.songs.find(item => item.id === song.id);
    const { values: _values, deleteReason: _reason, statsLoaded, ...summary } = song;
    const next = { ...summary, ...(statsLoaded === false ? { clips: previous?.clips || 0, verifiedClips: previous?.verifiedClips || 0 } : {}) };
    return { songs: reconcileLibrary(previous ? old.songs.map(item => item.id === song.id ? next : item) : [...old.songs, next]) };
  });
}
export async function cacheBulkSongs(client: QueryClient, scope: string, result: { changed: string[]; conflicts: string[]; updated: SongLibraryItem[] }) {
  await client.cancelQueries({ queryKey: libraryKey(scope) });
  const updated = new Map(result.updated.map(song => [song.id, song]));
  client.setQueryData<SongLibrary>(libraryQuery(scope).queryKey, old => old ? ({ songs: reconcileLibrary(old.songs.map(song => {
    const next = updated.get(song.id);
    return next ? { ...next, clips: song.clips, verifiedClips: song.verifiedClips } : song;
  })) }) : old);
  for (const id of [...result.changed, ...result.conflicts]) client.removeQueries({ queryKey: detailKey(scope, id), exact: true });
  // Conflicting records need a real refresh; do not patch them using attempted changes.
  if (result.conflicts.length) await client.invalidateQueries({ queryKey: libraryQuery(scope).queryKey });
}
