'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { PublicClipSummary } from '@/domains/archive/clip.service';

export interface ClipsFilters {
  sort: 'popular' | 'mostPlayed' | 'recent';
  platform: 'all' | 'youtube' | 'chzzk';
  verified: boolean;
  q: string;
}

interface ClipsPage {
  clips: PublicClipSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
}

async function fetchClips(filters: ClipsFilters, page: number): Promise<ClipsPage> {
  const params = new URLSearchParams({
    sort: filters.sort,
    platform: filters.platform,
    page: String(page),
  });
  if (filters.verified) params.set('verified', 'true');
  if (filters.q.trim()) params.set('q', filters.q.trim());

  const res = await fetch(`/api/clips?${params.toString()}`);
  if (!res.ok) throw new Error('클립 목록을 불러오지 못했습니다');
  const { data } = await res.json();
  return data as ClipsPage;
}

/** 공개 클립 갤러리 — 무한 스크롤. 필터가 바뀌면 새 쿼리키로 리셋. */
export function usePublicClips(filters: ClipsFilters) {
  const query = useInfiniteQuery({
    queryKey: ['publicClips', filters],
    queryFn: ({ pageParam }) => fetchClips(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    staleTime: 60 * 1000,
  });

  // 페이지 경계의 동률/데이터 변동으로 중복이 섞여도 키 충돌이 없도록 id 기준 중복 제거
  const seen = new Set<string>();
  const clips = (query.data?.pages.flatMap((p) => p.clips) ?? []).filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  const total = query.data?.pages[0]?.pagination.total ?? 0;

  return {
    clips,
    total,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}

type IndexFilters = Omit<ClipsFilters, 'q'>;

/**
 * 검색 모드용 전체 클립 — 노래책처럼 클라이언트에서 isTextMatch로 즉시 필터링하기 위함.
 * `enabled`(검색어 입력 시)일 때만 로딩한다. 정렬/플랫폼/검증 변경 시 새로 받는다.
 */
export function useAllClips(filters: IndexFilters, enabled: boolean) {
  const query = useQuery({
    queryKey: ['publicClipsAll', filters],
    queryFn: async () => {
      const params = new URLSearchParams({ sort: filters.sort, platform: filters.platform });
      if (filters.verified) params.set('verified', 'true');
      const res = await fetch(`/api/clips/all?${params.toString()}`);
      if (!res.ok) throw new Error('클립 목록을 불러오지 못했습니다');
      const { data } = await res.json();
      return data.clips as PublicClipSummary[];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  return {
    allClips: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
