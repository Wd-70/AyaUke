import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

// 전역 상태 관리를 위한 간단한 store
class LikesStore {
  private likes: Map<string, boolean> = new Map()
  private loading: Set<string> = new Set()
  private subscribers: Map<string, Set<() => void>> = new Map()
  private bulkLoadPromise: Promise<void> | null = null

  setLike(songId: string, liked: boolean) {
    this.likes.set(songId, liked)
    this.notifySubscribers(songId)
    // 전역 이벤트 발생
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('likesUpdated'))
    }
  }

  getLike(songId: string): boolean | undefined {
    return this.likes.get(songId)
  }

  setLoading(songId: string, loading: boolean) {
    if (loading) {
      this.loading.add(songId)
    } else {
      this.loading.delete(songId)
    }
    this.notifySubscribers(songId)
  }

  isLoading(songId: string): boolean {
    return this.loading.has(songId)
  }

  subscribe(songId: string, callback: () => void) {
    if (!this.subscribers.has(songId)) {
      this.subscribers.set(songId, new Set())
    }
    this.subscribers.get(songId)!.add(callback)

    return () => {
      const songSubscribers = this.subscribers.get(songId)
      if (songSubscribers) {
        songSubscribers.delete(callback)
        if (songSubscribers.size === 0) {
          this.subscribers.delete(songId)
        }
      }
    }
  }

  private notifySubscribers(songId: string) {
    const songSubscribers = this.subscribers.get(songId)
    if (songSubscribers) {
      songSubscribers.forEach(callback => callback())
    }
  }

  // bulk 데이터를 직접 설정
  setBulkLikes(likesData: Record<string, boolean>) {
    Object.entries(likesData).forEach(([songId, liked]) => {
      this.likes.set(songId, liked)
      this.notifySubscribers(songId)
    })
    // 전역 이벤트 발생
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('likesUpdated'))
    }
  }

  // 좋아요한 곡 ID들 반환
  getLikedSongIds(): string[] {
    const likedIds: string[] = []
    this.likes.forEach((liked, songId) => {
      if (liked) {
        likedIds.push(songId)
      }
    })
    return likedIds
  }

  // 대량 로딩 (중복 방지)
  async bulkLoadLikes(songIds: string[], priority: 'high' | 'low' = 'low'): Promise<void> {
    if (this.bulkLoadPromise && priority === 'low') {
      // 낮은 우선순위 요청이고 이미 진행 중인 요청이 있으면 기다림
      await this.bulkLoadPromise
    }

    // 아직 로딩되지 않은 곡들만 필터링
    const unloadedSongIds = songIds.filter(id => !this.likes.has(id))
    
    if (unloadedSongIds.length === 0) {
      console.log(`⏭️ 모든 곡이 이미 로딩됨: ${songIds.length}곡`)
      return
    }

    // 동일한 요청이 진행 중인지 확인 (songIds 배열을 문자열로 변환하여 비교)
    const requestKey = unloadedSongIds.sort().join(',')
    if (this.bulkLoadPromise) {
      console.log(`⌛ 동일한 대량 로딩 요청 대기 중: ${unloadedSongIds.length}곡`)
      await this.bulkLoadPromise
      return
    }

    console.log(`🔄 대량 좋아요 로딩 시작 (${priority}): ${unloadedSongIds.length}곡`)

    this.bulkLoadPromise = this.performBulkLoad(unloadedSongIds)
    await this.bulkLoadPromise
    this.bulkLoadPromise = null
  }

  private async performBulkLoad(songIds: string[]): Promise<void> {
    try {
      const response = await fetch('/api/likes-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ songIds })
      })

      if (response.ok) {
        const data = await response.json()
        
        // 결과를 store에 저장하고 모든 관련 구독자에게 알림
        Object.entries(data.likes).forEach(([songId, liked]) => {
          this.likes.set(songId, liked as boolean)
          this.notifySubscribers(songId)
        })

        // 전역 이벤트 발생
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('likesUpdated'))
        }

        console.log(`✅ 대량 좋아요 로딩 완료: ${Object.keys(data.likes).length}곡`)
      } else {
        console.error('대량 좋아요 로딩 실패:', response.status)
      }
    } catch (error) {
      console.error('대량 좋아요 로딩 오류:', error)
    }
  }

  reset() {
    this.likes.clear()
    this.loading.clear()
    this.subscribers.clear()
    this.bulkLoadPromise = null
  }
}

const likesStore = new LikesStore()

// 전역 이벤트 리스너 설정 (플레이리스트에서 bulk 데이터 수신)
if (typeof window !== 'undefined') {
  window.addEventListener('likesLoaded', (event: CustomEvent) => {
    const { likes } = event.detail
    console.log('📨 좋아요 bulk 데이터 수신:', likes)
    likesStore.setBulkLikes(likes)
  })
}

interface UseLikeReturn {
  liked: boolean
  isLoading: boolean
  error: string | null
  toggleLike: () => Promise<void>
}

export function useLike(songId: string): UseLikeReturn {
  const { data: session } = useSession()
  const [updateCounter, setUpdateCounter] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  // 강제 업데이트 함수
  const forceUpdate = useCallback(() => {
    if (mounted.current) {
      setUpdateCounter(prev => prev + 1)
    }
  }, [])

  // 컴포넌트 언마운트 시 cleanup
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // 세션 변경 시 store 리셋 (다른 사용자로 변경된 경우에만)
  const prevChannelIdRef = useRef<string | null>(null)
  useEffect(() => {
    const currentChannelId = session?.user?.channelId || null
    
    // 이전 channelId가 있었는데 다른 사용자로 변경된 경우에만 리셋
    if (prevChannelIdRef.current && prevChannelIdRef.current !== currentChannelId) {
      console.log('🔄 사용자 변경 감지, store 리셋:', prevChannelIdRef.current, '->', currentChannelId)
      likesStore.reset()
    }
    
    prevChannelIdRef.current = currentChannelId
  }, [session?.user?.channelId])

  // store 구독 - UI 업데이트를 위해 필요
  useEffect(() => {
    if (!songId) return

    const unsubscribe = likesStore.subscribe(songId, forceUpdate)

    return unsubscribe
  }, [songId, forceUpdate])

  // 개별 API 호출 제거 - 오직 대량 로딩에만 의존

  const toggleLike = async () => {
    if (!session?.user?.channelId) {
      setError('로그인이 필요합니다')
      return
    }

    const currentLiked = likesStore.getLike(songId) || false
    const newLikedState = !currentLiked
    
    // 즉시 UI 반영 (낙관적 업데이트)
    likesStore.setLike(songId, newLikedState)
    likesStore.setLoading(songId, true)
    setError(null)

    try {
      if (currentLiked) {
        // 좋아요 취소
        const response = await fetch(`/api/likes?songId=${songId}`, {
          method: 'DELETE'
        })

        if (!response.ok) {
          // 실패 시 원래 상태로 되돌림
          likesStore.setLike(songId, currentLiked)
          const data = await response.json()
          setError(data.error || '좋아요 취소에 실패했습니다')
        }
      } else {
        // 좋아요 추가
        const response = await fetch('/api/likes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ songId })
        })

        if (!response.ok) {
          // 실패 시 원래 상태로 되돌림
          likesStore.setLike(songId, currentLiked)
          const data = await response.json()
          setError(data.error || '좋아요 추가에 실패했습니다')
        }
      }
    } catch (err) {
      // 오류 시 원래 상태로 되돌림
      likesStore.setLike(songId, currentLiked)
      setError('네트워크 오류가 발생했습니다')
      console.error('좋아요 토글 오류:', err)
    } finally {
      likesStore.setLoading(songId, false)
    }
  }

  return {
    liked: likesStore.getLike(songId) || false,
    isLoading: likesStore.isLoading(songId),
    error,
    toggleLike
  }
}

// 대량 좋아요 로딩을 위한 훅
export function useBulkLikes() {
  const { data: session } = useSession()

  const loadLikes = useCallback(async (songIds: string[], priority: 'high' | 'low' = 'low') => {
    if (!session?.user?.channelId || !songIds.length) {
      console.log('🚫 좋아요 로딩 건너뜀:', { 
        hasSession: !!session?.user?.channelId, 
        songCount: songIds.length 
      })
      return
    }

    await likesStore.bulkLoadLikes(songIds, priority)
  }, [session?.user?.channelId])

  return { loadLikes }
}

// 좋아요 관련 정보를 가져오는 훅
export function useLikes() {
  const getLikedSongIds = useCallback(() => {
    return likesStore.getLikedSongIds()
  }, [])

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

export function useUserLikes(page: number = 1, limit: number = 20): UserLikesReturn {
  const { data: session } = useSession()
  const [likes, setLikes] = useState<unknown[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<unknown>(null)

  const fetchLikes = async () => {
    if (!session?.user?.channelId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/user/likes?page=${page}&limit=${limit}`)
      
      if (response.ok) {
        const data = await response.json()
        setLikes(data.likes)
        setPagination(data.pagination)
      } else {
        const data = await response.json()
        setError(data.error || '좋아요 목록을 불러오는데 실패했습니다')
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다')
      console.error('좋아요 목록 조회 오류:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLikes()
  }, [session, page, limit])

  return {
    likes,
    isLoading,
    error,
    refresh: fetchLikes,
    pagination
  }
}