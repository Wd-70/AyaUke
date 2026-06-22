'use client';

import { useQuery } from '@tanstack/react-query';
import type { ChzzkLiveStatus } from '@/domains/archive/chzzk.client';

async function fetchStatus(): Promise<ChzzkLiveStatus | null> {
  try {
    const res = await fetch('/api/stream-status');
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data as ChzzkLiveStatus) ?? null;
  } catch {
    return null;
  }
}

/** 아야우케 실시간 라이브 상태 — 1분 폴링. 실패 시 null(오프라인 취급). */
export function useLiveStatus() {
  return useQuery({
    queryKey: ['streamStatus'],
    queryFn: fetchStatus,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
