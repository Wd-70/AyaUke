'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ChevronUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
  StarIcon,
  ShieldCheckIcon,
  PencilIcon,
  EyeIcon,
  CalendarIcon,
  ClockIcon,
  HeartIcon,
  QueueListIcon
} from '@heroicons/react/24/outline'
import { IUser } from '@/models/User'
import UserDetailModal from '@/components/admin/UserDetailModal'

interface UserWithCounts extends IUser {
  likesCount: number
  playlistsCount: number
}

interface UserListResponse {
  users: UserWithCounts[]
  pagination: {
    currentPage: number
    totalPages: number
    totalUsers: number
    hasNextPage: boolean
    hasPreviousPage: boolean
    limit: number
  }
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

export default function UserManagementTab() {
  const [users, setUsers] = useState<UserWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalUsers: 0,
    hasNextPage: false,
    hasPreviousPage: false,
    limit: 20
  })

  // 필터 및 검색 상태
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('all')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)

  // 모달 상태
  const [selectedUser, setSelectedUser] = useState<UserWithCounts | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        search: searchTerm,
        role: selectedRole,
        sortBy,
        sortOrder
      })

      const response = await fetch(`/api/admin/users?${params}`)
      if (!response.ok) throw new Error('사용자 목록을 불러올 수 없습니다.')

      const data: UserListResponse = await response.json()
      setUsers(data.users)
      setPagination(data.pagination)
    } catch (error) {
      console.error('사용자 목록 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [currentPage, searchTerm, selectedRole, sortBy, sortOrder])

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const openUserModal = (user: IUser) => {
    setSelectedUser(user)
    setIsModalOpen(true)
  }

  const closeUserModal = () => {
    setSelectedUser(null)
    setIsModalOpen(false)
  }

  const handleUserUpdate = (updatedUser: IUser) => {
    setUsers(users.map(user => 
      user._id === updatedUser._id ? updatedUser : user
    ))
    closeUserModal()
  }

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRoleIcon = (role: keyof typeof roleIcons) => {
    const Icon = roleIcons[role] || UserIcon
    return Icon
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-light-text dark:text-dark-text">사용자 관리</h2>
            <p className="text-sm text-light-text/60 dark:text-dark-text/60 mt-1">
              총 {pagination.totalUsers}명의 사용자
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-light-text/40 dark:text-dark-text/40" />
              <input
                type="text"
                placeholder="채널명, 표시명, 채널ID로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 
                           bg-white/50 dark:bg-gray-900/50 text-light-text dark:text-dark-text
                           focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
              />
            </div>
          </div>

          {/* Role Filter */}
          <div className="flex gap-2">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-4 py-2 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 
                         bg-white/50 dark:bg-gray-900/50 text-light-text dark:text-dark-text
                         focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
            >
              <option value="all">모든 권한</option>
              <option value="super_admin">최고 관리자</option>
              <option value="ayauke_admin">아야우케 관리자</option>
              <option value="song_admin">노래 관리자</option>
              <option value="song_editor">노래 편집자</option>
              <option value="user">일반 사용자</option>
            </select>
          </div>
        </div>
      </div>

      {/* User List */}
      <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl border border-light-primary/20 dark:border-dark-primary/20 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-light-accent/30 dark:border-dark-accent/30 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-light-primary/20 dark:border-dark-primary/20 bg-light-primary/5 dark:bg-dark-primary/5">
              <div className="col-span-3">
                <button
                  onClick={() => handleSort('channelName')}
                  className="flex items-center gap-2 text-sm font-medium text-light-text/70 dark:text-dark-text/70 hover:text-light-text dark:hover:text-dark-text"
                >
                  사용자 정보
                  <ChevronUpDownIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="col-span-2">
                <button
                  onClick={() => handleSort('role')}
                  className="flex items-center gap-2 text-sm font-medium text-light-text/70 dark:text-dark-text/70 hover:text-light-text dark:hover:text-dark-text"
                >
                  권한
                  <ChevronUpDownIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="col-span-2">
                <button
                  onClick={() => handleSort('lastLoginAt')}
                  className="flex items-center gap-2 text-sm font-medium text-light-text/70 dark:text-dark-text/70 hover:text-light-text dark:hover:text-dark-text"
                >
                  최근 로그인
                  <ChevronUpDownIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="col-span-2">
                <button
                  onClick={() => handleSort('createdAt')}
                  className="flex items-center gap-2 text-sm font-medium text-light-text/70 dark:text-dark-text/70 hover:text-light-text dark:hover:text-dark-text"
                >
                  가입일
                  <ChevronUpDownIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="col-span-2">
                <span className="text-sm font-medium text-light-text/70 dark:text-dark-text/70">좋아요/플레이리스트</span>
              </div>
              <div className="col-span-1">
                <span className="text-sm font-medium text-light-text/70 dark:text-dark-text/70">액션</span>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-light-primary/10 dark:divide-dark-primary/10">
              <AnimatePresence>
                {users.map((user, index) => {
                  const RoleIcon = getRoleIcon(user.role as keyof typeof roleIcons)
                  return (
                    <motion.div
                      key={user._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="grid grid-cols-12 gap-4 p-4 hover:bg-light-primary/5 dark:hover:bg-dark-primary/5 transition-colors"
                    >
                      {/* 사용자 정보 */}
                      <div className="col-span-3">
                        <div className="flex items-center gap-3">
                          {user.profileImageUrl ? (
                            <img
                              src={user.profileImageUrl}
                              alt={user.channelName}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-light-accent/10 dark:bg-dark-accent/10 rounded-full flex items-center justify-center">
                              <UserIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-light-text dark:text-dark-text truncate">
                              {user.displayName || user.channelName}
                            </div>
                            <div className="text-sm text-light-text/60 dark:text-dark-text/60 truncate">
                              @{user.channelName}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 권한 */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <RoleIcon className="w-4 h-4" />
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role as keyof typeof roleColors]}`}>
                            {roleLabels[user.role as keyof typeof roleLabels]}
                          </span>
                        </div>
                      </div>

                      {/* 최근 로그인 */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-1 text-sm text-light-text/70 dark:text-dark-text/70">
                          <ClockIcon className="w-4 h-4" />
                          {formatDate(user.lastLoginAt)}
                        </div>
                      </div>

                      {/* 가입일 */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-1 text-sm text-light-text/70 dark:text-dark-text/70">
                          <CalendarIcon className="w-4 h-4" />
                          {formatDate(user.createdAt)}
                        </div>
                      </div>

                      {/* 좋아요/플레이리스트 */}
                      <div className="col-span-2">
                        <div className="text-sm text-light-text/70 dark:text-dark-text/70">
                          <div className="flex items-center gap-1 mb-1">
                            <HeartIcon className="w-3 h-3 text-red-500" />
                            <span>{user.likesCount || 0}곡</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <QueueListIcon className="w-3 h-3 text-blue-500" />
                            <span>{user.playlistsCount || 0}개</span>
                          </div>
                        </div>
                      </div>

                      {/* 액션 */}
                      <div className="col-span-1">
                        <button
                          onClick={() => openUserModal(user)}
                          className="p-2 rounded-lg hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 
                                     text-light-accent dark:text-dark-accent transition-colors"
                          title="사용자 상세 보기"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-light-primary/20 dark:border-dark-primary/20">
                <div className="text-sm text-light-text/60 dark:text-dark-text/60">
                  {((pagination.currentPage - 1) * pagination.limit) + 1}-{Math.min(pagination.currentPage * pagination.limit, pagination.totalUsers)} / {pagination.totalUsers}명
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={!pagination.hasPreviousPage}
                    className="p-2 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 
                               disabled:opacity-50 disabled:cursor-not-allowed
                               hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition-colors"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-light-text dark:text-dark-text px-3">
                    {pagination.currentPage} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="p-2 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 
                               disabled:opacity-50 disabled:cursor-not-allowed
                               hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition-colors"
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          isOpen={isModalOpen}
          onClose={closeUserModal}
          onUserUpdate={handleUserUpdate}
        />
      )}
    </div>
  )
}