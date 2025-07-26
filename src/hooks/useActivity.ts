'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useCallback, useRef } from 'react'

export function useActivity() {
  const { data: session } = useSession()
  const lastUpdateRef = useRef<number>(0)
  const initializedRef = useRef<boolean>(false)

  const updateActivity = useCallback(async (isFirstVisit = false) => {
    const currentSession = session
    if (!currentSession?.user) return

    // 첫 방문이 아닌 경우에는 1시간 이내 중복 호출 방지
    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    
    if (!isFirstVisit && now - lastUpdateRef.current < oneHour) {
      return
    }

    try {
      const response = await fetch('/api/user/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isFirstVisit })
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
  }, []) // 의존성 완전 제거

  useEffect(() => {
    // 이미 초기화되었거나 세션이 없으면 건너뛰기
    if (initializedRef.current || !session?.user) return
    
    initializedRef.current = true

    // 페이지 로드 시 한 번만 업데이트 (첫 방문으로 처리)
    updateActivity(true)

    // 사용자가 실제 의미있는 행동을 할 때만 업데이트
    let lastActivityTime = 0
    const minInterval = 10 * 60 * 1000 // 10분 간격

    const handleSignificantActivity = () => {
      const now = Date.now()
      if (now - lastActivityTime > minInterval) {
        updateActivity()
        lastActivityTime = now
      }
    }

    // 의미있는 사용자 행동만 감지
    const significantEvents = [
      'click', // 클릭
      'submit', // 폼 제출
      'keydown' // 키 입력
    ]

    significantEvents.forEach(event => {
      document.addEventListener(event, handleSignificantActivity, { passive: true })
    })

    return () => {
      significantEvents.forEach(event => {
        document.removeEventListener(event, handleSignificantActivity)
      })
    }
  }, [session?.user]) // session?.user가 처음 로드될 때만 실행

  return { updateActivity }
}