'use client';

import { useQuery } from '@tanstack/react-query';

export interface RecentVideo {
  id: number | string;
  title: string;
  thumbnail: string;
  duration: string;
  publishDate: string;
  viewCount: string;
  url: string;
}

async function fetchRecentVideos(): Promise<RecentVideo[]> {
  // 실패를 삼키지 않고 throw → React Query가 isError/재시도를 처리하게 한다.
  const res = await fetch('/api/chzzk-videos');
  if (!res.ok) throw new Error(`최근 다시보기 요청 실패 (${res.status})`);
  const json = await res.json();
  return (json?.videos as RecentVideo[]) ?? [];
}

/** 최근 다시보기 — 10분 캐시, 일시 오류는 2회까지 자동 재시도. */
export function useRecentVideos() {
  return useQuery({
    queryKey: ['recentVideos'],
    queryFn: fetchRecentVideos,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}
