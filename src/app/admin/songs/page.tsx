'use client'

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { useActivity } from '@/hooks/useActivity'
import { motion, AnimatePresence } from "framer-motion"
import { hasPermission, Permission, UserRole, canManageSongs } from "@/lib/permissions"
import { 
  MusicalNoteIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  LanguageIcon,
  LinkIcon,
  HeartIcon,
  PencilIcon,
  TrashIcon,
  ArrowLeftIcon,
  Bars3Icon,
  TableCellsIcon,
  PlayIcon,
  TagIcon
} from '@heroicons/react/24/outline'
import Navigation from '@/components/Navigation'
import SongEditModal from '@/components/admin/SongEditModal'

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
  status: 'complete' | 'missing-mr' | 'missing-lyrics' | 'incomplete'
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
  incomplete: number
  languages: {
    Korean: number
    English: number
    Japanese: number
    Chinese: number
    Other: number
  }
}

export default function SongManagement() {
  // 노래관리 페이지 활동 추적
  useActivity()
  const { data: session, status } = useSession()
  const router = useRouter()
  const initializedRef = useRef(false)
  const [songs, setSongs] = useState<AdminSong[]>([])
  const [filteredSongs, setFilteredSongs] = useState<AdminSong[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [loading, setLoading] = useState(true)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(24) // 그리드 뷰에서 보기 좋은 수 (3x8)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [showBulkEditModal, setShowBulkEditModal] = useState(false)
  const [showTagAddModal, setShowTagAddModal] = useState(false)
  const [showSongEditModal, setShowSongEditModal] = useState(false)
  const [editingSong, setEditingSong] = useState<AdminSong | null>(null)
  const [stats, setStats] = useState<AdminStats>({
    total: 0,
    complete: 0,
    missingMR: 0,
    missingLyrics: 0,
    incomplete: 0,
    languages: {
      Korean: 0,
      English: 0,
      Japanese: 0,
      Chinese: 0,
      Other: 0
    }
  })

  // 실제 데이터 로드
  const loadSongs = useCallback(async (showFullLoading = false) => {
    try {
      // 초기 로딩이나 새로고침 버튼 클릭 시에만 전체 페이지 로딩 표시
      if (showFullLoading) {
        setLoading(true)
      }
      
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
      if (showFullLoading) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    if (!canManageSongs(session.user.role as UserRole)) {
      router.push('/')
      return
    }

    // 이미 초기화되었으면 건너뛰기
    if (initializedRef.current) return
    
    initializedRef.current = true

    // 실제 데이터 로드 - 페이지 로딩 시 한 번만 실행
    loadSongs(true)
  }, [session, status]) // loadSongs 제거로 재실행 방지

  // 필터링 효과
  useEffect(() => {
    const filtered = songs.filter(song => {
      const matchesSearch = song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           song.artist.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesLanguage = selectedLanguage === 'all' || song.language === selectedLanguage
      const matchesStatus = selectedStatus === 'all' || song.status === selectedStatus
      
      return matchesSearch && matchesLanguage && matchesStatus
    })
    
    setFilteredSongs(filtered)
    setCurrentPage(1) // 필터링 시 첫 페이지로 이동
  }, [songs, searchTerm, selectedLanguage, selectedStatus])

  // 현재 페이지의 곡들
  const currentSongs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredSongs.slice(startIndex, endIndex)
  }, [filteredSongs, currentPage, itemsPerPage])

  // 페이지 정보 계산
  const totalPages = Math.ceil(filteredSongs.length / itemsPerPage)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  // Hook들을 최상단에 모두 선언
  const handleSelectSong = useCallback((songId: string) => {
    setSelectedSongs(prev => {
      const newSelected = new Set(prev)
      if (newSelected.has(songId)) {
        newSelected.delete(songId)
      } else {
        newSelected.add(songId)
      }
      return newSelected
    })
  }, [])

  // 권한별 사용 가능한 작업들을 미리 계산
  const userRole = session?.user?.role as UserRole
  const userPermissions = useMemo(() => ({
    canEdit: userRole ? hasPermission(userRole, Permission.SONGS_EDIT) : false,
    canCreate: userRole ? hasPermission(userRole, Permission.SONGS_CREATE) : false,
    canDelete: userRole ? hasPermission(userRole, Permission.SONGS_DELETE) : false
  }), [userRole])

  const handleSelectAll = useCallback(() => {
    // 전체 필터링된 곡들 중에서 선택된 곡의 수 계산
    const selectedFilteredSongs = filteredSongs.filter(song => selectedSongs.has(song.id))
    
    if (selectedFilteredSongs.length === filteredSongs.length) {
      // 전체 해제: 현재 필터링된 곡들만 선택에서 제거
      setSelectedSongs(prev => {
        const newSelected = new Set(prev)
        filteredSongs.forEach(song => newSelected.delete(song.id))
        return newSelected
      })
    } else {
      // 전체 선택: 현재 필터링된 모든 곡들 선택
      setSelectedSongs(prev => {
        const newSelected = new Set(prev)
        filteredSongs.forEach(song => newSelected.add(song.id))
        return newSelected
      })
    }
  }, [selectedSongs, filteredSongs])

  // 일괄 작업 실행
  const executeBulkAction = useCallback(async (action: string, data?: unknown) => {
    if (selectedSongs.size === 0) {
      alert('곡을 선택해주세요.')
      return
    }

    try {
      setBulkActionLoading(true)
      
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
        // 데이터 다시 로드 (백그라운드에서 조용히)
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
  }, [selectedSongs, loadSongs])

  // 일괄 작업 버튼 정의
  const bulkActions = useMemo(() => {
    const actions = []
    
    if (selectedSongs.size > 0) {
      // 편집 권한이 있는 경우에만 편집 관련 액션 추가
      if (userPermissions.canEdit) {
        actions.push(
          {
            title: "일괄 편집",
            description: "선택한 곡들의 정보 일괄 수정",
            icon: PencilIcon,
            color: "bg-gradient-to-r from-blue-500 to-blue-600",
            action: () => setShowBulkEditModal(true)
          },
          {
            title: "태그 추가",
            description: "선택한 곡들에 태그 추가",
            icon: TagIcon,
            color: "bg-gradient-to-r from-green-500 to-green-600",
            action: () => setShowTagAddModal(true)
          }
        )
      }
      
      // 삭제 권한이 있는 경우에만 삭제 액션 추가
      if (userPermissions.canDelete) {
        actions.push({
          title: "곡 삭제",
          description: "선택한 곡들을 삭제",
          icon: TrashIcon,
          color: "bg-gradient-to-r from-red-500 to-red-600",
          action: () => {
            if (confirm(`선택한 ${selectedSongs.size}곡을 정말 삭제하시겠습니까?`)) {
              executeBulkAction('delete-songs')
            }
          }
        })
      }
    }
    
    return actions
  }, [selectedSongs.size, userPermissions.canEdit, userPermissions.canDelete, executeBulkAction])

  // 새 곡 추가 함수
  const handleAddSong = useCallback(async (songData: {
    title: string
    artist: string
    language: string
    lyrics?: string
    mrLinks?: string[]
    tags?: string[]
  }) => {
    try {
      setAddLoading(true)
      
      const response = await fetch('/api/admin/songs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'add-song',
          songData: songData
        })
      })

      const result = await response.json()
      
      if (result.success) {
        alert(`${songData.title} 곡이 성공적으로 추가되었습니다!`)
        setShowAddModal(false)
        // 데이터 다시 로드 (백그라운드에서 조용히)
        await loadSongs()
      } else {
        throw new Error(result.error || '곡 추가 실패')
      }
    } catch (error) {
      console.error('❌ 새 곡 추가 오류:', error)
      alert('곡 추가 중 오류가 발생했습니다.')
    } finally {
      setAddLoading(false)
    }
  }, [loadSongs])

  // 개별 곡 편집 함수
  const handleEditSong = useCallback((song: AdminSong) => {
    setEditingSong(song)
    setShowSongEditModal(true)
  }, [])

  // 개별 곡 삭제 함수
  const handleDeleteSong = useCallback(async (song: AdminSong) => {
    if (!confirm(`"${song.title} - ${song.artist}" 곡을 정말 삭제하시겠습니까?`)) {
      return
    }

    try {
      setBulkActionLoading(true)
      
      const response = await fetch('/api/admin/songs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete-songs',
          songIds: [song.id],
          data: { reason: '개별 삭제' }
        })
      })

      const result = await response.json()
      
      if (result.success) {
        alert(`"${song.title}" 곡이 성공적으로 삭제되었습니다.`)
        // 데이터 다시 로드 (백그라운드에서 조용히)
        await loadSongs()
      } else {
        throw new Error(result.error || '곡 삭제 실패')
      }
    } catch (error) {
      console.error('❌ 곡 삭제 오류:', error)
      alert('곡 삭제 중 오류가 발생했습니다.')
    } finally {
      setBulkActionLoading(false)
    }
  }, [loadSongs])

  // 개별 곡 업데이트 함수
  const handleUpdateSong = useCallback(async (songData: {
    title?: string
    artist?: string
    language?: string
    keyAdjustment?: number | null
    lyrics?: string
    mrLinks?: string[]
    tags?: string[]
  }) => {
    if (!editingSong) return

    try {
      setBulkActionLoading(true)
      
      const response = await fetch('/api/admin/songs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'edit-song',
          songIds: [editingSong.id],
          data: songData
        })
      })

      const result = await response.json()
      
      if (result.success) {
        alert(`${editingSong.title} 곡이 성공적으로 수정되었습니다!`)
        setShowSongEditModal(false)
        setEditingSong(null)
        // 데이터 다시 로드 (백그라운드에서 조용히)
        await loadSongs()
      } else {
        throw new Error(result.error || '곡 수정 실패')
      }
    } catch (error) {
      console.error('❌ 개별 곡 수정 오류:', error)
      alert('곡 수정 중 오류가 발생했습니다.')
    } finally {
      setBulkActionLoading(false)
    }
  }, [editingSong, loadSongs])

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

  if (!session || !canManageSongs(session.user.role as UserRole)) {
    return null
  }

  const statusColors = {
    complete: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'missing-mr': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'missing-lyrics': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    incomplete: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
  }

  const statusLabels = {
    complete: '완료',
    'missing-mr': 'MR 없음',
    'missing-lyrics': '가사 없음',
    incomplete: '미완성'
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
      title: "가사 없음",
      value: stats.missingLyrics,
      icon: PencilIcon,
      color: "from-yellow-400 to-orange-500"
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
                <option value="Chinese">중국어 ({stats.languages.Chinese})</option>
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
                <option value="incomplete">미완성</option>
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
                onClick={() => {
                  initializedRef.current = false; // 재초기화 허용
                  loadSongs(true);
                }}
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

              {/* 새 곡 추가 버튼 - 생성 권한이 있을 때만 표시 */}
              {userPermissions.canCreate && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-3 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple 
                             text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-300 
                             flex items-center gap-2 font-medium"
                  title="새 곡 추가"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span className="hidden sm:inline">새 곡 추가</span>
                </button>
              )}
            </div>
          </div>

          {/* Bulk Actions */}
          <AnimatePresence>
            {(selectedSongs.size > 0 || bulkActions.length > 0) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 pt-6 border-t border-light-primary/20 dark:border-dark-primary/20"
              >
                {selectedSongs.size > 0 && (
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
                )}
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
                {currentSongs.map((song) => (
                  <motion.div
                    key={song.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => handleSelectSong(song.id)}
                    className={`bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 
                               border transition-all duration-200 group cursor-pointer
                               ${selectedSongs.has(song.id) 
                                 ? 'border-light-accent dark:border-dark-accent bg-light-accent/10 dark:bg-dark-accent/10' 
                                 : 'border-light-primary/20 dark:border-dark-primary/20 hover:border-light-accent/40 dark:hover:border-dark-accent/40'
                               }`}
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
                          onChange={(e) => {
                            e.stopPropagation()
                            handleSelectSong(song.id)
                          }}
                          className="w-4 h-4 text-light-accent focus:ring-light-accent border-light-primary/30 rounded"
                        />
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[song.status]}`}>
                          {statusLabels[song.status]}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-light-text/50 dark:text-dark-text/50 mb-3">
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
                      {song.keyAdjustment !== null && song.keyAdjustment !== undefined && (
                        <div className="flex items-center gap-1">
                          <MusicalNoteIcon className="w-3 h-3" />
                          <span>
                            {song.keyAdjustment === 0 ? '원본키' : `${song.keyAdjustment > 0 ? '+' : ''}${song.keyAdjustment}`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 검색 태그 */}
                    {song.tags && song.tags.length > 0 && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-1">
                          {song.tags.slice(0, 3).map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-0.5 bg-light-accent/10 dark:bg-dark-accent/10 
                                         text-light-accent dark:text-dark-accent rounded-full text-xs border 
                                         border-light-accent/20 dark:border-dark-accent/20"
                            >
                              {tag}
                            </span>
                          ))}
                          {song.tags.length > 3 && (
                            <span className="inline-flex items-center px-2 py-0.5 bg-light-primary/10 dark:bg-dark-primary/10 
                                           text-light-text/60 dark:text-dark-text/60 rounded-full text-xs border 
                                           border-light-primary/20 dark:border-dark-primary/20">
                              +{song.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

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
                      {userPermissions.canEdit && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditSong(song)
                          }}
                          className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-200"
                          title="곡 편집"
                        >
                          <PencilIcon className="w-5 h-5 text-blue-500" />
                        </button>
                      )}
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
                            checked={filteredSongs.length > 0 && filteredSongs.filter(song => selectedSongs.has(song.id)).length === filteredSongs.length}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-light-accent focus:ring-light-accent border-light-primary/30 rounded"
                          />
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-light-text dark:text-dark-text">제목</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-light-text dark:text-dark-text">아티스트</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-light-text dark:text-dark-text">언어</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-light-text dark:text-dark-text">키</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-light-text dark:text-dark-text">태그</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-light-text dark:text-dark-text">상태</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-light-text dark:text-dark-text">통계</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-light-text dark:text-dark-text">액션</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-light-primary/10 dark:divide-dark-primary/10">
                      {currentSongs.map((song) => (
                        <motion.tr
                          key={song.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.1 }}
                          onClick={() => handleSelectSong(song.id)}
                          className={`cursor-pointer transition-colors
                            ${selectedSongs.has(song.id) 
                              ? 'bg-light-accent/10 dark:bg-dark-accent/10' 
                              : 'hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'
                            }`}
                        >
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedSongs.has(song.id)}
                              onChange={(e) => {
                                e.stopPropagation()
                                handleSelectSong(song.id)
                              }}
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
                          <td className="px-6 py-4 text-sm text-light-text/70 dark:text-dark-text/70">
                            {song.keyAdjustment !== null && song.keyAdjustment !== undefined ? (
                              <span className="inline-flex items-center gap-1">
                                <MusicalNoteIcon className="w-3 h-3" />
                                {song.keyAdjustment === 0 ? '원본키' : `${song.keyAdjustment > 0 ? '+' : ''}${song.keyAdjustment}`}
                              </span>
                            ) : (
                              <span className="text-light-text/40 dark:text-dark-text/40">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {song.tags && song.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {song.tags.slice(0, 2).map((tag, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-2 py-0.5 bg-light-accent/10 dark:bg-dark-accent/10 
                                               text-light-accent dark:text-dark-accent rounded-full text-xs border 
                                               border-light-accent/20 dark:border-dark-accent/20"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {song.tags.length > 2 && (
                                  <span className="inline-flex items-center px-2 py-0.5 bg-light-primary/10 dark:bg-dark-primary/10 
                                                 text-light-text/60 dark:text-dark-text/60 rounded-full text-xs border 
                                                 border-light-primary/20 dark:border-dark-primary/20">
                                    +{song.tags.length - 2}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-light-text/40 dark:text-dark-text/40">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusColors[song.status]}`}>
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
                              {userPermissions.canEdit && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditSong(song)
                                  }}
                                  className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-200"
                                  title="곡 편집"
                                >
                                  <PencilIcon className="w-4 h-4 text-blue-500" />
                                </button>
                              )}
                              {userPermissions.canDelete && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteSong(song)
                                  }}
                                  disabled={bulkActionLoading}
                                  className="p-1 rounded hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                  title="곡 삭제"
                                >
                                  <TrashIcon className="w-4 h-4 text-red-500" />
                                </button>
                              )}
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

          {/* 페이징 UI */}
          {filteredSongs.length > 0 && (
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* 페이지 정보 */}
              <div className="text-sm text-light-text/70 dark:text-dark-text/70">
                <span className="font-medium text-light-text dark:text-dark-text">
                  {filteredSongs.length}곡 중 {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredSongs.length)}곡 표시
                </span>
                {selectedSongs.size > 0 && (
                  <span className="ml-2 text-light-accent dark:text-dark-accent">
                    ({selectedSongs.size}곡 선택됨)
                  </span>
                )}
              </div>

              {/* 페이징 버튼 */}
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={!hasPrevPage}
                    className="px-3 py-2 text-sm bg-white/30 dark:bg-gray-900/30 border border-light-primary/20 dark:border-dark-primary/20 
                               rounded-lg hover:border-light-accent/40 dark:hover:border-dark-accent/40 transition-all
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    처음
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={!hasPrevPage}
                    className="px-3 py-2 text-sm bg-white/30 dark:bg-gray-900/30 border border-light-primary/20 dark:border-dark-primary/20 
                               rounded-lg hover:border-light-accent/40 dark:hover:border-dark-accent/40 transition-all
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  
                  {/* 페이지 번호 */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                      if (pageNum > totalPages) return null
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-2 text-sm rounded-lg transition-all
                            ${pageNum === currentPage 
                              ? 'bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple text-white' 
                              : 'bg-white/30 dark:bg-gray-900/30 border border-light-primary/20 dark:border-dark-primary/20 hover:border-light-accent/40 dark:hover:border-dark-accent/40'
                            }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={!hasNextPage}
                    className="px-3 py-2 text-sm bg-white/30 dark:bg-gray-900/30 border border-light-primary/20 dark:border-dark-primary/20 
                               rounded-lg hover:border-light-accent/40 dark:hover:border-dark-accent/40 transition-all
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={!hasNextPage}
                    className="px-3 py-2 text-sm bg-white/30 dark:bg-gray-900/30 border border-light-primary/20 dark:border-dark-primary/20 
                               rounded-lg hover:border-light-accent/40 dark:hover:border-dark-accent/40 transition-all
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    마지막
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* 새 곡 추가 모달 */}
        <AnimatePresence>
          {showAddModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  e.currentTarget.dataset.mouseDownOnBackdrop = 'true';
                }
              }}
              onMouseUp={(e) => {
                if (e.target === e.currentTarget && e.currentTarget.dataset.mouseDownOnBackdrop === 'true') {
                  setShowAddModal(false);
                }
                delete e.currentTarget.dataset.mouseDownOnBackdrop;
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <AddSongModal
                  onClose={() => setShowAddModal(false)}
                  onSubmit={handleAddSong}
                  loading={addLoading}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 일괄 편집 모달 */}
        <AnimatePresence>
          {showBulkEditModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  e.currentTarget.dataset.mouseDownOnBackdrop = 'true';
                }
              }}
              onMouseUp={(e) => {
                if (e.target === e.currentTarget && e.currentTarget.dataset.mouseDownOnBackdrop === 'true') {
                  setShowBulkEditModal(false);
                }
                delete e.currentTarget.dataset.mouseDownOnBackdrop;
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <BulkEditModal
                  selectedCount={selectedSongs.size}
                  onClose={() => setShowBulkEditModal(false)}
                  onSubmit={(editData) => executeBulkAction('bulk-edit', editData)}
                  loading={bulkActionLoading}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 태그 추가 모달 */}
        <AnimatePresence>
          {showTagAddModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  e.currentTarget.dataset.mouseDownOnBackdrop = 'true';
                }
              }}
              onMouseUp={(e) => {
                if (e.target === e.currentTarget && e.currentTarget.dataset.mouseDownOnBackdrop === 'true') {
                  setShowTagAddModal(false);
                }
                delete e.currentTarget.dataset.mouseDownOnBackdrop;
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <TagAddModal
                  selectedCount={selectedSongs.size}
                  onClose={() => setShowTagAddModal(false)}
                  onSubmit={(tagData) => executeBulkAction('add-tags', tagData)}
                  loading={bulkActionLoading}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 개별 곡 편집 모달 */}
        <AnimatePresence>
          {showSongEditModal && editingSong && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-20"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  e.currentTarget.dataset.mouseDownOnBackdrop = 'true';
                }
              }}
              onMouseUp={(e) => {
                if (e.target === e.currentTarget && e.currentTarget.dataset.mouseDownOnBackdrop === 'true') {
                  setShowSongEditModal(false);
                  setEditingSong(null);
                }
                delete e.currentTarget.dataset.mouseDownOnBackdrop;
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-6xl max-h-[calc(100vh-6rem)] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <SongEditModal
                  song={editingSong}
                  onClose={() => {
                    setShowSongEditModal(false)
                    setEditingSong(null)
                  }}
                  onSubmit={handleUpdateSong}
                  loading={bulkActionLoading}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}

// 일괄 편집 모달 컴포넌트
interface BulkEditModalProps {
  selectedCount: number
  onClose: () => void
  onSubmit: (editData: {
    artist?: string
    keyAdjustment?: number
    language?: string
  }) => void
  loading: boolean
}

function BulkEditModal({ selectedCount, onClose, onSubmit, loading }: BulkEditModalProps) {
  const [formData, setFormData] = useState({
    artist: '',
    keyAdjustment: '',
    language: ''
  })

  // 배경 스크롤 방지 (노래책과 동일한 방식)
  useEffect(() => {
    // body 스크롤 완전 비활성화
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = '0px' // 스크롤바 공간 보정
    document.body.style.touchAction = 'none' // 터치 스크롤 방지
    document.documentElement.style.overflow = 'hidden' // html 요소도 차단
    
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
      document.body.style.touchAction = ''
      document.documentElement.style.overflow = ''
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // 변경할 데이터만 전송
    const editData: { artist?: string; keyAdjustment?: number; language?: string } = {}
    
    if (formData.artist.trim()) {
      editData.artist = formData.artist.trim()
    }
    
    if (formData.keyAdjustment.trim()) {
      const keyValue = parseInt(formData.keyAdjustment)
      if (!isNaN(keyValue)) {
        editData.keyAdjustment = keyValue
      }
    }
    
    if (formData.language) {
      editData.language = formData.language
    }
    
    if (Object.keys(editData).length === 0) {
      alert('변경할 항목을 선택해주세요.')
      return
    }

    onSubmit(editData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">일괄 편집</h2>
          <p className="text-sm text-light-text/60 dark:text-dark-text/60 mt-1">
            선택된 {selectedCount}곡의 정보를 일괄 수정합니다
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 bg-light-primary/20 dark:bg-dark-primary/20 rounded-lg 
                     hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 transition-colors
                     flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
            아티스트 (선택)
          </label>
          <input
            type="text"
            value={formData.artist}
            onChange={(e) => setFormData(prev => ({ ...prev, artist: e.target.value }))}
            className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                       text-light-text dark:text-dark-text"
            placeholder="아티스트명 (비워두면 변경하지 않음)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-3">
            키 조절 (선택)
          </label>
          <div className="space-y-3">
            {/* 상태 버튼들 */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, keyAdjustment: '' }))}
                className={`px-3 py-2 text-sm rounded-lg border transition-all duration-200 ${
                  formData.keyAdjustment === '' 
                    ? 'border-light-accent dark:border-dark-accent bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent' 
                    : 'border-light-primary/20 dark:border-dark-primary/20 text-light-text/70 dark:text-dark-text/70 hover:border-light-accent/40 dark:hover:border-dark-accent/40'
                }`}
              >
                변경 안함
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, keyAdjustment: '0' }))}
                className={`px-3 py-2 text-sm rounded-lg border transition-all duration-200 ${
                  formData.keyAdjustment === '0' 
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' 
                    : 'border-light-primary/20 dark:border-dark-primary/20 text-light-text/70 dark:text-dark-text/70 hover:border-green-400'
                }`}
              >
                원본 키
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, keyAdjustment: '999' }))}
                className={`px-3 py-2 text-sm rounded-lg border transition-all duration-200 ${
                  formData.keyAdjustment === '999' 
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' 
                    : 'border-light-primary/20 dark:border-dark-primary/20 text-light-text/70 dark:text-dark-text/70 hover:border-red-400'
                }`}
              >
                조절 해제
              </button>
            </div>
            
            {/* 키 조절 값 입력 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  let current = 0;
                  if (formData.keyAdjustment === '' || formData.keyAdjustment === '999') {
                    current = 0; // 변경안함이나 조절해제 상태에서는 0부터 시작
                  } else {
                    current = parseInt(formData.keyAdjustment) || 0;
                  }
                  const newValue = Math.max(-12, current - 1);
                  setFormData(prev => ({ ...prev, keyAdjustment: newValue.toString() }));
                }}
                className="w-10 h-10 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                          rounded-lg hover:border-light-accent/40 dark:hover:border-dark-accent/40 transition-all duration-200
                          flex items-center justify-center text-light-text dark:text-dark-text font-medium"
              >
                -
              </button>
              
              <div className="flex-1 relative">
                <input
                  type="number"
                  min="-12"
                  max="12"
                  value={formData.keyAdjustment === '' || formData.keyAdjustment === '999' ? '' : formData.keyAdjustment}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setFormData(prev => ({ ...prev, keyAdjustment: '' }));
                    } else if (parseInt(value) >= -12 && parseInt(value) <= 12) {
                      setFormData(prev => ({ ...prev, keyAdjustment: value }));
                    }
                  }}
                  className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                            rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                            text-light-text dark:text-dark-text text-center"
                  placeholder="키값"
                />
                {(formData.keyAdjustment !== '' && formData.keyAdjustment !== '999' && formData.keyAdjustment !== '0') && (
                  <div className="absolute inset-y-0 right-8 flex items-center text-xs text-light-text/50 dark:text-dark-text/50">
                    {parseInt(formData.keyAdjustment) > 0 ? '+' : ''}{formData.keyAdjustment}
                  </div>
                )}
              </div>
              
              <button
                type="button"
                onClick={() => {
                  let current = 0;
                  if (formData.keyAdjustment === '' || formData.keyAdjustment === '999') {
                    current = 0; // 변경안함이나 조절해제 상태에서는 0부터 시작
                  } else {
                    current = parseInt(formData.keyAdjustment) || 0;
                  }
                  const newValue = Math.min(12, current + 1);
                  setFormData(prev => ({ ...prev, keyAdjustment: newValue.toString() }));
                }}
                className="w-10 h-10 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                          rounded-lg hover:border-light-accent/40 dark:hover:border-dark-accent/40 transition-all duration-200
                          flex items-center justify-center text-light-text dark:text-dark-text font-medium"
              >
                +
              </button>
            </div>
            
            {/* 상태 표시 */}
            <div className="text-xs text-light-text/60 dark:text-dark-text/60 text-center">
              {formData.keyAdjustment === '' && '키 조절 설정을 변경하지 않습니다'}
              {formData.keyAdjustment === '0' && '원본 키로 설정됩니다'}
              {formData.keyAdjustment === '999' && '키 조절 설정이 해제됩니다'}
              {(formData.keyAdjustment !== '' && formData.keyAdjustment !== '0' && formData.keyAdjustment !== '999') && 
                `키를 ${parseInt(formData.keyAdjustment) > 0 ? '+' : ''}${formData.keyAdjustment} 조절합니다`
              }
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
            언어 (선택)
          </label>
          <select
            value={formData.language}
            onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
            className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                       text-light-text dark:text-dark-text"
          >
            <option value="">변경하지 않음</option>
            <option value="Korean">한국어</option>
            <option value="English">영어</option>
            <option value="Japanese">일본어</option>
            <option value="Chinese">중국어</option>
            <option value="Other">기타</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-light-primary/20 dark:border-dark-primary/20">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-light-text dark:text-dark-text hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                     rounded-lg transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 
                     text-white rounded-lg hover:shadow-lg transition-all duration-300 
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              수정 중...
            </>
          ) : (
            <>
              <PencilIcon className="w-4 h-4" />
              {selectedCount}곡 일괄 수정
            </>
          )}
        </button>
      </div>
    </form>
  )
}


// 태그 추가 모달 컴포넌트
interface TagAddModalProps {
  selectedCount: number
  onClose: () => void
  onSubmit: (tagData: {
    tags: string[]
  }) => void
  loading: boolean
}

function TagAddModal({ selectedCount, onClose, onSubmit, loading }: TagAddModalProps) {
  const [formData, setFormData] = useState({
    tags: ''
  })

  // 배경 스크롤 방지 (노래책과 동일한 방식)
  useEffect(() => {
    // body 스크롤 완전 비활성화
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = '0px' // 스크롤바 공간 보정
    document.body.style.touchAction = 'none' // 터치 스크롤 방지
    document.documentElement.style.overflow = 'hidden' // html 요소도 차단
    
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
      document.body.style.touchAction = ''
      document.documentElement.style.overflow = ''
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.tags.trim()) {
      alert('추가할 태그를 입력해주세요.')
      return
    }

    const tags = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
    
    if (tags.length === 0) {
      alert('유효한 태그를 입력해주세요.')
      return
    }

    onSubmit({ tags })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">태그 추가</h2>
          <p className="text-sm text-light-text/60 dark:text-dark-text/60 mt-1">
            선택된 {selectedCount}곡에 태그를 추가합니다
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 bg-light-primary/20 dark:bg-dark-primary/20 rounded-lg 
                     hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 transition-colors
                     flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
            추가할 태그
          </label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
            className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                       text-light-text dark:text-dark-text"
            placeholder="태그를 쉼표로 구분하여 입력하세요 (예: 발라드, 신나는, 인기곡)"
            required
          />
          <p className="text-xs text-light-text/60 dark:text-dark-text/60 mt-1">
            기존 태그는 유지되고 새로운 태그만 추가됩니다
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-light-primary/20 dark:border-dark-primary/20">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-light-text dark:text-dark-text hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                     rounded-lg transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 
                     text-white rounded-lg hover:shadow-lg transition-all duration-300 
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              추가 중...
            </>
          ) : (
            <>
              <TagIcon className="w-4 h-4" />
              {selectedCount}곡에 태그 추가
            </>
          )}
        </button>
      </div>
    </form>
  )
}

// 새 곡 추가 모달 컴포넌트
interface AddSongModalProps {
  onClose: () => void
  onSubmit: (songData: {
    title: string
    artist: string
    language: string
    lyrics?: string
    mrLinks?: string[]
    tags?: string[]
  }) => void
  loading: boolean
}

function AddSongModal({ onClose, onSubmit, loading }: AddSongModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    language: 'Korean',
    lyrics: '',
    mrLinks: '',
    tags: ''
  })

  // 배경 스크롤 방지 (노래책과 동일한 방식)
  useEffect(() => {
    // body 스크롤 완전 비활성화
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = '0px' // 스크롤바 공간 보정
    document.body.style.touchAction = 'none' // 터치 스크롤 방지
    document.documentElement.style.overflow = 'hidden' // html 요소도 차단
    
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
      document.body.style.touchAction = ''
      document.documentElement.style.overflow = ''
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim() || !formData.artist.trim()) {
      alert('제목과 아티스트는 필수 항목입니다.')
      return
    }

    const songData = {
      title: formData.title.trim(),
      artist: formData.artist.trim(),
      language: formData.language,
      lyrics: formData.lyrics.trim() || undefined,
      mrLinks: formData.mrLinks.trim() ? formData.mrLinks.split('\n').map(link => link.trim()).filter(link => link) : undefined,
      tags: formData.tags.trim() ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : undefined
    }

    onSubmit(songData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">새 곡 추가</h2>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 bg-light-primary/20 dark:bg-dark-primary/20 rounded-lg 
                     hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 transition-colors
                     flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                       text-light-text dark:text-dark-text"
            placeholder="곡 제목을 입력하세요"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
            아티스트 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.artist}
            onChange={(e) => setFormData(prev => ({ ...prev, artist: e.target.value }))}
            className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                       text-light-text dark:text-dark-text"
            placeholder="아티스트명을 입력하세요"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
            언어
          </label>
          <select
            value={formData.language}
            onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
            className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                       text-light-text dark:text-dark-text"
          >
            <option value="Korean">한국어</option>
            <option value="English">영어</option>
            <option value="Japanese">일본어</option>
            <option value="Chinese">중국어</option>
            <option value="Other">기타</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
            태그 (선택)
          </label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
            className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                       text-light-text dark:text-dark-text"
            placeholder="태그를 쉼표로 구분하여 입력하세요"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
          MR 링크 (선택)
        </label>
        <textarea
          value={formData.mrLinks}
          onChange={(e) => setFormData(prev => ({ ...prev, mrLinks: e.target.value }))}
          className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                     rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                     text-light-text dark:text-dark-text"
          placeholder="MR 링크를 한 줄에 하나씩 입력하세요"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
          가사 (선택)
        </label>
        <textarea
          value={formData.lyrics}
          onChange={(e) => setFormData(prev => ({ ...prev, lyrics: e.target.value }))}
          className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 
                     rounded-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                     text-light-text dark:text-dark-text"
          placeholder="가사를 입력하세요"
          rows={4}
        />
      </div>


      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-light-text dark:text-dark-text hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                     rounded-lg transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple 
                     text-white rounded-lg hover:shadow-lg transition-all duration-300 
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              추가 중...
            </>
          ) : (
            '곡 추가'
          )}
        </button>
      </div>
    </form>
  )
}