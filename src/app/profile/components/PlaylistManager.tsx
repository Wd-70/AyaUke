'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MusicalNoteIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  PlusIcon,
  ShareIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline'
import PlaylistEditModal from './PlaylistEditModal'
import CreatePlaylistModal from './CreatePlaylistModal'

interface Playlist {
  _id: string
  name: string
  description: string
  isPublic: boolean
  songCount: number
  shareId: string
  createdAt: string
  updatedAt: string
}

interface PlaylistsResponse {
  playlists: Playlist[]
  total: number
}

export default function PlaylistManager() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null)
  const [deletingPlaylist, setDeletingPlaylist] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)

  const fetchPlaylists = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user/playlists')
      if (!response.ok) {
        throw new Error('플레이리스트를 불러오는데 실패했습니다.')
      }

      const data: PlaylistsResponse = await response.json()
      setPlaylists(data.playlists)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlaylists()
  }, [])

  const handleDelete = async (playlistId: string) => {
    if (!confirm('정말로 이 플레이리스트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    try {
      setDeletingPlaylist(playlistId)
      const response = await fetch(`/api/playlists/${playlistId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '플레이리스트 삭제에 실패했습니다.')
      }

      // 목록에서 제거
      setPlaylists(prev => prev.filter(p => p._id !== playlistId))
      
      showNotification('success', '플레이리스트가 성공적으로 삭제되었습니다.')
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingPlaylist(null)
    }
  }

  const handleVisibilityToggle = async (playlist: Playlist) => {
    try {
      const response = await fetch(`/api/playlists/${playlist._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isPublic: !playlist.isPublic
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '공개 설정 변경에 실패했습니다.')
      }

      const updatedPlaylist = await response.json()
      
      // 목록 업데이트
      setPlaylists(prev => 
        prev.map(p => p._id === playlist._id ? { ...p, isPublic: !p.isPublic } : p)
      )

      showNotification('success', `플레이리스트가 ${!playlist.isPublic ? '공개' : '비공개'}로 변경되었습니다.`)
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : '설정 변경 중 오류가 발생했습니다.')
    }
  }

  const handlePlaylistUpdate = (updatedPlaylist: Playlist) => {
    setPlaylists(prev => 
      prev.map(p => p._id === updatedPlaylist._id ? updatedPlaylist : p)
    )
    showNotification('success', '플레이리스트가 성공적으로 수정되었습니다.')
  }

  const handlePlaylistCreate = (newPlaylist: Playlist) => {
    setPlaylists(prev => [newPlaylist, ...prev])
    showNotification('success', '새 플레이리스트가 성공적으로 생성되었습니다.')
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 3000)
  }

  const copyShareLink = async (shareId: string, playlistName: string) => {
    const shareUrl = `${window.location.origin}/playlist/${shareId}`
    
    try {
      await navigator.clipboard.writeText(shareUrl)
      showNotification('success', `"${playlistName}" 공유 링크가 복사되었습니다.`)
    } catch (err) {
      // 클립보드 API 실패 시 fallback
      const textArea = document.createElement('textarea')
      textArea.value = shareUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      showNotification('success', '공유 링크가 복사되었습니다.')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <MusicalNoteIcon className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            오류가 발생했습니다
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchPlaylists}
            className="px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 알림 */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-50"
          >
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm ${
              notification.type === 'success'
                ? 'bg-green-50/95 dark:bg-green-900/90 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-red-50/95 dark:bg-red-900/90 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
            }`}>
              {notification.type === 'success' ? (
                <CheckIcon className="w-5 h-5 flex-shrink-0" />
              ) : (
                <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="text-sm font-medium">{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 헤더 */}
      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MusicalNoteIcon className="w-6 h-6 text-light-accent dark:text-dark-accent" />
              내 플레이리스트
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {playlists.length > 0 && `총 ${playlists.length}개의 플레이리스트`}
            </p>
          </div>

          <button
            onClick={() => setIsCreatingPlaylist(true)}
            className="px-4 py-2 bg-gradient-to-r from-light-accent to-light-secondary dark:from-dark-accent dark:to-dark-secondary text-white rounded-lg hover:from-light-secondary hover:to-light-accent dark:hover:from-dark-secondary dark:hover:to-dark-accent transition-all duration-200 flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            새 플레이리스트
          </button>
        </div>

        {/* 플레이리스트 목록 */}
        {playlists.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <MusicalNoteIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              아직 플레이리스트가 없습니다
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              노래책에서 첫 번째 플레이리스트를 만들어보세요
            </p>
            <button
              onClick={() => window.location.href = '/songbook'}
              className="px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200"
            >
              노래책으로 이동
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {playlists.map((playlist, index) => (
              <motion.div
                key={playlist._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group bg-white/80 dark:bg-gray-700/80 rounded-lg border border-gray-200/60 dark:border-gray-600/60 hover:border-light-accent/30 dark:hover:border-dark-accent/30 hover:shadow-lg transition-all duration-200 overflow-hidden"
              >
                {/* 플레이리스트 헤더 */}
                <div className="p-4 border-b border-gray-200/60 dark:border-gray-600/60">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {playlist.name}
                      </h3>
                      {playlist.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {playlist.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <MusicalNoteIcon className="w-3 h-3" />
                          {playlist.songCount}곡
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                          playlist.isPublic
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {playlist.isPublic ? (
                            <>
                              <EyeIcon className="w-3 h-3" />
                              공개
                            </>
                          ) : (
                            <>
                              <EyeSlashIcon className="w-3 h-3" />
                              비공개
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 플레이리스트 정보 */}
                <div className="p-4">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    생성일: {formatDate(playlist.createdAt)}
                    {playlist.updatedAt !== playlist.createdAt && (
                      <span className="block mt-1">
                        수정일: {formatDate(playlist.updatedAt)}
                      </span>
                    )}
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => window.open(`/playlist/${playlist.shareId}`, '_blank')}
                      className="flex-1 min-w-0 px-3 py-2 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors duration-200 flex items-center justify-center gap-1"
                      title="플레이리스트 보기"
                    >
                      <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                      보기
                    </button>

                    <button
                      onClick={() => setEditingPlaylist(playlist)}
                      className="flex-1 min-w-0 px-3 py-2 text-xs bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent border border-light-accent/20 dark:border-dark-accent/20 rounded-lg hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors duration-200 flex items-center justify-center gap-1"
                    >
                      <PencilIcon className="w-3 h-3" />
                      편집
                    </button>

                    <button
                      onClick={() => handleVisibilityToggle(playlist)}
                      className="px-3 py-2 text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors duration-200 flex items-center gap-1"
                      title={playlist.isPublic ? '비공개로 변경' : '공개로 변경'}
                    >
                      {playlist.isPublic ? <EyeSlashIcon className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
                    </button>

                    {playlist.isPublic && (
                      <button
                        onClick={() => copyShareLink(playlist.shareId, playlist.name)}
                        className="px-3 py-2 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors duration-200 flex items-center gap-1"
                        title="공유 링크 복사"
                      >
                        <ShareIcon className="w-3 h-3" />
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(playlist._id)}
                      disabled={deletingPlaylist === playlist._id}
                      className="px-3 py-2 text-xs bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors duration-200 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="삭제"
                    >
                      {deletingPlaylist === playlist._id ? (
                        <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <TrashIcon className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 플레이리스트 편집 모달 */}
      {editingPlaylist && (
        <PlaylistEditModal
          playlist={editingPlaylist}
          isOpen={!!editingPlaylist}
          onClose={() => setEditingPlaylist(null)}
          onUpdate={handlePlaylistUpdate}
        />
      )}

      {/* 새 플레이리스트 생성 모달 */}
      <CreatePlaylistModal
        isOpen={isCreatingPlaylist}
        onClose={() => setIsCreatingPlaylist(false)}
        onSuccess={handlePlaylistCreate}
      />
    </div>
  )
}