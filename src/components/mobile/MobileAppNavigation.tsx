'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from '@headlessui/react';
import { HomeIcon, Music2, PlaySquare, Library, MoreHorizontal, X, Download, WifiOff } from 'lucide-react';
import { hasMobileTabs, mobileSection, MOBILE_TABS } from './navigation-model';
import { usePwaInstall } from '@/components/pwa/usePwaInstall';

const icons = [HomeIcon, Music2, PlaySquare, Library];

export default function MobileAppNavigation({ path, open, onOpen, onClose, children }: {
  path: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [offline, setOffline] = useState(false);
  const tabBarRef = useRef<HTMLElement>(null);
  const pwa = usePwaInstall();
  const enabled = hasMobileTabs(path);
  const section = mobileSection(path);

  useEffect(() => {
    // This portal sits outside the app root that Dialog makes inert.
    if (tabBarRef.current) tabBarRef.current.inert = open;
  }, [open, mounted]);

  useEffect(() => {
    setMounted(true);
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    // A mobile sheet must never trap focus after rotating to a desktop layout.
    const media = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = () => { if (media.matches) onClose(); };
    closeOnDesktop();
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, [onClose]);

  if (!mounted) return null;
  return <>
    {enabled && createPortal(
      <nav ref={tabBarRef} data-mobile-tabs aria-hidden={open || undefined} aria-label="모바일 주요 메뉴" className="mobile-tab-bar md:hidden">
        {MOBILE_TABS.map((tab, index) => {
          const Icon = icons[index];
          const active = section === tab.section;
          return <Link key={tab.href} href={tab.href} aria-current={active ? 'page' : undefined}
            className={`mobile-tab ${active ? 'is-active' : ''}`}>
            <span className="mobile-tab-icon"><Icon size={21} strokeWidth={active ? 2.2 : 1.7} aria-hidden /></span>
            <span>{tab.label}</span>
          </Link>;
        })}
        <button type="button" onClick={onOpen} aria-haspopup="dialog" aria-expanded={open}
          aria-controls={open ? 'mobile-navigation-menu' : undefined} className={`mobile-tab ${open || path === '/profile' ? 'is-active' : ''}`}>
          <span className="mobile-tab-icon"><MoreHorizontal size={22} aria-hidden /></span>
          <span>더보기</span>
        </button>
      </nav>, document.body)}
    {offline && enabled && createPortal(
      <div role="status" className="mobile-offline-notice md:hidden"><WifiOff size={14} aria-hidden />오프라인이에요 · 연결되면 다시 이용해 주세요</div>, document.body)}
    <Dialog open={open} onClose={onClose} className="relative z-[110]">
      <DialogBackdrop transition className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 data-[closed]:opacity-0 motion-reduce:transition-none" />
      <div className="fixed inset-0 flex items-end justify-center">
        <DialogPanel id="mobile-navigation-menu" transition className="mobile-menu-sheet w-full max-w-lg overflow-y-auto rounded-t-[2rem] border border-light-primary/20 bg-white px-5 shadow-2xl transition duration-200 data-[closed]:translate-y-8 data-[closed]:opacity-0 motion-reduce:transition-none dark:border-dark-primary/20 dark:bg-gray-900">
          <div aria-hidden className="mx-auto mb-2 mt-3 h-1 w-9 rounded-full bg-gray-300 dark:bg-gray-600" />
          <div className="mb-4 flex items-center justify-between">
            <div><DialogTitle className="text-xl font-bold tracking-tight">나의 AyaUke</DialogTitle>
              <Description className="mt-1 text-xs text-gray-600 dark:text-gray-400">계정부터 앱 설정까지, 한곳에서</Description></div>
            <button type="button" onClick={onClose} aria-label="메뉴 닫기" className="flex h-11 w-11 items-center justify-center rounded-full bg-light-primary/10 dark:bg-dark-primary/10"><X size={20} /></button>
          </div>
          <div onClick={event => { if ((event.target as HTMLElement).closest('a[href]')) onClose(); }}>{children}</div>
          {!pwa.installed && <section className="mb-2 mt-4 rounded-2xl border border-light-primary/25 bg-light-primary/10 p-4 dark:border-dark-primary/25 dark:bg-dark-primary/10" aria-label="앱 설치">
            <div className="flex items-center gap-2 text-sm font-semibold"><Download size={18} aria-hidden />홈 화면에서 더 가까이</div>
            <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
              {pwa.available ? 'AyaUke를 설치하고, 홈 화면에서 바로 노래를 만나보세요.' : pwa.ios ? 'Safari의 공유 버튼 → 홈 화면에 추가를 선택해 주세요.' : '브라우저 메뉴의 앱 설치 또는 홈 화면에 추가를 이용해 주세요. 지원 여부는 브라우저에 따라 달라요.'}
            </p>
            {pwa.available && <button type="button" disabled={pwa.busy} onClick={() => void pwa.install()} className="mt-3 min-h-11 w-full rounded-xl bg-gradient-to-r from-light-cta-accent to-light-cta-purple px-4 text-sm font-semibold text-white disabled:opacity-50 dark:from-dark-accent dark:to-dark-secondary">{pwa.busy ? '설치 확인 중…' : '앱으로 설치하기'}</button>}
            {pwa.message && <p role="status" className="mt-2 text-xs leading-relaxed">{pwa.message}</p>}
          </section>}
        </DialogPanel>
      </div>
    </Dialog>
  </>;
}
