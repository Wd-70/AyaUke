'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  HeartIcon, 
  MusicalNoteIcon,
  MagnifyingGlassIcon,
  ChevronUpDownIcon,
  PlayIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'

interface LikedSong {
  _id: string
  songId: {
    _id: string
    title: string
    artist: string
    language?: string
    genre?: string
  }
  createdAt: string
}

interface LikedSongsResponse {
  likes: LikedSong[]
  total: number
  page: number
  totalPages: number
}

export default function LikedSongs() {
  const [likedSongs, setLikedSongs] = useState<LikedSong[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'artist'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchLikedSongs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        search: searchTerm,
        sortBy,
        sortOrder
      })

      const response = await fetch(`/api/user/likes?${params}`)
      if (!response.ok) {
        throw new Error('좋아요한 곡을 불러오는데 실패했습니다.')
      }

      const data: LikedSongsResponse = await response.json()
      setLikedSongs(data.likes)
      setTotalPages(data.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLikedSongs()
  }, [page, searchTerm, sortBy, sortOrder])

  const handleSort = (field: 'date' | 'title' | 'artist') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setPage(1)
  }

  const languageColors: { [key: string]: string } = {
    Korean: 'bg-blue-500',
    English: 'bg-purple-500',
    Japanese: 'bg-pink-500',
    Chinese: 'bg-green-500'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getSortIcon = (field: 'date' | 'title' | 'artist') => {
    if (sortBy !== field) return <ChevronUpDownIcon className="w-4 h-4 opacity-50" />
    return sortOrder === 'asc' ? '↑' : '↓'
  }

  if (loading && likedSongs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
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
            <HeartIcon className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            오류가 발생했습니다
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchLikedSongs}
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
      {/* 헤더 및 검색 */}
      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <HeartSolidIcon className="w-6 h-6 text-red-500" />
              좋아요한 곡들
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {likedSongs.length > 0 && `총 ${likedSongs.length}곡`}
            </p>
          </div>
          
          {/* 검색바 */}
          <div className="relative w-full sm:w-64">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              placeholder="곡 제목이나 아티스트 검색..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent outline-none transition-all duration-200"
            />
          </div>
        </div>

        {/* 정렬 옵션 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => handleSort('date')}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors duration-200 flex items-center gap-1 ${
              sortBy === 'date'
                ? 'bg-light-accent/10 dark:bg-dark-accent/10 border-light-accent/30 dark:border-dark-accent/30 text-light-accent dark:text-dark-accent'
                : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-light-accent/20 dark:hover:border-dark-accent/20'
            }`}
          >
            좋아요 날짜 {getSortIcon('date')}
          </button>
          <button
            onClick={() => handleSort('title')}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors duration-200 flex items-center gap-1 ${
              sortBy === 'title'
                ? 'bg-light-accent/10 dark:bg-dark-accent/10 border-light-accent/30 dark:border-dark-accent/30 text-light-accent dark:text-dark-accent'
                : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-light-accent/20 dark:hover:border-dark-accent/20'
            }`}
          >
            제목순 {getSortIcon('title')}
          </button>
          <button
            onClick={() => handleSort('artist')}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors duration-200 flex items-center gap-1 ${
              sortBy === 'artist'
                ? 'bg-light-accent/10 dark:bg-dark-accent/10 border-light-accent/30 dark:border-dark-accent/30 text-light-accent dark:text-dark-accent'
                : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-light-accent/20 dark:hover:border-dark-accent/20'
            }`}
          >
            아티스트순 {getSortIcon('artist')}
          </button>
        </div>

        {/* 곡 목록 */}
        {likedSongs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <HeartIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchTerm ? '검색 결과가 없습니다' : '아직 좋아요한 곡이 없습니다'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm ? '다른 검색어를 시도해보세요' : '노래책에서 마음에 드는 곡에 좋아요를 눌러보세요'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {likedSongs.map((like, index) => (
              <motion.div
                key={like._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group flex items-center gap-4 p-4 bg-white/80 dark:bg-gray-700/80 rounded-lg border border-gray-200/60 dark:border-gray-600/60 hover:border-light-accent/30 dark:hover:border-dark-accent/30 hover:shadow-md transition-all duration-200"
              >
                {/* 곡 아이콘 */}
                <div className="w-12 h-12 bg-gradient-to-br from-light-accent to-light-secondary dark:from-dark-accent dark:to-dark-secondary rounded-full flex items-center justify-center flex-shrink-0">
                  <MusicalNoteIcon className="w-6 h-6 text-white" />
                </div>

                {/* 곡 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {like.songId.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {like.songId.artist}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {like.songId.language && (
                          <span className={`inline-block w-2 h-2 rounded-full ${
                            languageColors[like.songId.language] || 'bg-gray-400'
                          }`} />
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(like.createdAt)}에 좋아요
                        </span>
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={() => {
                          // 노래책으로 이동하여 해당 곡 표시
                          window.open(`/songbook?search=${encodeURIComponent(like.songId.title)}`, '_blank')
                        }}
                        className="p-2 text-gray-400 hover:text-light-accent dark:hover:text-dark-accent transition-colors duration-200"
                        title="노래책에서 보기"
                      >
                        <PlayIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6">
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-light-accent/20 dark:hover:border-dark-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                이전
              </button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors duration-200 ${
                      page === pageNum
                        ? 'bg-light-accent dark:bg-dark-accent text-white border-light-accent dark:border-dark-accent'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-light-accent/20 dark:hover:border-dark-accent/20'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-light-accent/20 dark:hover:border-dark-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}