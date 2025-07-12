'use client'

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { motion } from "framer-motion"
import UserDebugInfo from "@/components/UserDebugInfo"
import ManualCookieSetup from "@/components/ManualCookieSetup"
import AutoCookieDetector from "@/components/AutoCookieDetector"
import ChzzkLoginGuide from "@/components/ChzzkLoginGuide"
import ChzzkAPITester from "@/components/ChzzkAPITester"

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

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
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-light-primary via-white to-light-secondary dark:from-dark-primary dark:via-gray-900 dark:to-dark-secondary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-dark-primary/30 border-t-dark-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!session || !session.user.isAdmin) {
    return null
  }

  const adminFeatures = [
    {
      title: "노래 관리",
      description: "곡 정보 수정, 가사 추가, MR 링크 관리",
      icon: "🎵",
      href: "/admin/songs",
      color: "from-purple-500 to-pink-500"
    },
    {
      title: "스트림 설정",
      description: "라이브 상태 관리, 스트림 정보 업데이트",
      icon: "📺",
      href: "/admin/stream",
      color: "from-blue-500 to-cyan-500"
    },
    {
      title: "사용자 통계",
      description: "방문자 분석, 인기 곡 통계",
      icon: "📊",
      href: "/admin/analytics",
      color: "from-green-500 to-emerald-500"
    },
    {
      title: "콘텐츠 관리",
      description: "페이지 콘텐츠, 이미지, 동영상 관리",
      icon: "📝",
      href: "/admin/content",
      color: "from-orange-500 to-red-500"
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-primary via-white to-light-secondary dark:from-dark-primary dark:via-gray-900 dark:to-dark-secondary">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-dark-primary to-dark-accent bg-clip-text text-transparent dark:from-light-primary dark:to-light-accent mb-4">
            관리자 대시보드
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            안녕하세요, {session.user.channelName || session.user.name}님! ({session.user.adminRole || '관리자'})
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            치지직 채널: {session.user.channelId} • 팔로워: {session.user.followerCount?.toLocaleString() || '정보 없음'}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {adminFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white/10 dark:bg-gray-800/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 cursor-pointer hover:border-white/40 transition-all duration-300"
              onClick={() => router.push(feature.href)}
            >
              <div className={`w-16 h-16 bg-gradient-to-r ${feature.color} rounded-2xl flex items-center justify-center text-2xl mb-4`}>
                {feature.icon}
              </div>
              
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                {feature.title}
              </h3>
              
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                {feature.description}
              </p>
              
              <div className="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
                <span>관리하기</span>
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-12 bg-white/10 dark:bg-gray-800/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
        >
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
            빠른 정보
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-dark-primary dark:text-light-primary">
                {session.user.channelName || session.user.name}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                채널명
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-dark-primary dark:text-light-primary">
                활성
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                인증 상태
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-dark-primary dark:text-light-primary">
                관리자
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                권한 수준
              </div>
            </div>
          </div>
        </motion.div>

        {/* 치지직 로그인 가이드 */}
        <ChzzkLoginGuide />
        
        {/* 자동 쿠키 감지 컴포넌트 */}
        <AutoCookieDetector />
        
        {/* 수동 쿠키 설정 컴포넌트 */}
        <ManualCookieSetup />
        
        {/* 치지직 API 테스터 */}
        <ChzzkAPITester />
        
        {/* 디버그 정보 컴포넌트 */}
        <UserDebugInfo />
      </div>
    </div>
  )
}