'use client'

import { signIn } from "next-auth/react"
import { useState } from "react"
import { motion } from "framer-motion"

export default function SignIn() {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async () => {
    setIsLoading(true)
    try {
      const result = await signIn('chzzk', { 
        callbackUrl: '/',
        redirect: false 
      })
      
      if (result?.error) {
        console.error('Login error:', result.error)
        if (result.error.includes('승인')) {
          alert('치지직 API 승인이 필요합니다. 개발자 콘솔에서 승인 상태를 확인하세요.')
        } else {
          alert('로그인에 실패했습니다. 다시 시도해주세요.')
        }
        setIsLoading(false)
      } else if (result?.url) {
        window.location.href = result.url
      }
    } catch (error) {
      console.error('Login error:', error)
      alert('로그인에 실패했습니다. 다시 시도해주세요.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50 dark:bg-gradient-to-br dark:from-gray-900 dark:via-purple-900 dark:to-pink-900">
      
      {/* 라이트모드 배경 애니메이션 요소 */}
      <div className="absolute inset-0 dark:hidden">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-light-primary/30 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-light-secondary/40 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-light-accent/30 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* 다크모드 배경 애니메이션 요소 */}
      <div className="absolute inset-0 hidden dark:block">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-dark-primary/20 rounded-full mix-blend-screen filter blur-xl opacity-60 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-dark-secondary/20 rounded-full mix-blend-screen filter blur-xl opacity-60 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-dark-accent/20 rounded-full mix-blend-screen filter blur-xl opacity-60 animate-blob animation-delay-4000"></div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* 로고 및 제목 섹션 */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center mb-8"
          >
            <div className="mb-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center shadow-2xl bg-gradient-to-r from-light-primary to-light-accent dark:bg-gradient-to-r dark:from-dark-primary dark:to-dark-accent"
              >
                <span className="text-2xl">🎵</span>
              </motion.div>
            </div>
            
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-light-primary via-light-accent to-light-purple bg-clip-text text-transparent dark:bg-gradient-to-r dark:from-dark-primary dark:via-dark-accent dark:to-dark-secondary dark:bg-clip-text dark:text-transparent">
              아야의 노래책
            </h1>
            <p className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">
              Welcome to AyaUke
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              치지직으로 간편하게 로그인하세요
            </p>
          </motion.div>

          {/* 로그인 카드 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="backdrop-blur-xl rounded-3xl p-8 shadow-2xl border bg-white/70 border-gray-200/50 dark:bg-gray-800/30 dark:border-gray-700/50"
          >
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full relative overflow-hidden font-bold py-4 px-8 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed group bg-gradient-to-r from-light-primary via-light-accent to-light-purple text-white hover:from-light-purple hover:via-light-accent hover:to-light-primary dark:bg-gradient-to-r dark:from-dark-primary dark:via-dark-accent dark:to-dark-secondary dark:text-white dark:hover:from-dark-secondary dark:hover:via-dark-accent dark:hover:to-dark-primary"
            >
              {/* 버튼 배경 효과 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              
              <div className="relative flex items-center justify-center space-x-3">
                {isLoading ? (
                  <>
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
                    />
                    <span className="text-lg">로그인 중...</span>
                  </>
                ) : (
                  <>
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-8l3-3 3 3-3 3-3-3z"/>
                      </svg>
                    </motion.div>
                    <span className="text-lg">치지직으로 로그인</span>
                    <motion.div
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      →
                    </motion.div>
                  </>
                )}
              </div>
            </motion.button>

            {/* 부가 설명 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="mt-6 text-center"
            >
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                치지직 계정으로 로그인하여<br />
                개인화된 노래책 서비스를 이용하세요
              </p>
              <div className="flex items-center justify-center mt-4 space-x-2 text-xs text-gray-500 dark:text-gray-400">
                <span>🔒</span>
                <span>안전한 OAuth 2.0 인증</span>
              </div>
            </motion.div>
          </motion.div>

          {/* 하단 링크 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="text-center mt-8"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">
              계정이 없으신가요?{" "}
              <a 
                href="https://chzzk.naver.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline transition-colors text-light-accent hover:text-light-purple dark:text-dark-primary dark:hover:text-dark-accent"
              >
                치지직에서 가입하기
              </a>
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* 추가 CSS for blob animation */}
      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}