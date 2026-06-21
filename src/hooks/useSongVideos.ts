'use client';

import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import type { SongVideo } from '@/types';

/**
 * 곡별 클립(영상) 목록 메타데이터 — TanStack Query 캐시 기반.
 * 수제 fetch+useState를 대체해 자동 캐싱/중복제거/프리페치를 얻는다:
 *   - 같은 곡 재오픈 = 즉시(staleTime 내 캐시)
 *   - 카드 hover 시 prefetchSongVideos로 미리 적재
 * setSongVideos/loadSongVideos는 기존 prop 형태(Dispatch / () => Promise<void>)를
 * 유지해 SongDetailModal·LiveClipManager를 바꾸지 않고 그대로 쓴다.
 */

const EMPTY: SongVideo[] = [];

export const songVideosKey = (songId: string) =>
  ['songVideos', songId] as const;

async function fetchSongVideos(songId: string): Promise<SongVideo[]> {
  const res = await fetch(`/api/songs/${songId}/videos`);
  if (!res.ok) throw new Error('클립 목록을 불러오지 못했습니다.');
  const data = await res.json();
  return (data.videos ?? []) as SongVideo[];
}

const STALE = 5 * 60 * 1000; // 5분 — 재오픈 시 재요청 없이 즉시 표시

/** 카드 hover/워밍업 등에서 미리 받아 캐시에 적재 */
export function prefetchSongVideos(qc: QueryClient, songId: string) {
  if (!songId) return;
  void qc.prefetchQuery({
    queryKey: songVideosKey(songId),
    queryFn: () => fetchSongVideos(songId),
    staleTime: STALE,
  });
}

export function useSongVideos(songId: string, enabled: boolean) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: songVideosKey(songId),
    queryFn: () => fetchSongVideos(songId),
    enabled: enabled && !!songId,
    staleTime: STALE,
  });

  // LiveClipManager가 prev=>next 함수형 업데이트도 쓰므로 Dispatch 형태로 캐시를 갱신
  const setSongVideos = useCallback(
    (updater: SongVideo[] | ((prev: SongVideo[]) => SongVideo[])) => {
      qc.setQueryData<SongVideo[]>(songVideosKey(songId), (prev) =>
        typeof updater === 'function'
          ? (updater as (p: SongVideo[]) => SongVideo[])(prev ?? [])
          : updater
      );
    },
    [qc, songId]
  );

  // 클립 추가/편집/삭제 후 강제 새로고침
  const loadSongVideos = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    songVideos: query.data ?? EMPTY,
    // 첫 fetch가 끝나기 전(콜드 로딩 포함)까지 로딩 → 스켈레톤이 끊김 없이 표시된다.
    // (isLoading은 enabled 직후 한 틱 동안 false가 되어 그 순간 "빈 상태"가 잠깐 보임)
    videosLoading: enabled && !!songId && !query.isFetched,
    setSongVideos,
    loadSongVideos,
  };
}
