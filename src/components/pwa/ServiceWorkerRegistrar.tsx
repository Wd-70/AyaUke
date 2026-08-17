'use client';

import { useEffect } from 'react';

/**
 * 서비스워커 등록 (프로덕션에서만). 개발 모드는 HMR 캐시 충돌을 피하려고 등록하지 않고,
 * 혹시 등록돼 있으면 해제한다.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* 등록 실패는 앱 동작에 영향 없음 */
      });
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
