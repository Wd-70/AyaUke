'use client'

import { useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { extractChzzkCookies, requestChzzkLogin, tryAccessChzzkCookiesViaIframe, executeJavaScriptForCookies } from "@/lib/browserCookieReader"

export default function AutoCookieDetector() {
  const { data: session, update } = useSession()
  const [cookieStatus, setCookieStatus] = useState<{
    detected: boolean
    cookies?: string
    lastCheck?: Date
  }>({ detected: false })
  const [isChecking, setIsChecking] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const [isAutoDetecting, setIsAutoDetecting] = useState(false)

  // 페이지 로드 시 자동으로 쿠키 확인
  useEffect(() => {
    if (session && session.user) {
      checkCookies()
    }
  }, [session])

  const checkCookies = () => {
    console.log('=== 브라우저 쿠키 자동 감지 ===')
    setIsChecking(true)
    
    try {
      const { naverCookies, hasValidCookies } = extractChzzkCookies()
      
      setCookieStatus({
        detected: hasValidCookies,
        cookies: naverCookies || undefined,
        lastCheck: new Date()
      })
      
      if (hasValidCookies && naverCookies) {
        console.log('쿠키 자동 감지 성공!')
        // 자동으로 서버에 전송
        sendCookiesToServer(naverCookies)
      } else {
        console.log('유효한 쿠키가 감지되지 않음')
      }
    } catch (error) {
      console.error('쿠키 확인 오류:', error)
    } finally {
      setIsChecking(false)
    }
  }

  const sendCookiesToServer = async (cookies: string) => {
    if (!session || !session.user.naverId) return

    try {
      const response = await fetch('/api/admin/set-manual-cookie', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          naverId: session.user.naverId,
          cookies: cookies
        })
      })

      const result = await response.json()
      
      if (result.success) {
        console.log('쿠키 서버 전송 성공!')
        alert('치지직 쿠키가 자동으로 감지되어 설정되었습니다!')
        
        // 세션 업데이트 시도
        await update()
        
        // 페이지 새로고침으로 세션 반영
        window.location.reload()
      } else {
        console.log('쿠키 서버 전송 실패:', result.message)
      }
    } catch (error) {
      console.error('쿠키 서버 전송 오류:', error)
    }
  }

  const handleRequestLogin = async () => {
    setIsRequesting(true)
    
    try {
      const result = await requestChzzkLogin()
      
      if (result.success && result.cookies) {
        console.log('사용자 로그인 후 쿠키 획득 성공!')
        await sendCookiesToServer(result.cookies)
      } else {
        console.log('사용자 로그인 실패 또는 취소')
      }
    } catch (error) {
      console.error('로그인 요청 오류:', error)
    } finally {
      setIsRequesting(false)
    }
  }

  const handleAutoDetection = async () => {
    setIsAutoDetecting(true)
    
    try {
      console.log('=== 자동 쿠키 감지 시작 ===')
      
      // 방법 1: 현재 도메인 쿠키 확인
      const { naverCookies, hasValidCookies } = extractChzzkCookies()
      
      if (hasValidCookies && naverCookies) {
        console.log(`기존 쿠키 감지 성공! (${naverCookies.substring(0, 50)}...)`)
        await sendCookiesToServer(naverCookies)
        return
      }
      
      // 방법 2: JavaScript 실행으로 쿠키 추출
      console.log('JavaScript 실행으로 쿠키 추출 중...')
      const jsResult = await executeJavaScriptForCookies()
      
      if (jsResult.success && jsResult.cookies) {
        console.log(`JavaScript 실행 성공! (${jsResult.cookies.substring(0, 50)}...)`)
        await sendCookiesToServer(jsResult.cookies)
        return
      }
      
      // 방법 3: 치지직 페이지로 이동해서 쿠키 추출
      console.log('치지직 페이지에서 쿠키 추출 시도...')
      const { extractCookiesFromChzzk } = await import('@/lib/directCookieExtractor')
      const extractResult = await extractCookiesFromChzzk()
      
      if (extractResult.success && extractResult.cookies) {
        console.log(`치지직 페이지 추출 성공! (${extractResult.cookies.substring(0, 50)}...)`)
        await sendCookiesToServer(extractResult.cookies)
        return
      }
      
      // 방법 4: 새 창으로 치지직 로그인 안내
      console.log('새 창으로 치지직 로그인 안내...')
      const loginResult = await requestChzzkLogin()
      
      if (loginResult.success && loginResult.cookies) {
        console.log(`로그인 후 쿠키 감지 성공! (${loginResult.cookies.substring(0, 50)}...)`)
        await sendCookiesToServer(loginResult.cookies)
        return
      }
      
      // 모든 방법 실패
      alert('모든 자동 감지 방법이 실패했습니다. 수동으로 쿠키를 설정해주세요.')
      
    } catch (error) {
      console.error('자동 감지 오류:', error)
      alert('자동 감지 중 오류가 발생했습니다.')
    } finally {
      setIsAutoDetecting(false)
    }
  }

  const handleIframeAccess = async () => {
    try {
      const result = await tryAccessChzzkCookiesViaIframe()
      
      if (result.success && result.cookies) {
        console.log('iframe 쿠키 접근 성공!')
        await sendCookiesToServer(result.cookies)
      } else {
        console.log('iframe 쿠키 접근 실패 (CORS 제한 가능성)')
        alert('iframe 방식은 CORS 제한으로 인해 실패했습니다. 다른 방법을 시도해보세요.')
      }
    } catch (error) {
      console.error('iframe 접근 오류:', error)
    }
  }

  if (!session || !session.user) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 dark:bg-gray-800/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mt-6"
    >
      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
        🔍 자동 쿠키 감지
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              브라우저에서 치지직 쿠키 자동 감지
            </div>
            {cookieStatus.lastCheck && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                마지막 확인: {cookieStatus.lastCheck.toLocaleTimeString()}
              </div>
            )}
          </div>
          
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            cookieStatus.detected 
              ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          }`}>
            {cookieStatus.detected ? '✅ 감지됨' : '❌ 미감지'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={handleAutoDetection}
            disabled={isAutoDetecting}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg transition-all duration-300 disabled:opacity-50 font-medium"
          >
            {isAutoDetecting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>자동 감지 중...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>완전 자동 감지</span>
              </>
            )}
          </button>

          <button
            onClick={checkCookies}
            disabled={isChecking}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isChecking ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>확인 중...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>단순 확인</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <button
            onClick={handleRequestLogin}
            disabled={isRequesting}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isRequesting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>진행 중...</span>
              </>
            ) : (
              <>
                <span>🔑</span>
                <span>로그인 요청</span>
              </>
            )}
          </button>

          <button
            onClick={handleIframeAccess}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <span>🖼️</span>
            <span>iframe 시도</span>
          </button>
        </div>

        {cookieStatus.detected && cookieStatus.cookies && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
              감지된 쿠키:
            </div>
            <div className="text-xs text-green-700 dark:text-green-300 font-mono bg-white/50 dark:bg-gray-800/50 p-2 rounded border overflow-hidden">
              {cookieStatus.cookies.substring(0, 100)}...
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400">
          💡 <strong>완전 자동 감지</strong>: 여러 방법을 순서대로 시도하여 쿠키를 자동으로 찾습니다.
          <br />
          • 현재 도메인 쿠키 확인 → JavaScript 실행 → 치지직 페이지 이동 → 로그인 안내
          <br />
          사용자 동의 후 자동으로 진행됩니다.
        </div>
      </div>
    </motion.div>
  )
}