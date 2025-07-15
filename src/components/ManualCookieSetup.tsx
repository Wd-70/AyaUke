'use client'

import { useSession } from "next-auth/react"
import { useState } from "react"
import { motion } from "framer-motion"

export default function ManualCookieSetup() {
  const { data: session } = useSession()
  const [cookies, setCookies] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<unknown>(null)

  if (!session || !session.user.isAdmin) {
    return null
  }

  const handleSetCookie = async () => {
    if (!cookies.trim()) {
      alert('쿠키 값을 입력해주세요')
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/set-manual-cookie', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          naverId: session.user.naverId,
          cookies: cookies.trim()
        })
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        alert('쿠키가 성공적으로 설정되었습니다!')
        setCookies('')
      } else {
        alert(`쿠키 설정 실패: ${data.message}`)
      }
    } catch (error) {
      console.error('쿠키 설정 오류:', error)
      alert('쿠키 설정 중 오류가 발생했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 dark:bg-gray-800/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mt-6"
    >
      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
        🍪 치지직 수동 쿠키 설정
      </h3>
      
      <div className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          <p className="mb-2">자동 인증이 실패한 경우 수동으로 쿠키를 설정할 수 있습니다:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>브라우저에서 <a href="https://chzzk.naver.com" target="_blank" className="text-blue-500 hover:underline">chzzk.naver.com</a>에 로그인</li>
            <li>개발자 도구 (F12) → Application → Cookies → https://chzzk.naver.com</li>
            <li>NID_AUT와 NID_SES 쿠키 값을 복사</li>
            <li>아래 형식으로 입력: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">NID_AUT=값; NID_SES=값</code></li>
          </ol>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            치지직 쿠키 (NID_AUT; NID_SES)
          </label>
          <textarea
            value={cookies}
            onChange={(e) => setCookies(e.target.value)}
            placeholder="NID_AUT=your_auth_token; NID_SES=your_session_token"
            className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none"
          />
        </div>

        <button
          onClick={handleSetCookie}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>설정 중...</span>
            </div>
          ) : (
            '쿠키 설정하기'
          )}
        </button>

        {result && (
          <div className={`p-3 rounded-lg text-sm ${
            result.success 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
          }`}>
            <div className="font-medium mb-1">
              {result.success ? '✅ 성공' : '❌ 실패'}
            </div>
            <div>{result.message}</div>
            {result.userInfo && (
              <div className="mt-2 text-xs">
                <div>채널 ID: {result.userInfo.channelId}</div>
                <div>채널명: {result.userInfo.channelName}</div>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400">
          💡 현재 네이버 ID: <code>{session.user.naverId}</code>
        </div>
      </div>
    </motion.div>
  )
}