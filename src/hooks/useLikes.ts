'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'

/**
 * 좋아요 상태 관리 — TanStack Query 캐시 기반.
 * 캐시 형태: Record<songId, boolean>, 키는 사용자(channelId)별로 분리되어
 * 로그인 전환 시 자동으로 격리된다.
 *
 * 데이터는 항상 대량 로딩(useBulkLikes)으로 주입되고,
 * useLike는 캐시를 구독해 개별 곡 상태를 읽는다.
 */

type LikesMap = Record<string, boolean>

// 안정적인 빈 기본값. useQuery의 data가 없을 때 `= {}`로 매 렌더 새 객체를 만들면
// likesMap 참조가 매번 바뀌어, 이를 의존하는 메모/이펙트가 무한 갱신될 수 있다.
const EMPTY_LIKES: LikesMap = {}

const likesKey = (channelId: string | null) => ['likes', channelId ?? 'anonymous'] as const

/** SongSearch 등 외부 구독자를 위한 레거시 호환 이벤트 */
function emitLikesUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('likesUpdated'))
  }
}

function useLikesCache() {
  const { data: session } = useSession()
  const channelId = session?.user?.channelId ?? null
  const queryClient = useQueryClient()

  const { data: likesMap = EMPTY_LIKES } = useQuery<LikesMap>({
    queryKey: likesKey(channelId),
    // 실제 데이터는 loadLikes가 setQueryData로 병합 주입한다
    queryFn: () => ({}),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: !!channelId,
  })

  const mergeLikes = useCallback(
    (incoming: LikesMap) => {
      queryClient.setQueryData<LikesMap>(likesKey(channelId), (prev) => ({
        ...(prev ?? {}),
        ...incoming,
      }))
      emitLikesUpdated()
    },
    [queryClient, channelId],
  )

  return { channelId, likesMap, mergeLikes, queryClient }
}

interface UseLikeReturn {
  liked: boolean
  isLoading: boolean
  error: string | null
  toggleLike: () => Promise<void>
}

export function useLike(songId: string): UseLikeReturn {
  const { channelId, likesMap, mergeLikes } = useLikesCache()
  const [error, setError] = useState<string | null>(null)

  const liked = likesMap[songId] ?? false

  const mutation = useMutation({
    mutationFn: async (currentLiked: boolean) => {
      const response = currentLiked
        ? await fetch(`/api/likes?songId=${songId}`, { method: 'DELETE' })
        : await fetch('/api/likes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songId }),
          })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(
          data?.error?.message || (currentLiked ? '좋아요 취소에 실패했습니다' : '좋아요 추가에 실패했습니다'),
        )
      }
    },
    onMutate: async (currentLiked) => {
      // 낙관적 업데이트
      setError(null)
      mergeLikes({ [songId]: !currentLiked })
      return { previous: currentLiked }
    },
    onError: (err, _vars, context) => {
      // 실패 시 원래 상태로 롤백
      if (context) mergeLikes({ [songId]: context.previous })
      setError(err instanceof Error ? err.message : '네트워크 오류가 발생했습니다')
    },
  })

  const toggleLike = useCallback(async () => {
    if (!channelId) {
      setError('로그인이 필요합니다')
      return
    }
    await mutation.mutateAsync(liked).catch(() => {
      // 에러는 onError에서 처리됨
    })
  }, [channelId, liked, mutation])

  return {
    liked,
    isLoading: mutation.isPending,
    error,
    toggleLike,
  }
}

/** 여러 곡의 좋아요 상태를 한 번에 로딩해 캐시에 병합 */
export function useBulkLikes() {
  const { channelId, likesMap, mergeLikes } = useLikesCache()

  const loadLikes = useCallback(
    async (songIds: string[], _priority: 'high' | 'low' = 'low') => {
      if (!channelId || !songIds.length) return

      // 이미 캐시에 있는 곡은 제외
      const unloaded = songIds.filter((id) => !(id in likesMap))
      if (unloaded.length === 0) return

      try {
        const response = await fetch('/api/likes/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songIds: unloaded }),
        })

        if (response.ok) {
          const { data } = await response.json()
          mergeLikes(data.likes)
        } else {
          console.error('대량 좋아요 로딩 실패:', response.status)
        }
      } catch (error) {
        console.error('대량 좋아요 로딩 오류:', error)
      }
    },
    [channelId, likesMap, mergeLikes],
  )

  return { loadLikes }
}

/** 캐시에서 좋아요한 곡 ID 목록을 읽는다 (SongSearch의 필터링용) */
export function useLikes() {
  const { likesMap } = useLikesCache()

  const getLikedSongIds = useCallback((): string[] => {
    return Object.keys(likesMap).filter((id) => likesMap[id])
  }, [likesMap])

  return { getLikedSongIds }
}

interface UserLikesReturn {
  likes: unknown[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  pagination: {
    page: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  } | null
}

/** 프로필 화면의 좋아요 목록 (페이지네이션) */
export function useUserLikes(page: number = 1, limit: number = 20): UserLikesReturn {
  const { data: session } = useSession()
  const [likes, setLikes] = useState<unknown[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<UserLikesReturn['pagination']>(null)

  const fetchLikes = useCallback(async () => {
    if (!session?.user?.channelId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/user/likes?page=${page}&limit=${limit}`)
      const data = await response.json()

      if (response.ok) {
        setLikes(data.likes)
        setPagination(data.pagination)
      } else {
        setError(data.error?.message || data.error || '좋아요 목록을 불러오는데 실패했습니다')
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다')
      console.error('좋아요 목록 조회 오류:', err)
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.channelId, page, limit])

  useEffect(() => {
    fetchLikes()
  }, [fetchLikes])

  return {
    likes,
    isLoading,
    error,
    refresh: fetchLikes,
    pagination,
  }
}
