'use client';

import { useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

/**
 * 클립 개인 메모(나만 보는 노트) — 클립 좋아요(useClipLikes)와 동일한 캐시 기반 패턴.
 * - 카드 인디케이터용 "메모 보유 여부" 맵: Record<clipId, boolean> (useBulkClipMemos로 대량 주입)
 * - 다이얼로그용 개별 메모 텍스트: useClipMemo가 단건 조회/저장하며, 저장 시 보유 여부 맵도 갱신
 * 캐시 키는 사용자(channelId)별로 분리한다.
 */

type FlagMap = Record<string, boolean>;
const EMPTY: FlagMap = {};

const flagsKey = (channelId: string | null) => ['clipMemoFlags', channelId ?? 'anonymous'] as const;
const textKey = (channelId: string | null, clipId: string) =>
  ['clipMemo', channelId ?? 'anonymous', clipId] as const;

function useFlagsCache() {
  const { data: session } = useSession();
  const channelId = session?.user?.channelId ?? null;
  const queryClient = useQueryClient();

  const { data: flags = EMPTY } = useQuery<FlagMap>({
    queryKey: flagsKey(channelId),
    queryFn: () => ({}),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: !!channelId,
  });

  const mergeFlags = useCallback(
    (incoming: FlagMap) => {
      queryClient.setQueryData<FlagMap>(flagsKey(channelId), (prev) => ({ ...(prev ?? {}), ...incoming }));
    },
    [queryClient, channelId],
  );

  return { channelId, flags, mergeFlags };
}

/** 여러 클립의 메모 보유 여부를 한 번에 로딩해 캐시에 병합 (갤러리 카드 인디케이터용) */
export function useBulkClipMemos() {
  const { channelId, flags, mergeFlags } = useFlagsCache();

  const loadClipMemos = useCallback(
    async (clipIds: string[]) => {
      if (!channelId || clipIds.length === 0) return;
      const unloaded = clipIds.filter((id) => !(id in flags));
      if (unloaded.length === 0) return;
      try {
        const res = await fetch('/api/clips/memos/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clipIds: unloaded }),
        });
        if (res.ok) {
          const { data } = await res.json();
          mergeFlags(data.memos);
        }
      } catch (e) {
        console.error('클립 메모 대량 로딩 실패:', e);
      }
    },
    [channelId, flags, mergeFlags],
  );

  return { loadClipMemos, memoFlags: flags };
}

interface UseClipMemoReturn {
  text: string;
  hasMemo: boolean;
  isLoading: boolean;
  isSaving: boolean;
  save: (text: string) => Promise<void>;
}

/** 개별 클립의 내 메모 텍스트 + 저장. `enabled`가 true일 때만 서버에서 불러온다(다이얼로그 열림 시). */
export function useClipMemo(clipId: string, enabled = true): UseClipMemoReturn {
  const { channelId, mergeFlags } = useFlagsCache();
  const queryClient = useQueryClient();

  const { data: text = '', isLoading } = useQuery<string>({
    queryKey: textKey(channelId, clipId),
    queryFn: async () => {
      const res = await fetch(`/api/clips/${clipId}/memo`);
      if (!res.ok) throw new Error('메모를 불러오지 못했습니다');
      const { data } = await res.json();
      return (data?.text as string) ?? '';
    },
    staleTime: 60_000,
    enabled: !!channelId && !!clipId && enabled,
  });

  const mutation = useMutation({
    mutationFn: async (next: string) => {
      const res = await fetch(`/api/clips/${clipId}/memo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: next }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error?.message || '메모 저장에 실패했습니다');
      }
      const { data } = await res.json();
      return (data?.text as string) ?? '';
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(textKey(channelId, clipId), saved);
      mergeFlags({ [clipId]: saved.length > 0 });
    },
  });

  const save = useCallback(
    async (next: string) => {
      if (!channelId) return;
      await mutation.mutateAsync(next).catch(() => {});
    },
    [channelId, mutation],
  );

  return { text, hasMemo: text.length > 0, isLoading, isSaving: mutation.isPending, save };
}
