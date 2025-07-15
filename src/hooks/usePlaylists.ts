import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface Playlist {
  _id: string
  name: string
  description?: string
  coverImage?: string
  tags: string[]
  songCount: number
  songs?: unknown[]
  createdAt: string
  updatedAt: string
}

interface CreatePlaylistData {
  name: string
  description?: string
  coverImage?: string
  tags?: string[]
}

interface UpdatePlaylistData extends CreatePlaylistData {
  // 업데이트 시 추가 필드가 있을 수 있음
}

interface UsePlaylistsReturn {
  playlists: Playlist[]
  isLoading: boolean
  error: string | null
  createPlaylist: (data: CreatePlaylistData) => Promise<Playlist | null>
  updatePlaylist: (id: string, data: UpdatePlaylistData) => Promise<Playlist | null>
  deletePlaylist: (id: string) => Promise<boolean>
  refresh: () => Promise<void>
  pagination: {
    page: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  } | null
}

export function usePlaylists(page: number = 1, limit: number = 10, includeSongs: boolean = false): UsePlaylistsReturn {
  const { data: session } = useSession()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<unknown>(null)

  const fetchPlaylists = async () => {
    if (!session?.user?.channelId) return

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        includeSongs: includeSongs.toString()
      })

      const response = await fetch(`/api/user/playlists?${params}`)
      
      if (response.ok) {
        const data = await response.json()
        setPlaylists(data.playlists)
        setPagination(data.pagination)
      } else {
        const data = await response.json()
        setError(data.error || '플레이리스트 목록을 불러오는데 실패했습니다')
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다')
      console.error('플레이리스트 목록 조회 오류:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const createPlaylist = async (data: CreatePlaylistData): Promise<Playlist | null> => {
    if (!session?.user?.channelId) {
      setError('로그인이 필요합니다')
      return null
    }

    setError(null)

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
        await fetchPlaylists() // 목록 새로고침
        return result.playlist
      } else {
        const result = await response.json()
        setError(result.error || '플레이리스트 생성에 실패했습니다')
        return null
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다')
      console.error('플레이리스트 생성 오류:', err)
      return null
    }
  }

  const updatePlaylist = async (id: string, data: UpdatePlaylistData): Promise<Playlist | null> => {
    if (!session?.user?.channelId) {
      setError('로그인이 필요합니다')
      return null
    }

    setError(null)

    try {
      const response = await fetch(`/api/playlists/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (response.ok) {
        const result = await response.json()
        await fetchPlaylists() // 목록 새로고침
        return result.playlist
      } else {
        const result = await response.json()
        setError(result.error || '플레이리스트 수정에 실패했습니다')
        return null
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다')
      console.error('플레이리스트 수정 오류:', err)
      return null
    }
  }

  const deletePlaylist = async (id: string): Promise<boolean> => {
    if (!session?.user?.channelId) {
      setError('로그인이 필요합니다')
      return false
    }

    setError(null)

    try {
      const response = await fetch(`/api/playlists/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchPlaylists() // 목록 새로고침
        return true
      } else {
        const result = await response.json()
        setError(result.error || '플레이리스트 삭제에 실패했습니다')
        return false
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다')
      console.error('플레이리스트 삭제 오류:', err)
      return false
    }
  }

  useEffect(() => {
    fetchPlaylists()
  }, [session, page, limit, includeSongs])

  return {
    playlists,
    isLoading,
    error,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    refresh: fetchPlaylists,
    pagination
  }
}

interface UsePlaylistReturn {
  playlist: Playlist | null
  isLoading: boolean
  error: string | null
  addSong: (songId: string) => Promise<boolean>
  removeSong: (songId: string) => Promise<boolean>
  reorderSongs: (songs: { songId: string }[]) => Promise<boolean>
  refresh: () => Promise<void>
}

export function usePlaylist(playlistId: string): UsePlaylistReturn {
  const { data: session } = useSession()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPlaylist = async () => {
    if (!session?.user?.channelId || !playlistId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/playlists/${playlistId}`)
      
      if (response.ok) {
        const data = await response.json()
        setPlaylist(data.playlist)
      } else {
        const data = await response.json()
        setError(data.error || '플레이리스트를 불러오는데 실패했습니다')
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다')
      console.error('플레이리스트 조회 오류:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const addSong = async (songId: string): Promise<boolean> => {
    if (!session?.user?.channelId) {
      setError('로그인이 필요합니다')
      return false
    }

    setError(null)

    try {
      const response = await fetch(`/api/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ songId })
      })

      if (response.ok) {
        const result = await response.json()
        setPlaylist(result.playlist)
        return true
      } else {
        const result = await response.json()
        setError(result.error || '곡 추가에 실패했습니다')
        return false
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다')
      console.error('곡 추가 오류:', err)
      return false
    }
  }

  const removeSong = async (songId: string): Promise<boolean> => {
    if (!session?.user?.channelId) {
      setError('로그인이 필요합니다')
      return false
    }

    setError(null)

    try {
      const response = await fetch(`/api/playlists/${playlistId}/songs?songId=${songId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const result = await response.json()
        setPlaylist(result.playlist)
        return true
      } else {
        const result = await response.json()
        setError(result.error || '곡 삭제에 실패했습니다')
        return false
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다')
      console.error('곡 삭제 오류:', err)
      return false
    }
  }

  const reorderSongs = async (songs: { songId: string }[]): Promise<boolean> => {
    if (!session?.user?.channelId) {
      setError('로그인이 필요합니다')
      return false
    }

    setError(null)

    try {
      const response = await fetch(`/api/playlists/${playlistId}/songs`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ songs })
      })

      if (response.ok) {
        const result = await response.json()
        setPlaylist(result.playlist)
        return true
      } else {
        const result = await response.json()
        setError(result.error || '곡 순서 변경에 실패했습니다')
        return false
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다')
      console.error('곡 순서 변경 오류:', err)
      return false
    }
  }

  useEffect(() => {
    fetchPlaylist()
  }, [session, playlistId])

  return {
    playlist,
    isLoading,
    error,
    addSong,
    removeSong,
    reorderSongs,
    refresh: fetchPlaylist
  }
}