'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  PlayIcon, 
  ShareIcon, 
  HeartIcon,
  MusicalNoteIcon,
  ClockIcon,
  UserIcon,
  CogIcon,
  LinkIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import SongCard from './SongCard'
import ShareManagement from './ShareManagement'
import { Song } from '@/types'

interface PlaylistData {
  playlist: {
    _id: string
    name: string
    description?: string
    coverImage?: string
    tags: string[]
    songs: Array<{
      songId: Song
      addedAt: string
      order: number
      _id: string
    }>
    songCount: number
    createdAt: string
    updatedAt: string
    // 소유자만 볼 수 있는 정보
    shareId?: string
    isPublic?: boolean
    shareSettings?: {
      allowCopy: boolean
      requireLogin: boolean
      expiresAt?: string
    }
    shareHistory?: Array<{
      shareId: string
      createdAt: string
      revokedAt: string
    }>
  }
  isOwner: boolean
  permissions: {
    canEdit: boolean
    canDelete: boolean
    canShare: boolean
    canCopy: boolean
  }
}

interface PlaylistDetailViewProps {
  data: PlaylistData
  shareId: string
}

export default function PlaylistDetailView({ data, shareId }: PlaylistDetailViewProps) {
  const { playlist, isOwner, permissions } = data
  const [showShareManagement, setShowShareManagement] = useState(false)
  const [isLiked, setIsLiked] = useState(false)

  // 플레이리스트 곡들의 좋아요 정보 미리 로드
  useEffect(() => {
    const loadPlaylistLikes = async () => {
      if (playlist.songs.length === 0) return

      try {
        const songIds = playlist.songs.map(item => item.songId.id || item.songId._id)
        console.log('🔄 플레이리스트 좋아요 정보 로딩:', songIds)
        
        const response = await fetch('/api/likes-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songIds })
        })

        if (response.ok) {
          const data = await response.json()
          console.log('✅ 플레이리스트 좋아요 정보 로딩 완료:', data.likes)
          
          // 전역 likes store에 데이터 설정 (useLike 훅에서 사용)
          // 각 SongCard의 useLike 훅이 이 데이터를 사용하도록 강제 새로고침
          window.dispatchEvent(new CustomEvent('likesLoaded', { 
            detail: { likes: data.likes } 
          }))
        }
      } catch (error) {
        console.error('❌ 플레이리스트 좋아요 정보 로딩 실패:', error)
      }
    }

    loadPlaylistLikes()
  }, [playlist.songs])

  const handlePlayAll = () => {
    // TODO: 전체 재생 기능 구현
    console.log('전체 재생:', playlist.songs)
  }

  const handleCopyPlaylist = () => {
    // TODO: 플레이리스트 복사 기능 구현
    console.log('플레이리스트 복사')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatDuration = (songs: any[]) => {
    // 임시로 곡 수 기반 예상 시간 계산 (평균 3분 30초)
    const estimatedMinutes = songs.length * 3.5
    const hours = Math.floor(estimatedMinutes / 60)
    const minutes = Math.floor(estimatedMinutes % 60)
    
    if (hours > 0) {
      return `약 ${hours}시간 ${minutes}분`
    }
    return `약 ${minutes}분`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-bg to-light-primary/5 dark:from-gray-900 dark:to-dark-primary/5">
      <div className="container mx-auto px-4 py-8">
        {/* 플레이리스트 헤더 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8"
        >
          <div className="flex flex-col lg:flex-row gap-8">
            {/* 커버 이미지 */}
            <div className="flex-shrink-0">
              <div className="w-64 h-64 bg-gradient-to-br from-light-accent to-light-secondary dark:from-dark-accent to-dark-secondary rounded-2xl shadow-lg flex items-center justify-center">
                {playlist.coverImage ? (
                  <img 
                    src={playlist.coverImage} 
                    alt={playlist.name}
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  <MusicalNoteIcon className="w-24 h-24 text-white opacity-80" />
                )}
              </div>
            </div>

            {/* 플레이리스트 정보 */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-light-accent dark:text-dark-accent">
                      플레이리스트
                    </span>
                    {playlist.isPublic ? (
                      <EyeIcon className="w-4 h-4 text-green-500" />
                    ) : (
                      <EyeSlashIcon className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <h1 className="text-4xl font-bold text-light-text dark:text-dark-text mb-2">
                    {playlist.name}
                  </h1>
                  {playlist.description && (
                    <p className="text-light-text/70 dark:text-dark-text/70 mb-4">
                      {playlist.description}
                    </p>
                  )}
                </div>
                
                {isOwner && (
                  <button
                    onClick={() => setShowShareManagement(!showShareManagement)}
                    className="p-2 rounded-lg hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition-colors"
                  >
                    <CogIcon className="w-6 h-6 text-light-text dark:text-dark-text" />
                  </button>
                )}
              </div>

              {/* 메타 정보 */}
              <div className="flex flex-wrap items-center gap-6 mb-6 text-sm text-light-text/60 dark:text-dark-text/60">
                <div className="flex items-center gap-1">
                  <MusicalNoteIcon className="w-4 h-4" />
                  <span>{playlist.songCount}곡</span>
                </div>
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-4 h-4" />
                  <span>{formatDuration(playlist.songs)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <UserIcon className="w-4 h-4" />
                  <span>{formatDate(playlist.createdAt)} 생성</span>
                </div>
              </div>

              {/* 태그 */}
              {playlist.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {playlist.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-light-primary/20 dark:bg-dark-primary/20 text-light-accent dark:text-dark-accent rounded-full text-sm"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handlePlayAll}
                  className="flex items-center gap-2 px-6 py-3 bg-light-accent dark:bg-dark-accent text-white rounded-full hover:opacity-90 transition-opacity"
                >
                  <PlayIcon className="w-5 h-5" />
                  전체 재생
                </button>

                {!isOwner && (
                  <button
                    onClick={() => setIsLiked(!isLiked)}
                    className="flex items-center gap-2 px-6 py-3 border border-light-primary/20 dark:border-dark-primary/20 rounded-full hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition-colors"
                  >
                    {isLiked ? (
                      <HeartSolidIcon className="w-5 h-5 text-red-500" />
                    ) : (
                      <HeartIcon className="w-5 h-5" />
                    )}
                    좋아요
                  </button>
                )}

                {permissions.canCopy && !isOwner && (
                  <button
                    onClick={handleCopyPlaylist}
                    className="flex items-center gap-2 px-6 py-3 border border-light-primary/20 dark:border-dark-primary/20 rounded-full hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition-colors"
                  >
                    <LinkIcon className="w-5 h-5" />
                    내 플레이리스트에 복사
                  </button>
                )}

                <button
                  className="flex items-center gap-2 px-6 py-3 border border-light-primary/20 dark:border-dark-primary/20 rounded-full hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition-colors"
                >
                  <ShareIcon className="w-5 h-5" />
                  공유
                </button>
              </div>
            </div>
          </div>

          {/* 공유 관리 패널 */}
          {isOwner && showShareManagement && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-8 pt-8 border-t border-light-primary/10 dark:border-dark-primary/10"
            >
              <ShareManagement 
                shareId={shareId}
                playlist={playlist}
                onUpdate={() => {
                  // TODO: 플레이리스트 데이터 새로고침
                  window.location.reload()
                }}
              />
            </motion.div>
          )}
        </motion.div>

        {/* 곡 목록 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8"
        >
          <h2 className="text-2xl font-bold text-light-text dark:text-dark-text mb-6">
            곡 목록 ({playlist.songCount})
          </h2>

          {playlist.songs.length === 0 ? (
            <div className="text-center py-12">
              <MusicalNoteIcon className="w-16 h-16 text-light-text/20 dark:text-dark-text/20 mx-auto mb-4" />
              <p className="text-light-text/60 dark:text-dark-text/60">
                이 플레이리스트에는 아직 곡이 없습니다.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {playlist.songs
                .sort((a, b) => a.order - b.order)
                .map((item) => (
                  <SongCard
                    key={item._id}
                    song={item.songId}
                  />
                ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}