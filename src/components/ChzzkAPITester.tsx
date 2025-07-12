'use client'

import { useSession } from "next-auth/react"
import { useState } from "react"
import { motion } from "framer-motion"
import { testChzzkMethods } from "@/lib/testChzzkAPI"

export default function ChzzkAPITester() {
  const { data: session } = useSession()
  const [isTesting, setIsTesting] = useState(false)
  const [testResults, setTestResults] = useState<string[]>([])

  if (!session || !session.user.isAdmin) {
    return null
  }

  const runAPITest = async () => {
    setIsTesting(true)
    setTestResults([])
    
    // 콘솔 출력을 캡처하기 위한 임시 함수
    const originalLog = console.log
    const logs: string[] = []
    
    console.log = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
      logs.push(message)
      originalLog(...args)
    }
    
    try {
      console.log('=== 치지직 API 테스트 시작 ===')
      await testChzzkMethods()
      console.log('=== 치지직 API 테스트 완료 ===')
    } catch (error) {
      console.log('API 테스트 오류:', error)
    } finally {
      // 원래 console.log 복원
      console.log = originalLog
      setTestResults(logs)
      setIsTesting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 dark:bg-gray-800/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mt-6"
    >
      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
        🧪 치지직 API 테스터
      </h3>
      
      <div className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          치지직 비공식 API의 사용 가능한 메서드들을 확인합니다.
        </div>

        <button
          onClick={runAPITest}
          disabled={isTesting}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg transition-all duration-300 disabled:opacity-50"
        >
          {isTesting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>테스트 중...</span>
            </>
          ) : (
            <>
              <span>🔬</span>
              <span>API 메서드 테스트</span>
            </>
          )}
        </button>

        {testResults.length > 0 && (
          <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              테스트 결과:
            </div>
            <div className="space-y-1">
              {testResults.map((result, index) => (
                <div key={index} className="text-xs text-gray-800 dark:text-gray-200 font-mono">
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400">
          💡 이 테스트는 치지직 비공식 API 라이브러리가 제공하는 메서드들을 확인합니다.
          <br />
          브라우저 콘솔에서도 상세한 결과를 확인할 수 있습니다.
        </div>
      </div>
    </motion.div>
  )
}