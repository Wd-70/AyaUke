'use client';

import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

/** OS의 '동작 줄이기' 설정을 모든 framer-motion 애니메이션에 적용(이동·스케일 제거, 페이드 유지). */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
