'use client'

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"

interface ChzzkInfo {
  channelId: string
  channelName: string
  channelImageUrl: string
  followerCount: number
  openLive: boolean
}

interface UserInfo {
  session: unknown
  chzzkInfo: ChzzkInfo | null
}

export default function UserDebugInfo() {
  const { data: session } = useSession()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchUserInfo = async () => {
    if (!session) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/user/chzzk-info')
      const data = await response.json()
      setUserInfo(data)
      
      // 콘솔에도 출력
      console.log('=== 클라이언트 사이드 디버깅 ===')
      console.log('Session data:', session)
      console.log('API Response:', data)
    } catch (error) {
      console.error('사용자 정보 가져오기 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchUserInfo()
    }
  }, [session])

  if (!session) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 m-4">
        <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
          로그인 상태
        </h3>
        <p className="text-xs text-yellow-700 dark:text-yellow-300">
          로그인되지 않음
        </p>
      </div>
    )
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 m-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
          사용자 디버그 정보
        </h3>
        <button
          onClick={fetchUserInfo}
          disabled={loading}
          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '로딩...' : '새로고침'}
        </button>
      </div>
      
      <div className="space-y-3 text-xs">
        <div>
          <strong className="text-blue-800 dark:text-blue-200">기본 세션 정보:</strong>
          <div className="mt-1 p-2 bg-white/50 dark:bg-gray-800/50 rounded border">
            <div>이름: {session.user?.name}</div>
            <div>이메일: {session.user?.email}</div>
            <div>네이버 ID: {session.user?.naverId}</div>
            <div>채널 ID: {session.user?.channelId || '없음'}</div>
            <div>채널명: {session.user?.channelName || '없음'}</div>
            <div>아야우케 여부: {session.user?.isAyauke ? '예' : '아니오'}</div>
          </div>
        </div>

        {userInfo?.chzzkInfo && (
          <div>
            <strong className="text-blue-800 dark:text-blue-200">치지직 채널 정보:</strong>
            <div className="mt-1 p-2 bg-white/50 dark:bg-gray-800/50 rounded border">
              <div>채널 ID: {userInfo.chzzkInfo.channelId}</div>
              <div>채널명: {userInfo.chzzkInfo.channelName}</div>
              <div>팔로워 수: {userInfo.chzzkInfo.followerCount?.toLocaleString() || '정보 없음'}</div>
              <div>라이브 상태: {userInfo.chzzkInfo.openLive ? '방송 중' : '방송 종료'}</div>
              {userInfo.chzzkInfo.channelImageUrl && (
                <div className="mt-2">
                  <img 
                    src={userInfo.chzzkInfo.channelImageUrl} 
                    alt="채널 이미지" 
                    className="w-12 h-12 rounded-full"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-xs text-blue-600 dark:text-blue-400">
          💡 개발자 도구 콘솔에서 더 자세한 정보를 확인할 수 있습니다.
        </div>
      </div>
    </div>
  )
}