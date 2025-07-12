'use client'

import { signIn, getProviders } from "next-auth/react"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"

interface Provider {
  id: string
  name: string
  type: string
  signinUrl: string
  callbackUrl: string
}

export default function SignIn() {
  const [providers, setProviders] = useState<Record<string, Provider> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [ayaukeChecked, setAyaukeChecked] = useState(false)

  useEffect(() => {
    const fetchProviders = async () => {
      const providers = await getProviders()
      setProviders(providers)
    }
    fetchProviders()
  }, [])

  const handleSignIn = async (providerId: string) => {
    setIsLoading(true)
    try {
      if (providerId === 'dev-auth') {
        await signIn(providerId, { 
          isAyauke: ayaukeChecked ? 'true' : 'false',
          callbackUrl: '/' 
        })
      } else {
        await signIn(providerId, { callbackUrl: '/' })
      }
    } catch (error) {
      console.error('Sign in error:', error)
      setIsLoading(false)
    }
  }

  const getProviderButton = (provider: Provider) => {
    if (provider.id === 'naver') {
      return (
        <motion.button
          key={provider.name}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleSignIn(provider.id)}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>로그인 중...</span>
            </>
          ) : (
            <>
              <div className="w-6 h-6 bg-white rounded-sm flex items-center justify-center">
                <span className="text-green-600 font-bold text-sm">N</span>
              </div>
              <span>네이버로 로그인</span>
            </>
          )}
        </motion.button>
      )
    }

    if (provider.id === 'dev-auth') {
      return (
        <div key={provider.name} className="space-y-4">
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
              개발 모드
            </h3>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              네이버 OAuth 설정이 완료되지 않아 개발용 로그인을 사용합니다.
            </p>
          </div>
          
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ayaukeChecked}
              onChange={(e) => setAyaukeChecked(e.target.checked)}
              className="w-4 h-4 text-light-accent border-gray-300 rounded focus:ring-light-accent dark:focus:ring-dark-primary"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              아야우케로 로그인 (관리자 권한)
            </span>
          </label>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSignIn(provider.id)}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>로그인 중...</span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 bg-white rounded-sm flex items-center justify-center">
                  <span className="text-gray-600 font-bold text-sm">🔧</span>
                </div>
                <span>개발용 로그인</span>
              </>
            )}
          </motion.button>
        </div>
      )
    }

    return null
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
            아야우케 페이지
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            계정으로 로그인
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            아야우케님 전용 관리 기능 액세스
          </p>
        </div>

        <div className="space-y-4">
          {providers && Object.values(providers).map((provider) => 
            getProviderButton(provider)
          )}
        </div>

        <div className="mt-8 space-y-4">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            <p>🎯 인증된 사용자만 관리 기능을 사용할 수 있습니다</p>
          </div>
          
          <div className="border-t border-gray-300/20 pt-4">
            <details className="text-sm text-gray-500 dark:text-gray-400">
              <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                로그인 방법 안내
              </summary>
              <div className="mt-2 space-y-1 text-xs">
                <p>• 네이버 OAuth: 안전한 공식 인증 (설정 완료 시)</p>
                <p>• 개발 모드: 테스트용 임시 인증</p>
                <p>• 치지직 채널 정보 자동 연동</p>
                <p>• 아야우케 채널 확인 후 관리자 권한 부여</p>
              </div>
            </details>
          </div>
        </div>
      </motion.div>
    </div>
  )
}