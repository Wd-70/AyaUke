'use client'

import { useActivity } from '@/hooks/useActivity'

export default function ActivityTracker() {
  useActivity()
  return null // 렌더링할 것이 없음 (백그라운드에서 동작)
}