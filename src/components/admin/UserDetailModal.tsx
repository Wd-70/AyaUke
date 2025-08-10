'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  XMarkIcon,
  UserIcon,
  StarIcon,
  ShieldCheckIcon,
  PencilIcon,
  CalendarIcon,
  ClockIcon,
  TrophyIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
  GiftIcon,
  SparklesIcon,
  ListBulletIcon,
  HeartIcon,
  QueueListIcon,
  MusicalNoteIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline'
import { IUser } from '@/models/User'

interface UserDetailData {
  user: IUser & { likesCount?: number; playlistsCount?: number }
  likedSongs?: Array<{
    _id: string
    title: string
    artist: string
    titleAlias?: string
    artistAlias?: string
  }>
  playlists?: Array<{
    _id: string
    name: string
    description?: string
    isPublic: boolean
    songCount: number
    shareId: string
    createdAt: string
    updatedAt: string
  }>
}

interface UserDetailModalProps {
  user: IUser & { likesCount?: number; playlistsCount?: number }
  isOpen: boolean
  onClose: () => void
  onUserUpdate: (updatedUser: IUser) => void
}

const roleLabels = {
  super_admin: '최고 관리자',
  ayauke_admin: '아야우케 관리자',
  song_admin: '노래 관리자',
  song_editor: '노래 편집자',
  user: '일반 사용자'
}

const roleColors = {
  super_admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  ayauke_admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  song_admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  song_editor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  user: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
}

const roleIcons = {
  super_admin: StarIcon,
  ayauke_admin: ShieldCheckIcon,
  song_admin: ShieldCheckIcon,
  song_editor: PencilIcon,
  user: UserIcon
}

const rarityColors = {
  common: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  rare: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  epic: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  legendary: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
}

// 타이틀 템플릿 정의
const titleTemplates = [
  {
    id: 'early-supporter',
    name: '얼리 서포터',
    description: '서비스 초기부터 함께해준 소중한 사용자',
    condition: '베타 테스트 참여',
    rarity: 'rare' as const
  },
  {
    id: 'active-contributor',
    name: '활발한 기여자',
    description: '커뮤니티에 활발하게 참여하는 사용자',
    condition: '월 10회 이상 활동',
    rarity: 'common' as const
  },
  {
    id: 'playlist-master',
    name: '플레이리스트 마스터',
    description: '다양한 플레이리스트를 만드는 음악 큐레이터',
    condition: '플레이리스트 10개 이상 생성',
    rarity: 'rare' as const
  },
  {
    id: 'music-lover',
    name: '음악 애호가',
    description: '음악을 사랑하는 마음이 특별한 사용자',
    condition: '좋아요 100개 이상',
    rarity: 'common' as const
  },
  {
    id: 'community-helper',
    name: '커뮤니티 도우미',
    description: '다른 사용자들을 적극적으로 도와주는 사용자',
    condition: '도움 활동 인정',
    rarity: 'epic' as const
  },
  {
    id: 'vip-member',
    name: 'VIP 멤버',
    description: '특별한 기여를 인정받은 VIP 사용자',
    condition: '특별 기여 인정',
    rarity: 'legendary' as const
  },
  {
    id: 'longtime-fan',
    name: '오래된 팬',
    description: '아야우케와 오랫동안 함께한 충성도 높은 팬',
    condition: '6개월 이상 연속 활동',
    rarity: 'epic' as const
  },
  {
    id: 'streamer-friend',
    name: '스트리머 친구',
    description: '스트리머와 특별한 인연이 있는 사용자',
    condition: '스트리머 인정',
    rarity: 'legendary' as const
  }
]

export default function UserDetailModal({ user, isOpen, onClose, onUserUpdate }: UserDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    role: user.role,
    displayName: user.displayName || '',
    profileImageUrl: user.profileImageUrl || ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  
  // 사용자 상세 데이터
  const [userDetail, setUserDetail] = useState<UserDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  
  // 탭 상태
  const [activeTab, setActiveTab] = useState<'info' | 'likes' | 'playlists'>('info')
  
  // 타이틀 관리 상태
  const [showTitleForm, setShowTitleForm] = useState(false)
  const [titleForm, setTitleForm] = useState({
    name: '',
    description: '',
    condition: '',
    rarity: 'common' as 'common' | 'rare' | 'epic' | 'legendary'
  })
  const [titleLoading, setTitleLoading] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  // 사용자 상세 정보 가져오기
  const fetchUserDetail = async () => {
    if (!user._id) return
    
    try {
      setDetailLoading(true)
      const response = await fetch(`/api/admin/users/${user._id}`)
      if (!response.ok) throw new Error('사용자 상세 정보를 불러올 수 없습니다.')
      
      const data = await response.json()
      setUserDetail(data)
    } catch (error) {
      console.error('사용자 상세 정보 조회 오류:', error)
      setMessage({ type: 'error', text: '상세 정보를 불러오는데 실패했습니다.' })
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setEditForm({
        role: user.role,
        displayName: user.displayName || '',
        profileImageUrl: user.profileImageUrl || ''
      })
      setMessage({ type: '', text: '' })
      setShowTitleForm(false)
      setShowTemplates(false)
      setTitleForm({
        name: '',
        description: '',
        condition: '',
        rarity: 'common'
      })
      setActiveTab('info')
      
      // 상세 정보 가져오기
      if (user._id) {
        fetchUserDetail()
      }
    }
  }, [user._id, isOpen])

  const handleSave = async () => {
    try {
      setLoading(true)
      setMessage({ type: '', text: '' })

      const response = await fetch(`/api/admin/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '업데이트에 실패했습니다.')
      }

      setMessage({ type: 'success', text: data.message })
      onUserUpdate(data.user)
      setIsEditing(false)
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' 
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleAddTitle = async () => {
    try {
      setTitleLoading(true)
      setMessage({ type: '', text: '' })

      const response = await fetch(`/api/admin/users/${user._id}/titles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(titleForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '타이틀 부여에 실패했습니다.')
      }

      setMessage({ type: 'success', text: data.message })
      onUserUpdate(data.user)
      setShowTitleForm(false)
      setTitleForm({
        name: '',
        description: '',
        condition: '',
        rarity: 'common'
      })
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' 
      })
    } finally {
      setTitleLoading(false)
    }
  }

  const handleRemoveTitle = async (titleId: string) => {
    if (!confirm('정말로 이 타이틀을 회수하시겠습니까?')) return

    try {
      setTitleLoading(true)
      setMessage({ type: '', text: '' })

      const response = await fetch(`/api/admin/users/${user._id}/titles?titleId=${titleId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '타이틀 회수에 실패했습니다.')
      }

      setMessage({ type: 'success', text: data.message })
      onUserUpdate(data.user)
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' 
      })
    } finally {
      setTitleLoading(false)
    }
  }

  const handleSelectTemplate = (template: typeof titleTemplates[0]) => {
    setTitleForm({
      name: template.name,
      description: template.description,
      condition: template.condition,
      rarity: template.rarity
    })
    setShowTemplates(false)
  }

  const getRoleIcon = (role: keyof typeof roleIcons) => {
    const Icon = roleIcons[role] || UserIcon
    return Icon
  }

  if (!isOpen) return null

  const RoleIcon = getRoleIcon(user.role as keyof typeof roleIcons)

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
              {user.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt={user.channelName}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-light-accent/10 dark:bg-dark-accent/10 rounded-full flex items-center justify-center">
                  <UserIcon className="w-8 h-8 text-light-accent dark:text-dark-accent" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">
                  {user.displayName || user.channelName}
                </h2>
                <p className="text-light-text/60 dark:text-dark-text/60">@{user.channelName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <XMarkIcon className="w-6 h-6 text-light-text dark:text-dark-text" />
            </button>
          </div>

          {/* Message */}
          {message.text && (
            <div className={`mx-6 mt-4 p-3 rounded-lg flex items-center gap-2 ${
              message.type === 'success' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {message.type === 'success' ? (
                <CheckCircleIcon className="w-5 h-5" />
              ) : (
                <ExclamationTriangleIcon className="w-5 h-5" />
              )}
              {message.text}
            </div>
          )}

          <div className="p-6 space-y-6">
            {/* Tab Navigation */}
            <div className="border-b border-light-primary/20 dark:border-dark-primary/20">
              <nav className="flex space-x-8" aria-label="탭">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'info'
                      ? 'border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent'
                      : 'border-transparent text-light-text/70 dark:text-dark-text/70 hover:text-light-text dark:hover:text-dark-text hover:border-light-primary/30 dark:hover:border-dark-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <InformationCircleIcon className="w-4 h-4" />
                    기본 정보
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('likes')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'likes'
                      ? 'border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent'
                      : 'border-transparent text-light-text/70 dark:text-dark-text/70 hover:text-light-text dark:hover:text-dark-text hover:border-light-primary/30 dark:hover:border-dark-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <HeartIcon className="w-4 h-4" />
                    좋아요 곡 ({userDetail?.user.likesCount || user.likesCount || 0})
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('playlists')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'playlists'
                      ? 'border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent'
                      : 'border-transparent text-light-text/70 dark:text-dark-text/70 hover:text-light-text dark:hover:text-dark-text hover:border-light-primary/30 dark:hover:border-dark-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <QueueListIcon className="w-4 h-4" />
                    플레이리스트 ({userDetail?.user.playlistsCount || user.playlistsCount || 0})
                  </div>
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'info' && (
              <div className="space-y-8">
                {/* Basic Info */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4">기본 정보</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
                        표시명
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.displayName}
                          onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 
                                     bg-white/50 dark:bg-gray-900/50 text-light-text dark:text-dark-text
                                     focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                          placeholder="표시명을 입력하세요"
                        />
                      ) : (
                        <p className="text-light-text dark:text-dark-text">
                          {user.displayName || '설정되지 않음'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
                        프로필 이미지 URL
                      </label>
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="url"
                            value={editForm.profileImageUrl}
                            onChange={(e) => setEditForm({ ...editForm, profileImageUrl: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 
                                       bg-white/50 dark:bg-gray-900/50 text-light-text dark:text-dark-text
                                       focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                            placeholder="https://example.com/image.jpg"
                          />
                          {editForm.profileImageUrl && (
                            <div className="flex items-center gap-2">
                              <PhotoIcon className="w-4 h-4 text-light-text/60 dark:text-dark-text/60" />
                              <span className="text-sm text-light-text/60 dark:text-dark-text/60">미리보기:</span>
                              <img 
                                src={editForm.profileImageUrl} 
                                alt="미리보기" 
                                className="w-8 h-8 rounded-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-light-text/60 dark:text-dark-text/60 text-sm">
                          {user.profileImageUrl ? (
                            <div className="space-y-2">
                              <p className="truncate max-w-xs" title={user.profileImageUrl}>
                                {user.profileImageUrl.length > 60 
                                  ? `${user.profileImageUrl.substring(0, 60)}...` 
                                  : user.profileImageUrl
                                }
                              </p>
                              {user.profileImageUrl.startsWith('data:image') && (
                                <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded">
                                  Base64 이미지
                                </span>
                              )}
                            </div>
                          ) : (
                            '설정되지 않음'
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
                        채널 ID
                      </label>
                      <p className="text-light-text/60 dark:text-dark-text/60 font-mono text-sm">
                        {user.channelId}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
                        권한
                      </label>
                      {isEditing ? (
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 
                                     bg-white/50 dark:bg-gray-900/50 text-light-text dark:text-dark-text
                                     focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                        >
                          <option value="user">일반 사용자</option>
                          <option value="song_editor">노래 편집자</option>
                          <option value="song_admin">노래 관리자</option>
                          <option value="ayauke_admin">아야우케 관리자</option>
                          <option value="super_admin">최고 관리자</option>
                        </select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <RoleIcon className="w-5 h-5" />
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleColors[user.role as keyof typeof roleColors]}`}>
                            {roleLabels[user.role as keyof typeof roleLabels]}
                          </span>
                        </div>
                      )}
                    </div>

                    {user.grantedBy && (
                      <div>
                        <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
                          권한 부여자
                        </label>
                        <p className="text-light-text/60 dark:text-dark-text/60 text-sm">
                          {user.grantedBy} • {user.grantedAt && formatDate(user.grantedAt)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4">활동 정보</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="w-5 h-5 text-light-text/60 dark:text-dark-text/60" />
                      <div>
                        <p className="text-sm font-medium text-light-text dark:text-dark-text">가입일</p>
                        <p className="text-sm text-light-text/60 dark:text-dark-text/60">
                          {formatDate(user.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <ClockIcon className="w-5 h-5 text-light-text/60 dark:text-dark-text/60" />
                      <div>
                        <p className="text-sm font-medium text-light-text dark:text-dark-text">최근 로그인</p>
                        <p className="text-sm text-light-text/60 dark:text-dark-text/60">
                          {formatDate(user.lastLoginAt)}
                        </p>
                      </div>
                    </div>

                    {user.activityStats && (
                      <div className="grid grid-cols-2 gap-4 p-4 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-light-accent dark:text-dark-accent">
                            {user.activityStats.totalLoginDays}
                          </p>
                          <p className="text-xs text-light-text/60 dark:text-dark-text/60">총 접속일</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-light-secondary dark:text-dark-secondary">
                            {user.activityStats.currentStreak}
                          </p>
                          <p className="text-xs text-light-text/60 dark:text-dark-text/60">현재 연속</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-light-purple dark:text-dark-purple">
                            {user.activityStats.longestStreak}
                          </p>
                          <p className="text-xs text-light-text/60 dark:text-dark-text/60">최고 연속</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-light-text/60 dark:text-dark-text/60">
                            {user.activityStats.lastVisitDate || '기록 없음'}
                          </p>
                          <p className="text-xs text-light-text/60 dark:text-dark-text/60">마지막 방문</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Channel Name History */}
            {user.channelNameHistory && user.channelNameHistory.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4">채널명 변경 이력</h3>
                <div className="bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg p-4">
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {user.channelNameHistory.map((history, index) => (
                      <div key={index} className="flex items-center justify-between py-1">
                        <span className="text-sm text-light-text dark:text-dark-text">
                          {history.channelName}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-light-text/60 dark:text-dark-text/60">
                          <span className={`px-2 py-1 rounded ${
                            history.source === 'initial' 
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          }`}>
                            {history.source === 'initial' ? '초기' : '로그인'}
                          </span>
                          <span>{formatDate(history.changedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Titles */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text flex items-center gap-2">
                  <TrophyIcon className="w-5 h-5" />
                  획득한 타이틀 ({user.titles?.length || 0}개)
                </h3>
                {isEditing && (
                  <button
                    onClick={() => setShowTitleForm(!showTitleForm)}
                    className="flex items-center gap-2 px-3 py-1 bg-light-accent dark:bg-dark-accent text-white rounded-lg 
                               hover:bg-light-accent/90 dark:hover:bg-dark-accent/90 transition-colors text-sm"
                  >
                    <GiftIcon className="w-4 h-4" />
                    타이틀 부여
                  </button>
                )}
              </div>

              {/* Add Title Form */}
              {showTitleForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 p-4 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-light-text dark:text-dark-text">새 타이틀 부여</h4>
                    <button
                      onClick={() => setShowTemplates(!showTemplates)}
                      className="flex items-center gap-2 px-3 py-1 text-sm bg-light-secondary/20 dark:bg-dark-secondary/20 
                                 text-light-secondary dark:text-dark-secondary rounded-lg hover:bg-light-secondary/30 
                                 dark:hover:bg-dark-secondary/30 transition-colors"
                    >
                      <ListBulletIcon className="w-4 h-4" />
                      템플릿 선택
                    </button>
                  </div>

                  {/* Template Selection */}
                  {showTemplates && (
                    <div className="mb-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-light-primary/10 dark:border-dark-primary/10">
                      <h5 className="text-sm font-medium text-light-text dark:text-dark-text mb-2">타이틀 템플릿</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {titleTemplates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => handleSelectTemplate(template)}
                            className="p-2 text-left bg-white dark:bg-gray-900 rounded border border-light-primary/20 
                                       dark:border-dark-primary/20 hover:border-light-accent dark:hover:border-dark-accent 
                                       transition-colors group"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-light-text dark:text-dark-text">
                                {template.name}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${rarityColors[template.rarity]}`}>
                                {template.rarity}
                              </span>
                            </div>
                            <p className="text-xs text-light-text/60 dark:text-dark-text/60 line-clamp-2">
                              {template.description}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      placeholder="타이틀 이름"
                      value={titleForm.name}
                      onChange={(e) => setTitleForm({ ...titleForm, name: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 
                                 bg-white/50 dark:bg-gray-900/50 text-light-text dark:text-dark-text
                                 focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                    />
                    <select
                      value={titleForm.rarity}
                      onChange={(e) => setTitleForm({ ...titleForm, rarity: e.target.value as any })}
                      className="px-3 py-2 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 
                                 bg-white/50 dark:bg-gray-900/50 text-light-text dark:text-dark-text
                                 focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                    >
                      <option value="common">일반</option>
                      <option value="rare">레어</option>
                      <option value="epic">에픽</option>
                      <option value="legendary">전설</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="타이틀 설명"
                    value={titleForm.description}
                    onChange={(e) => setTitleForm({ ...titleForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 
                               bg-white/50 dark:bg-gray-900/50 text-light-text dark:text-dark-text
                               focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent mb-3"
                  />
                  <input
                    type="text"
                    placeholder="획득 조건"
                    value={titleForm.condition}
                    onChange={(e) => setTitleForm({ ...titleForm, condition: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 
                               bg-white/50 dark:bg-gray-900/50 text-light-text dark:text-dark-text
                               focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent mb-3"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddTitle}
                      disabled={titleLoading || !titleForm.name || !titleForm.description || !titleForm.condition}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg 
                                 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <PlusIcon className="w-4 h-4" />
                      {titleLoading ? '부여 중...' : '타이틀 부여'}
                    </button>
                    <button
                      onClick={() => {
                        setShowTitleForm(false)
                        setShowTemplates(false)
                        setTitleForm({ name: '', description: '', condition: '', rarity: 'common' })
                      }}
                      className="px-4 py-2 text-light-text/60 dark:text-dark-text/60 hover:text-light-text dark:hover:text-dark-text transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Titles List */}
              {user.titles && user.titles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {user.titles.map((title, index) => (
                    <div key={index} className="p-3 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-light-text dark:text-dark-text">
                          {title.name}
                          {user.selectedTitle === title.id && (
                            <span className="ml-2 text-xs bg-light-accent/20 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent px-2 py-1 rounded">
                              사용중
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${rarityColors[title.rarity]}`}>
                            {title.rarity}
                          </span>
                          {isEditing && (
                            <button
                              onClick={() => handleRemoveTitle(title.id)}
                              disabled={titleLoading}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 
                                         rounded transition-colors disabled:opacity-50"
                              title="타이틀 회수"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-light-text/60 dark:text-dark-text/60 mb-2">
                        {title.description}
                      </p>
                      <div className="flex items-center justify-between text-xs text-light-text/50 dark:text-dark-text/50">
                        <span>{title.condition}</span>
                        <span>{new Date(title.earnedAt).toLocaleDateString('ko-KR')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-light-text/60 dark:text-dark-text/60">
                  <TrophyIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>획득한 타이틀이 없습니다.</p>
                </div>
              )}
            </div>

            {/* User Preferences */}
            <div>
              <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4">사용자 설정</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg">
                  <h4 className="font-medium text-light-text dark:text-dark-text mb-2">테마 설정</h4>
                  <p className="text-sm text-light-text/60 dark:text-dark-text/60">
                    {user.preferences?.theme === 'light' ? '라이트 모드' : 
                     user.preferences?.theme === 'dark' ? '다크 모드' : '시스템 설정'}
                  </p>
                </div>
                <div className="p-4 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg">
                  <h4 className="font-medium text-light-text dark:text-dark-text mb-2">플레이리스트 보기</h4>
                  <p className="text-sm text-light-text/60 dark:text-dark-text/60">
                    {user.preferences?.defaultPlaylistView === 'grid' ? '그리드 보기' : '리스트 보기'}
                  </p>
                </div>
              </div>
            </div>
              </div>
            )}

            {/* 좋아요한 곡 탭 */}
            {activeTab === 'likes' && (
              <div className="space-y-4">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-2 border-light-accent/30 dark:border-dark-accent/30 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
                  </div>
                ) : userDetail?.likedSongs?.length ? (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">
                      좋아요한 곡 ({userDetail.likedSongs.length}곡)
                    </h3>
                    <div className="grid gap-3 max-h-96 overflow-y-auto">
                      {userDetail.likedSongs.map((song) => (
                        <div
                          key={song._id}
                          className="p-3 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20"
                        >
                          <div className="flex items-center gap-3">
                            <MusicalNoteIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-light-text dark:text-dark-text truncate">
                                {song.titleAlias || song.title}
                              </h4>
                              <p className="text-sm text-light-text/60 dark:text-dark-text/60 truncate">
                                {song.artistAlias || song.artist}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <HeartIcon className="w-12 h-12 text-light-text/30 dark:text-dark-text/30 mx-auto mb-3" />
                    <p className="text-light-text/60 dark:text-dark-text/60">아직 좋아요한 곡이 없습니다.</p>
                  </div>
                )}
              </div>
            )}

            {/* 플레이리스트 탭 */}
            {activeTab === 'playlists' && (
              <div className="space-y-4">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-2 border-light-accent/30 dark:border-dark-accent/30 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
                  </div>
                ) : userDetail?.playlists?.length ? (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">
                      플레이리스트 ({userDetail.playlists.length}개)
                    </h3>
                    <div className="grid gap-3 max-h-96 overflow-y-auto">
                      {userDetail.playlists.map((playlist) => (
                        <div
                          key={playlist._id}
                          className="p-4 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <QueueListIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
                                <h4 className="font-medium text-light-text dark:text-dark-text truncate">
                                  {playlist.name}
                                </h4>
                                {playlist.isPublic && (
                                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs rounded-full">
                                    공개
                                  </span>
                                )}
                              </div>
                              {playlist.description && (
                                <p className="text-sm text-light-text/60 dark:text-dark-text/60 mb-2 line-clamp-2">
                                  {playlist.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-light-text/50 dark:text-dark-text/50">
                                <span>곡 수: {playlist.songCount}개</span>
                                <span>생성: {new Date(playlist.createdAt).toLocaleDateString()}</span>
                                {playlist.updatedAt !== playlist.createdAt && (
                                  <span>수정: {new Date(playlist.updatedAt).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => window.open(`/playlist/${playlist.shareId}`, '_blank')}
                              className="ml-3 p-2 text-light-accent dark:text-dark-accent hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 rounded-lg transition-colors flex-shrink-0"
                              title="플레이리스트 페이지로 이동"
                            >
                              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <QueueListIcon className="w-12 h-12 text-light-text/30 dark:text-dark-text/30 mx-auto mb-3" />
                    <p className="text-light-text/60 dark:text-dark-text/60">아직 생성한 플레이리스트가 없습니다.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm text-light-text/60 dark:text-dark-text/60">
              <InformationCircleIcon className="w-4 h-4" />
              사용자 ID: {user._id}
            </div>
            <div className="flex items-center gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditForm({
                        role: user.role,
                        displayName: user.displayName || '',
                        profileImageUrl: user.profileImageUrl || ''
                      })
                      setMessage({ type: '', text: '' })
                    }}
                    className="px-4 py-2 text-sm font-medium text-light-text/60 dark:text-dark-text/60 
                               hover:text-light-text dark:hover:text-dark-text transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg 
                               hover:bg-light-accent/90 dark:hover:bg-dark-accent/90 transition-colors
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? '저장 중...' : '저장'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg 
                             hover:bg-light-accent/90 dark:hover:bg-dark-accent/90 transition-colors"
                >
                  편집
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}