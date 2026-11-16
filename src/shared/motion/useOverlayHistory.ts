'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const MARK = '__overlay';
/** 열린 오버레이 id — 맨 위 것만 링크 클릭을 가로챈다 */
const stack: string[] = [];
let seq = 0;

/** 오버레이가 하나라도 열려 있는지 — 페이지 전환(PageTransitions)이 양보할 때 쓴다 */
export function overlayOpen(): boolean {
  return stack.length > 0;
}

function currentMark(): string | undefined {
  const state = window.history.state as Record<string, unknown> | null;
  return typeof state?.[MARK] === 'string' ? (state[MARK] as string) : undefined;
}

/**
 * 오버레이(다이얼로그·시트·펼친 플레이어)를 브라우저 히스토리 한 칸으로 올린다.
 *
 * - 열릴 때 같은 URL로 항목을 하나 추가한다 → 뒤로가기(안드로이드 back, iOS 스와이프,
 *   마우스 뒤로 버튼)가 페이지를 떠나는 대신 오버레이를 닫는다.
 * - 닫기 버튼·ESC·배경 클릭으로 닫히면 추가했던 항목을 `history.back()`으로 걷어낸다.
 * - 오버레이 안의 내부 링크를 누르면 먼저 항목을 걷어낸 뒤 이동한다.
 *   (그냥 이동하면 되돌아왔을 때 아무 변화 없는 '빈 뒤로가기' 한 칸이 남는다)
 *
 * Next 앱 라우터는 popstate의 state에 자기 내부 값(__NA, 트리)이 없으면 페이지를
 * 새로고침하므로, 현재 state를 그대로 복사한 뒤 표식만 덧붙인다.
 *
 * 반환값 `leaveTo(href)`: 오버레이 안에서 코드로 페이지를 옮길 때 router.push 대신 쓴다.
 * (닫기 + router.push를 따로 부르면 항목을 걷어내는 back()과 이동이 경합한다)
 */
export function useOverlayHistory(open: boolean, onClose: () => void) {
  const router = useRouter();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const leaveRef = useRef<((href: string) => void) | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = `overlay-${++seq}`;
    stack.push(id);
    window.history.pushState({ ...(window.history.state ?? {}), [MARK]: id }, '');

    let popped = false;
    let pendingHref: string | null = null;

    const onPop = () => {
      // 위에 쌓인 다른 오버레이가 닫히며 우리 항목으로 돌아온 경우는 무시
      if (currentMark() === id) return;
      popped = true;
      const href = pendingHref;
      pendingHref = null;
      closeRef.current();
      if (href) router.push(href);
    };

    leaveRef.current = (href: string) => {
      if (currentMark() !== id) {
        closeRef.current();
        router.push(href);
        return;
      }
      pendingHref = href;
      window.history.back();
    };

    const onClick = (e: MouseEvent) => {
      if (stack[stack.length - 1] !== id || currentMark() !== id) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      if (a.dataset.overlayNav === 'off') return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Link의 클라이언트 이동을 막고, 항목을 걷어낸 뒤(onPop) 이동한다.
      e.preventDefault();
      e.stopPropagation();
      pendingHref = url.pathname + url.search + url.hash;
      window.history.back();
    };

    window.addEventListener('popstate', onPop);
    document.addEventListener('click', onClick, true);
    return () => {
      leaveRef.current = null;
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('click', onClick, true);
      const i = stack.indexOf(id);
      if (i >= 0) stack.splice(i, 1);
      // 뒤로가기가 아닌 방법으로 닫힘 → 우리가 올린 항목이 맨 위에 있으면 걷어낸다.
      // (그 사이 다른 페이지로 이동했다면 맨 위가 아니므로 건드리지 않는다)
      if (!popped && currentMark() === id) window.history.back();
    };
  }, [open, router]);

  return useCallback(
    (href: string) => {
      if (leaveRef.current) leaveRef.current(href);
      else router.push(href);
    },
    [router],
  );
}
