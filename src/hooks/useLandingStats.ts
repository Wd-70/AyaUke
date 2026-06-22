'use client';

import { useQuery } from '@tanstack/react-query';

export interface LandingStats {
  songCount: number;
  clipCount: number;
  vodCount: number;
  totalLiveHours: number;
  followerCount: number;
}

async function fetchLandingStats(): Promise<LandingStats | null> {
  try {
    const res = await fetch('/api/landing-stats');
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data as LandingStats) ?? null;
  } catch {
    return null;
  }
}

/** 랜딩 숫자 섹션용 집계 — 5분 캐시. */
export function useLandingStats() {
  return useQuery({
    queryKey: ['landingStats'],
    queryFn: fetchLandingStats,
    staleTime: 5 * 60 * 1000,
  });
}
