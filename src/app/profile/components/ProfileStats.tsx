'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  HeartIcon, 
  MusicalNoteIcon,
  CalendarDaysIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'

interface UserStats {
  totals: {
    likes: number
    playlists: number
    songsInPlaylists: number
  }
  user: {
    channelName: string
    joinedAt: string
    lastLoginAt: string
  }
}

export default function ProfileStats() {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user/stats')
      if (!response.ok) {
        throw new Error('통계 정보를 불러오는데 실패했습니다.')
      }

      const data = await response.json()
      setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-6 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-6">
        <div className="text-center py-4">
          <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
          <button
            onClick={fetchStats}
            className="mt-2 px-3 py-1 text-xs bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const statCards = [
    {
      icon: HeartSolidIcon,
      label: '좋아요한 곡',
      value: stats.totals.likes,
      color: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800'
    },
    {
      icon: MusicalNoteIcon,
      label: '플레이리스트',
      value: stats.totals.playlists,
      color: 'text-light-accent dark:text-dark-accent',
      bgColor: 'bg-light-accent/10 dark:bg-dark-accent/10',
      borderColor: 'border-light-accent/20 dark:border-dark-accent/20'
    },
    {
      icon: SparklesIcon,
      label: '수집한 곡',
      value: stats.totals.songsInPlaylists,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800'
    },
    {
      icon: CalendarDaysIcon,
      label: '가입일',
      value: formatDate(stats.user.joinedAt),
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      isDate: true
    }
  ]

  return (
    <div className="space-y-6">
      {/* 통계 카드들 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, index) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border rounded-xl p-4 hover:shadow-lg transition-all duration-200 ${card.borderColor}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${card.bgColor}`}>
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {card.label}
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                    {card.isDate ? card.value : typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                    {!card.isDate && typeof card.value === 'number' && (
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                        {card.label.includes('곡') ? '곡' : '개'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* 활동 요약 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          활동 요약
        </h3>
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex justify-between items-center">
            <span>마지막 접속</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {formatDate(stats.user.lastLoginAt)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>평균 플레이리스트당 곡 수</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {stats.totals.playlists > 0 
                ? Math.round(stats.totals.songsInPlaylists / stats.totals.playlists)
                : 0
              }곡
            </span>
          </div>
          {stats.totals.likes > 0 && (
            <div className="flex justify-between items-center">
              <span>음악 활동 지수</span>
              <span className="text-light-accent dark:text-dark-accent font-medium">
                {stats.totals.likes + stats.totals.playlists > 50 ? '매우 활발' : 
                 stats.totals.likes + stats.totals.playlists > 20 ? '활발' : 
                 stats.totals.likes + stats.totals.playlists > 5 ? '보통' : '시작 단계'}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}