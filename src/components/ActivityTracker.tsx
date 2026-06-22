'use client';

import { useActivity } from '@/hooks/useActivity';

/** 로그인 사용자의 활동 시각을 갱신하는 부수효과 전용 컴포넌트 (렌더 없음). */
export default function ActivityTracker() {
  useActivity();
  return null;
}
