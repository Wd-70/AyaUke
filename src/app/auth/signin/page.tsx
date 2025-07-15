'use client'

import { signIn } from "next-auth/react"
import { useState } from "react"
import { motion } from "framer-motion"

export default function SignIn() {
  const [isLoading, setIsLoading] = useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = useState(false)
  const [nidAuth, setNidAuth] = useState('')
  const [nidSes, setNidSes] = useState('')

  const handleOAuthSignIn = async () => {
    setIsOAuthLoading(true)
    try {
      await signIn('chzzk', { callbackUrl: '/' })
    } catch (error) {
      console.error('OAuth sign in error:', error)
      alert('OAuth 로그인에 실패했습니다.')
      setIsOAuthLoading(false)
    }
  }

  const handleCookieSignIn = async () => {
    if (!nidAuth.trim() || !nidSes.trim()) {
      alert('NID_AUT와 NID_SES 쿠키를 모두 입력해주세요.')
      return
    }
    
    const finalCookies = `NID_AUT=${nidAuth.trim()}; NID_SES=${nidSes.trim()}`
    
    setIsLoading(true)
    try {
      await signIn('chzzk-cookie', { 
        cookies: finalCookies,
        callbackUrl: '/' 
      })
    } catch (error) {
      console.error('Cookie sign in error:', error)
      alert('로그인에 실패했습니다. 쿠키를 확인해주세요.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-primary via-white to-light-secondary dark:from-dark-primary dark:via-gray-900 dark:to-dark-secondary flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white/10 dark:bg-gray-800/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-dark-primary to-dark-accent bg-clip-text text-transparent dark:from-light-primary dark:to-light-accent mb-4">
            아야의 노래책
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            치지직으로 로그인
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            공식 API 또는 쿠키 방식으로 로그인하세요
          </p>
        </div>

        <div className="space-y-6">
          {/* OAuth 로그인 버튼 */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleOAuthSignIn}
            disabled={isOAuthLoading}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
          >
            {isOAuthLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>로그인 중...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
                </svg>
                <span>치지직으로 로그인</span>
              </>
            )}
          </motion.button>

          {/* 구분선 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white/10 dark:bg-gray-800/10 text-gray-500 dark:text-gray-400">
                또는 쿠키로 로그인
              </span>
            </div>
          </div>

          {/* 쿠키 로그인 폼 */}
          <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              NID_AUT:
            </label>
            <input
              type="text"
              value={nidAuth}
              onChange={(e) => setNidAuth(e.target.value)}
              placeholder="AAABnRCK5fK043lOg9..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              NID_SES:
            </label>
            <input
              type="text"
              value={nidSes}
              onChange={(e) => setNidSes(e.target.value)}
              placeholder="AAABnRCK5fK043lOg9..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent"
            />
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCookieSignIn}
            disabled={isLoading || !nidAuth.trim() || !nidSes.trim()}
            className="w-full bg-gradient-to-r from-light-accent to-light-secondary dark:from-dark-accent dark:to-dark-secondary text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>로그인 중...</span>
              </>
            ) : (
              <span>로그인</span>
            )}
          </motion.button>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 space-y-1">
          <p className="font-medium">📋 쿠키 복사 방법:</p>
          <p>1. 치지직(chzzk.naver.com)에 로그인</p>
          <p>2. F12 → Application → Cookies → chzzk.naver.com</p>
          <p>3. NID_AUT, NID_SES의 Value 값을 복사</p>
          <p>4. 위 입력창에 붙여넣기 후 로그인</p>
        </div>
      </motion.div>
    </div>
  )
}