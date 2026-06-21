'use client';

import { useQuery } from '@tanstack/react-query';
import type { VideoPlatform } from '@/shared/utils/video-url';

async function fetchClipTitle(
  platform: VideoPlatform,
  videoId: string
): Promise<string | null> {
  const res = await fetch(
    `/api/clips/title?platform=${platform}&videoId=${encodeURIComponent(videoId)}`
  );
  if (!res.ok) return null;
  const json = await res.json();
  return (json?.data?.title as string | undefined) ?? null;
}

/**
 * 클립의 실제 영상 제목을 가볍게 lazy-load (스트림 없이). facade 표시 중에만 받아오고,
 * 제목은 변하지 않으므로 무기한 캐시한다. 못 받으면 null → 호출부에서 메모로 폴백.
 */
export function useClipTitle(
  platform: VideoPlatform,
  videoId: string,
  enabled: boolean
): string | null {
  const query = useQuery({
    queryKey: ['clipTitle', platform, videoId],
    queryFn: () => fetchClipTitle(platform, videoId),
    enabled: enabled && !!videoId,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });
  return query.data ?? null;
}
