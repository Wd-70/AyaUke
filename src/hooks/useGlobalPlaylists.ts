import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface PlaylistWithSongs {
  _id: string
  name: string
  description?: string
  coverImage?: string
  tags: string[]
  songCount: number
  songs: Array<{
    songId: string
    addedAt: string
    order: number
  }>
  createdAt: string
  updatedAt: string
}

interface CreatePlaylistData {
  name: string
  description?: string
  coverImage?: string
  tags?: string[]
}

// 전역 플레이리스트 스토어
class GlobalPlaylistsStore {
  private playlists: PlaylistWithSongs[] = []
  private isLoading = false
  private error: string | null = null
  private subscribers = new Set<() => void>()
  public lastFetch = 0
  private cacheTime = 30000 // 30초 캐시
  private hasInitialized = false // 초기화 여부
  private previousChannelId: string | null = null // 이전 채널 ID
  // 개별 곡별 작업 상태 관리 - songId -> Set<playlistId>
  private songOperations: Map<string, Set<string>> = new Map()

  subscribe(callback: () => void) {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  private notify() {
    this.subscribers.forEach(callback => callback())
  }

  getPlaylists(): PlaylistWithSongs[] {
    return this.playlists
  }

  getPlaylistsForSong(songId: string): Array<{ _id: string; name: string }> {
    return this.playlists
      .filter(playlist => playlist.songs.some(song => {
        // songId가 객체인 경우 (populate된 경우) _id 또는 toString() 사용
        // songId가 문자열인 경우 직접 비교
        const id = typeof song.songId === 'object' && song.songId?._id 
          ? song.songId._id 
          : song.songId?.toString() || song.songId
        return id === songId
      }))
      .map(playlist => ({ _id: playlist._id, name: playlist.name }))
  }

  getLoading(): boolean {
    return this.isLoading
  }

  getError(): string | null {
    return this.error
  }

  setPlaylists(playlists: PlaylistWithSongs[]) {
    this.playlists = playlists
    this.lastFetch = Date.now()
    // 로그인된 상태에서만 초기화 완료로 표시
    if (playlists.length > 0 || this.hasInitialized) {
      this.hasInitialized = true
    }
    this.notify()
  }

  // 로그인 상태 변경 시 초기화 상태 리셋
  resetInitialized() {
    this.hasInitialized = false
    this.lastFetch = 0
  }

  setLoading(loading: boolean) {
    this.isLoading = loading
    this.notify()
  }

  setError(error: string | null) {
    this.error = error
    this.notify()
  }

  shouldRefetch(): boolean {
    return Date.now() - this.lastFetch > this.cacheTime
  }

  isInitialized(): boolean {
    return this.hasInitialized
  }

  getPreviousChannelId(): string | null {
    return this.previousChannelId
  }

  setPreviousChannelId(channelId: string | null) {
    this.previousChannelId = channelId
  }

  // 개별 곡 작업 상태 관리
  setSongOperation(songId: string, playlistId: string, isOperating: boolean) {
    if (isOperating) {
      if (!this.songOperations.has(songId)) {
        this.songOperations.set(songId, new Set())
      }
      this.songOperations.get(songId)!.add(playlistId)
    } else {
      const operations = this.songOperations.get(songId)
      if (operations) {
        operations.delete(playlistId)
        if (operations.size === 0) {
          this.songOperations.delete(songId)
        }
      }
    }
    this.notify()
  }

  isSongOperating(songId: string, playlistId?: string): boolean {
    const operations = this.songOperations.get(songId)
    if (!operations) return false
    if (playlistId) {
      return operations.has(playlistId)
    }
    return operations.size > 0
  }

  // 플레이리스트에 곡 추가 (로컬 상태 업데이트)
  addSongToPlaylist(playlistId: string, songId: string) {
    const playlist = this.playlists.find(p => p._id === playlistId)
    if (playlist && !playlist.songs.some(s => s.songId === songId)) {
      playlist.songs.push({
        songId,
        addedAt: new Date().toISOString(),
        order: playlist.songs.length
      })
      playlist.songCount = playlist.songs.length
      this.notify()
    }
  }

  // 플레이리스트에서 곡 제거 (로컬 상태 업데이트)
  removeSongFromPlaylist(playlistId: string, songId: string) {
    const playlist = this.playlists.find(p => p._id === playlistId)
    if (playlist) {
      playlist.songs = playlist.songs.filter(s => s.songId !== songId)
      playlist.songCount = playlist.songs.length
      this.notify()
    }
  }

  // 새 플레이리스트 추가 (로컬 상태 업데이트)
  addPlaylist(playlist: PlaylistWithSongs) {
    this.playlists.unshift(playlist)
    this.notify()
  }

  // 플레이리스트 삭제 (로컬 상태 업데이트)
  removePlaylist(playlistId: string) {
    this.playlists = this.playlists.filter(p => p._id !== playlistId)
    this.notify()
  }
}

// 전역 스토어 인스턴스
const globalPlaylistsStore = new GlobalPlaylistsStore()

interface UseGlobalPlaylistsReturn {
  playlists: PlaylistWithSongs[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  createPlaylist: (data: CreatePlaylistData) => Promise<PlaylistWithSongs | null>
  deletePlaylist: (id: string) => Promise<boolean>
  addSongToPlaylist: (playlistId: string, songId: string) => Promise<boolean>
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<boolean>
  getPlaylistsForSong: (songId: string) => Array<{ _id: string; name: string }>
  isSongOperating: (songId: string, playlistId?: string) => boolean
}

export function useGlobalPlaylists(): UseGlobalPlaylistsReturn {
  const { data: session } = useSession()
  const [playlists, setPlaylists] = useState<PlaylistWithSongs[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 스토어 구독
  useEffect(() => {
    const unsubscribe = globalPlaylistsStore.subscribe(() => {
      setPlaylists(globalPlaylistsStore.getPlaylists())
      setIsLoading(globalPlaylistsStore.getLoading())
      setError(globalPlaylistsStore.getError())
    })

    // 초기 데이터 설정
    setPlaylists(globalPlaylistsStore.getPlaylists())
    setIsLoading(globalPlaylistsStore.getLoading())
    setError(globalPlaylistsStore.getError())

    return unsubscribe
  }, [])

  const fetchPlaylists = async () => {
    if (!session?.user?.channelId) {
      console.log('🔒 로그인되지 않은 상태 - 플레이리스트 로딩 건너뜀')
      globalPlaylistsStore.setPlaylists([])
      globalPlaylistsStore.setError(null)
      return
    }

    globalPlaylistsStore.setLoading(true)
    globalPlaylistsStore.setError(null)

    try {
      const response = await fetch(`/api/user/playlists?page=1&limit=100&includeSongs=false`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ 플레이리스트 로딩 성공:', data.playlists?.length || 0)
        console.log('🔍 플레이리스트 상세 정보:', data.playlists?.map(p => ({
          id: p._id,
          name: p.name,
          songCount: p.songCount,
          songsData: p.songs?.slice(0, 2) // 처음 2개 곡만 로그
        })))
        globalPlaylistsStore.setPlaylists(data.playlists || [])
      } else if (response.status === 401) {
        // 401 에러는 로그인 문제이므로 에러로 처리하지 않음
        console.log('🔒 인증 오류 - 플레이리스트 기능 비활성화')
        globalPlaylistsStore.setPlaylists([])
        globalPlaylistsStore.setError(null)
      } else {
        // 500 에러 등의 경우 빈 배열로 설정하고 에러 상태로 둠
        console.error('❌ 플레이리스트 API 오류:', response.status, response.statusText)
        globalPlaylistsStore.setPlaylists([])
        globalPlaylistsStore.setError(`플레이리스트 로딩 실패 (${response.status})`)
        // lastFetch를 업데이트해서 무한 재시도 방지
        globalPlaylistsStore.lastFetch = Date.now()
      }
    } catch (err) {
      console.error('❌ 플레이리스트 네트워크 오류:', err)
      globalPlaylistsStore.setPlaylists([])
      globalPlaylistsStore.setError('네트워크 오류가 발생했습니다')
      // lastFetch를 업데이트해서 무한 재시도 방지
      globalPlaylistsStore.lastFetch = Date.now()
    } finally {
      globalPlaylistsStore.setLoading(false)
    }
  }

  const createPlaylist = async (data: CreatePlaylistData): Promise<PlaylistWithSongs | null> => {
    if (!session?.user?.channelId) {
      globalPlaylistsStore.setError('로그인이 필요합니다')
      return null
    }

    try {
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('🎵 새 플레이리스트 생성 응답:', result.playlist)
        const newPlaylist = {
          ...result.playlist,
          // API에서 이미 올바른 songs와 songCount를 반환하므로 오버라이드하지 않음
        }
        globalPlaylistsStore.addPlaylist(newPlaylist)
        return newPlaylist
      } else {
        const result = await response.json()
        globalPlaylistsStore.setError(result.error || '플레이리스트 생성에 실패했습니다')
        return null
      }
    } catch (err) {
      globalPlaylistsStore.setError('네트워크 오류가 발생했습니다')
      console.error('플레이리스트 생성 오류:', err)
      return null
    }
  }

  const deletePlaylist = async (id: string): Promise<boolean> => {
    if (!session?.user?.channelId) {
      globalPlaylistsStore.setError('로그인이 필요합니다')
      return false
    }

    try {
      const response = await fetch(`/api/playlists/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        globalPlaylistsStore.removePlaylist(id)
        return true
      } else {
        const result = await response.json()
        globalPlaylistsStore.setError(result.error || '플레이리스트 삭제에 실패했습니다')
        return false
      }
    } catch (err) {
      globalPlaylistsStore.setError('네트워크 오류가 발생했습니다')
      console.error('플레이리스트 삭제 오류:', err)
      return false
    }
  }

  const addSongToPlaylist = async (playlistId: string, songId: string): Promise<boolean> => {
    if (!session?.user?.channelId) {
      globalPlaylistsStore.setError('로그인이 필요합니다')
      return false
    }

    // 개별 곡 작업 시작
    globalPlaylistsStore.setSongOperation(songId, playlistId, true)

    // 이미 플레이리스트에 있는지 확인
    const playlists = globalPlaylistsStore.getPlaylists()
    const playlist = playlists.find(p => p._id === playlistId)
    const isAlreadyInPlaylist = playlist?.songs.some(s => s.songId === songId)
    
    console.log('🔍 플레이리스트 중복 체크:', {
      playlistId,
      songId,
      playlistExists: !!playlist,
      playlistName: playlist?.name,
      currentSongs: playlist?.songs.map(s => s.songId) || [],
      isAlreadyInPlaylist
    });
    
    if (isAlreadyInPlaylist) {
      console.log('⚠️ 곡이 이미 플레이리스트에 있습니다:', songId)
      globalPlaylistsStore.setSongOperation(songId, playlistId, false)
      return true // 이미 있으면 성공으로 처리
    }

    // 낙관적 업데이트
    globalPlaylistsStore.addSongToPlaylist(playlistId, songId)

    try {
      const response = await fetch(`/api/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ songId })
      })

      if (response.ok) {
        console.log('플레이리스트에 곡 추가 성공:', songId)
        return true
      } else if (response.status === 409) {
        // 409는 이미 있다는 뜻이므로 에러로 처리하지 않음
        console.log('곡이 이미 플레이리스트에 있습니다 (서버):', songId)
        return true
      } else {
        // 실패 시 원래 상태로 되돌림
        globalPlaylistsStore.removeSongFromPlaylist(playlistId, songId)
        const result = await response.json()
        console.error('플레이리스트 추가 실패:', result.error)
        globalPlaylistsStore.setError(result.error || '플레이리스트에 추가하는데 실패했습니다')
        return false
      }
    } catch (err) {
      // 실패 시 원래 상태로 되돌림
      globalPlaylistsStore.removeSongFromPlaylist(playlistId, songId)
      globalPlaylistsStore.setError('네트워크 오류가 발생했습니다')
      console.error('플레이리스트 추가 오류:', err)
      return false
    } finally {
      // 작업 완료
      globalPlaylistsStore.setSongOperation(songId, playlistId, false)
    }
  }

  const removeSongFromPlaylist = async (playlistId: string, songId: string): Promise<boolean> => {
    if (!session?.user?.channelId) {
      globalPlaylistsStore.setError('로그인이 필요합니다')
      return false
    }

    // 개별 곡 작업 시작
    globalPlaylistsStore.setSongOperation(songId, playlistId, true)

    // 낙관적 업데이트 - 현재 상태 백업
    const playlist = globalPlaylistsStore.getPlaylists().find(p => p._id === playlistId)
    const originalSongs = playlist ? [...playlist.songs] : []
    
    globalPlaylistsStore.removeSongFromPlaylist(playlistId, songId)

    try {
      const response = await fetch(`/api/playlists/${playlistId}/songs?songId=${songId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        return true
      } else {
        // 실패 시 원래 상태로 되돌림
        if (playlist) {
          playlist.songs = originalSongs
          playlist.songCount = originalSongs.length
          globalPlaylistsStore.notify()
        }
        const result = await response.json()
        globalPlaylistsStore.setError(result.error || '플레이리스트에서 제거하는데 실패했습니다')
        return false
      }
    } catch (err) {
      // 실패 시 원래 상태로 되돌림
      if (playlist) {
        playlist.songs = originalSongs
        playlist.songCount = originalSongs.length
        globalPlaylistsStore.notify()
      }
      globalPlaylistsStore.setError('네트워크 오류가 발생했습니다')
      console.error('플레이리스트 제거 오류:', err)
      return false
    } finally {
      // 작업 완료
      globalPlaylistsStore.setSongOperation(songId, playlistId, false)
    }
  }

  // 세션이 있고 데이터가 없거나 오래된 경우 자동 로딩 (전역 상태로 중복 실행 방지)
  useEffect(() => {
    const currentChannelId = session?.user?.channelId || null
    const previousChannelId = globalPlaylistsStore.getPreviousChannelId()
    
    // 로그인 상태가 변경된 경우에만 처리 (전역 상태 확인)
    if (previousChannelId !== currentChannelId) {
      console.log('🔄 로그인 상태 변경 감지 (전역):', {
        previous: previousChannelId,
        current: currentChannelId
      })
      
      if (currentChannelId) {
        // 로그인된 경우: 초기화 상태 리셋 후 플레이리스트 로딩
        globalPlaylistsStore.resetInitialized()
        console.log('🔄 로그인 완료 - 플레이리스트 로딩 시작 (1회)')
        fetchPlaylists()
      } else {
        // 로그아웃된 경우: 플레이리스트 초기화
        console.log('🔒 로그아웃 - 플레이리스트 초기화')
        globalPlaylistsStore.setPlaylists([])
        globalPlaylistsStore.setError(null)
        globalPlaylistsStore.resetInitialized()
      }
      
      globalPlaylistsStore.setPreviousChannelId(currentChannelId)
    } else if (currentChannelId) {
      // 로그인 상태가 동일하고 로그인된 경우: 필요시에만 재로딩
      const isCurrentlyLoading = globalPlaylistsStore.getLoading()
      const isInitialized = globalPlaylistsStore.isInitialized()
      const shouldRefetch = globalPlaylistsStore.shouldRefetch()
      
      if (!isCurrentlyLoading && (!isInitialized || shouldRefetch)) {
        console.log('🔄 플레이리스트 재로딩 (필요 시):', {
          isInitialized,
          shouldRefetch,
          channelId: currentChannelId
        })
        fetchPlaylists()
      }
    }
  }, [session?.user?.channelId]) // previousChannelId는 의존성에서 제거 (전역 상태이므로)

  return {
    playlists,
    isLoading,
    error,
    refresh: fetchPlaylists,
    createPlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    getPlaylistsForSong: globalPlaylistsStore.getPlaylistsForSong.bind(globalPlaylistsStore),
    isSongOperating: globalPlaylistsStore.isSongOperating.bind(globalPlaylistsStore)
  }
}

// 특정 곡의 플레이리스트만 필요한 경우를 위한 간단한 훅
export function useSongPlaylists(songId: string) {
  const { getPlaylistsForSong } = useGlobalPlaylists()
  
  return {
    playlists: getPlaylistsForSong(songId)
  }
}