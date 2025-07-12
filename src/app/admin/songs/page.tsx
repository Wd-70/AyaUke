'use client'

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"

export default function SongManagement() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return

    if (!session || !session.user.isAdmin) {
      router.push('/')
      return
    }

    // TODO: Load songs from API
    setLoading(false)
  }, [session, status, router])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-light-primary via-white to-light-secondary dark:from-dark-primary dark:via-gray-900 dark:to-dark-secondary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-dark-primary/30 border-t-dark-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!session || !session.user.isAdmin) {
    return null
  }

  const managementFeatures = [
    {
      title: "노래 추가",
      description: "새로운 곡을 데이터베이스에 추가",
      icon: "➕",
      action: "add"
    },
    {
      title: "가사 관리",
      description: "기존 곡의 가사 수정 및 추가",
      icon: "📝",
      action: "lyrics"
    },
    {
      title: "MR 링크",
      description: "MR 다운로드 링크 관리",
      icon: "🔗",
      action: "mr"
    },
    {
      title: "곡 정보 수정",
      description: "제목, 아티스트, 장르 등 정보 수정",
      icon: "✏️",
      action: "edit"
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
          <div className="flex items-center mb-4">
            <button
              onClick={() => router.push('/admin')}
              className="mr-4 p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-dark-primary to-dark-accent bg-clip-text text-transparent dark:from-light-primary dark:to-light-accent">
              노래 관리
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            곡 정보, 가사, MR 링크를 관리할 수 있습니다.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {managementFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white/10 dark:bg-gray-800/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 cursor-pointer hover:border-white/40 transition-all duration-300"
            >
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white/10 dark:bg-gray-800/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
        >
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
            최근 곡 목록
          </h2>
          
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🎵</div>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              곡 관리 기능을 구현 중입니다
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Google Sheets와 MongoDB 연동을 통한 곡 데이터 관리 시스템
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}