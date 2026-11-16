'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { overlayOpen } from './useOverlayHistory';

/**
 * 내부 링크 이동을 View Transitions API로 감싼다 (docs/ux-motion-plan.md S2).
 *
 * - Next 15.5의 React <ViewTransition>은 실험 기능이라, 문서 클릭을 가로채
 *   document.startViewTransition 안에서 router.push 하는 얇은 래퍼로 구현한다.
 *   (Next를 올리면 이 파일만 공식 API로 교체)
 * - 방향은 <html data-nav="tab|forward|back">으로 CSS에 전달한다(globals.css).
 * - 헤더·하단 탭·미니 플레이어는 view-transition-name으로 분리돼 제자리에 머문다.
 * - 미지원 브라우저, 동작 줄이기 설정, 오버레이가 열린 상태, 수정키 클릭은 평소대로 이동.
 * - 브라우저 뒤로/앞으로(popstate)는 감싸지 않는다(즉시 전환).
 */

type Dir = 'tab' | 'forward' | 'back';

/** 새 화면이 그려질 때까지 기다리는 최대 시간. 넘기면(느린 서버) 전환 없이 이어서 그린다. */
const COMMIT_TIMEOUT = 450;

function directionFor(a: HTMLAnchorElement): Dir {
  const explicit = a.dataset.nav;
  if (explicit === 'back' || explicit === 'forward' || explicit === 'tab') return explicit;
  if (a.closest('[data-mobile-tabs], [data-nav-links]')) return 'tab';
  return 'forward';
}

export default function PageTransitions() {
  const router = useRouter();
  const pathname = usePathname();
  const pending = useRef<{ path: string; resolve: () => void } | null>(null);

  // 경로가 바뀌어 새 화면이 커밋되면 전환의 '새 상태' 캡처를 진행시킨다.
  useEffect(() => {
    const p = pending.current;
    if (p && p.path === pathname) {
      pending.current = null;
      // 커밋된 DOM을 바로 '새 상태'로 캡처하게 한다.
      // (전환 콜백 동안은 렌더링이 멈춰 requestAnimationFrame이 돌지 않으므로 rAF로 미루면 안 된다)
      p.resolve();
    }
  }, [pathname]);

  useEffect(() => {
    const doc = document as Document & {
      startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void> };
    };
    if (typeof doc.startViewTransition !== 'function') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || reduce.matches || overlayOpen()) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      const a = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      if (a.dataset.transition === 'off') return;
      // 링크 안의 버튼 등(좋아요·메뉴)은 자기 동작을 하도록 둔다
      const control = target?.closest?.('button, input, select, textarea, [role="button"]');
      if (control && a.contains(control)) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // 같은 페이지(해시·쿼리만 변경)는 전환하지 않는다
      if (url.pathname === window.location.pathname) return;
      // 관리자·임베드·OBS·게임은 자체 레이아웃이라 제외
      if (/^\/(admin|embed|obs|game|api)(\/|$)/.test(url.pathname)) return;

      // preventDefault만: 링크의 onClick(메뉴 닫기 등)은 그대로 돌고,
      // Next Link는 defaultPrevented를 보고 자체 이동을 건너뛴다.
      e.preventDefault();
      const href = url.pathname + url.search + url.hash;
      document.documentElement.dataset.nav = directionFor(a);

      const transition = doc.startViewTransition!(
        () =>
          new Promise<void>((resolve) => {
            const timer = window.setTimeout(() => {
              pending.current = null;
              resolve();
            }, COMMIT_TIMEOUT);
            pending.current = {
              path: url.pathname,
              resolve: () => {
                window.clearTimeout(timer);
                resolve();
              },
            };
            router.push(href);
          }),
      );
      transition.finished.finally(() => {
        delete document.documentElement.dataset.nav;
      });
    };

    // 캡처 단계: Next Link의 클라이언트 이동보다 먼저 가로챈다.
    // 클릭으로 다른 동작(다이얼로그 열기 등)을 하는 링크는 data-transition="off"로 제외한다.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  return null;
}
