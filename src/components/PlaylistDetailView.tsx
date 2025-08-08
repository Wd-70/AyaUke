'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  ShareIcon, 
  MusicalNoteIcon,
  ClockIcon,
  UserIcon,
  CogIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  PhotoIcon,
  HashtagIcon,
  HomeIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid'
import SongCard from './SongCard'
import ShareManagement from './ShareManagement'
import { Song } from '@/types'
import { useToast } from './Toast'

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
  const { showSuccess, showError } = useToast()
  const [showShareManagement, setShowShareManagement] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(playlist.name)
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [isEditingImage, setIsEditingImage] = useState(false)
  const [editedCoverImage, setEditedCoverImage] = useState(playlist.coverImage || '')
  const [showNumbers, setShowNumbers] = useState(false)

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

  const showToastMessage = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message)
    setToastType(type)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000) // 3초 후 자동 숨김
  }

  const handleSharePlaylist = async () => {
    try {
      const currentUrl = window.location.href
      await navigator.clipboard.writeText(currentUrl)
      showToastMessage('플레이리스트 링크가 클립보드에 복사되었습니다!')
    } catch (error) {
      console.error('링크 복사 실패:', error)
      // 폴백: 텍스트 선택 방식
      const textArea = document.createElement('textarea')
      textArea.value = window.location.href
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        showToastMessage('플레이리스트 링크가 클립보드에 복사되었습니다!')
      } catch (fallbackError) {
        showToastMessage('링크 복사에 실패했습니다', 'error')
      }
      document.body.removeChild(textArea)
    }
  }

  const handleCopyPlaylist = () => {
    // TODO: 플레이리스트 복사 기능 구현
    console.log('플레이리스트 복사')
  }

  const handleEditName = () => {
    setIsEditing(true)
    setEditedName(playlist.name)
  }

  const handleSaveName = async () => {
    if (!editedName.trim() || editedName.trim() === playlist.name) {
      setIsEditing(false)
      setEditedName(playlist.name)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/playlists/${playlist._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editedName.trim()
        })
      })

      if (response.ok) {
        // 성공 시 페이지 새로고침
        window.location.reload()
      } else {
        const result = await response.json()
        showError('변경 실패', result.error || '플레이리스트 이름 변경에 실패했습니다')
        setEditedName(playlist.name)
      }
    } catch (error) {
      console.error('플레이리스트 이름 변경 오류:', error)
      showError('네트워크 오류', '네트워크 오류가 발생했습니다')
      setEditedName(playlist.name)
    } finally {
      setIsLoading(false)
      setIsEditing(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedName(playlist.name)
  }

  const handleDeletePlaylist = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/playlists/${playlist._id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // 성공 시 메인 페이지로 이동
        showSuccess('삭제 완료', '플레이리스트가 삭제되었습니다')
        // 약간의 지연 후 페이지 이동
        setTimeout(() => {
          window.location.href = '/songbook'
        }, 1500)
      } else {
        const result = await response.json()
        showError('삭제 실패', result.error || '플레이리스트 삭제에 실패했습니다')
      }
    } catch (error) {
      console.error('플레이리스트 삭제 오류:', error)
      showError('네트워크 오류', '네트워크 오류가 발생했습니다')
    } finally {
      setIsLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const handleEditImage = () => {
    setIsEditingImage(true)
    setEditedCoverImage(playlist.coverImage || '')
  }

  const handleSaveImage = async () => {
    if (editedCoverImage === playlist.coverImage) {
      setIsEditingImage(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/playlists/${playlist._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: playlist.name,
          coverImage: editedCoverImage.trim() || null
        })
      })

      if (response.ok) {
        // 성공 시 페이지 새로고침
        window.location.reload()
      } else {
        const result = await response.json()
        showToastMessage(result.error || '커버 이미지 변경에 실패했습니다', 'error')
        setEditedCoverImage(playlist.coverImage || '')
      }
    } catch (error) {
      console.error('커버 이미지 변경 오류:', error)
      showToastMessage('네트워크 오류가 발생했습니다', 'error')
      setEditedCoverImage(playlist.coverImage || '')
    } finally {
      setIsLoading(false)
      setIsEditingImage(false)
    }
  }

  const handleCancelImageEdit = () => {
    setIsEditingImage(false)
    setEditedCoverImage(playlist.coverImage || '')
  }

  const handleImageKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveImage()
    } else if (e.key === 'Escape') {
      handleCancelImageEdit()
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatDuration = (songs: unknown[]) => {
    let totalMinutes = 0
    
    songs.forEach(songItem => {
      const song = songItem.songId
      if (!song) return
      
      // 선택된 MR의 duration 가져오기
      const mrLinks = song.mrLinks || []
      const selectedIndex = song.selectedMRIndex || 0
      const selectedMR = mrLinks[selectedIndex]
      
      if (selectedMR?.duration) {
        // duration이 "3:45" 형태의 문자열인 경우 분으로 변환
        const durationParts = selectedMR.duration.split(':')
        if (durationParts.length === 2) {
          const minutes = parseInt(durationParts[0], 10)
          const seconds = parseInt(durationParts[1], 10)
          totalMinutes += minutes + (seconds / 60)
        } else {
          // duration이 분 단위 숫자인 경우
          const durationNum = parseFloat(selectedMR.duration)
          if (!isNaN(durationNum)) {
            totalMinutes += durationNum
          } else {
            // 파싱 실패 시 기본값 사용
            totalMinutes += 3.5
          }
        }
      } else {
        // duration이 없으면 기본값 3.5분 사용
        totalMinutes += 3.5
      }
    })
    
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.floor(totalMinutes % 60)
    
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
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8 relative"
        >
          {/* 우측 상단 컨트롤 */}
          <div className="absolute top-6 right-6 flex items-center gap-2">
            {/* 테마 토글 버튼 */}
            <div 
              className="relative p-2 rounded-full bg-light-primary/10 dark:bg-dark-primary/10 hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 transition-all duration-300 group cursor-pointer"
              data-theme-toggle
              aria-label="Toggle theme"
            >
              <div className="relative w-5 h-5">
                {/* Sun Icon */}
                <SunIcon 
                  className="absolute inset-0 w-5 h-5 text-light-purple dark:text-dark-text transition-all duration-300 transform dark:opacity-0 dark:rotate-90 dark:scale-75 opacity-100 rotate-0 scale-100"
                  strokeWidth={2}
                />
                
                {/* Moon Icon */}
                <MoonIcon 
                  className="absolute inset-0 w-5 h-5 text-light-purple dark:text-dark-text transition-all duration-300 transform opacity-0 -rotate-90 scale-75 dark:opacity-100 dark:rotate-0 dark:scale-100"
                  strokeWidth={2}
                />
              </div>
              
              {/* Hover gradient overlay */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-light-accent/0 to-light-accent/20 dark:from-dark-accent/0 dark:to-dark-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>

            {isOwner && (
              <>
                <button
                  onClick={() => setShowShareManagement(!showShareManagement)}
                  className="p-2 rounded-full bg-light-primary/10 dark:bg-dark-primary/10 hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 transition-colors"
                  title="공유 설정"
                >
                  <CogIcon className="w-5 h-5 text-light-text dark:text-dark-text" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                  title="플레이리스트 삭제"
                >
                  <TrashIcon className="w-5 h-5 text-red-500" />
                </button>
              </>
            )}
          </div>
          <div className="flex flex-col lg:flex-row gap-8">
            {/* 커버 이미지 */}
            <div className="flex-shrink-0 relative group">
              <div className="w-64 h-64 bg-gradient-to-br from-light-accent to-light-secondary dark:from-dark-accent to-dark-secondary rounded-2xl shadow-lg flex items-center justify-center relative overflow-hidden">
                {playlist.coverImage ? (
                  <img 
                    src={playlist.coverImage} 
                    alt={playlist.name}
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  <MusicalNoteIcon className="w-24 h-24 text-white opacity-80" />
                )}
                
                {/* 이미지 편집 오버레이 (소유자만) */}
                {isOwner && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-2xl flex items-center justify-center">
                    <button
                      onClick={handleEditImage}
                      className="flex items-center gap-2 px-4 py-2 bg-white/90 text-gray-800 rounded-lg hover:bg-white transition-colors"
                    >
                      <PhotoIcon className="w-4 h-4" />
                      이미지 편집
                    </button>
                  </div>
                )}
              </div>
              
              {/* 이미지 편집 모드 */}
              {isEditingImage && (
                <div className="absolute inset-0 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 z-10 border border-light-primary/20 dark:border-dark-primary/20">
                  <div className="h-full flex flex-col">
                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4">
                      커버 이미지 변경
                    </h3>
                    
                    <div className="flex-1 flex flex-col gap-4">
                      <div>
                        <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                          이미지 URL
                        </label>
                        <input
                          type="url"
                          value={editedCoverImage}
                          onChange={(e) => setEditedCoverImage(e.target.value)}
                          onKeyDown={handleImageKeyDown}
                          placeholder="https://example.com/image.jpg"
                          className="w-full px-3 py-2 text-sm border border-light-primary/20 dark:border-dark-primary/20 rounded-lg bg-white dark:bg-gray-700 text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                          disabled={isLoading}
                        />
                      </div>
                      
                      {/* 미리보기 */}
                      {editedCoverImage && (
                        <div className="flex-1 min-h-0">
                          <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                            미리보기
                          </label>
                          <div className="w-full h-24 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                            <img 
                              src={editedCoverImage} 
                              alt="미리보기"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={handleSaveImage}
                        disabled={isLoading || editedCoverImage === playlist.coverImage}
                        className="flex-1 px-3 py-2 text-sm bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? '저장 중...' : '저장'}
                      </button>
                      <button
                        onClick={handleCancelImageEdit}
                        disabled={isLoading}
                        className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 플레이리스트 정보 */}
            <div className="flex-1">
              <div className="mb-4">
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
                
                {/* 플레이리스트 이름 - 편집 가능 */}
                <div className="flex items-center gap-3 mb-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="text-4xl font-bold bg-transparent border-b-2 border-light-accent dark:border-dark-accent text-light-text dark:text-dark-text outline-none flex-1"
                        disabled={isLoading}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={isLoading || !editedName.trim()}
                        className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <CheckIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={isLoading}
                        className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-900/20 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-4xl font-bold text-light-text dark:text-dark-text flex-1">
                        {playlist.name}
                      </h1>
                      {isOwner && (
                        <button
                          onClick={handleEditName}
                          className="p-2 text-light-text/60 dark:text-dark-text/60 hover:text-light-accent dark:hover:text-dark-accent hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 rounded-lg transition-colors"
                          title="플레이리스트 이름 편집"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
                {playlist.description && (
                  <p className="text-light-text/70 dark:text-dark-text/70 mb-4">
                    {playlist.description}
                  </p>
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
                  onClick={() => window.location.href = '/'}
                  className="flex items-center gap-2 px-6 py-3 border border-light-primary/20 dark:border-dark-primary/20 rounded-full hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition-colors"
                >
                  <HomeIcon className="w-5 h-5" />
                  홈으로
                </button>

                <button
                  onClick={() => window.location.href = '/songbook'}
                  className="flex items-center gap-2 px-6 py-3 border border-light-primary/20 dark:border-dark-primary/20 rounded-full hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition-colors"
                >
                  <MusicalNoteIcon className="w-5 h-5" />
                  노래책
                </button>

                <button
                  onClick={handleSharePlaylist}
                  className="flex items-center gap-2 px-6 py-3 border border-light-primary/20 dark:border-dark-primary/20 rounded-full hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition-colors"
                >
                  <ShareIcon className="w-5 h-5" />
                  링크 복사
                </button>

                <button
                  onClick={() => setShowNumbers(!showNumbers)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full transition-colors ${
                    showNumbers
                      ? 'bg-light-accent/20 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent border border-light-accent/30 dark:border-dark-accent/30'
                      : 'border border-light-primary/20 dark:border-dark-primary/20 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
                  }`}
                >
                  <HashtagIcon className="w-5 h-5" />
                  {showNumbers ? '번호 숨기기' : '번호 표시'}
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

          {/* 삭제 확인 다이얼로그 */}
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-8 pt-8 border-t border-red-200 dark:border-red-800/30"
            >
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 border border-red-200 dark:border-red-800/30">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                    <TrashIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                      플레이리스트 삭제
                    </h3>
                    <p className="text-red-700 dark:text-red-300 mb-4">
                      정말로 &apos;<strong>{playlist.name}</strong>&apos; 플레이리스트를 삭제하시겠습니까?
                      <br />
                      <span className="text-sm">이 작업은 되돌릴 수 없으며, 포함된 {playlist.songCount}곡의 정보도 함께 삭제됩니다.</span>
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleDeletePlaylist}
                        disabled={isLoading}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? '삭제 중...' : '삭제하기'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isLoading}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
                .map((item, index) => (
                  <SongCard
                    key={item._id}
                    song={item.songId}
                    showNumber={showNumbers}
                    number={index + 1}
                  />
                ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* 토스트 알림 */}
      {showToast && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50"
        >
          <div className={`
            flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg backdrop-blur-sm
            ${toastType === 'success' 
              ? 'bg-green-500/90 text-white' 
              : 'bg-red-500/90 text-white'
            }
          `}>
            {toastType === 'success' ? (
              <CheckCircleIcon className="w-6 h-6 flex-shrink-0" />
            ) : (
              <ExclamationCircleIcon className="w-6 h-6 flex-shrink-0" />
            )}
            <span className="font-medium">{toastMessage}</span>
          </div>
        </motion.div>
      )}
    </div>
  )
}