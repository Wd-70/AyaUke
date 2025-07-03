'use client';

import Link from 'next/link';
import { useState } from 'react';

interface NavigationProps {
  currentPath?: string;
}

export default function Navigation({ currentPath = '/' }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-light-primary/20 dark:border-dark-primary/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">
          {/* Left side - Logo */}
          <div className="flex-1">
            <Link href="/" className="inline-flex items-center space-x-2 group cursor-pointer">
              <div className="w-10 h-10 bg-gradient-to-br from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary rounded-lg flex items-center justify-center p-1 group-hover:scale-105 transition-transform duration-200">
                <img 
                  src="/honeyz.png" 
                  alt="HONEYZ Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary bg-clip-text text-transparent">AyaUke</span>
            </Link>
          </div>
          
          {/* Center - Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8 flex-1 justify-center flex-row">
            <Link 
              href="/" 
              className={`px-3 py-2 text-sm font-medium hover:-translate-y-0.5 transition-all duration-200 whitespace-nowrap ${
                currentPath === '/' 
                  ? 'text-light-accent dark:text-dark-primary' 
                  : 'text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary'
              }`}
            >
              홈
            </Link>
            <Link 
              href="/songbook" 
              className={`px-3 py-2 text-sm font-medium hover:-translate-y-0.5 transition-all duration-200 whitespace-nowrap ${
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
          <div className="flex items-center justify-end flex-1 space-x-2">
            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2 rounded-full bg-light-primary/20 dark:bg-dark-primary/20 hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 transition-all duration-300"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <div className="px-4 py-2 space-y-1">
              <Link 
                href="/" 
                className={`block px-3 py-2 text-base font-medium rounded-lg transition-all duration-200 ${
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
                className={`block px-3 py-2 text-base font-medium rounded-lg transition-all duration-200 ${
                  currentPath === '/songbook' 
                    ? 'text-light-accent dark:text-dark-primary bg-light-primary/10 dark:bg-dark-primary/10' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                노래책
              </Link>
              
              {/* Theme toggle for mobile */}
              <div className="border-t border-light-primary/10 dark:border-dark-primary/10 pt-1 mt-1">
                <button
                  className="flex items-center w-full px-3 py-2 text-base font-medium text-gray-600 dark:text-gray-300 hover:text-light-accent dark:hover:text-dark-primary hover:bg-light-primary/5 dark:hover:bg-dark-primary/5 rounded-lg transition-all duration-200"
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