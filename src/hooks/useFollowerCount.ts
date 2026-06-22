'use client';

import { useQuery } from '@tanstack/react-query';

async function fetchFollowerCount(): Promise<number | null> {
  try {
    const res = await fetch('/api/channel-follower');
    if (!res.ok) return null;
    const json = await res.json();
    const fc = json?.data?.followerCount;
    return typeof fc === 'number' ? fc : null;
  } catch {
    return null;
  }
}

/** 치지직 팔로워 수 — 1분 폴링(거의 실시간). 실패 시 null. */
export function useFollowerCount() {
  return useQuery({
    queryKey: ['followerCount'],
    queryFn: fetchFollowerCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
