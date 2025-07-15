'use client'

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ChartBarIcon,
  UsersIcon,
  Cog6ToothIcon,
  PlayIcon,
  MusicalNoteIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  ClockIcon,
  HeartIcon,
  ListBulletIcon,
  ServerIcon,
  ArrowTrendingUpIcon,
  EyeIcon,
  DocumentDuplicateIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import Navigation from '@/components/Navigation'

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState({
    totalSongs: 0,
    totalUsers: 0,
    totalPlaylists: 0,
    recentActivity: 0
  })

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

    // 통계 데이터 로드 (실제 API 호출로 대체)
    setStats({
      totalSongs: 1250,
      totalUsers: 89,
      totalPlaylists: 156,
      recentActivity: 23
    })
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-light-background dark:bg-dark-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-light-accent/30 dark:border-dark-accent/30 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session || !session.user.isAdmin) {
    return null
  }

  const quickStats = [
    {
      title: "총 노래 수",
      value: stats.totalSongs.toLocaleString(),
      icon: MusicalNoteIcon,
      change: "+12",
      changeType: "increase" as const,
      color: "from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple"
    },
    {
      title: "등록 사용자",
      value: stats.totalUsers.toLocaleString(),
      icon: UsersIcon,
      change: "+5",
      changeType: "increase" as const,
      color: "from-light-secondary to-light-accent dark:from-dark-secondary dark:to-dark-accent"
    },
    {
      title: "플레이리스트",
      value: stats.totalPlaylists.toLocaleString(),
      icon: ListBulletIcon,
      change: "+8",
      changeType: "increase" as const,
      color: "from-light-purple to-light-secondary dark:from-dark-purple dark:to-dark-secondary"
    },
    {
      title: "오늘 활동",
      value: stats.recentActivity.toLocaleString(),
      icon: ArrowTrendingUpIcon,
      change: "+3",
      changeType: "increase" as const,
      color: "from-emerald-400 to-teal-500 dark:from-emerald-500 dark:to-teal-600"
    }
  ]

  const managementSections = [
    {
      title: "사용자 관리",
      description: "사용자 권한 관리, 활동 모니터링, 통계 분석",
      icon: UsersIcon,
      features: ["권한 관리", "활동 로그", "사용자 통계"],
      href: "/admin/users",
      color: "from-blue-500 to-indigo-600",
      bgColor: "from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20"
    },
    {
      title: "플레이리스트 관리",
      description: "전체 플레이리스트 현황, 공유 설정, 문제 해결",
      icon: ListBulletIcon,
      features: ["공유 관리", "문제 해결", "통계 분석"],
      href: "/admin/playlists",
      color: "from-purple-500 to-pink-600",
      bgColor: "from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20"
    },
    {
      title: "시스템 관리",
      description: "데이터 동기화, 백업 관리, 시스템 모니터링",
      icon: ServerIcon,
      features: ["데이터 동기화", "백업 관리", "성능 모니터링"],
      href: "/admin/system",
      color: "from-green-500 to-emerald-600",
      bgColor: "from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20"
    }
  ]

  const quickActions = [
    {
      title: "노래 관리",
      description: "곡 정보 편집, MR 관리, 일괄 작업",
      icon: MusicalNoteIcon,
      href: "/admin/songs",
      color: "from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple"
    },
    {
      title: "데이터 동기화",
      description: "Google Sheets ↔ MongoDB 동기화",
      icon: DocumentDuplicateIcon,
      href: "/admin/sync",
      color: "from-orange-400 to-red-500 dark:from-orange-500 dark:to-red-600"
    }
  ]

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background">
      <Navigation currentPath="/admin" />
      
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-light-accent/5 dark:bg-dark-accent/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-light-secondary/5 dark:bg-dark-secondary/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-light-purple/5 dark:bg-dark-purple/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
      </div>

      <div className="relative z-10 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple 
                            rounded-2xl flex items-center justify-center shadow-lg">
              <ShieldCheckIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold font-display gradient-text">
                관리자 대시보드
              </h1>
              <p className="text-light-text/70 dark:text-dark-text/70 text-lg mt-2">
                안녕하세요, {session.user.channelName || session.user.name}님!
              </p>
            </div>
          </div>
          
          <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-4 border border-light-primary/20 dark:border-dark-primary/20">
            <div className="flex items-center gap-4 text-sm text-light-text/60 dark:text-dark-text/60">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>시스템 정상</span>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon className="w-4 h-4" />
                <span>마지막 동기화: 5분 전</span>
              </div>
              <div className="flex items-center gap-2">
                <EyeIcon className="w-4 h-4" />
                <span>권한: 최고 관리자</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
        >
          {quickStats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 
                         border border-light-primary/20 dark:border-dark-primary/20 
                         hover:border-light-accent/40 dark:hover:border-dark-accent/40 
                         transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-lg flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium
                  ${stat.changeType === 'increase' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                  {stat.change}
                </div>
              </div>
              <div className="text-2xl font-bold text-light-text dark:text-dark-text mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-light-text/60 dark:text-dark-text/60">
                {stat.title}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12"
        >
          <h2 className="text-2xl font-bold text-light-text dark:text-dark-text mb-6">빠른 작업</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {quickActions.map((action, index) => (
              <motion.div
                key={action.title}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(action.href)}
                className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 
                           border border-light-primary/20 dark:border-dark-primary/20 
                           hover:border-light-accent/40 dark:hover:border-dark-accent/40 
                           cursor-pointer transition-all duration-300 group"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 bg-gradient-to-r ${action.color} rounded-lg flex items-center justify-center
                                   group-hover:scale-110 transition-transform duration-300`}>
                    <action.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-2">
                      {action.title}
                    </h3>
                    <p className="text-light-text/70 dark:text-dark-text/70 text-sm">
                      {action.description}
                    </p>
                  </div>
                  <div className="text-light-text/40 dark:text-dark-text/40 group-hover:translate-x-1 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Management Sections */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h2 className="text-2xl font-bold text-light-text dark:text-dark-text mb-6">시스템 관리</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {managementSections.map((section, index) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(section.href)}
                className={`bg-gradient-to-br ${section.bgColor} backdrop-blur-sm rounded-2xl p-8 
                           border border-light-primary/20 dark:border-dark-primary/20 
                           hover:border-light-accent/40 dark:hover:border-dark-accent/40 
                           cursor-pointer transition-all duration-300 group relative overflow-hidden`}
              >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute top-0 right-0 w-32 h-32 transform rotate-12 translate-x-8 -translate-y-8">
                    <section.icon className="w-full h-full" />
                  </div>
                </div>
                
                <div className="relative z-10">
                  <div className={`w-16 h-16 bg-gradient-to-r ${section.color} rounded-2xl flex items-center justify-center mb-6
                                   group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <section.icon className="w-8 h-8 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-3">
                    {section.title}
                  </h3>
                  
                  <p className="text-light-text/70 dark:text-dark-text/70 text-sm mb-6">
                    {section.description}
                  </p>
                  
                  <div className="space-y-2">
                    {section.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-light-text/60 dark:text-dark-text/60">
                        <div className="w-1.5 h-1.5 bg-light-accent dark:bg-dark-accent rounded-full"></div>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 flex items-center text-sm font-medium text-light-accent dark:text-dark-accent 
                                  group-hover:translate-x-1 transition-transform">
                    <span>관리하기</span>
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}