'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * 상단 네비를 "스크롤한 만큼" 비례해서 숨겼다/보였다 한다(트리거형 고정 애니메이션이 아님).
 *
 * 단일 rAF 스크롤 루프가 CSS 변수만 갱신하므로 스크롤 중 React 리렌더가 없고,
 * 네비·스티키 바가 동일한 변수에서 파생돼 구조적으로 동기화된다(둘의 충돌 제거):
 *   --nav-shift  : 0..네비높이(px). 네비는 translateY(-shift), 바는 top = 네비높이 - shift.
 *   --nav-height : 측정된 네비 높이(px). 모바일 14px 루트폰트로 42px가 되는 경우도 실측 반영.
 *
 * 페이지에서 한 번 호출하면 활성화되고, 언마운트 시 변수를 제거한다(타 페이지 영향 없음).
 *
 * @param shiftAnchorSelector 스티키 검색 바의 셀렉터. 두 가지에 쓰인다.
 *   ① 그 바가 줄면(필터 접힘) 브라우저 스크롤 앵커링이 scrollY를 그만큼 줄여 "가짜
 *      위-스크롤"을 만드는데, 그 분량을 상쇄해 네비가 실제 사용자 스크롤에만 반응하게 함.
 *   ② 바의 고정(stuck) 여부를 같은 rAF에서 동기 계산해 반환(IO의 비동기 지연 제거).
 * @returns stuck 바가 sticky top에 닿아 고정됐는지. (필터 자동접힘·배경 표시에 사용)
 */
const useIsoLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useScrollNav(shiftAnchorSelector?: string) {
  const navHeightRef = useRef(64);
  const [stuck, setStuck] = useState(false);

  // 네비 높이 측정 → --nav-height (페인트 전 1회, 이후 resize)
  useIsoLayoutEffect(() => {
    const root = document.documentElement;
    const measure = () => {
      const nav = document.querySelector('nav');
      const h = nav ? Math.round(nav.getBoundingClientRect().height) : 64;
      navHeightRef.current = h;
      root.style.setProperty('--nav-height', `${h}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      root.style.removeProperty('--nav-height');
    };
  }, []);

  // 스크롤량 누적 → --nav-shift (방향만큼 비례, [0, 네비높이]로 클램프)
  useEffect(() => {
    const root = document.documentElement;
    let lastY = window.scrollY;
    let shift = 0;
    let ticking = false;
    let lastAnchorH = 0;
    let barEl: HTMLElement | null = null;
    const getBar = (): HTMLElement | null => {
      if (!shiftAnchorSelector) return null;
      if (!barEl || !barEl.isConnected) {
        barEl = document.querySelector(shiftAnchorSelector);
      }
      return barEl;
    };
    lastAnchorH = getBar()?.getBoundingClientRect().height ?? 0;
    const update = () => {
      ticking = false;
      const max = navHeightRef.current;
      const y = window.scrollY;
      const bar = getBar();
      const h = bar ? bar.getBoundingClientRect().height : lastAnchorH;
      const rawDy = y - lastY;
      // 바 높이가 줄면(필터 접힘) 앵커링이 scrollY를 그만큼 줄인다 → 더해서 상쇄.
      // (확장 시엔 반대로 늘어난 분량을 빼서 상쇄) → userDy는 순수 사용자 스크롤만.
      const userDy = rawDy + (lastAnchorH - h);
      lastY = y;
      lastAnchorH = h;
      // 최상단 근처는 항상 표시, 그 외엔 내리면(+) 숨기고 올리면(-) 보인다
      shift = y <= 4 ? 0 : Math.max(0, Math.min(max, shift + userDy));
      root.style.setProperty('--nav-shift', `${shift}px`);
      // 같은 프레임에 고정 여부 동기 계산: var 반영된 레이아웃을 읽어 IO 지연 없이 즉시.
      // 바의 sticky top = max - shift. rectTop이 거기 닿으면 고정.
      // 히스테리시스: 고정은 즉시, 해제는 충분히(필터 높이 이상) 멀어져야 한다 →
      // 필터 접힘으로 인한 앵커링(-88px가량)이 경계에서 stuck을 진동시키는 것을 막는다.
      if (bar) {
        const rectTop = bar.getBoundingClientRect().top;
        const stickyTop = max - shift;
        setStuck((prev) =>
          prev ? rectTop <= stickyTop + 140 : rectTop <= stickyTop + 0.5
        );
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    root.style.setProperty('--nav-shift', '0px');
    update(); // 초기 상태 1회 계산
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      root.style.removeProperty('--nav-shift');
    };
  }, [shiftAnchorSelector]);

  return stuck;
}
