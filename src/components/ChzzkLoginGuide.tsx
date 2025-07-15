'use client'

import { useSession } from "next-auth/react"
import { useState } from "react"
import { motion } from "framer-motion"

export default function ChzzkLoginGuide() {
  const { data: session } = useSession()
  const [isModalOpen, setIsModalOpen] = useState(false)

  if (!session || !session.user) {
    return null
  }

  const openChzzkLogin = () => {
    // 새 탭에서 치지직 열기
    window.open('https://chzzk.naver.com', '_blank')
    setIsModalOpen(true)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('클립보드에 복사되었습니다!')
    } catch (error) {
      console.error('클립보드 복사 실패:', error)
      // 대체 방법
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      alert('클립보드에 복사되었습니다!')
    }
  }

  const cookieExtractionCode = `
// 1. 치지직(chzzk.naver.com)에서 이 코드를 실행하세요
const cookies = document.cookie;
console.log('현재 쿠키:', cookies);

// 2. NID_AUT와 NID_SES 쿠키 추출
const naverCookies = cookies
  .split(';')
  .map(c => c.trim())
  .filter(c => c.startsWith('NID_AUT=') || c.startsWith('NID_SES='))
  .join('; ');

console.log('네이버 쿠키:', naverCookies);

// 3. 이 값을 복사해서 수동 쿠키 설정에 사용하세요
if (naverCookies) {
  console.log('✅ 복사할 쿠키 값:', naverCookies);
  
  // 자동으로 클립보드에 복사 (HTTPS에서만 동작)
  if (navigator.clipboard) {
    navigator.clipboard.writeText(naverCookies).then(() => {
      console.log('✅ 클립보드에 복사됨!');
      alert('쿠키가 클립보드에 복사되었습니다!');
    });
  }
} else {
  console.log('❌ 네이버 쿠키를 찾을 수 없습니다. 로그인을 확인하세요.');
}
`.trim()

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/10 dark:bg-gray-800/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mt-6"
      >
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
          🎯 치지직 로그인 가이드
        </h3>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <p className="mb-3">치지직 채널 정보를 가져오기 위해 로그인이 필요합니다:</p>
            
            <div className="space-y-2 text-xs">
              <div className="flex items-start space-x-2">
                <span className="bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full font-medium">1</span>
                <span>아래 버튼으로 치지직에 로그인</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 px-2 py-1 rounded-full font-medium">2</span>
                <span>로그인 완료 후 &quot;쿠키 추출 코드&quot; 실행</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200 px-2 py-1 rounded-full font-medium">3</span>
                <span>추출된 쿠키를 &quot;수동 쿠키 설정&quot;에 입력</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={openChzzkLogin}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-all duration-300"
            >
              <span>🔗</span>
              <span>치지직 로그인하기</span>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg transition-all duration-300"
            >
              <span>📋</span>
              <span>쿠키 추출 코드</span>
            </button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              💡 이 방법이 가장 확실합니다!
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300">
              브라우저 보안 정책으로 인해 자동 쿠키 읽기가 제한될 수 있으므로, 
              수동으로 쿠키를 추출하는 것이 가장 안정적인 방법입니다.
            </div>
          </div>
        </div>
      </motion.div>

      {/* 쿠키 추출 코드 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                🍪 쿠키 추출 코드
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <p className="mb-2">치지직에 로그인한 후, 브라우저 콘솔에서 다음 코드를 실행하세요:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>치지직 페이지에서 F12 키를 눌러 개발자 도구 열기</li>
                  <li>Console 탭 클릭</li>
                  <li>아래 코드를 복사해서 붙여넣기</li>
                  <li>Enter 키로 실행</li>
                  <li>출력된 쿠키 값을 복사</li>
                </ol>
              </div>

              <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    JavaScript 코드:
                  </span>
                  <button
                    onClick={() => copyToClipboard(cookieExtractionCode)}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
                  >
                    📋 복사
                  </button>
                </div>
                <pre className="text-xs text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap">
                  {cookieExtractionCode}
                </pre>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  ⚠️ 주의사항
                </div>
                <div className="text-xs text-yellow-700 dark:text-yellow-300">
                  • 반드시 치지직(chzzk.naver.com)에서 실행하세요<br />
                  • 로그인이 완료된 상태에서 실행하세요<br />
                  • 쿠키는 개인정보이므로 안전하게 관리하세요
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </>
  )
}