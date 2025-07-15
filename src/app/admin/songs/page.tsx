'use client'

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  MusicalNoteIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  PlusIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  TagIcon,
  LanguageIcon,
  LinkIcon,
  ClockIcon,
  HeartIcon,
  ListBulletIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ArrowLeftIcon,
  Bars3Icon,
  TableCellsIcon,
  PlayIcon
} from '@heroicons/react/24/outline'
import Navigation from '@/components/Navigation'

interface AdminSong {
  id: string
  title: string
  artist: string
  originalTitle: string
  originalArtist: string
  language: string
  tags?: string[]
  mrLinks?: string[]
  hasLyrics: boolean
  lyrics?: string
  sungCount: number
  likedCount: number
  addedDate: string
  status: 'complete' | 'missing-mr' | 'missing-lyrics' | 'new'
  keyAdjustment?: number | null
  selectedMRIndex?: number
  personalNotes?: string
  source?: string
}

interface AdminStats {
  total: number
  complete: number
  missingMR: number
  missingLyrics: number
  newSongs: number
  languages: {
    Korean: number
    English: number
    Japanese: number
    Other: number
  }
}

export default function SongManagement() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [songs, setSongs] = useState<AdminSong[]>([])
  const [filteredSongs, setFilteredSongs] = useState<AdminSong[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [stats, setStats] = useState<AdminStats>({
    total: 0,
    complete: 0,
    missingMR: 0,
    missingLyrics: 0,
    newSongs: 0,
    languages: {
      Korean: 0,
      English: 0,
      Japanese: 0,
      Other: 0
    }
  })

  // 실제 데이터 로드
  const loadSongs = async () => {
    try {
      setLoading(true)
      console.log('🔄 관리자 노래 목록 로딩 시작...')
      
      const response = await fetch('/api/admin/songs', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success) {
        console.log(`✅ 노래 목록 로딩 완료: ${data.songs.length}곡`)
        setSongs(data.songs)
        setFilteredSongs(data.songs)
        setStats(data.stats)
      } else {
        throw new Error(data.error || '데이터 로드 실패')
      }
    } catch (error) {
      console.error('❌ 노래 목록 로딩 오류:', error)
      // 에러 시 사용자에게 알림
      alert('노래 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    if (!session.user.isAdmin) {
      router.push('/')
      return
    }

    // 실제 데이터 로드
    loadSongs()
  }, [session, status])

  // 필터링 효과
  useEffect(() => {
    let filtered = songs.filter(song => {
      const matchesSearch = song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           song.artist.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesLanguage = selectedLanguage === 'all' || song.language === selectedLanguage
      const matchesStatus = selectedStatus === 'all' || song.status === selectedStatus
      
      return matchesSearch && matchesLanguage && matchesStatus
    })
    
    setFilteredSongs(filtered)
  }, [songs, searchTerm, selectedLanguage, selectedStatus])

  // 일괄 작업 실행
  const executeBulkAction = async (action: string, data?: any) => {
    if (selectedSongs.size === 0) {
      alert('곡을 선택해주세요.')
      return
    }

    try {
      setBulkActionLoading(true)
      console.log(`🔧 일괄 작업 실행: ${action}, 대상: ${selectedSongs.size}곡`)
      
      const response = await fetch('/api/admin/songs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action,
          songIds: Array.from(selectedSongs),
          data: data
        })
      })

      const result = await response.json()
      
      if (result.success) {
        alert(`${result.message} (${result.affectedCount}곡 처리됨)`)
        setSelectedSongs(new Set()) // 선택 해제
        // 데이터 다시 로드
        await loadSongs()
      } else {
        throw new Error(result.error || '작업 실패')
      }
    } catch (error) {
      console.error('❌ 일괄 작업 오류:', error)
      alert('작업 중 오류가 발생했습니다.')
    } finally {
      setBulkActionLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-light-background dark:bg-dark-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-light-accent/30 dark:border-dark-accent/30 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
          <div className="text-light-text/60 dark:text-dark-text/60">
            {loading ? '노래 목록을 불러오는 중...' : '로딩 중...'}
          </div>
        </div>
      </div>
    )
  }

  if (!session || !session.user.isAdmin) {
    return null
  }

  const statusColors = {
    complete: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'missing-mr': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'missing-lyrics': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  }

  const statusLabels = {
    complete: '완료',
    'missing-mr': 'MR 없음',
    'missing-lyrics': '가사 없음',
    new: '신규'
  }

  const handleSelectAll = () => {
    if (selectedSongs.size === filteredSongs.length) {
      setSelectedSongs(new Set())
    } else {
      setSelectedSongs(new Set(filteredSongs.map(song => song.id)))
    }
  }

  const handleSelectSong = (songId: string) => {
    const newSelected = new Set(selectedSongs)
    if (newSelected.has(songId)) {
      newSelected.delete(songId)
    } else {
      newSelected.add(songId)
    }
    setSelectedSongs(newSelected)
  }

  const quickStats = [
    {
      title: "전체 곡",
      value: stats.total,
      icon: MusicalNoteIcon,
      color: "from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple"
    },
    {
      title: "완료된 곡",
      value: stats.complete,
      icon: CheckCircleIcon,
      color: "from-green-400 to-emerald-500"
    },
    {
      title: "MR 없음",
      value: stats.missingMR,
      icon: ExclamationTriangleIcon,
      color: "from-red-400 to-pink-500"
    },
    {
      title: "신규 곡",
      value: stats.newSongs,
      icon: PlusIcon,
      color: "from-blue-400 to-indigo-500"
    }
  ]

  const bulkActions = [
    {
      title: "일괄 편집",
      description: "선택된 곡들의 정보를 한번에 수정",
      icon: PencilIcon,
      color: "bg-light-accent hover:bg-light-accent/80",
      action: () => {
        // TODO: 일괄 편집 모달 열기
        alert('일괄 편집 기능이 곧 추가됩니다!')
      }
    },
    {
      title: "MR 자동 검색",
      description: "YouTube에서 MR 링크 자동 검색",
      icon: MagnifyingGlassIcon,
      color: "bg-orange-500 hover:bg-orange-600",
      action: () => {
        if (confirm(`선택된 ${selectedSongs.size}곡의 MR을 자동으로 검색하시겠습니까?`)) {
          executeBulkAction('auto-search-mr')
        }
      }
    },
    {
      title: "가사 일괄 추가",
      description: "선택된 곡들에 가사 추가",
      icon: TagIcon,
      color: "bg-green-500 hover:bg-green-600",
      action: () => {
        // TODO: 가사 일괄 추가 모달 열기
        alert('가사 일괄 추가 기능이 곧 추가됩니다!')
      }
    },
    {
      title: "삭제",
      description: "선택된 곡들을 삭제",
      icon: TrashIcon,
      color: "bg-red-500 hover:bg-red-600",
      action: () => {
        if (confirm(`정말로 선택된 ${selectedSongs.size}곡을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
          executeBulkAction('delete')
        }
      }
    }
  ]

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background">
      <Navigation currentPath="/admin/songs" />
      
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-light-accent/5 dark:bg-dark-accent/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-light-secondary/5 dark:bg-dark-secondary/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.push('/admin')}
              className="w-12 h-12 bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl 
                         border border-light-primary/20 dark:border-dark-primary/20 
                         hover:border-light-accent/40 dark:hover:border-dark-accent/40 
                         transition-all duration-300 flex items-center justify-center group"
            >
              <ArrowLeftIcon className="w-5 h-5 text-light-text dark:text-dark-text group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="w-16 h-16 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple 
                            rounded-2xl flex items-center justify-center shadow-lg">
              <MusicalNoteIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold font-display gradient-text">
                노래 관리
              </h1>
              <p className="text-light-text/70 dark:text-dark-text/70 text-lg mt-2">
                곡 정보 편집, MR 관리, 일괄 작업
              </p>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {quickStats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 
                         border border-light-primary/20 dark:border-dark-primary/20"
            >
              <div className="flex items-center gap-4 mb-2">
                <div className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-lg flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-2xl font-bold text-light-text dark:text-dark-text">
                  {stat.value}
                </div>
              </div>
              <div className="text-sm text-light-text/60 dark:text-dark-text/60">
                {stat.title}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 
                     border border-light-primary/20 dark:border-dark-primary/20 mb-8"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-light-text/40 dark:text-dark-text/40" />
              <input
                type="text"
                placeholder="노래 제목이나 아티스트로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                           rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                           text-light-text dark:text-dark-text placeholder-light-text/40 dark:placeholder-dark-text/40"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-3">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="px-4 py-3 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                           rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                           text-light-text dark:text-dark-text"
              >
                <option value="all">모든 언어 ({stats.total})</option>
                <option value="Korean">한국어 ({stats.languages.Korean})</option>
                <option value="English">영어 ({stats.languages.English})</option>
                <option value="Japanese">일본어 ({stats.languages.Japanese})</option>
                {stats.languages.Other > 0 && (
                  <option value="Other">기타 ({stats.languages.Other})</option>
                )}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-3 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                           rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                           text-light-text dark:text-dark-text"
              >
                <option value="all">모든 상태</option>
                <option value="complete">완료</option>
                <option value="missing-mr">MR 없음</option>
                <option value="missing-lyrics">가사 없음</option>
                <option value="new">신규</option>
              </select>

              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
                className="px-4 py-3 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                           rounded-lg hover:border-light-accent/40 dark:hover:border-dark-accent/40 
                           transition-all duration-300 text-light-text dark:text-dark-text"
              >
                {viewMode === 'grid' ? <TableCellsIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
              </button>

              <button
                onClick={loadSongs}
                disabled={loading}
                className="px-4 py-3 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                           rounded-lg hover:border-light-accent/40 dark:hover:border-dark-accent/40 
                           transition-all duration-300 text-light-text dark:text-dark-text
                           disabled:opacity-50 disabled:cursor-not-allowed"
                title="새로고침"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-light-accent/30 dark:border-dark-accent/30 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Bulk Actions */}
          <AnimatePresence>
            {selectedSongs.size > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 pt-6 border-t border-light-primary/20 dark:border-dark-primary/20"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-light-text/60 dark:text-dark-text/60">
                    {selectedSongs.size}곡 선택됨
                  </div>
                  <button
                    onClick={() => setSelectedSongs(new Set())}
                    className="text-sm text-light-text/60 dark:text-dark-text/60 hover:text-light-accent dark:hover:text-dark-accent transition-colors"
                  >
                    선택 해제
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {bulkActions.map((action, index) => (
                    <motion.button
                      key={action.title}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      onClick={action.action}
                      disabled={bulkActionLoading}
                      className={`${action.color} text-white rounded-lg p-3 text-sm font-medium 
                                  transition-all duration-300 hover:scale-105 hover:shadow-lg
                                  flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed
                                  disabled:hover:scale-100`}
                    >
                      <action.icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <div className="text-left">
                        <div className="font-medium">{action.title}</div>
                        <div className="text-xs opacity-80">{action.description}</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Songs List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {/* 결과 없음 상태 */}
          {filteredSongs.length === 0 && !loading && (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 bg-light-primary/20 dark:bg-dark-primary/20 
                             rounded-full flex items-center justify-center">
                <MusicalNoteIcon className="w-12 h-12 text-light-text/40 dark:text-dark-text/40" />
              </div>
              <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-2">
                검색 결과가 없습니다
              </h3>
              <p className="text-light-text/70 dark:text-dark-text/70 mb-6">
                다른 검색어나 필터를 시도해보세요
              </p>
              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedLanguage('all')
                  setSelectedStatus('all')
                }}
                className="px-6 py-3 bg-gradient-to-r from-light-accent to-light-purple 
                         dark:from-dark-accent dark:to-dark-purple text-white 
                         rounded-lg hover:shadow-lg transition-all duration-200"
              >
                필터 초기화
              </button>
            </div>
          )}

          {/* 노래 목록 */}
          {filteredSongs.length > 0 && (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSongs.map((song, index) => (
                  <motion.div
                    key={song.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 
                               border border-light-primary/20 dark:border-dark-primary/20 
                               hover:border-light-accent/40 dark:hover:border-dark-accent/40 
                               transition-all duration-300 group cursor-pointer"
                    onClick={() => handleSelectSong(song.id)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-light-text dark:text-dark-text mb-1 line-clamp-1">
                          {song.title}
                        </h3>
                        <p className="text-sm text-light-text/60 dark:text-dark-text/60 line-clamp-1">
                          {song.artist}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedSongs.has(song.id)}
                          onChange={() => handleSelectSong(song.id)}
                          className="w-4 h-4 text-light-accent focus:ring-light-accent border-light-primary/30 rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[song.status]}`}>
                          {statusLabels[song.status]}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-light-text/50 dark:text-dark-text/50 mb-4">
                      <div className="flex items-center gap-1">
                        <LanguageIcon className="w-3 h-3" />
                        <span>{song.language}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <HeartIcon className="w-3 h-3" />
                        <span>{song.likedCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <PlayIcon className="w-3 h-3" />
                        <span>{song.sungCount}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        {song.mrLinks && song.mrLinks.length > 0 && (
                          <div className="w-6 h-6 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 
                                          rounded flex items-center justify-center">
                            <LinkIcon className="w-3 h-3" />
                          </div>
                        )}
                        {song.hasLyrics && (
                          <div className="w-6 h-6 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 
                                          rounded flex items-center justify-center">
                            <PencilIcon className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/songbook?search=${encodeURIComponent(song.title)}`)
                        }}
                        className="p-1 rounded hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors"
                      >
                        <EyeIcon className="w-4 h-4 text-light-text/60 dark:text-dark-text/60" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              // Table View
              <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl 
                             border border-light-primary/20 dark:border-dark-primary/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-light-primary/10 dark:bg-dark-primary/10">
                      <tr>
                        <th className="px-6 py-4 text-left">
                          <input
                            type="checkbox"
                            checked={selectedSongs.size === filteredSongs.length && filteredSongs.length > 0}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-light-accent focus:ring-light-accent border-light-primary/30 rounded"
                          />
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-light-text dark:text-dark-text">제목</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-light-text dark:text-dark-text">아티스트</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-light-text dark:text-dark-text">언어</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-light-text dark:text-dark-text">상태</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-light-text dark:text-dark-text">통계</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-light-text dark:text-dark-text">액션</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-light-primary/10 dark:divide-dark-primary/10">
                      {filteredSongs.map((song, index) => (
                        <motion.tr
                          key={song.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3, delay: index * 0.02 }}
                          className="hover:bg-light-primary/5 dark:hover:bg-dark-primary/5 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedSongs.has(song.id)}
                              onChange={() => handleSelectSong(song.id)}
                              className="w-4 h-4 text-light-accent focus:ring-light-accent border-light-primary/30 rounded"
                            />
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-light-text dark:text-dark-text">
                            {song.title}
                          </td>
                          <td className="px-6 py-4 text-sm text-light-text/70 dark:text-dark-text/70">
                            {song.artist}
                          </td>
                          <td className="px-6 py-4 text-sm text-light-text/70 dark:text-dark-text/70">
                            {song.language}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[song.status]}`}>
                              {statusLabels[song.status]}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-light-text/60 dark:text-dark-text/60">
                            <div className="flex gap-4">
                              <span>♥ {song.likedCount}</span>
                              <span>▶ {song.sungCount}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => router.push(`/songbook?search=${encodeURIComponent(song.title)}`)}
                                className="p-1 rounded hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors"
                              >
                                <EyeIcon className="w-4 h-4 text-light-text/60 dark:text-dark-text/60" />
                              </button>
                              <button className="p-1 rounded hover:bg-red-500/20 transition-colors">
                                <TrashIcon className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </motion.div>

        {/* Floating Action Button */}
        <motion.button
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple 
                     rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 
                     flex items-center justify-center text-white z-50"
        >
          <PlusIcon className="w-6 h-6" />
        </motion.button>
      </div>
    </div>
  )
}