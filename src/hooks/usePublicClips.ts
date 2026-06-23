'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
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

  const clips = query.data?.pages.flatMap((p) => p.clips) ?? [];
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
