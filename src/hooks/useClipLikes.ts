'use client';

import { useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

/**
 * 클립 좋아요 — 곡 좋아요(useLikes)와 동일한 캐시 기반 패턴.
 * 캐시: Record<clipId, boolean>, 키는 사용자(channelId)별로 분리.
 * 좋아요 여부는 useBulkClipLikes로 대량 주입, useClipLike가 개별 구독.
 * (likeCount는 클립 데이터에서 받은 초기값을 토글 시 서버 응답으로 갱신)
 */

type LikesMap = Record<string, boolean>;
const EMPTY: LikesMap = {};

const clipLikesKey = (channelId: string | null) =>
  ['clipLikes', channelId ?? 'anonymous'] as const;

function useClipLikesCache() {
  const { data: session } = useSession();
  const channelId = session?.user?.channelId ?? null;
  const queryClient = useQueryClient();

  const { data: likesMap = EMPTY } = useQuery<LikesMap>({
    queryKey: clipLikesKey(channelId),
    queryFn: () => ({}),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: !!channelId,
  });

  const merge = useCallback(
    (incoming: LikesMap) => {
      queryClient.setQueryData<LikesMap>(clipLikesKey(channelId), (prev) => ({
        ...(prev ?? {}),
        ...incoming,
      }));
    },
    [queryClient, channelId],
  );

  return { channelId, likesMap, merge };
}

interface UseClipLikeReturn {
  liked: boolean;
  likeCount: number;
  isLoading: boolean;
  toggle: () => Promise<void>;
}

/** 개별 클립 좋아요 상태 + 카운트. initialCount는 클립 데이터의 likeCount. */
export function useClipLike(clipId: string, initialCount = 0): UseClipLikeReturn {
  const { channelId, likesMap, merge } = useClipLikesCache();
  const liked = likesMap[clipId] ?? false;
  const [count, setCount] = useState(initialCount);

  const mutation = useMutation({
    mutationFn: async (currentLiked: boolean) => {
      const res = currentLiked
        ? await fetch(`/api/clips/${clipId}/like`, { method: 'DELETE' })
        : await fetch(`/api/clips/${clipId}/like`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || '좋아요 처리에 실패했습니다');
      }
      const data = await res.json();
      return data?.data?.likeCount as number | undefined;
    },
    onMutate: (currentLiked) => {
      merge({ [clipId]: !currentLiked });
      setCount((c) => Math.max(0, c + (currentLiked ? -1 : 1)));
      return { previous: currentLiked, prevCount: count };
    },
    onSuccess: (serverCount) => {
      if (typeof serverCount === 'number') setCount(serverCount);
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        merge({ [clipId]: ctx.previous });
        setCount(ctx.prevCount);
      }
    },
  });

  const toggle = useCallback(async () => {
    if (!channelId) return; // 비로그인: 호출부에서 안내
    await mutation.mutateAsync(liked).catch(() => {});
  }, [channelId, liked, mutation]);

  return { liked, likeCount: count, isLoading: mutation.isPending, toggle };
}

/** 여러 클립의 좋아요 여부를 한 번에 로딩해 캐시에 병합 (다이얼로그 목록용) */
export function useBulkClipLikes() {
  const { channelId, likesMap, merge } = useClipLikesCache();

  const loadClipLikes = useCallback(
    async (clipIds: string[]) => {
      if (!channelId || clipIds.length === 0) return;
      const unloaded = clipIds.filter((id) => !(id in likesMap));
      if (unloaded.length === 0) return;

      try {
        const res = await fetch('/api/clips/likes/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clipIds: unloaded }),
        });
        if (res.ok) {
          const { data } = await res.json();
          merge(data.likes);
        }
      } catch (e) {
        console.error('클립 좋아요 대량 로딩 실패:', e);
      }
    },
    [channelId, likesMap, merge],
  );

  return { loadClipLikes };
}
