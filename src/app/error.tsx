'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-primary via-white to-light-secondary dark:from-dark-primary dark:via-gray-900 dark:to-dark-secondary flex items-center justify-center p-4">
      <div className="bg-white/10 dark:bg-gray-800/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20 text-center">
        <h2 className="text-2xl font-bold text-red-500 mb-4">
          오류가 발생했습니다
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          페이지를 불러오는 중 문제가 발생했습니다.
        </p>
        <button
          onClick={reset}
          className="w-full bg-gradient-to-r from-light-accent to-light-secondary hover:from-light-secondary hover:to-light-accent dark:from-dark-accent dark:to-dark-secondary dark:hover:from-dark-secondary dark:hover:to-dark-accent text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}