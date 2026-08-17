'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useSession, signOut } from 'next-auth/react';
import type { Session } from 'next-auth';
import { UserIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { isSuperAdmin, canManageSongs, UserRole } from '@/lib/permissions';

interface NavigationProps {
  /** 활성 경로 강제 지정(미지정 시 usePathname으로 자체 판단) */
  currentPath?: string;
}

/** 상단 셸에 노출되는 기본 내비 링크 */
const NAV_LINKS = [
  { href: '/', label: '홈' },
  { href: '/songbook', label: '노래책' },
  { href: '/clips', label: '클립' },
  { href: '/player', label: '플레이어' },
] as const;

/**
 * 권한에 따라 노출할 관리 메뉴 — 데스크톱/모바일이 공유하는 단일 출처.
 * (권한 분기 로직을 한 곳에만 두어 양쪽 메뉴가 어긋나지 않게 한다.)
 */
function adminMenuItems(session: Session | null): { href: string; label: string }[] {
  if (!session || !canManageSongs(session.user.role as UserRole)) return [];
  const items: { href: string; label: string }[] = [];
  if (isSuperAdmin(session.user.role as UserRole)) {
    items.push({ href: '/admin', label: '관리자 대시보드' });
  }
  items.push({ href: '/admin/songs', label: '노래 관리' });
  return items;
}

/** 페이지 상단에서 벗어났는지 — 스크롤 시 네비 그림자 강화용 */
function useScrolled(threshold = 4) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

/** 해/달 아이콘 (라이트=해, 다크=달) — 중복 제거용 공용 마크업 */
function ThemeIcons({ sizeClass }: { sizeClass: string }) {
  return (
    <span className={`relative block ${sizeClass}`}>
      <svg
        className={`absolute inset-0 ${sizeClass} transform transition-all duration-300 rotate-0 scale-100 opacity-100 dark:rotate-90 dark:scale-75 dark:opacity-0`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
      <svg
        className={`absolute inset-0 ${sizeClass} transform transition-all duration-300 -rotate-90 scale-75 opacity-0 dark:rotate-0 dark:scale-100 dark:opacity-100`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    </span>
  );
}

export default function Navigation({ currentPath }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: session, status } = useSession(); // 한 번만 호출
  const pathname = usePathname();
  const activePath = currentPath ?? pathname ?? '/';
  const scrolled = useScrolled();
  const reduce = useReducedMotion();
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen]);

  // 스크롤 연동: useScrollNav가 --nav-shift를 갱신하면 그만큼 위로 밀려 올라간다.
  // (변수가 없는 페이지는 0px → 이동 없음). 모바일 메뉴가 열려 있으면 항상 표시.
  return (
    <nav
      className={`fixed left-0 right-0 top-0 z-50 border-b backdrop-blur-md transition-shadow duration-300 ${
        scrolled
          ? 'border-light-primary/30 bg-white/90 shadow-lg shadow-light-primary/5 dark:border-dark-primary/30 dark:bg-gray-900/90 dark:shadow-black/20'
          : 'border-light-primary/20 bg-white/80 dark:border-dark-primary/20 dark:bg-gray-900/80'
      }`}
      style={{
        transform: isMobileMenuOpen
          ? 'translateY(0)'
          : 'translateY(calc(-1 * var(--nav-shift, 0px)))',
      }}
    >
      <div className="mx-auto max-w-6xl px-3 sm:px-6 lg:px-8">
        <div className="flex h-12 items-center sm:h-16">
          {/* Left side - Logo */}
          <div className="flex-1">
            <Link href="/" className="group inline-flex cursor-pointer items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-light-accent to-light-purple p-1 transition-transform duration-200 group-hover:scale-105 dark:from-dark-primary dark:to-dark-secondary sm:h-10 sm:w-10">
                <img src="/honeyz.png" alt="HONEYZ Logo" className="h-full w-full object-contain" />
              </div>
              <span className="bg-gradient-to-r from-light-accent to-light-purple bg-clip-text font-display text-lg font-bold text-transparent dark:from-dark-primary dark:to-dark-secondary sm:text-xl">
                AyaUke
              </span>
            </Link>
          </div>

          {/* Center - Desktop Navigation */}
          <div className="hidden flex-1 items-center justify-center space-x-8 md:flex">
            {NAV_LINKS.map((link) => {
              const isActive = activePath === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative whitespace-nowrap px-2 py-1 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 ${
                    isActive
                      ? 'text-light-accent-deep dark:text-dark-primary'
                      : 'text-gray-600 hover:text-light-accent dark:text-gray-300 dark:hover:text-dark-primary'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-underline"
                      className="absolute -bottom-1 left-2 right-2 h-0.5 rounded-full bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary"
                      transition={{ type: 'spring', stiffness: 380, damping: 30, duration: reduce ? 0 : undefined }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side - Controls */}
          <div className="flex flex-1 items-center justify-end space-x-1 sm:space-x-2">
            {/* Desktop Auth Controls */}
            <div className="hidden md:block">
              <AuthControls session={session} status={status} />
            </div>

            {/* Mobile menu button */}
            <button
              ref={mobileMenuButtonRef}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-light-primary/20 p-1.5 transition-all duration-300 hover:bg-light-primary/30 dark:bg-dark-primary/20 dark:hover:bg-dark-primary/30 md:hidden sm:p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? '모바일 메뉴 닫기' : '모바일 메뉴 열기'}
              aria-controls="mobile-navigation-menu"
              aria-expanded={isMobileMenuOpen}
            >
              <svg className="h-5 w-5 text-gray-600 dark:text-gray-300 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {/* Theme toggle - Desktop only (a11y: 키보드 포커스 가능한 button) */}
            <button
              type="button"
              data-theme-toggle
              aria-label="테마 전환"
              className="group relative hidden rounded-full bg-light-primary/20 p-2 transition-all duration-300 hover:bg-light-primary/30 dark:bg-dark-primary/20 dark:hover:bg-dark-primary/30 md:block"
            >
              <span className="block text-light-purple dark:text-dark-text">
                <ThemeIcons sizeClass="h-6 w-6" />
              </span>
              <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-light-accent/0 to-light-accent/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-dark-accent/0 dark:to-dark-accent/20" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              id="mobile-navigation-menu"
              key="mobile-menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: reduce ? 0 : 0.22, ease: 'easeOut' }}
              className="overflow-hidden border-t border-light-primary/20 bg-white/95 backdrop-blur-md dark:border-dark-primary/20 dark:bg-gray-900/95 md:hidden"
            >
              <div className="space-y-1 px-3 py-2">
                {/* 1. 사용자 정보 */}
                <MobileUserProfile session={session} status={status} />

                {/* 2. 기본 내비 링크 */}
                {NAV_LINKS.map((link) => {
                  const isActive = activePath === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-light-primary/10 text-light-accent-deep dark:bg-dark-primary/10 dark:text-dark-primary'
                          : 'text-gray-600 hover:bg-light-primary/5 hover:text-light-accent dark:text-gray-300 dark:hover:bg-dark-primary/5 dark:hover:text-dark-primary'
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  );
                })}

                {/* 3. 권한별 추가 메뉴 */}
                <MobileAdminMenus session={session} onMenuClose={() => setIsMobileMenuOpen(false)} />

                {/* 4. 로그아웃 */}
                <MobileLogout session={session} onMenuClose={() => setIsMobileMenuOpen(false)} />

                {/* 5. 테마 토글 */}
                <div className="mt-1 border-t border-light-primary/10 pt-1 dark:border-dark-primary/10">
                  <button
                    type="button"
                    data-theme-toggle
                    aria-label="테마 전환"
                    className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-all duration-200 hover:bg-light-primary/5 hover:text-light-accent dark:text-gray-300 dark:hover:bg-dark-primary/5 dark:hover:text-dark-primary"
                  >
                    <span className="mr-3">
                      <ThemeIcons sizeClass="h-5 w-5" />
                    </span>
                    <span className="dark:hidden">다크 모드</span>
                    <span className="hidden dark:inline">라이트 모드</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}

function AuthControls({
  session,
  status,
}: {
  session: Session | null;
  status: 'authenticated' | 'loading' | 'unauthenticated';
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
        dropdownButtonRef.current?.focus();
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDropdownOpen]);

  // 채널 ID 줄임표 표시 함수
  const truncateChannelId = (channelId: string) => {
    if (!channelId || channelId.length <= 8) return channelId;
    return `${channelId.slice(0, 4)}...${channelId.slice(-4)}`;
  };

  // 에러 상태 처리
  if (status === 'unauthenticated' || status === 'loading') {
    return (
      <>
        {status === 'loading' ? (
          <div className="h-8 w-8 animate-pulse rounded-full bg-light-primary/20 dark:bg-dark-primary/20" />
        ) : (
          <Link
            href="/auth/signin"
            className="flex items-center space-x-1.5 rounded-lg bg-gradient-to-r from-light-cta-accent to-light-cta-purple px-3 py-1.5 text-sm font-medium text-white shadow-lg transition-all duration-300 hover:from-light-cta-purple hover:to-light-cta-accent hover:shadow-xl dark:from-dark-accent dark:to-dark-secondary dark:hover:from-dark-secondary dark:hover:to-dark-accent"
          >
            <UserIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">로그인</span>
          </Link>
        )}
      </>
    );
  }

  if (!session) {
    return null;
  }

  const adminItems = adminMenuItems(session);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={dropdownButtonRef}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}

        aria-expanded={isDropdownOpen}
        aria-controls="user-navigation-menu"
        className="flex items-center space-x-2 rounded-lg bg-light-primary/10 p-2 transition-all duration-300 hover:bg-light-primary/20 dark:bg-dark-primary/10 dark:hover:bg-dark-primary/20"
      >
        {session.user.image ? (
          <img src={session.user.image} alt={session.user.name || 'Profile'} className="h-8 w-8 rounded-full" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-light-accent to-light-secondary dark:from-dark-accent dark:to-dark-secondary">
            <UserIcon className="h-4 w-4 text-white" />
          </div>
        )}
        <div className="hidden text-left md:block">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {session.user.name || session.user.channelName}
          </div>
          {session.user.selectedTitle && (
            <div className={`rounded-full px-3 py-1 text-xs font-medium ${session.user.selectedTitle.colorClass}`}>
              {session.user.selectedTitle.name}
            </div>
          )}
        </div>
        <ChevronDownIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </button>

      {isDropdownOpen && (
        <div
          id="user-navigation-menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-light-primary/20 bg-white/95 py-1 shadow-lg backdrop-blur-md dark:border-dark-primary/20 dark:bg-gray-800/95"
        >
          <div className="border-b border-light-primary/10 px-4 py-2 dark:border-dark-primary/10">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {session.user.name || session.user.channelName}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              치지직 ID: {truncateChannelId(session.user.channelId || '미확인')}
            </div>
            {session.user.selectedTitle && (
              <div className={`mt-1 inline-block rounded-full px-2 py-1 text-xs font-medium ${session.user.selectedTitle.colorClass}`}>
                ✨ {session.user.selectedTitle.name}
              </div>
            )}
          </div>

          {adminItems.length > 0 && (
            <>
              {adminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-4 py-2 text-sm text-gray-700 transition-colors duration-200 hover:bg-light-primary/10 dark:text-gray-300 dark:hover:bg-dark-primary/10"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="my-1 border-t border-light-primary/10 dark:border-dark-primary/10" />
            </>
          )}

          <Link
            href="/profile"
            className="block px-4 py-2 text-sm text-gray-700 transition-colors duration-200 hover:bg-light-primary/10 dark:text-gray-300 dark:hover:bg-dark-primary/10"
            onClick={() => setIsDropdownOpen(false)}
          >
            내 프로필
          </Link>

          <button
            onClick={() => {
              setIsDropdownOpen(false);
              signOut();
            }}
            className="block w-full px-4 py-2 text-left text-sm text-red-600 transition-colors duration-200 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

// 1. 사용자 정보 (로그인/프로필)
function MobileUserProfile({
  session,
  status,
}: {
  session: Session | null;
  status: 'authenticated' | 'loading' | 'unauthenticated';
}) {
  if (status === 'loading') {
    return (
      <div className="mb-3 border-b border-light-primary/10 pb-3 dark:border-dark-primary/10">
        <div className="px-3 py-2">
          <div className="h-8 w-full animate-pulse rounded-lg bg-light-primary/20 dark:bg-dark-primary/20" />
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="mb-3 border-b border-light-primary/10 pb-3 dark:border-dark-primary/10">
        <Link
          href="/auth/signin"
          className="flex min-h-11 w-full items-center rounded-lg bg-gradient-to-r from-light-cta-accent to-light-cta-purple px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:from-light-cta-purple hover:to-light-cta-accent dark:from-dark-accent dark:to-dark-secondary dark:hover:from-dark-secondary dark:hover:to-dark-accent"
        >
          <UserIcon className="mr-3 h-5 w-5" />
          <span>로그인</span>
        </Link>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="mb-3 border-b border-light-primary/10 pb-3 dark:border-dark-primary/10">
      <div className="px-3 py-2">
        <div className="flex items-center space-x-3">
          {session.user.image ? (
            <img src={session.user.image} alt={session.user.name || 'Profile'} className="h-8 w-8 rounded-full" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-light-accent to-light-secondary dark:from-dark-accent dark:to-dark-secondary">
              <UserIcon className="h-4 w-4 text-white" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
              {session.user.name || session.user.channelName}
            </div>
            {session.user.selectedTitle && (
              <div className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${session.user.selectedTitle.colorClass}`}>
                ✨ {session.user.selectedTitle.name}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* 프로필 링크도 사용자 정보에 포함 */}
      <Link
        href="/profile"
        className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-all duration-200 hover:bg-light-primary/5 hover:text-light-accent dark:text-gray-300 dark:hover:bg-dark-primary/5 dark:hover:text-dark-primary"
      >
        내 프로필
      </Link>
    </div>
  );
}

// 3. 권한별 추가 메뉴
function MobileAdminMenus({
  session,
  onMenuClose,
}: {
  session: Session | null;
  onMenuClose: () => void;
}) {
  const items = adminMenuItems(session);
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 border-b border-light-primary/10 pb-3 dark:border-dark-primary/10">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-all duration-200 hover:bg-light-primary/5 hover:text-light-accent dark:text-gray-300 dark:hover:bg-dark-primary/5 dark:hover:text-dark-primary"
          onClick={onMenuClose}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

// 4. 로그아웃
function MobileLogout({
  session,
  onMenuClose,
}: {
  session: Session | null;
  onMenuClose: () => void;
}) {
  if (!session) {
    return null;
  }

  return (
    <div className="mb-3 border-b border-light-primary/10 pb-3 dark:border-dark-primary/10">
      <button
        onClick={() => {
          onMenuClose();
          signOut();
        }}
        className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition-all duration-200 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
      >
        로그아웃
      </button>
    </div>
  );
}
