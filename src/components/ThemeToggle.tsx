'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

export default function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-full bg-light-primary/20 dark:bg-dark-primary/20 animate-pulse" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="relative p-2 rounded-full bg-light-primary/20 dark:bg-dark-primary/20 
                 hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 
                 transition-all duration-300 group"
      aria-label="Toggle theme"
    >
      <div className="relative w-6 h-6">
        <SunIcon 
          className={`absolute inset-0 w-6 h-6 text-light-purple dark:text-dark-text
                     transition-all duration-300 transform
                     ${theme === 'dark' ? 'opacity-0 rotate-90 scale-75' : 'opacity-100 rotate-0 scale-100'}`}
        />
        <MoonIcon 
          className={`absolute inset-0 w-6 h-6 text-light-purple dark:text-dark-text
                     transition-all duration-300 transform
                     ${theme === 'light' ? 'opacity-0 -rotate-90 scale-75' : 'opacity-100 rotate-0 scale-100'}`}
        />
      </div>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-light-accent/0 to-light-accent/20 
                      dark:from-dark-accent/0 dark:to-dark-accent/20 opacity-0 group-hover:opacity-100 
                      transition-opacity duration-300"></div>
    </button>
  );
}