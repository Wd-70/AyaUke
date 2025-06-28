'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Song } from '@/types';
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SongSearchProps {
  songs: Song[];
  onFilteredSongs: (songs: Song[]) => void;
}

// Debounce hook for performance
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function SongSearch({ songs, onFilteredSongs }: SongSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Debounce search term to reduce filtering frequency
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const languages = useMemo(() => 
    Array.from(new Set(songs.map(song => song.language))).filter(Boolean),
    [songs]
  );

  // Memoized filter function for performance
  const filteredSongs = useMemo(() => {
    let filtered = songs;

    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(song =>
        song.title.toLowerCase().includes(searchLower) ||
        song.artist.toLowerCase().includes(searchLower) ||
        song.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    if (selectedLanguage) {
      filtered = filtered.filter(song => song.language === selectedLanguage);
    }

    return filtered;
  }, [songs, debouncedSearchTerm, selectedLanguage]);

  // Update filtered songs when filteredSongs changes
  React.useEffect(() => {
    onFilteredSongs(filteredSongs);
  }, [filteredSongs, onFilteredSongs]);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedLanguage('');
  }, []);

  const hasActiveFilters = searchTerm || selectedLanguage;

  return (
    <div className="mb-8">
      {/* Search bar */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-light-text/40 dark:text-dark-text/40" />
        </div>
        <input
          type="text"
          placeholder="노래 제목, 아티스트, 태그로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-12 py-3 border border-light-primary/20 dark:border-dark-primary/20 
                     rounded-xl bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm
                     text-light-text dark:text-dark-text placeholder-light-text/50 dark:placeholder-dark-text/50
                     focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                     focus:border-transparent transition-all duration-200"
        />
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
        >
          <FunnelIcon 
            className={`h-5 w-5 transition-colors duration-200 
                       ${hasActiveFilters 
                         ? 'text-light-accent dark:text-dark-accent' 
                         : 'text-light-text/40 dark:text-dark-text/40 hover:text-light-accent dark:hover:text-dark-accent'}`}
          />
        </button>
      </div>

      {/* Filter panel */}
      <motion.div
        initial={false}
        animate={{ 
          height: isFilterOpen ? 'auto' : 0,
          opacity: isFilterOpen ? 1 : 0 
        }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="p-4 bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl 
                        border border-light-primary/20 dark:border-dark-primary/20 mb-4">
          <div className="grid grid-cols-1 gap-4 mb-4">
            {/* Language filter */}
            <div>
              <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                언어
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-light-primary/20 dark:border-dark-primary/20 
                         rounded-lg bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm
                         text-light-text dark:text-dark-text
                         focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                         focus:border-transparent transition-all duration-200"
              >
                <option value="">모든 언어</option>
                {languages.map(language => (
                  <option key={language} value={language}>{language}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={clearFilters}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm 
                       bg-light-primary/20 dark:bg-dark-primary/20 
                       hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 
                       text-light-text dark:text-dark-text rounded-lg transition-colors duration-200"
            >
              <XMarkIcon className="w-4 h-4" />
              필터 초기화
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-2 mb-4"
        >
          {searchTerm && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-light-accent/20 dark:bg-dark-accent/20 
                           text-light-text dark:text-dark-text rounded-full text-sm">
              검색: {searchTerm}
              <button onClick={() => setSearchTerm('')}>
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedLanguage && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 
                           text-light-text dark:text-dark-text rounded-full text-sm">
              언어: {selectedLanguage}
              <button onClick={() => setSelectedLanguage('')}>
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          )}
        </motion.div>
      )}
    </div>
  );
}