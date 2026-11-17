'use client';

import { useEffect, useRef, useState } from 'react';
import { overlayOpen } from './useOverlayHistory';

/**
 * 뒤로가기로 돌아온 목록 화면 되살리기 (검색어·필터·불러온 개수·스크롤).
 *
 * 앱 라우터는 페이지를 떠나면 클라이언트 상태를 버리므로, 노래책에서 검색해 둔 채 다른 탭에
 * 갔다가 뒤로 오면 빈 검색·맨 위로 초기화됐다. 화면을 떠날 때 상태를 sessionStorage에 적어
 * 두고, '브라우저 뒤로/앞으로'로 다시 열렸을 때만 되살린다(탭·링크로 새로 열면 처음부터).
 *
 * popstate 기록은 이 모듈이 로드될 때 등록된다 — 레이아웃의 PageTransitions가 import한다.
 */
let pop = { at: 0, path: '' };
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    pop = { at: Date.now(), path: window.location.pathname };
  });
  // 링크를 눌러 새로 이동하는 건 뒤로가기가 아니다
  document.addEventListener(
    'click',
    (e) => {
      if ((e.target as Element | null)?.closest?.('a[href]')) pop = { at: 0, path: '' };
    },
    true,
  );
}

/** 지금 마운트되는 화면이 브라우저 뒤로/앞으로로 열렸는지 */
export function cameBack(): boolean {
  return pop.path === window.location.pathname && Date.now() - pop.at < 3000;
}

const storageKey = (key: string) => `restore:${key}`;

/**
 * @returns 뒤로가기로 돌아왔으면 저장된 값(첫 렌더에서 한 번 읽음), 아니면 null.
 * `save()`가 돌려준 최신 값과 스크롤 위치를 화면을 떠날 때 저장하고, 돌아왔으면 스크롤을 되돌린다.
 */
export function useHistoryRestore<T>(key: string, save: () => T): T | null {
  const [restored] = useState<(T & { __scrollY?: number }) | null>(() => {
    if (typeof window === 'undefined' || !cameBack()) return null;
    try {
      const raw = window.sessionStorage.getItem(storageKey(key));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const saveRef = useRef(save);
  saveRef.current = save;

  // 스크롤 위치는 계속 기억해 둔다(떠나는 순간엔 새 화면 때문에 이미 바뀌었을 수 있다).
  // 시트·다이얼로그가 본문 스크롤을 잠근 동안의 값(0)은 무시한다.
  const scrollY = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      if (!overlayOpen()) scrollY.current = window.scrollY;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      try {
        window.sessionStorage.setItem(storageKey(key), JSON.stringify({ ...saveRef.current(), __scrollY: scrollY.current }));
      } catch {
        /* 저장소 차단 — 되살리기만 포기 */
      }
    };
  }, [key]);

  // 되살린 목록이 그려진 뒤 스크롤을 되돌린다(브라우저·라우터의 늦은 스크롤을 한 번 더 덮는다)
  useEffect(() => {
    const y = restored?.__scrollY;
    if (!y) return;
    const go = () => window.scrollTo(0, y);
    const raf = requestAnimationFrame(go);
    const t = window.setTimeout(go, 120);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [restored]);

  return restored;
}
