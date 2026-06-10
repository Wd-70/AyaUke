'use client'

import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'

/**
 * 사용자 플레이리스트 전역 상태 — TanStack Query 캐시 기반.
 * (구 수제 GlobalPlaylistsStore 509줄을 대체)
 */

interface PlaylistWithSongs {
  _id: string
  name: string
  description?: string
  coverImage?: string
  tags: string[]
  songCount: number
  songs: Array<{
    songId: string | { _id: string }
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

const playlistsKey = (channelId: string | null) => ['playlists', channelId ?? 'anonymous'] as const

/** 진행 중인 곡↔플레이리스트 작업 추적용 캐시 키 */
const OPS_KEY = ['playlist-ops'] as const
type OpsMap = Record<string, string[]> // songId -> playlistIds

function songIdOf(entry: PlaylistWithSongs['songs'][number]): string {
  const id = entry.songId
  return typeof id === 'object' && id?._id ? id._id : String(id)
}

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
  const channelId = session?.user?.channelId ?? null
  const queryClient = useQueryClient()
  const [mutationError, setMutationError] = useState<string | null>(null)

  const query = useQuery<PlaylistWithSongs[]>({
    queryKey: playlistsKey(channelId),
    queryFn: async () => {
      const response = await fetch('/api/user/playlists?page=1&limit=100&includeSongs=false')
      if (response.status === 401) return [] // 인증 문제는 빈 목록으로 처리
      if (!response.ok) throw new Error(`플레이리스트 로딩 실패 (${response.status})`)
      const data = await response.json()
      return data.playlists || []
    },
    enabled: !!channelId,
  })

  const playlists = query.data ?? []

  /** 캐시 직접 갱신 헬퍼 */
  const updateCache = useCallback(
    (updater: (prev: PlaylistWithSongs[]) => PlaylistWithSongs[]) => {
      queryClient.setQueryData<PlaylistWithSongs[]>(playlistsKey(channelId), (prev) =>
        updater(prev ?? []),
      )
    },
    [queryClient, channelId],
  )

  // 곡별 진행 중 작업 추적 (스피너 표시용)
  const { data: ops = {} } = useQuery<OpsMap>({
    queryKey: OPS_KEY,
    queryFn: () => ({}),
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const setSongOperation = useCallback(
    (songId: string, playlistId: string, operating: boolean) => {
      queryClient.setQueryData<OpsMap>(OPS_KEY, (prev = {}) => {
        const current = new Set(prev[songId] ?? [])
        if (operating) current.add(playlistId)
        else current.delete(playlistId)
        const next = { ...prev }
        if (current.size > 0) next[songId] = [...current]
        else delete next[songId]
        return next
      })
    },
    [queryClient],
  )

  const isSongOperating = useCallback(
    (songId: string, playlistId?: string): boolean => {
      const current = ops[songId]
      if (!current) return false
      return playlistId ? current.includes(playlistId) : current.length > 0
    },
    [ops],
  )

  const createMutation = useMutation({
    mutationFn: async (data: CreatePlaylistData) => {
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error?.message || '플레이리스트 생성에 실패했습니다')
      }
      return result.playlist as PlaylistWithSongs
    },
    onSuccess: (playlist) => {
      updateCache((prev) => [playlist, ...prev])
    },
    onError: (err) => setMutationError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/playlists/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.error?.message || '플레이리스트 삭제에 실패했습니다')
      }
      return id
    },
    onSuccess: (id) => {
      updateCache((prev) => prev.filter((p) => p._id !== id))
    },
    onError: (err) => setMutationError(err.message),
  })

  const addSongToPlaylist = useCallback(
    async (playlistId: string, songId: string): Promise<boolean> => {
      if (!channelId) {
        setMutationError('로그인이 필요합니다')
        return false
      }

      const playlist = playlists.find((p) => p._id === playlistId)
      if (playlist?.songs.some((s) => songIdOf(s) === songId)) {
        return true // 이미 있으면 성공으로 처리
      }

      setSongOperation(songId, playlistId, true)

      // 낙관적 업데이트
      updateCache((prev) =>
        prev.map((p) =>
          p._id === playlistId
            ? {
                ...p,
                songs: [...p.songs, { songId, addedAt: new Date().toISOString(), order: p.songs.length }],
                songCount: p.songs.length + 1,
              }
            : p,
        ),
      )

      try {
        const response = await fetch(`/api/playlists/${playlistId}/songs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId }),
        })

        if (response.ok || response.status === 409) return true

        // 실패 시 롤백
        updateCache((prev) =>
          prev.map((p) =>
            p._id === playlistId
              ? {
                  ...p,
                  songs: p.songs.filter((s) => songIdOf(s) !== songId),
                  songCount: p.songs.filter((s) => songIdOf(s) !== songId).length,
                }
              : p,
          ),
        )
        const result = await response.json().catch(() => null)
        setMutationError(result?.error?.message || '플레이리스트에 추가하는데 실패했습니다')
        return false
      } catch (err) {
        updateCache((prev) =>
          prev.map((p) =>
            p._id === playlistId
              ? {
                  ...p,
                  songs: p.songs.filter((s) => songIdOf(s) !== songId),
                  songCount: p.songs.filter((s) => songIdOf(s) !== songId).length,
                }
              : p,
          ),
        )
        setMutationError('네트워크 오류가 발생했습니다')
        console.error('플레이리스트 추가 오류:', err)
        return false
      } finally {
        setSongOperation(songId, playlistId, false)
      }
    },
    [channelId, playlists, updateCache, setSongOperation],
  )

  const removeSongFromPlaylist = useCallback(
    async (playlistId: string, songId: string): Promise<boolean> => {
      if (!channelId) {
        setMutationError('로그인이 필요합니다')
        return false
      }

      setSongOperation(songId, playlistId, true)

      const original = playlists.find((p) => p._id === playlistId)
      const originalSongs = original ? [...original.songs] : []

      // 낙관적 업데이트
      updateCache((prev) =>
        prev.map((p) =>
          p._id === playlistId
            ? {
                ...p,
                songs: p.songs.filter((s) => songIdOf(s) !== songId),
                songCount: p.songs.filter((s) => songIdOf(s) !== songId).length,
              }
            : p,
        ),
      )

      try {
        const response = await fetch(`/api/playlists/${playlistId}/songs?songId=${songId}`, {
          method: 'DELETE',
        })

        if (response.ok) return true

        // 실패 시 롤백
        updateCache((prev) =>
          prev.map((p) =>
            p._id === playlistId ? { ...p, songs: originalSongs, songCount: originalSongs.length } : p,
          ),
        )
        const result = await response.json().catch(() => null)
        setMutationError(result?.error?.message || '플레이리스트에서 제거하는데 실패했습니다')
        return false
      } catch (err) {
        updateCache((prev) =>
          prev.map((p) =>
            p._id === playlistId ? { ...p, songs: originalSongs, songCount: originalSongs.length } : p,
          ),
        )
        setMutationError('네트워크 오류가 발생했습니다')
        console.error('플레이리스트 제거 오류:', err)
        return false
      } finally {
        setSongOperation(songId, playlistId, false)
      }
    },
    [channelId, playlists, updateCache, setSongOperation],
  )

  const getPlaylistsForSong = useCallback(
    (songId: string): Array<{ _id: string; name: string }> => {
      return playlists
        .filter((playlist) => playlist.songs.some((song) => songIdOf(song) === songId))
        .map((playlist) => ({ _id: playlist._id, name: playlist.name }))
    },
    [playlists],
  )

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: playlistsKey(channelId) })
  }, [queryClient, channelId])

  return {
    playlists,
    isLoading: query.isLoading,
    error: mutationError ?? (query.error ? query.error.message : null),
    refresh,
    createPlaylist: async (data) => {
      try {
        return await createMutation.mutateAsync(data)
      } catch {
        return null
      }
    },
    deletePlaylist: async (id) => {
      try {
        await deleteMutation.mutateAsync(id)
        return true
      } catch {
        return false
      }
    },
    addSongToPlaylist,
    removeSongFromPlaylist,
    getPlaylistsForSong,
    isSongOperating,
  }
}

/** 특정 곡이 속한 플레이리스트만 필요한 경우의 간단한 훅 */
export function useSongPlaylists(songId: string) {
  const { getPlaylistsForSong } = useGlobalPlaylists()

  return {
    playlists: getPlaylistsForSong(songId),
  }
}
