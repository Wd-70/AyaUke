'use client';

import { useReducedMotion } from 'framer-motion';

interface RevealOpts {
  /** 진입 시 아래에서 올라오는 거리(px). 기본 24 */
  y?: number;
  /** stagger 지연(s) */
  delay?: number;
  /** 등장 트리거 여백 */
  margin?: string;
  /** 지속(s). 기본 0.5 */
  duration?: number;
}

/**
 * 스크롤 진입 리빌 모션 props 팩토리.
 * `prefers-reduced-motion`이면 이동·지연을 제거하고 즉시(또는 페이드만) 나타나게 한다.
 * 반환된 객체를 `<motion.*>`에 스프레드해서 사용한다.
 */
export function useReveal() {
  const reduce = useReducedMotion();

  function reveal(opts: RevealOpts = {}) {
    const { y = 24, delay = 0, margin = '-80px', duration = 0.5 } = opts;
    return {
      initial: { opacity: 0, y: reduce ? 0 : y },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, margin },
      transition: { duration: reduce ? 0 : duration, delay: reduce ? 0 : delay },
    } as const;
  }

  return { reduce, reveal };
}
