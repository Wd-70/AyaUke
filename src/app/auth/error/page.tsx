'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Suspense } from 'react'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'Configuration':
        return '서버 설정에 문제가 있습니다.'
      case 'AccessDenied':
        return '접근이 거부되었습니다.'
      case 'Verification':
        return '인증 토큰이 만료되었거나 이미 사용되었습니다.'
      case 'Default':
        return '알 수 없는 오류가 발생했습니다.'
      default:
        return '로그인 중 오류가 발생했습니다.'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-primary via-white to-light-secondary dark:from-dark-primary dark:via-gray-900 dark:to-dark-secondary flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white/10 dark:bg-gray-800/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20 text-center"
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-red-500 mb-4">
            로그인 오류
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {getErrorMessage(error)}
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/auth/signin"
            className="block w-full bg-gradient-to-r from-light-accent to-light-secondary hover:from-light-secondary hover:to-light-accent dark:from-dark-accent dark:to-dark-secondary dark:hover:from-dark-secondary dark:hover:to-dark-accent text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            다시 로그인하기
          </Link>
          
          <Link
            href="/"
            className="block w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold py-3 px-6 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

export default function AuthError() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-light-primary via-white to-light-secondary dark:from-dark-primary dark:via-gray-900 dark:to-dark-secondary flex items-center justify-center p-4">
        <div className="bg-white/10 dark:bg-gray-800/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-light-accent dark:border-dark-accent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">로딩 중...</p>
        </div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}