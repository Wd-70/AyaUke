'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Song } from '@/types';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  XMarkIcon,
  HeartIcon,
  ListBulletIcon,
  CursorArrowRaysIcon,
  Square3Stack3DIcon,
  PlusCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { isTextMatch } from '@/lib/searchUtils';
import { useGlobalPlaylists } from '@/hooks/useGlobalPlaylists';
import { useLikes } from '@/hooks/useLikes';

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

type FilterMode = 'individual' | 'intersection' | 'union';

export default function SongSearch({ songs, onFilteredSongs }: SongSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(true); // 기본으로 열려있게 변경
  
  // 새로운 필터 상태
  const [filterMode, setFilterMode] = useState<FilterMode>('individual');
  const [activeLanguages, setActiveLanguages] = useState<Set<string>>(new Set());
  const [showLikedOnly, setShowLikedOnly] = useState(false);
  const [activePlaylists, setActivePlaylists] = useState<Set<string>>(new Set());
  const [selectedSingleFilter, setSelectedSingleFilter] = useState<string | null>(null); // 개별 모드용
  
  // 훅 사용
  const { playlists } = useGlobalPlaylists();
  const { getLikedSongIds } = useLikes();

  // Debounce search term to reduce filtering frequency
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const languages = useMemo(() => 
    Array.from(new Set(songs.map(song => song.language))).filter(Boolean),
    [songs]
  );

  // 좋아요한 곡 ID들 가져오기
  const likedSongIds = useMemo(() => getLikedSongIds(), [getLikedSongIds]);

  // 플레이리스트별 곡 ID 매핑
  const playlistSongIds = useMemo(() => {
    const mapping: Record<string, Set<string>> = {};
    playlists.forEach(playlist => {
      mapping[playlist._id] = new Set(
        playlist.songs?.map(songItem => songItem.songId?.id || songItem.songId).filter(Boolean) || []
      );
    });
    return mapping;
  }, [playlists]);

  // 새로운 필터링 로직 - 언어는 항상 OR, 전체는 AND
  const filteredSongs = useMemo(() => {
    let filtered = songs;

    // 텍스트 검색 필터
    if (debouncedSearchTerm) {
      filtered = filtered.filter(song => {
        return isTextMatch(debouncedSearchTerm, song.title) ||
               isTextMatch(debouncedSearchTerm, song.artist) ||
               song.tags?.some((tag: string) => isTextMatch(debouncedSearchTerm, tag)) ||
               song.searchTags?.some((tag: string) => isTextMatch(debouncedSearchTerm, tag));
      });
    }

    // 필터가 활성화된 경우에만 적용
    const hasLanguageFilter = activeLanguages.size > 0;
    const hasOtherFilters = (filterMode === 'individual' && selectedSingleFilter) || 
                           (filterMode !== 'individual' && (showLikedOnly || activePlaylists.size > 0));
    
    if (!hasLanguageFilter && !hasOtherFilters) {
      return filtered;
    }

    return filtered.filter(song => {
      // 1. 언어 필터 (항상 OR 조건)
      const languagePass = activeLanguages.size === 0 || activeLanguages.has(song.language);
      
      // 2. 다른 필터들 처리
      let otherFiltersPass = true;
      
      if (filterMode === 'individual') {
        // 개별 모드: 라디오버튼처럼 하나만 선택
        if (selectedSingleFilter === 'liked') {
          otherFiltersPass = likedSongIds.includes(song.id);
        } else if (selectedSingleFilter && selectedSingleFilter.startsWith('playlist-')) {
          const playlistId = selectedSingleFilter.replace('playlist-', '');
          otherFiltersPass = playlistSongIds[playlistId]?.has(song.id) || false;
        }
        // selectedSingleFilter가 null이면 다른 필터 없음
      } else {
        // 교집합/합집합 모드
        const otherActiveFilters = [];
        
        if (showLikedOnly) {
          otherActiveFilters.push(likedSongIds.includes(song.id));
        }
        
        if (activePlaylists.size > 0) {
          const playlistMatches = Array.from(activePlaylists).map(playlistId => 
            playlistSongIds[playlistId]?.has(song.id) || false
          );
          otherActiveFilters.push(...playlistMatches);
        }
        
        if (otherActiveFilters.length > 0) {
          if (filterMode === 'intersection') {
            otherFiltersPass = otherActiveFilters.every(Boolean);
          } else { // union
            otherFiltersPass = otherActiveFilters.some(Boolean);
          }
        }
      }
      
      // 최종: 언어 AND 다른필터들
      return languagePass && otherFiltersPass;
    });
  }, [songs, debouncedSearchTerm, activeLanguages, showLikedOnly, activePlaylists, selectedSingleFilter, filterMode, likedSongIds, playlistSongIds]);

  // Update filtered songs when filteredSongs changes
  React.useEffect(() => {
    onFilteredSongs(filteredSongs);
  }, [filteredSongs, onFilteredSongs]);

  // Helper 함수들
  const toggleLanguage = useCallback((language: string) => {
    setActiveLanguages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(language)) {
        newSet.delete(language);
      } else {
        newSet.add(language);
      }
      return newSet;
    });
  }, []);

  const togglePlaylist = useCallback((playlistId: string) => {
    if (filterMode === 'individual') {
      // 개별 모드: 라디오버튼처럼 동작
      const filterKey = `playlist-${playlistId}`;
      setSelectedSingleFilter(prev => prev === filterKey ? null : filterKey);
    } else {
      // 교집합/합집합 모드: 체크박스처럼 동작
      setActivePlaylists(prev => {
        const newSet = new Set(prev);
        if (newSet.has(playlistId)) {
          newSet.delete(playlistId);
        } else {
          newSet.add(playlistId);
        }
        return newSet;
      });
    }
  }, [filterMode]);

  const toggleLiked = useCallback(() => {
    if (filterMode === 'individual') {
      // 개별 모드: 라디오버튼처럼 동작
      setSelectedSingleFilter(prev => prev === 'liked' ? null : 'liked');
    } else {
      // 교집합/합집합 모드: 체크박스처럼 동작
      setShowLikedOnly(prev => !prev);
    }
  }, [filterMode]);

  const toggleFilterMode = useCallback(() => {
    setFilterMode(prev => {
      const nextMode = prev === 'individual' ? 'intersection' : prev === 'intersection' ? 'union' : 'individual';
      
      // 모드 변경 시 상태 정리
      if (nextMode === 'individual') {
        // 개별 모드로 변경: 다중 선택 상태를 단일 선택으로 변환
        if (showLikedOnly) {
          setSelectedSingleFilter('liked');
          setShowLikedOnly(false);
        } else if (activePlaylists.size > 0) {
          const firstPlaylist = Array.from(activePlaylists)[0];
          setSelectedSingleFilter(`playlist-${firstPlaylist}`);
          setActivePlaylists(new Set());
        } else {
          setSelectedSingleFilter(null);
        }
      } else {
        // 교집합/합집합 모드로 변경: 단일 선택을 다중 선택으로 변환
        if (selectedSingleFilter === 'liked') {
          setShowLikedOnly(true);
        } else if (selectedSingleFilter?.startsWith('playlist-')) {
          const playlistId = selectedSingleFilter.replace('playlist-', '');
          setActivePlaylists(new Set([playlistId]));
        }
        setSelectedSingleFilter(null);
      }
      
      return nextMode;
    });
  }, [showLikedOnly, activePlaylists, selectedSingleFilter]);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setActiveLanguages(new Set());
    setShowLikedOnly(false);
    setActivePlaylists(new Set());
    setSelectedSingleFilter(null);
  }, []);

  const hasActiveFilters = searchTerm || activeLanguages.size > 0 || 
                        (filterMode === 'individual' ? selectedSingleFilter !== null : (showLikedOnly || activePlaylists.size > 0));

  // 필터 모드 정보
  const filterModeInfo = useMemo(() => {
    switch (filterMode) {
      case 'individual':
        return { icon: CursorArrowRaysIcon, label: '하나씩', description: '한 번에 하나의 필터만 선택' };
      case 'intersection':
        return { icon: Square3Stack3DIcon, label: '모두 만족', description: '모든 조건을 만족하는 곡만' };
      case 'union':
        return { icon: PlusCircleIcon, label: '하나라도', description: '조건 중 하나라도 만족하는 곡' };
      default:
        return { icon: CursorArrowRaysIcon, label: '하나씩', description: '한 번에 하나의 필터만 선택' };
    }
  }, [filterMode]);

  // 뱃지 컴포넌트
  const FilterBadge = ({ 
    active, 
    onClick, 
    icon: Icon, 
    label, 
    count 
  }: {
    active: boolean;
    onClick: () => void;
    icon?: React.ComponentType<{ className?: string }>;
    label: string;
    count?: number;
  }) => (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
        transition-all duration-200 hover:scale-105 border
        ${active 
          ? 'bg-light-accent dark:bg-dark-accent text-white border-light-accent dark:border-dark-accent shadow-lg' 
          : 'bg-white/50 dark:bg-gray-800/50 text-light-text dark:text-dark-text border-light-primary/20 dark:border-dark-primary/20 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
        }
      `}
    >
      {Icon && <Icon className="w-4 h-4" />}
      <span>{label}</span>
      {count !== undefined && <span className="text-xs opacity-75">({count})</span>}
    </button>
  );

  return (
    <div className="sticky top-16 z-20 mb-8 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md 
                    border-b border-light-primary/20 dark:border-dark-primary/20 
                    py-4 shadow-sm -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
      {/* Search bar */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-light-text/40 dark:text-dark-text/40" />
        </div>
        <input
          type="text"
          placeholder="노래 제목, 아티스트, 검색태그로 검색... (띄어쓰기 무관, 초성검색, 한/영 오타 허용)"
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
          title={isFilterOpen ? "필터 숨기기" : "필터 보기"}
        >
          {isFilterOpen ? (
            <ChevronUpIcon className="h-5 w-5 text-light-text/60 dark:text-dark-text/60 hover:text-light-accent dark:hover:text-dark-accent transition-colors duration-200" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-light-text/60 dark:text-dark-text/60 hover:text-light-accent dark:hover:text-dark-accent transition-colors duration-200" />
          )}
        </button>
      </div>

      {/* Badge-style filters */}
      <motion.div
        initial={false}
        animate={{ 
          height: isFilterOpen ? 'auto' : 0,
          opacity: isFilterOpen ? 1 : 0 
        }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="space-y-3">
          {/* 첫 번째 줄: 언어 필터들 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-light-text/60 dark:text-dark-text/60 mr-2">언어:</span>
            {languages.map(language => (
              <button
                key={language}
                onClick={() => toggleLanguage(language)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
                  transition-all duration-200 hover:scale-105 border-2
                  ${activeLanguages.has(language)
                    ? 'bg-blue-500 text-white border-blue-500 shadow-lg' 
                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                  }
                `}
              >
                <span>{language}</span>
                <span className="text-xs opacity-75">({songs.filter(song => song.language === language).length})</span>
              </button>
            ))}
          </div>

          {/* 두 번째 줄: 모드 선택 + 기타 필터들 */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter mode toggle */}
            <button
              onClick={toggleFilterMode}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
                       bg-light-primary/20 dark:bg-dark-primary/20 
                       hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 
                       text-light-text dark:text-dark-text transition-colors duration-200
                       border border-light-primary/30 dark:border-dark-primary/30"
              title={filterModeInfo.description}
            >
              <filterModeInfo.icon className="w-4 h-4" />
              <span>{filterModeInfo.label}</span>
            </button>
            
            <div className="w-px h-6 bg-light-primary/20 dark:bg-dark-primary/20" />
            
            {/* Liked filter */}
            <FilterBadge
              active={filterMode === 'individual' ? selectedSingleFilter === 'liked' : showLikedOnly}
              onClick={toggleLiked}
              icon={(filterMode === 'individual' ? selectedSingleFilter === 'liked' : showLikedOnly) ? HeartSolidIcon : HeartIcon}
              label="좋아요"
              count={likedSongIds.length}
            />
            
            {/* Playlist filters */}
            {playlists.map(playlist => (
              <FilterBadge
                key={playlist._id}
                active={filterMode === 'individual' 
                  ? selectedSingleFilter === `playlist-${playlist._id}`
                  : activePlaylists.has(playlist._id)
                }
                onClick={() => togglePlaylist(playlist._id)}
                icon={ListBulletIcon}
                label={playlist.name}
                count={playlist.songCount}
              />
            ))}
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-end"
            >
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm 
                         bg-red-100 dark:bg-red-900/20 
                         hover:bg-red-200 dark:hover:bg-red-900/30 
                         text-red-800 dark:text-red-300 rounded-lg transition-colors duration-200
                         border border-red-200 dark:border-red-800"
              >
                <XMarkIcon className="w-4 h-4" />
                모든 필터 초기화
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Results count */}
      <div className="mt-3 text-sm text-light-text/60 dark:text-dark-text/60">
        {filteredSongs.length}곡 표시 중
        {hasActiveFilters && ` (전체 ${songs.length}곡 중)`}
      </div>
    </div>
  );
}