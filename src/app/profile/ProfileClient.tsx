'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useActivity } from '@/hooks/useActivity'
import { motion } from 'framer-motion'
import { 
  UserIcon, 
  PencilIcon, 
  HeartIcon, 
  MusicalNoteIcon,
  PlayIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  Cog6ToothIcon,
  SparklesIcon,
  TrophyIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import Navigation from '@/components/Navigation'
import ProfileEditor from './components/ProfileEditor'
import LikedSongs from './components/LikedSongs'
import PlaylistManager from './components/PlaylistManager'
import ProfileStats from './components/ProfileStats'
import TitleManager from './components/TitleManager'

export default function ProfileClient() {
  // 프로필 페이지 활동 추적
  useActivity()
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState<'overview' | 'likes' | 'playlists' | 'titles'>('overview')
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)

  // 사용자 프로필 데이터 로드
  useEffect(() => {
    if (session?.user?.channelId && !userProfile) {
      loadUserProfile()
    }
  }, [session?.user?.channelId, userProfile])

  const loadUserProfile = async () => {
    setIsLoadingProfile(true)
    try {
      const response = await fetch('/api/user/profile')
      if (response.ok) {
        const data = await response.json()
        setUserProfile(data.user)
      }
    } catch (error) {
      console.error('프로필 로딩 실패:', error)
    } finally {
      setIsLoadingProfile(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-light-background to-light-primary/10 dark:from-dark-background dark:to-dark-primary/10">
        <Navigation currentPath="/profile" />
        <div className="pt-20 flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-light-accent dark:border-dark-accent"></div>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  const tabs = [
    { 
      id: 'overview' as const, 
      label: '프로필', 
      icon: UserIcon,
      description: '내 정보 관리'
    },
    { 
      id: 'titles' as const, 
      label: '타이틀', 
      icon: TrophyIcon,
      description: '보유 타이틀 관리'
    },
    { 
      id: 'likes' as const, 
      label: '좋아요', 
      icon: HeartSolidIcon,
      description: '좋아하는 곡들'
    },
    { 
      id: 'playlists' as const, 
      label: '플레이리스트', 
      icon: MusicalNoteIcon,
      description: '내 플레이리스트 관리'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-background to-light-primary/10 dark:from-dark-background dark:to-dark-primary/10">
      <Navigation currentPath="/profile" />
      
      <div className="pt-20 pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 헤더 섹션 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-light-accent/20 via-light-secondary/20 to-light-accent/20 dark:from-dark-primary/20 dark:via-dark-secondary/20 dark:to-dark-accent/20 backdrop-blur-sm border border-light-primary/20 dark:border-dark-primary/20">
              {/* 배경 장식 요소 */}
              <div className="absolute inset-0 bg-gradient-to-r from-light-accent/5 to-light-secondary/5 dark:from-dark-primary/5 dark:to-dark-secondary/5" />
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-light-accent/10 dark:bg-dark-accent/10 rounded-full blur-xl" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-light-secondary/10 dark:bg-dark-secondary/10 rounded-full blur-xl" />
              
              <div className="relative p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  {/* 프로필 이미지 */}
                  <div className="relative">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-gradient-to-br from-light-accent to-light-secondary dark:from-dark-accent to-dark-secondary ring-4 ring-white/20 dark:ring-gray-800/20">
                      {userProfile?.profileImageUrl || session.user.image ? (
                        <img
                          src={userProfile?.profileImageUrl || session.user.image}
                          alt={userProfile?.displayName || session.user.name || 'Profile'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <UserIcon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="absolute -bottom-1 -right-1 w-8 h-8 bg-light-accent dark:bg-dark-accent text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform duration-200 shadow-lg"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 사용자 정보 */}
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                          {userProfile?.displayName || session.user.name || session.user.channelName}
                        </h1>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <SparklesIcon className="w-4 h-4" />
                            치지직 사용자
                          </span>
                          {session.user.isAdmin && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-light-accent/20 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent rounded-full">
                              <Cog6ToothIcon className="w-3 h-3" />
                              {session.user.role === 'super_admin' ? '최고 관리자' : 
                               session.user.role === 'song_admin' ? '노래 관리자' : 
                               session.user.role === 'ayauke_admin' ? '노래책 관리자' :
                               session.user.role === 'song_editor' ? '노래 편집자' : '관리자'}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setIsEditingProfile(true)}
                        className="px-4 py-2 bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent border border-light-accent/20 dark:border-dark-accent/20 rounded-lg hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors duration-200 flex items-center gap-2"
                      >
                        <PencilIcon className="w-4 h-4" />
                        프로필 편집
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 탭 네비게이션 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row gap-4">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex-1 p-4 rounded-xl border transition-all duration-300 group ${
                      isActive
                        ? 'bg-light-accent/10 dark:bg-dark-accent/10 border-light-accent/30 dark:border-dark-accent/30 text-light-accent dark:text-dark-accent'
                        : 'bg-white/60 dark:bg-gray-800/60 border-gray-200/60 dark:border-gray-700/60 hover:border-light-accent/20 dark:hover:border-dark-accent/20 text-gray-600 dark:text-gray-400 hover:text-light-accent dark:hover:text-dark-accent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg transition-colors duration-300 ${
                        isActive
                          ? 'bg-light-accent/20 dark:bg-dark-accent/20'
                          : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-light-accent/10 dark:group-hover:bg-dark-accent/10'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium">{tab.label}</div>
                        <div className="text-xs opacity-70">{tab.description}</div>
                      </div>
                    </div>
                    
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-light-accent/5 to-light-secondary/5 dark:from-dark-accent/5 dark:to-dark-secondary/5"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>

          {/* 탭 콘텐츠 */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 통계 정보 */}
                <ProfileStats />
                
                {/* 계정 정보 */}
                <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">계정 정보</h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">치지직 ID</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {session.user.channelId}
                      </span>
                    </div>
                    {session.user.followerCount && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">팔로워</span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {session.user.followerCount.toLocaleString()}명
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'titles' && <TitleManager />}
            {activeTab === 'likes' && <LikedSongs />}
            {activeTab === 'playlists' && <PlaylistManager />}
          </motion.div>
        </div>
      </div>

      {/* 프로필 편집 모달 */}
      {isEditingProfile && (
        <ProfileEditor
          isOpen={isEditingProfile}
          onClose={() => setIsEditingProfile(false)}
          onSuccess={() => {
            // 프로필 업데이트 성공 시 데이터 새로고침
            loadUserProfile()
            setIsEditingProfile(false)
          }}
          initialUserData={userProfile ? {
            displayName: userProfile.displayName,
            profileImageUrl: userProfile.profileImageUrl
          } : undefined}
        />
      )}
    </div>
  )
}