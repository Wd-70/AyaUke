'use client';

import { flushSync } from 'react-dom';

/**
 * 카드 → 상세(시트·다이얼로그) 모핑 (docs/ux-motion-plan.md S4).
 *
 * View Transitions의 '이름 이어 주기'를 쓴다: 바뀌기 전 요소(from)와 바뀐 뒤 요소(to)에
 * 같은 view-transition-name을 주면 브라우저가 위치·크기를 이어서 움직이고 내용은 교차 페이드한다.
 * framer layoutId와 달리 카드 안 글자가 늘어나 보이거나 카드의 overflow에 잘리지 않는다.
 *
 * 전환 콜백 동안은 렌더링이 멈춰 requestAnimationFrame·framer 애니메이션이 돌지 않으므로,
 * update는 flushSync로 즉시 DOM에 반영되어야 한다 → 모핑을 쓰는 오버레이는 framer
 * 진입/퇴장 애니메이션 없이(즉시) 렌더한다(`instant` 모드).
 */

type VT = { finished: Promise<void> };
type DocVT = Document & { startViewTransition?: (cb: () => void | Promise<void>) => VT };

export function canMorph(): boolean {
  if (typeof document === 'undefined') return false;
  if (typeof (document as DocVT).startViewTransition !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const setName = (el: Element | null, name: string) =>
  (el as HTMLElement | null)?.style.setProperty('view-transition-name', name || null);

/**
 * from을 to로 이어 주며 update를 적용한다. to는 update 직후 DOM에서 찾는다.
 * 모핑할 수 없으면(미지원·동작 줄이기·from 없음) update만 실행하고 false.
 */
export function morph(
  name: string,
  from: Element | null,
  update: () => void,
  findTo: () => Element | null,
): boolean {
  if (!from || !canMorph()) {
    update();
    return false;
  }
  const root = document.documentElement;
  setName(from, name);
  root.dataset.morph = '';
  let to: Element | null = null;
  const t = (document as DocVT).startViewTransition!(() => {
    setName(from, '');
    flushSync(update);
    to = findTo();
    setName(to, name);
  });
  t.finished.finally(() => {
    setName(to, '');
    delete root.dataset.morph;
  });
  return true;
}
