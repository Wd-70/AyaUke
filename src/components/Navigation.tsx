'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { UserIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { isSuperAdmin, canManageSongs, UserRole } from '@/lib/permissions';
import { getSelectedTitleInfo } from '@/lib/titleSystem';

interface NavigationProps {
  currentPath?: string;
}

export default function Navigation({ currentPath = '/' }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: session, status, update } = useSession(); // 한 번만 호출
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-light-primary/20 dark:border-dark-primary/20">
      <div className="px-3 sm:px-6 lg:px-8">
        <div className="flex items-center h-12 sm:h-16">
          {/* Left side - Logo */}
          <div className="flex-1">
            <Link href="/" className="inline-flex items-center space-x-2 group cursor-pointer">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary rounded-lg flex items-center justify-center p-1 group-hover:scale-105 transition-transform duration-200">
                <img 
                  src="/honeyz.png" 
                  alt="HONEYZ Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary bg-clip-text text-transparent">AyaUke</span>
            </Link>
          </div>
          
          {/* Center - Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8 flex-1 justify-center flex-row">
            <Link 
              href="/" 
              className={`px-2 py-1 text-sm font-medium hover:-translate-y-0.5 transition-all duration-200 whitespace-nowrap ${
                currentPath === '/' 
                  ? 'text-light-accent dark:text-dark-primary' 
                  : 'text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary'
              }`}
            >
              홈
            </Link>
            <Link 
              href="/songbook" 
              className={`px-2 py-1 text-sm font-medium hover:-translate-y-0.5 transition-all duration-200 whitespace-nowrap ${
                currentPath === '/songbook' 
                  ? 'text-light-accent dark:text-dark-primary' 
                  : 'text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary'
              }`}
            >
              노래책
            </Link>
            {/* <Link 
              href="#" 
              className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary hover:-translate-y-0.5 transition-all duration-200 whitespace-nowrap"
            >
              스케줄
            </Link>
            <Link 
              href="#" 
              className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary hover:-translate-y-0.5 transition-all duration-200 whitespace-nowrap"
            >
              다시보기
            </Link>
            <Link 
              href="#" 
              className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary hover:-translate-y-0.5 transition-all duration-200 whitespace-nowrap"
            >
              게임
            </Link> */}
          </div>

          {/* Right side - Controls */}
          <div className="flex items-center justify-end flex-1 space-x-1 sm:space-x-2">
            {/* Desktop Auth Controls */}
            <div className="hidden md:block">
              <AuthControls session={session} status={status} update={update} />
            </div>
            
            {/* Mobile menu button */}
            <button 
              className="md:hidden p-1.5 sm:p-2 rounded-full bg-light-primary/20 dark:bg-dark-primary/20 hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 transition-all duration-300"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            
            {/* Theme toggle - Desktop only */}
            <div 
              className="hidden md:block relative p-2 rounded-full bg-light-primary/20 dark:bg-dark-primary/20 hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 transition-all duration-300 group cursor-pointer"
              data-theme-toggle
              aria-label="Toggle theme"
            >
              <div className="relative w-6 h-6">
                {/* Sun Icon */}
                <svg 
                  className="absolute inset-0 w-6 h-6 text-light-purple dark:text-dark-text transition-all duration-300 transform dark:opacity-0 dark:rotate-90 dark:scale-75 opacity-100 rotate-0 scale-100"
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor" 
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                
                {/* Moon Icon */}
                <svg 
                  className="absolute inset-0 w-6 h-6 text-light-purple dark:text-dark-text transition-all duration-300 transform opacity-0 -rotate-90 scale-75 dark:opacity-100 dark:rotate-0 dark:scale-100"
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor" 
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </div>
              
              {/* Hover gradient overlay */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-light-accent/0 to-light-accent/20 dark:from-dark-accent/0 dark:to-dark-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-light-primary/20 dark:border-dark-primary/20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md">
            <div className="px-3 py-2 space-y-1">
              {/* 1. 사용자 정보 */}
              <MobileUserProfile session={session} status={status} />
              
              {/* 2. 홈, 노래책 링크 */}
              <Link 
                href="/" 
                className={`block px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  currentPath === '/' 
                    ? 'text-light-accent dark:text-dark-primary bg-light-primary/10 dark:bg-dark-primary/10' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                홈
              </Link>
              <Link 
                href="/songbook" 
                className={`block px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  currentPath === '/songbook' 
                    ? 'text-light-accent dark:text-dark-primary bg-light-primary/10 dark:bg-dark-primary/10' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                노래책
              </Link>
              
              {/* 3. 권한별 추가 메뉴 */}
              <MobileAdminMenus session={session} onMenuClose={() => setIsMobileMenuOpen(false)} />
              
              {/* 4. 로그아웃 */}
              <MobileLogout session={session} onMenuClose={() => setIsMobileMenuOpen(false)} />
              
              {/* 5. 테마 토글 */}
              <div className="border-t border-light-primary/10 dark:border-dark-primary/10 pt-1 mt-1">
                <button
                  className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary hover:bg-light-primary/5 dark:hover:bg-dark-primary/5 rounded-lg transition-all duration-200"
                  data-theme-toggle
                  aria-label="Toggle theme"
                >
                  <div className="relative w-5 h-5 mr-3">
                    {/* Sun Icon */}
                    <svg 
                      className="absolute inset-0 w-5 h-5 transition-all duration-300 transform dark:opacity-0 dark:rotate-90 dark:scale-75 opacity-100 rotate-0 scale-100"
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    
                    {/* Moon Icon */}
                    <svg 
                      className="absolute inset-0 w-5 h-5 transition-all duration-300 transform opacity-0 -rotate-90 scale-75 dark:opacity-100 dark:rotate-0 dark:scale-100"
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  </div>
                  <span className="dark:hidden">다크 모드</span>
                  <span className="hidden dark:inline">라이트 모드</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function AuthControls({ session, status, update }: { session: any, status: string, update: any }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
          <div className="w-8 h-8 rounded-full bg-light-primary/20 dark:bg-dark-primary/20 animate-pulse" />
        ) : (
          <Link
            href="/auth/signin"
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-light-accent to-light-secondary hover:from-light-secondary hover:to-light-accent dark:from-dark-accent dark:to-dark-secondary dark:hover:from-dark-secondary dark:hover:to-dark-accent text-white text-sm font-medium rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">로그인</span>
          </Link>
        )}
      </>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-2 p-2 rounded-lg bg-light-primary/10 dark:bg-dark-primary/10 hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 transition-all duration-300"
      >
        {session.user.image ? (
          <img
            src={session.user.image}
            alt={session.user.name || 'Profile'}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-light-accent to-light-secondary dark:from-dark-accent dark:to-dark-secondary flex items-center justify-center">
            <UserIcon className="w-4 h-4 text-white" />
          </div>
        )}
        <div className="hidden md:block text-left">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {session.user.name || session.user.channelName}
          </div>
          {session.user.selectedTitle && (
            <div className={`text-xs font-medium px-3 py-1 rounded-full ${session.user.selectedTitle.colorClass}`}>
              {session.user.selectedTitle.name}
            </div>
          )}
        </div>
        <ChevronDownIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-lg shadow-lg border border-light-primary/20 dark:border-dark-primary/20 py-1 z-50">
          <div className="px-4 py-2 border-b border-light-primary/10 dark:border-dark-primary/10">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {session.user.name || session.user.channelName}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              치지직 ID: {truncateChannelId(session.user.channelId || '미확인')}
            </div>
            {session.user.selectedTitle && (
              <div className={`text-xs font-medium mt-1 px-2 py-1 rounded-full inline-block ${session.user.selectedTitle.colorClass}`}>
                ✨ {session.user.selectedTitle.name}
              </div>
            )}
          </div>
          
          {canManageSongs(session.user.role as UserRole) && (
            <>
              {isSuperAdmin(session.user.role as UserRole) && (
                <Link
                  href="/admin"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition-colors duration-200"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  관리자 대시보드
                </Link>
              )}
              <Link
                href="/admin/songs"
                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition-colors duration-200"
                onClick={() => setIsDropdownOpen(false)}
              >
                노래 관리
              </Link>
              <div className="border-t border-light-primary/10 dark:border-dark-primary/10 my-1" />
            </>
          )}
          
          <Link
            href="/profile"
            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition-colors duration-200"
            onClick={() => setIsDropdownOpen(false)}
          >
            내 프로필
          </Link>
          
          <button
            onClick={() => {
              setIsDropdownOpen(false);
              signOut();
            }}
            className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

// 1. 사용자 정보 (로그인/프로필)
function MobileUserProfile({ session, status }: { session: any, status: string }) {

  if (status === 'loading') {
    return (
      <div className="mb-3 pb-3 border-b border-light-primary/10 dark:border-dark-primary/10">
        <div className="px-3 py-2">
          <div className="w-full h-8 bg-light-primary/20 dark:bg-dark-primary/20 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="mb-3 pb-3 border-b border-light-primary/10 dark:border-dark-primary/10">
        <Link
          href="/auth/signin"
          className="flex items-center w-full px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-light-accent to-light-secondary hover:from-light-secondary hover:to-light-accent dark:from-dark-accent dark:to-dark-secondary dark:hover:from-dark-secondary dark:hover:to-dark-accent rounded-lg transition-all duration-200"
        >
          <UserIcon className="w-5 h-5 mr-3" />
          <span>로그인</span>
        </Link>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="mb-3 pb-3 border-b border-light-primary/10 dark:border-dark-primary/10">
      <div className="px-3 py-2">
        <div className="flex items-center space-x-3">
          {session.user.image ? (
            <img
              src={session.user.image}
              alt={session.user.name || 'Profile'}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-light-accent to-light-secondary dark:from-dark-accent dark:to-dark-secondary flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {session.user.name || session.user.channelName}
            </div>
            {session.user.selectedTitle && (
              <div className={`text-xs font-medium px-2 py-1 rounded-full inline-block ${session.user.selectedTitle.colorClass}`}>
                ✨ {session.user.selectedTitle.name}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* 프로필 링크도 사용자 정보에 포함 */}
      <Link
        href="/profile"
        className="block px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary hover:bg-light-primary/5 dark:hover:bg-dark-primary/5 rounded-lg transition-all duration-200"
      >
        내 프로필
      </Link>
    </div>
  );
}

// 3. 권한별 추가 메뉴
function MobileAdminMenus({ session, onMenuClose }: { session: any, onMenuClose: () => void }) {

  if (!session || !canManageSongs(session.user.role as UserRole)) {
    return null;
  }

  return (
    <div className="mb-3 pb-3 border-b border-light-primary/10 dark:border-dark-primary/10">
      {isSuperAdmin(session.user.role as UserRole) && (
        <Link
          href="/admin"
          className="block px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary hover:bg-light-primary/5 dark:hover:bg-dark-primary/5 rounded-lg transition-all duration-200"
          onClick={onMenuClose}
        >
          관리자 대시보드
        </Link>
      )}
      <Link
        href="/admin/songs"
        className="block px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary hover:bg-light-primary/5 dark:hover:bg-dark-primary/5 rounded-lg transition-all duration-200"
        onClick={onMenuClose}
      >
        노래 관리
      </Link>
    </div>
  );
}

// 4. 로그아웃
function MobileLogout({ session, onMenuClose }: { session: any, onMenuClose: () => void }) {

  if (!session) {
    return null;
  }

  return (
    <div className="mb-3 pb-3 border-b border-light-primary/10 dark:border-dark-primary/10">
      <button
        onClick={() => {
          onMenuClose();
          signOut();
        }}
        className="block w-full text-left px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
      >
        로그아웃
      </button>
    </div>
  );
}
