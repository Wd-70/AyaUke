'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useCallback, useRef } from 'react'

export function useActivity() {
  const { data: session } = useSession()
  const lastUpdateRef = useRef<number>(0)

  const updateActivity = useCallback(async () => {
    if (!session?.user) return

    // 1시간 이내 중복 호출 방지 (클라이언트 사이드)
    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    
    if (now - lastUpdateRef.current < oneHour) {
      return
    }

    try {
      const response = await fetch('/api/user/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && !data.skipped) {
          console.log('✅ 활동 업데이트:', data.message)
          lastUpdateRef.current = now
        }
      }
    } catch (error) {
      // 에러가 발생해도 조용히 처리 (사용자 경험에 영향 없게)
      console.error('활동 업데이트 실패:', error)
    }
  }, [session?.user])

  useEffect(() => {
    if (!session?.user) return

    // 페이지 로드 시 업데이트
    updateActivity()

    // 페이지 가시성 변경 시 업데이트 (탭 전환 등)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateActivity()
      }
    }

    // 페이지 포커스 시 업데이트
    const handleFocus = () => {
      updateActivity()
    }

    // 페이지 떠나기 전 업데이트 (선택적)
    const handleBeforeUnload = () => {
      // sendBeacon으로 비동기 전송 (페이지 언로드 시에도 전송됨)
      if (Date.now() - lastUpdateRef.current >= 60 * 60 * 1000) {
        // FormData로 POST 요청 전송
        const formData = new FormData()
        formData.append('type', 'beforeunload')
        navigator.sendBeacon('/api/user/activity', formData)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [session?.user, updateActivity])

  return { updateActivity }
}