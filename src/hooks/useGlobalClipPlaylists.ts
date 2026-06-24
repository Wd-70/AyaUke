'use client'

import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'

/**
 * 사용자 클립 플레이리스트 전역 상태 — TanStack Query 캐시 기반.
 * useGlobalPlaylists(곡)의 클립 버전. clips는 SongVideo를 참조한다.
 */

interface PlaylistWithClips {
  _id: string
  name: string
  description?: string
  coverImage?: string
  tags: string[]
  clipCount: number
  shareId?: string
  isPublic?: boolean
  clips: Array<{
    clipId: string | { _id: string }
    addedAt: string
    order: number
  }>
  createdAt: string
  updatedAt: string
}

interface CreateClipPlaylistData {
  name: string
  description?: string
  coverImage?: string
  tags?: string[]
}

const clipPlaylistsKey = (channelId: string | null) => ['clip-playlists', channelId ?? 'anonymous'] as const

/** 진행 중인 클립↔플레이리스트 작업 추적용 캐시 키 */
const OPS_KEY = ['clip-playlist-ops'] as const
type OpsMap = Record<string, string[]> // clipId -> playlistIds

const EMPTY_PLAYLISTS: PlaylistWithClips[] = []
const EMPTY_OPS: OpsMap = {}

export function clipIdOf(entry: PlaylistWithClips['clips'][number]): string {
  const id = entry.clipId
  return typeof id === 'object' && id?._id ? id._id : String(id)
}

interface UseGlobalClipPlaylistsReturn {
  playlists: PlaylistWithClips[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  createPlaylist: (data: CreateClipPlaylistData) => Promise<PlaylistWithClips | null>
  deletePlaylist: (id: string) => Promise<boolean>
  addClipToPlaylist: (playlistId: string, clipId: string) => Promise<boolean>
  removeClipFromPlaylist: (playlistId: string, clipId: string) => Promise<boolean>
  getPlaylistsForClip: (clipId: string) => Array<{ _id: string; name: string }>
  isClipOperating: (clipId: string, playlistId?: string) => boolean
}

export function useGlobalClipPlaylists(): UseGlobalClipPlaylistsReturn {
  const { data: session } = useSession()
  const channelId = session?.user?.channelId ?? null
  const queryClient = useQueryClient()
  const [mutationError, setMutationError] = useState<string | null>(null)

  const query = useQuery<PlaylistWithClips[]>({
    queryKey: clipPlaylistsKey(channelId),
    queryFn: async () => {
      const response = await fetch('/api/clip-playlists')
      if (response.status === 401) return []
      if (!response.ok) throw new Error(`클립 플레이리스트 로딩 실패 (${response.status})`)
      const data = await response.json()
      return data.playlists || []
    },
    enabled: !!channelId,
  })

  const playlists = query.data ?? EMPTY_PLAYLISTS

  const updateCache = useCallback(
    (updater: (prev: PlaylistWithClips[]) => PlaylistWithClips[]) => {
      queryClient.setQueryData<PlaylistWithClips[]>(clipPlaylistsKey(channelId), (prev) =>
        updater(prev ?? []),
      )
    },
    [queryClient, channelId],
  )

  const { data: ops = EMPTY_OPS } = useQuery<OpsMap>({
    queryKey: OPS_KEY,
    queryFn: () => ({}),
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const setClipOperation = useCallback(
    (clipId: string, playlistId: string, operating: boolean) => {
      queryClient.setQueryData<OpsMap>(OPS_KEY, (prev = {}) => {
        const current = new Set(prev[clipId] ?? [])
        if (operating) current.add(playlistId)
        else current.delete(playlistId)
        const next = { ...prev }
        if (current.size > 0) next[clipId] = [...current]
        else delete next[clipId]
        return next
      })
    },
    [queryClient],
  )

  const isClipOperating = useCallback(
    (clipId: string, playlistId?: string): boolean => {
      const current = ops[clipId]
      if (!current) return false
      return playlistId ? current.includes(playlistId) : current.length > 0
    },
    [ops],
  )

  const createMutation = useMutation({
    mutationFn: async (data: CreateClipPlaylistData) => {
      const response = await fetch('/api/clip-playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error?.message || '클립 플레이리스트 생성에 실패했습니다')
      }
      return result.playlist as PlaylistWithClips
    },
    onSuccess: (playlist) => {
      updateCache((prev) => [playlist, ...prev])
    },
    onError: (err) => setMutationError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/clip-playlists/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.error?.message || '클립 플레이리스트 삭제에 실패했습니다')
      }
      return id
    },
    onSuccess: (id) => {
      updateCache((prev) => prev.filter((p) => p._id !== id))
    },
    onError: (err) => setMutationError(err.message),
  })

  const addClipToPlaylist = useCallback(
    async (playlistId: string, clipId: string): Promise<boolean> => {
      if (!channelId) {
        setMutationError('로그인이 필요합니다')
        return false
      }

      const playlist = playlists.find((p) => p._id === playlistId)
      if (playlist?.clips.some((c) => clipIdOf(c) === clipId)) {
        return true
      }

      setClipOperation(clipId, playlistId, true)

      updateCache((prev) =>
        prev.map((p) =>
          p._id === playlistId
            ? {
                ...p,
                clips: [...p.clips, { clipId, addedAt: new Date().toISOString(), order: p.clips.length }],
                clipCount: p.clips.length + 1,
              }
            : p,
        ),
      )

      try {
        const response = await fetch(`/api/clip-playlists/${playlistId}/clips`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clipId }),
        })

        if (response.ok || response.status === 409) return true

        updateCache((prev) =>
          prev.map((p) =>
            p._id === playlistId
              ? {
                  ...p,
                  clips: p.clips.filter((c) => clipIdOf(c) !== clipId),
                  clipCount: p.clips.filter((c) => clipIdOf(c) !== clipId).length,
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
                  clips: p.clips.filter((c) => clipIdOf(c) !== clipId),
                  clipCount: p.clips.filter((c) => clipIdOf(c) !== clipId).length,
                }
              : p,
          ),
        )
        setMutationError('네트워크 오류가 발생했습니다')
        console.error('클립 플레이리스트 추가 오류:', err)
        return false
      } finally {
        setClipOperation(clipId, playlistId, false)
      }
    },
    [channelId, playlists, updateCache, setClipOperation],
  )

  const removeClipFromPlaylist = useCallback(
    async (playlistId: string, clipId: string): Promise<boolean> => {
      if (!channelId) {
        setMutationError('로그인이 필요합니다')
        return false
      }

      setClipOperation(clipId, playlistId, true)

      const original = playlists.find((p) => p._id === playlistId)
      const originalClips = original ? [...original.clips] : []

      updateCache((prev) =>
        prev.map((p) =>
          p._id === playlistId
            ? {
                ...p,
                clips: p.clips.filter((c) => clipIdOf(c) !== clipId),
                clipCount: p.clips.filter((c) => clipIdOf(c) !== clipId).length,
              }
            : p,
        ),
      )

      try {
        const response = await fetch(`/api/clip-playlists/${playlistId}/clips?clipId=${clipId}`, {
          method: 'DELETE',
        })

        if (response.ok) return true

        updateCache((prev) =>
          prev.map((p) =>
            p._id === playlistId ? { ...p, clips: originalClips, clipCount: originalClips.length } : p,
          ),
        )
        const result = await response.json().catch(() => null)
        setMutationError(result?.error?.message || '플레이리스트에서 제거하는데 실패했습니다')
        return false
      } catch (err) {
        updateCache((prev) =>
          prev.map((p) =>
            p._id === playlistId ? { ...p, clips: originalClips, clipCount: originalClips.length } : p,
          ),
        )
        setMutationError('네트워크 오류가 발생했습니다')
        console.error('클립 플레이리스트 제거 오류:', err)
        return false
      } finally {
        setClipOperation(clipId, playlistId, false)
      }
    },
    [channelId, playlists, updateCache, setClipOperation],
  )

  const getPlaylistsForClip = useCallback(
    (clipId: string): Array<{ _id: string; name: string }> => {
      return playlists
        .filter((playlist) => playlist.clips.some((clip) => clipIdOf(clip) === clipId))
        .map((playlist) => ({ _id: playlist._id, name: playlist.name }))
    },
    [playlists],
  )

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: clipPlaylistsKey(channelId) })
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
    addClipToPlaylist,
    removeClipFromPlaylist,
    getPlaylistsForClip,
    isClipOperating,
  }
}

export type { PlaylistWithClips }
