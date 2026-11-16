/**
 * 모션 토큰 (초 단위) — globals.css의 --dur-* / --ease-* 와 같은 값.
 * 기준: docs/ux-motion-plan.md 3장.
 */
export const DUR = {
  press: 0.1,
  fade: 0.16,
  enter: 0.22,
  sheet: 0.32,
  exit: 0.15,
} as const;

export const EASE_OUT = [0.2, 0, 0, 1] as const;
export const EASE_IN = [0.4, 0, 1, 1] as const;

/** 탭 표시·세그먼트·좋아요 등 작은 요소 */
export const SPRING_SNAPPY = { type: 'spring', stiffness: 380, damping: 32 } as const;
/** 시트·플레이어 같은 큰 면 */
export const SPRING_SHEET = { type: 'spring', stiffness: 320, damping: 34 } as const;
