'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { SongRequestSortOption, SongRequestFilters } from '@/types';
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SuggestionsFiltersProps {
  sortOption: SongRequestSortOption;
  setSortOption: (option: SongRequestSortOption) => void;
  filters: SongRequestFilters;
  setFilters: (filters: SongRequestFilters) => void;
}

const sortOptions = [
  { value: 'latest', label: '최신순', icon: '🕐' },
  { value: 'recommended', label: '추천순', icon: '❤️' },
  { value: 'viewed', label: '조회순', icon: '👀' },
  { value: 'trending', label: '인기순', icon: '🔥' },
  { value: 'pending', label: '승격 대기', icon: '⏳' }
] as const;

const genreOptions = [
  'K-pop', 'J-pop', 'Pop', 'Rock', 'Ballad', 'R&B', 'Hip-hop', 
  'Folk', 'Indie', 'Electronic', 'Jazz', 'Classical', 'OST'
];

export default function SuggestionsFilters({ 
  sortOption, 
  setSortOption, 
  filters, 
  setFilters 
}: SuggestionsFiltersProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search || '');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ ...filters, search: searchInput.trim() || undefined });
  };

  const handleGenreChange = (genre: string) => {
    setFilters({ 
      ...filters, 
      genre: filters.genre === genre ? undefined : genre 
    });
  };

  const handleStatusChange = (status: string) => {
    setFilters({ 
      ...filters, 
      status: filters.status === status ? undefined : status as any
    });
  };

  const handlePromotedFilter = (promoted: boolean) => {
    setFilters({ 
      ...filters, 
      promotedToSongbook: filters.promotedToSongbook === promoted ? undefined : promoted
    });
  };

  const clearFilters = () => {
    setSearchInput('');
    setFilters({});
  };

  const hasActiveFilters = filters.search || filters.genre || filters.status || filters.promotedToSongbook !== undefined;

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        {/* 검색 */}
        <form onSubmit={handleSearchSubmit} className="flex-1">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-light-text/40 dark:text-dark-text/40" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="곡명, 아티스트, 태그로 검색..."
              className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm
                       border border-light-primary/20 dark:border-dark-primary/20 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50
                       text-light-text dark:text-dark-text placeholder-light-text/50 dark:placeholder-dark-text/50"
            />
          </div>
        </form>

        {/* 정렬 옵션 */}
        <div className="flex gap-2 overflow-x-auto">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSortOption(option.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all duration-200 ${
                sortOption === option.value
                  ? 'bg-light-accent dark:bg-dark-accent text-white shadow-lg'
                  : 'bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border border-light-primary/20 dark:border-dark-primary/20 text-light-text dark:text-dark-text hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
              }`}
            >
              <span>{option.icon}</span>
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>

        {/* 필터 토글 */}
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
            isFilterOpen || hasActiveFilters
              ? 'bg-light-secondary dark:bg-dark-secondary text-white'
              : 'bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border border-light-primary/20 dark:border-dark-primary/20 text-light-text dark:text-dark-text hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
          }`}
        >
          <FunnelIcon className="w-5 h-5" />
          <span className="text-sm font-medium">필터</span>
          {hasActiveFilters && (
            <div className="w-2 h-2 bg-white rounded-full" />
          )}
        </button>
      </div>

      {/* 필터 패널 */}
      {isFilterOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border border-light-primary/20 dark:border-dark-primary/20 rounded-lg p-4 mb-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">상세 필터</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 text-sm text-light-text/70 dark:text-dark-text/70 hover:text-light-accent dark:hover:text-dark-accent"
              >
                <XMarkIcon className="w-4 h-4" />
                초기화
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* 장르 필터 */}
            <div>
              <h4 className="text-sm font-medium text-light-text dark:text-dark-text mb-2">장르</h4>
              <div className="flex flex-wrap gap-2">
                {genreOptions.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => handleGenreChange(genre)}
                    className={`px-3 py-1 text-sm rounded-full transition-all duration-200 ${
                      filters.genre === genre
                        ? 'bg-light-accent dark:bg-dark-accent text-white'
                        : 'bg-light-primary/20 dark:bg-dark-primary/20 text-light-text dark:text-dark-text hover:bg-light-primary/30 dark:hover:bg-dark-primary/30'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            {/* 상태 필터 */}
            <div>
              <h4 className="text-sm font-medium text-light-text dark:text-dark-text mb-2">상태</h4>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'active', label: '활성' },
                  { value: 'pending_approval', label: '승격 대기' },
                  { value: 'approved', label: '승격 완료' }
                ].map((status) => (
                  <button
                    key={status.value}
                    onClick={() => handleStatusChange(status.value)}
                    className={`px-3 py-1 text-sm rounded-full transition-all duration-200 ${
                      filters.status === status.value
                        ? 'bg-light-secondary dark:bg-dark-secondary text-white'
                        : 'bg-light-primary/20 dark:bg-dark-primary/20 text-light-text dark:text-dark-text hover:bg-light-primary/30 dark:hover:bg-dark-primary/30'
                    }`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 편입 상태 필터 */}
            <div>
              <h4 className="text-sm font-medium text-light-text dark:text-dark-text mb-2">노래책 편입</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePromotedFilter(true)}
                  className={`px-3 py-1 text-sm rounded-full transition-all duration-200 ${
                    filters.promotedToSongbook === true
                      ? 'bg-green-500 text-white'
                      : 'bg-light-primary/20 dark:bg-dark-primary/20 text-light-text dark:text-dark-text hover:bg-light-primary/30 dark:hover:bg-dark-primary/30'
                  }`}
                >
                  편입됨
                </button>
                <button
                  onClick={() => handlePromotedFilter(false)}
                  className={`px-3 py-1 text-sm rounded-full transition-all duration-200 ${
                    filters.promotedToSongbook === false
                      ? 'bg-blue-500 text-white'
                      : 'bg-light-primary/20 dark:bg-dark-primary/20 text-light-text dark:text-dark-text hover:bg-light-primary/30 dark:hover:bg-dark-primary/30'
                  }`}
                >
                  미편입
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}