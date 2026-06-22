'use client';

import { useQuery } from '@tanstack/react-query';

export interface LandingSong {
  id: string;
  title: string;
  artist: string;
  imageUrl: string | null;
  sungCount: number;
  language: string | null;
}

async function fetchLandingSongs(): Promise<LandingSong[]> {
  try {
    const res = await fetch('/api/landing-songs');
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.data?.songs as LandingSong[]) ?? [];
  } catch {
    return [];
  }
}

/** 랜딩 노래책 미리보기용 추천 곡 — 10분 캐시. */
export function useLandingSongs() {
  return useQuery({
    queryKey: ['landingSongs'],
    queryFn: fetchLandingSongs,
    staleTime: 10 * 60 * 1000,
  });
}
