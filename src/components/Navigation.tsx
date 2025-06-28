'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import ThemeToggle from './ThemeToggle';
import NotificationSettings from './NotificationSettings';

export default function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { name: '홈', href: '/', current: true },
    { name: '노래책', href: '/songbook' },
    { name: '스케줄', href: '/schedule' },
    { name: '다시보기', href: '/archives' },
    { name: '게임', href: '/games' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-light-primary/20 dark:border-dark-primary/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex items-center space-x-2"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-light-accent to-light-purple 
                            dark:from-dark-accent dark:to-dark-purple rounded-lg 
                            flex items-center justify-center text-white font-bold">
              A
            </div>
            <span className="text-xl font-bold gradient-text">AyaUke</span>
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <motion.div key={item.name} whileHover={{ y: -2 }}>
                <Link
                  href={item.href}
                  className={`px-3 py-2 text-sm font-medium transition-colors duration-200 
                             ${item.current 
                               ? 'text-light-accent dark:text-dark-accent' 
                               : 'text-light-text/70 dark:text-dark-text/70 hover:text-light-accent dark:hover:text-dark-accent'}`}
                >
                  {item.name}
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Desktop Controls */}
          <div className="hidden md:flex items-center space-x-4">
            <NotificationSettings />
            <ThemeToggle />
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-2">
            <NotificationSettings />
            <ThemeToggle />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-md text-light-text dark:text-dark-text 
                         hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                         transition-colors duration-200"
            >
              {isMenuOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-light-primary/20 dark:border-dark-primary/20"
          >
            <div className="px-4 py-2 space-y-1 bg-white/80 dark:bg-black/80 backdrop-blur-md">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`block px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 
                             ${item.current 
                               ? 'text-light-accent dark:text-dark-accent bg-light-primary/10 dark:bg-dark-primary/10' 
                               : 'text-light-text/70 dark:text-dark-text/70 hover:text-light-accent dark:hover:text-dark-accent hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'}`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}