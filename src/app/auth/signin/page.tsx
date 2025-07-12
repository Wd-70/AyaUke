'use client'

import { signIn, getProviders } from "next-auth/react"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { extractChzzkCookies, executeJavaScriptForCookies } from "@/lib/browserCookieReader"

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
  const [cookieInput, setCookieInput] = useState('')
  const [nidAuth, setNidAuth] = useState('')
  const [nidSes, setNidSes] = useState('')
  const [isAutoDetecting, setIsAutoDetecting] = useState(false)

  useEffect(() => {
    const fetchProviders = async () => {
      const providers = await getProviders()
      setProviders(providers)
    }
    fetchProviders()
  }, [])

  const handleCookieSignIn = async () => {
    let finalCookies = ''
    
    if (nidAuth.trim() || nidSes.trim()) {
      // 개별 쿠키 입력 사용
      const cookieParts = []
      if (nidAuth.trim()) {
        cookieParts.push(`NID_AUT=${nidAuth.trim()}`)
      }
      if (nidSes.trim()) {
        cookieParts.push(`NID_SES=${nidSes.trim()}`)
      }
      finalCookies = cookieParts.join('; ')
    } else if (cookieInput.trim()) {
      // 전체 쿠키 입력 사용
      finalCookies = cookieInput.trim()
    }
    
    if (!finalCookies) {
      alert('쿠키를 입력해주세요. (개별 입력 또는 전체 입력)')
      return
    }
    
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
  
  const handleCopyScript = async () => {
    const script = `// 치지직 쿠키 추출 스크립트
// 1. 치지직(chzzk.naver.com)에 로그인 후 이 스크립트를 실행하세요
// 2. 아래 결과를 복사해서 로그인 폼에 붙여넣기 하세요

// 모든 쿠키 확인
console.log('전체 쿠키:', document.cookie);

const cookies = document.cookie
  .split(';')
  .map(c => c.trim())
  .filter(c => c.startsWith('NID_AUT=') || c.startsWith('NID_SES=') || c.startsWith('NID_JKL=') || c.startsWith('NID_'))
  .join('; ');

// 개별 쿠키 확인
const allCookies = document.cookie.split(';').map(c => c.trim());
const nidCookies = allCookies.filter(c => c.startsWith('NID_'));
console.log('모든 NID 쿠키들:', nidCookies);

if (cookies) {
  console.log('🎉 쿠키 추출 성공!');
  console.log('👇 아래 내용을 복사하세요:');
  console.log(cookies);
  
  // 클립보드에 자동 복사 시도
  if (navigator.clipboard) {
    navigator.clipboard.writeText(cookies).then(() => {
      console.log('✅ 클립보드에 복사되었습니다!');
      alert('쿠키가 클립보드에 복사되었습니다! 로그인 폼에 붙여넣기 하세요.');
    }).catch(() => {
      console.log('❌ 클립보드 복사 실패. 수동으로 복사해주세요.');
      alert('쿠키: ' + cookies);
    });
  } else {
    alert('쿠키: ' + cookies);
  }
} else {
  console.log('❌ 네이버 쿠키가 없습니다.');
  alert('네이버 쿠키가 없습니다. 치지직에 로그인했는지 확인하세요.');
}`

    try {
      await navigator.clipboard.writeText(script)
      alert('쿠키 추출 스크립트가 클립보드에 복사되었습니다!\n\n1. 치지직(chzzk.naver.com)에 로그인하세요\n2. F12 → Console 탭에서 스크립트를 붙여넣고 실행하세요\n3. 추출된 쿠키를 아래 입력창에 붙여넣으세요')
    } catch (error) {
      // 클립보드 복사 실패시 텍스트 영역에 표시
      const textarea = document.createElement('textarea')
      textarea.value = script
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      alert('스크립트가 복사되었습니다! 치지직 콘솔에서 실행하세요.')
    }
  }

  const handleOpenChzzkAndCopy = async () => {
    // 치지직 새 창 열기
    window.open('https://chzzk.naver.com', '_blank', 'width=1000,height=700')
    
    // 스크립트도 클립보드에 복사
    await handleCopyScript()
  }

  const handleAutoDetectCookies = async () => {
    setIsAutoDetecting(true)
    
    try {
      console.log('=== 자동 쿠키 감지 시작 ===')
      
      // 방법 1: 현재 도메인 쿠키 확인
      const { naverCookies, hasValidCookies } = extractChzzkCookies()
      
      if (hasValidCookies && naverCookies) {
        console.log('기존 쿠키 감지 성공!')
        setCookieInput(naverCookies)
        alert('쿠키가 자동으로 감지되었습니다! 로그인 버튼을 눌러주세요.')
        return
      }
      
      // 방법 2: JavaScript 실행으로 쿠키 추출
      console.log('JavaScript 실행으로 쿠키 추출 중...')
      const jsResult = await executeJavaScriptForCookies()
      
      if (jsResult.success && jsResult.cookies) {
        console.log('JavaScript 실행 성공!')
        setCookieInput(jsResult.cookies)
        alert('쿠키가 자동으로 추출되었습니다! 로그인 버튼을 눌러주세요.')
        return
      }
      
      // 자동 감지 실패 - 수동 방법 안내
      alert('자동 감지에 실패했습니다.\n\n"치지직 열기 + 스크립트 복사" 버튼을 사용해보세요!')
      
    } catch (error) {
      console.error('자동 감지 오류:', error)
      alert('자동 감지 중 오류가 발생했습니다.')
    } finally {
      setIsAutoDetecting(false)
    }
  }

  const getCookieLoginForm = () => {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <h3 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
            치지직 쿠키 로그인
          </h3>
          <p className="text-xs text-purple-700 dark:text-purple-300">
            치지직 쿠키를 사용하여 직접 로그인합니다.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleOpenChzzkAndCopy}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            <span>🎯</span>
            <span>치지직 열기 + 스크립트</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCopyScript}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            <span>📋</span>
            <span>스크립트만 복사</span>
          </motion.button>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAutoDetectCookies}
          disabled={isAutoDetecting || isLoading}
          className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
        >
          {isAutoDetecting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>자동 감지 중...</span>
            </>
          ) : (
            <>
              <span>🔍</span>
              <span>자동 감지 시도</span>
            </>
          )}
        </motion.button>
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300/20"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white/10 dark:bg-gray-800/10 text-gray-500 dark:text-gray-400">
              또는
            </span>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              🎯 개별 쿠키 입력 (권장)
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
              치지직 → F12 → Application → Cookies → chzzk.naver.com에서 Value만 복사
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  NID_AUT (필수):
                </label>
                <input
                  type="text"
                  value={nidAuth}
                  onChange={(e) => setNidAuth(e.target.value)}
                  placeholder="AAABnRCK5fK043lOg9..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  NID_SES (필수):
                </label>
                <input
                  type="text"
                  value={nidSes}
                  onChange={(e) => setNidSes(e.target.value)}
                  placeholder="AAABnRCK5fK043lOg9..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300/20"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white/10 dark:bg-gray-800/10 text-gray-500 dark:text-gray-400">
                또는 전체 입력
              </span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              전체 쿠키 문자열:
            </label>
            <textarea
              value={cookieInput}
              onChange={(e) => setCookieInput(e.target.value)}
              placeholder="NID_AUT=...; NID_SES=..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCookieSignIn}
            disabled={isLoading || (!nidAuth.trim() && !nidSes.trim() && !cookieInput.trim())}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>로그인 중...</span>
              </>
            ) : (
              <>
                <span>🔑</span>
                <span>쿠키로 로그인</span>
              </>
            )}
          </motion.button>
        </div>
      </div>
    )
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
          {getCookieLoginForm()}
        </div>

        <div className="mt-8 space-y-4">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            <p>🎯 치지직 채널 인증으로 관리 기능 사용</p>
          </div>
          
          <div className="border-t border-gray-300/20 pt-4">
            <details className="text-sm text-gray-500 dark:text-gray-400">
              <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                쿠키 얻는 방법
              </summary>
              <div className="mt-2 space-y-1 text-xs">
                <p>• 자동 감지: 브라우저에서 쿠키를 자동으로 찾습니다</p>
                <p>• 수동 입력: chzzk.naver.com 로그인 후 F12 > Application > Cookies</p>
                <p>• NID_AUT, NID_SES 쿠키 값을 복사해서 입력</p>
                <p>• 아야우케 채널 확인 후 관리자 권한 부여</p>
              </div>
            </details>
          </div>
        </div>
      </motion.div>
    </div>
  )
}