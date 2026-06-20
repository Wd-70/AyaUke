'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Song } from '@/types';
import { useGlobalPlaylists, songIdOf } from '@/hooks/useGlobalPlaylists';
import { useLikes } from '@/hooks/useLikes';
import {
  filterSongs,
  sortSongs,
  shuffle,
  type FilterMode,
  type SortBy,
  type SortOrder,
} from '@/domains/catalog/song-filter';

// 검색어 디바운스 (필터링 빈도 감소)
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

/**
 * 노래책 필터/정렬 상태와 파생 결과(filteredSongs)를 한 곳에서 소유하는 훅.
 *
 * 부모(SongbookClient)가 호출해 filteredSongs를 단일 진실원으로 갖고, SongSearch는
 * 이 훅이 돌려주는 상태/핸들러를 props로 받아 UI만 렌더한다. (이전에는 SongSearch가
 * 상태를 소유하고 useEffect로 부모 state를 갱신해 무한 렌더 루프의 무대가 되었다.)
 * 검색/필터/정렬 순수 로직은 domains/catalog/song-filter에 위임한다.
 */
export function useSongFilters(songs: Song[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(true); // 기본 열림
  const [includeLyrics, setIncludeLyrics] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('individual');
  const [activeLanguages, setActiveLanguages] = useState<Set<string>>(new Set());
  const [showLikedOnly, setShowLikedOnly] = useState(false);
  const [activePlaylists, setActivePlaylists] = useState<Set<string>>(new Set());
  const [selectedSingleFilter, setSelectedSingleFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('default');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [randomSeed, setRandomSeed] = useState(0); // 랜덤 재섞기 트리거

  const { playlists } = useGlobalPlaylists();
  const { getLikedSongIds } = useLikes();

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // 언어 목록을 곡 개수 많은 순으로
  const languages = useMemo(() => {
    const counts = songs.reduce((acc, song) => {
      if (song.language) acc[song.language] = (acc[song.language] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }, [songs]);

  // 좋아요한 곡 ID — TanStack Query 캐시에서 직접 파생 (getLikedSongIds는 likesMap이
  // 바뀔 때만 갱신되므로 캐시가 채워지면 자동 재계산)
  const likedSongIds = useMemo(() => getLikedSongIds(), [getLikedSongIds]);

  // 플레이리스트별 곡 ID 매핑
  const playlistSongIds = useMemo(() => {
    const mapping: Record<string, Set<string>> = {};
    playlists.forEach((playlist) => {
      mapping[playlist._id] = new Set(
        playlist.songs?.map((songItem) => songIdOf(songItem)).filter(Boolean) || []
      );
    });
    return mapping;
  }, [playlists]);

  // 검색 + 필터 (순수 모듈 위임)
  const filtered = useMemo(
    () =>
      filterSongs(songs, {
        searchTerm: debouncedSearchTerm,
        includeLyrics,
        activeLanguages,
        filterMode,
        selectedSingleFilter,
        showLikedOnly,
        activePlaylists,
        likedSongIds,
        playlistSongIds,
      }),
    [
      songs,
      debouncedSearchTerm,
      includeLyrics,
      activeLanguages,
      showLikedOnly,
      activePlaylists,
      selectedSingleFilter,
      filterMode,
      likedSongIds,
      playlistSongIds,
    ]
  );

  // 정렬 (random은 비결정적이라 호출부에서 shuffle)
  const filteredSongs = useMemo(() => {
    if (sortBy === 'random') return shuffle(filtered);
    return sortSongs(filtered, sortBy, sortOrder);
    // randomSeed: 랜덤 재섞기 트리거(같은 입력에도 새 셔플 결과를 만들기 위한 의존성)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortBy, sortOrder, randomSeed]);

  const toggleLanguage = useCallback((language: string) => {
    setActiveLanguages((prev) => {
      const next = new Set(prev);
      if (next.has(language)) next.delete(language);
      else next.add(language);
      return next;
    });
  }, []);

  const togglePlaylist = useCallback(
    (playlistId: string) => {
      if (filterMode === 'individual') {
        const filterKey = `playlist-${playlistId}`;
        setSelectedSingleFilter((prev) => (prev === filterKey ? null : filterKey));
      } else {
        setActivePlaylists((prev) => {
          const next = new Set(prev);
          if (next.has(playlistId)) next.delete(playlistId);
          else next.add(playlistId);
          return next;
        });
      }
    },
    [filterMode]
  );

  const toggleLiked = useCallback(() => {
    if (filterMode === 'individual') {
      setSelectedSingleFilter((prev) => (prev === 'liked' ? null : 'liked'));
    } else {
      setShowLikedOnly((prev) => !prev);
    }
  }, [filterMode]);

  const toggleFilterMode = useCallback(() => {
    setFilterMode((prev) => {
      const nextMode =
        prev === 'individual'
          ? 'intersection'
          : prev === 'intersection'
          ? 'union'
          : 'individual';

      // 모드 변경 시 상태 정리 (단일 ↔ 다중 선택 변환)
      if (nextMode === 'individual') {
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
    setSortBy('default');
    setSortOrder('desc');
  }, []);

  const hasActiveFilters =
    !!searchTerm ||
    activeLanguages.size > 0 ||
    (filterMode === 'individual'
      ? selectedSingleFilter !== null
      : showLikedOnly || activePlaylists.size > 0);

  return {
    songs,
    // 파생 결과 (단일 진실원)
    filteredSongs,
    languages,
    likedSongIds,
    playlists,
    hasActiveFilters,
    // 상태
    searchTerm,
    setSearchTerm,
    isFilterOpen,
    setIsFilterOpen,
    includeLyrics,
    setIncludeLyrics,
    filterMode,
    activeLanguages,
    showLikedOnly,
    activePlaylists,
    selectedSingleFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    setRandomSeed,
    // 핸들러
    toggleLanguage,
    togglePlaylist,
    toggleLiked,
    toggleFilterMode,
    clearFilters,
  };
}

export type SongFilters = ReturnType<typeof useSongFilters>;
