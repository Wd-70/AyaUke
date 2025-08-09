"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Song } from "@/types";
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
  ChevronUpIcon,
  ArrowsUpDownIcon,
  HashtagIcon,
  MusicalNoteIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import { isTextMatch } from "@/lib/searchUtils";
import { useGlobalPlaylists } from "@/hooks/useGlobalPlaylists";
import { useLikes } from "@/hooks/useLikes";

interface SongSearchProps {
  songs: Song[];
  onFilteredSongs: (songs: Song[]) => void;
  showNumbers?: boolean;
  onToggleNumbers?: (show: boolean) => void;
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

type FilterMode = "individual" | "intersection" | "union";

export default function SongSearch({
  songs,
  onFilteredSongs,
  showNumbers = false,
  onToggleNumbers,
}: SongSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(true); // 기본으로 열려있게 변경
  const [includeLyrics, setIncludeLyrics] = useState(false); // 가사 검색 포함 여부

  // 새로운 필터 상태
  const [filterMode, setFilterMode] = useState<FilterMode>("individual");
  const [activeLanguages, setActiveLanguages] = useState<Set<string>>(
    new Set()
  );
  const [showLikedOnly, setShowLikedOnly] = useState(false);
  const [activePlaylists, setActivePlaylists] = useState<Set<string>>(
    new Set()
  );
  const [selectedSingleFilter, setSelectedSingleFilter] = useState<
    string | null
  >(null); // 개별 모드용

  // 정렬 옵션
  const [sortBy, setSortBy] = useState<"default" | "random" | "likes" | "sungCount" | "title">("default");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 훅 사용
  const { playlists } = useGlobalPlaylists();
  const { getLikedSongIds } = useLikes();

  // Debounce search term to reduce filtering frequency
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // 언어 목록을 곡 개수가 많은 순서대로 정렬
  const languages = useMemo(() => {
    const languageCounts = songs.reduce((acc, song) => {
      if (song.language) {
        acc[song.language] = (acc[song.language] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.keys(languageCounts).sort(
      (a, b) => languageCounts[b] - languageCounts[a]
    ); // 개수 많은 순서대로
  }, [songs]);

  // 좋아요한 곡 ID들 가져오기 (실시간 업데이트)
  const [likedSongIds, setLikedSongIds] = useState<string[]>([]);

  // 좋아요 데이터 실시간 업데이트
  useEffect(() => {
    // 초기 로드
    setLikedSongIds(getLikedSongIds());

    // 좋아요 상태 변경 이벤트 리스너
    const handleLikesChange = () => {
      setLikedSongIds(getLikedSongIds());
    };

    // 이벤트 리스너 등록 (likesStore에서 발생시키는 커스텀 이벤트)
    window.addEventListener('likesUpdated', handleLikesChange);

    return () => {
      window.removeEventListener('likesUpdated', handleLikesChange);
    };
  }, []);

  // 플레이리스트별 곡 ID 매핑
  const playlistSongIds = useMemo(() => {
    const mapping: Record<string, Set<string>> = {};
    playlists.forEach((playlist) => {
      mapping[playlist._id] = new Set(
        playlist.songs
          ?.map((songItem) => songItem.songId?.id || songItem.songId)
          .filter(Boolean) || []
      );
    });
    return mapping;
  }, [playlists]);

  // 새로운 필터링 로직 - 언어는 항상 OR, 전체는 AND
  const filteredSongs = useMemo(() => {
    let filtered = songs;

    // 텍스트 검색 필터
    if (debouncedSearchTerm) {
      filtered = filtered.filter((song) => {
        const basicMatch = (
          isTextMatch(debouncedSearchTerm, song.title) ||
          isTextMatch(debouncedSearchTerm, song.artist) ||
          // alias 필드도 검색 대상에 포함
          (song.titleAlias && isTextMatch(debouncedSearchTerm, song.titleAlias)) ||
          (song.artistAlias && isTextMatch(debouncedSearchTerm, song.artistAlias)) ||
          song.tags?.some((tag: string) =>
            isTextMatch(debouncedSearchTerm, tag)
          ) ||
          song.searchTags?.some((tag: string) =>
            isTextMatch(debouncedSearchTerm, tag)
          )
        );

        // 가사 검색이 활성화된 경우 가사도 검색 대상에 포함
        const lyricsMatch = includeLyrics && song.lyrics && 
          isTextMatch(debouncedSearchTerm, song.lyrics);

        return basicMatch || lyricsMatch;
      });
    }

    // 필터가 활성화된 경우에만 적용
    const hasLanguageFilter = activeLanguages.size > 0;
    const hasOtherFilters =
      (filterMode === "individual" && selectedSingleFilter) ||
      (filterMode !== "individual" &&
        (showLikedOnly || activePlaylists.size > 0));

    if (!hasLanguageFilter && !hasOtherFilters) {
      return filtered;
    }

    return filtered.filter((song) => {
      // 1. 언어 필터 (항상 OR 조건)
      const languagePass =
        activeLanguages.size === 0 || activeLanguages.has(song.language);

      // 2. 다른 필터들 처리
      let otherFiltersPass = true;

      if (filterMode === "individual") {
        // 개별 모드: 라디오버튼처럼 하나만 선택
        if (selectedSingleFilter === "liked") {
          otherFiltersPass = likedSongIds.includes(song.id);
        } else if (
          selectedSingleFilter &&
          selectedSingleFilter.startsWith("playlist-")
        ) {
          const playlistId = selectedSingleFilter.replace("playlist-", "");
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
          const playlistMatches = Array.from(activePlaylists).map(
            (playlistId) => playlistSongIds[playlistId]?.has(song.id) || false
          );
          otherActiveFilters.push(...playlistMatches);
        }

        if (otherActiveFilters.length > 0) {
          if (filterMode === "intersection") {
            otherFiltersPass = otherActiveFilters.every(Boolean);
          } else {
            // union
            otherFiltersPass = otherActiveFilters.some(Boolean);
          }
        }
      }

      // 최종: 언어 AND 다른필터들
      return languagePass && otherFiltersPass;
    });
  }, [
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
  ]);

  // 랜덤 시드를 위한 상태 (재섞기 트리거)
  const [randomSeed, setRandomSeed] = useState(0);

  // 정렬된 곡들
  const sortedSongs = useMemo(() => {
    if (sortBy === "default") {
      return filteredSongs;
    }

    if (sortBy === "random") {
      // 랜덤 정렬을 위해 Fisher-Yates 셔플 알고리즘 사용
      // randomSeed가 변경될 때마다 재실행됨
      const shuffled = [...filteredSongs];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    const sorted = [...filteredSongs].sort((a, b) => {
      if (sortBy === "likes") {
        const aLikes = a.likeCount || 0;
        const bLikes = b.likeCount || 0;
        return sortOrder === "desc" ? bLikes - aLikes : aLikes - bLikes;
      } else if (sortBy === "sungCount") {
        const aSungCount = a.sungCount || 0;
        const bSungCount = b.sungCount || 0;
        return sortOrder === "desc" ? bSungCount - aSungCount : aSungCount - bSungCount;
      } else if (sortBy === "title") {
        const aTitle = a.titleAlias || a.title;
        const bTitle = b.titleAlias || b.title;
        const result = aTitle.localeCompare(bTitle, 'ko', { numeric: true });
        return sortOrder === "desc" ? -result : result;
      }
      return 0;
    });

    return sorted;
  }, [filteredSongs, sortBy, sortOrder, randomSeed]);

  // Update filtered songs when sortedSongs changes
  React.useEffect(() => {
    onFilteredSongs(sortedSongs);
  }, [sortedSongs, onFilteredSongs]);

  // Helper 함수들
  const toggleLanguage = useCallback((language: string) => {
    setActiveLanguages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(language)) {
        newSet.delete(language);
      } else {
        newSet.add(language);
      }
      return newSet;
    });
  }, []);

  const togglePlaylist = useCallback(
    (playlistId: string) => {
      if (filterMode === "individual") {
        // 개별 모드: 라디오버튼처럼 동작
        const filterKey = `playlist-${playlistId}`;
        setSelectedSingleFilter((prev) =>
          prev === filterKey ? null : filterKey
        );
      } else {
        // 교집합/합집합 모드: 체크박스처럼 동작
        setActivePlaylists((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(playlistId)) {
            newSet.delete(playlistId);
          } else {
            newSet.add(playlistId);
          }
          return newSet;
        });
      }
    },
    [filterMode]
  );

  const toggleLiked = useCallback(() => {
    if (filterMode === "individual") {
      // 개별 모드: 라디오버튼처럼 동작
      setSelectedSingleFilter((prev) => (prev === "liked" ? null : "liked"));
    } else {
      // 교집합/합집합 모드: 체크박스처럼 동작
      setShowLikedOnly((prev) => !prev);
    }
  }, [filterMode]);

  const toggleFilterMode = useCallback(() => {
    setFilterMode((prev) => {
      const nextMode =
        prev === "individual"
          ? "intersection"
          : prev === "intersection"
          ? "union"
          : "individual";

      // 모드 변경 시 상태 정리
      if (nextMode === "individual") {
        // 개별 모드로 변경: 다중 선택 상태를 단일 선택으로 변환
        if (showLikedOnly) {
          setSelectedSingleFilter("liked");
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
        if (selectedSingleFilter === "liked") {
          setShowLikedOnly(true);
        } else if (selectedSingleFilter?.startsWith("playlist-")) {
          const playlistId = selectedSingleFilter.replace("playlist-", "");
          setActivePlaylists(new Set([playlistId]));
        }
        setSelectedSingleFilter(null);
      }

      return nextMode;
    });
  }, [showLikedOnly, activePlaylists, selectedSingleFilter]);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setActiveLanguages(new Set());
    setShowLikedOnly(false);
    setActivePlaylists(new Set());
    setSelectedSingleFilter(null);
    setSortBy("default");
    setSortOrder("desc");
  }, []);

  // 랜덤 정렬 함수
  const handleRandomSort = useCallback(() => {
    setSortBy("random");
  }, []);

  const hasActiveFilters =
    searchTerm ||
    activeLanguages.size > 0 ||
    (filterMode === "individual"
      ? selectedSingleFilter !== null
      : showLikedOnly || activePlaylists.size > 0);

  // 필터 모드 정보
  const filterModeInfo = useMemo(() => {
    switch (filterMode) {
      case "individual":
        return {
          icon: CursorArrowRaysIcon,
          label: "하나씩",
          description: "한 번에 하나의 필터만 선택",
        };
      case "intersection":
        return {
          icon: Square3Stack3DIcon,
          label: "모두 만족",
          description: "모든 조건을 만족하는 곡만",
        };
      case "union":
        return {
          icon: PlusCircleIcon,
          label: "하나라도",
          description: "조건 중 하나라도 만족하는 곡",
        };
      default:
        return {
          icon: CursorArrowRaysIcon,
          label: "하나씩",
          description: "한 번에 하나의 필터만 선택",
        };
    }
  }, [filterMode]);

  // 툴팁 컴포넌트
  const TooltipButton = ({
    onClick,
    active,
    children,
    tooltip,
    className = "",
  }: {
    onClick: () => void;
    active: boolean;
    children: React.ReactNode;
    tooltip: string;
    className?: string;
  }) => (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`p-1.5 rounded-lg transition-all duration-200 hover:scale-110 ${
          active
            ? "bg-light-accent/20 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent"
            : "hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 text-light-text/60 dark:text-dark-text/60 hover:text-light-accent dark:hover:text-dark-accent"
        } ${className}`}
      >
        {children}
      </button>
      {/* 세련된 툴팁 */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs sm:text-sm font-medium text-white bg-gray-900 dark:bg-gray-700 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
        {tooltip}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
      </div>
    </div>
  );

  // 뱃지 컴포넌트
  const FilterBadge = ({
    active,
    onClick,
    icon: Icon,
    label,
    count,
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
        ${
          active
            ? "bg-light-accent dark:bg-dark-accent text-white border-light-accent dark:border-dark-accent shadow-lg"
            : "bg-white/50 dark:bg-gray-800/50 text-light-text dark:text-dark-text border-light-primary/20 dark:border-dark-primary/20 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10"
        }
      `}
    >
      {Icon && <Icon className="w-4 h-4" />}
      <span>{label}</span>
      {count !== undefined && (
        <span className="text-xs opacity-75">({count})</span>
      )}
    </button>
  );

  return (
    <div
      className="sticky top-16 z-20 mb-8 bg-light-background/95 dark:bg-dark-background/95 backdrop-blur-md 
                    border-b border-light-primary/20 dark:border-dark-primary/20 
                    py-4 shadow-sm -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8"
    >
      {/* Search bar */}
      <div className="relative mb-3 sm:mb-4">
        <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-4 w-4 sm:h-5 sm:w-5 text-light-text/40 dark:text-dark-text/40" />
        </div>
        <input
          type="text"
          placeholder="노래 제목, 아티스트, 검색태그로 검색... (띄어쓰기 무관, 초성검색, 한/영 오타 허용)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-8 sm:pl-10 pr-24 sm:pr-32 py-2.5 sm:py-3 border border-light-primary/20 dark:border-dark-primary/20 
                     rounded-xl bg-light-background/50 dark:bg-dark-background/50 backdrop-blur-sm
                     text-sm sm:text-base md:text-lg text-light-text dark:text-dark-text placeholder-light-text/50 dark:placeholder-dark-text/50
                     focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent 
                     focus:border-transparent transition-all duration-200"
        />
        <div className="absolute inset-y-0 right-0 pr-2 sm:pr-3 flex items-center gap-1">
          {/* 가사 검색 토글 버튼 */}
          <TooltipButton
            onClick={() => setIncludeLyrics(!includeLyrics)}
            active={includeLyrics}
            tooltip={includeLyrics ? "가사 검색 제외" : "가사도 검색"}
          >
            <MusicalNoteIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </TooltipButton>

          {/* 번호 표시 토글 버튼 */}
          {onToggleNumbers && (
            <TooltipButton
              onClick={() => onToggleNumbers(!showNumbers)}
              active={showNumbers}
              tooltip={showNumbers ? "번호 숨기기" : "번호 표시"}
            >
              <HashtagIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </TooltipButton>
          )}

          {/* 필터 토글 버튼 */}
          <TooltipButton
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            active={false}
            tooltip={isFilterOpen ? "필터 숨기기" : "필터 보기"}
          >
            {isFilterOpen ? (
              <ChevronUpIcon className="h-5 w-5" />
            ) : (
              <ChevronDownIcon className="h-5 w-5" />
            )}
          </TooltipButton>
        </div>
      </div>

      {/* Badge-style filters */}
      <motion.div
        initial={false}
        animate={{
          height: isFilterOpen ? "auto" : 0,
          opacity: isFilterOpen ? 1 : 0,
        }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="space-y-3">
          {/* 첫 번째 줄: 언어 필터들 + 정렬 탭 */}
          <div className="flex items-center justify-between gap-4">
            {/* 왼쪽: 언어 필터들 */}
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {languages.map((language) => (
                <button
                  key={language}
                  onClick={() => toggleLanguage(language)}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
                    transition-all duration-200 hover:scale-105 border-2
                    ${
                      activeLanguages.has(language)
                        ? "bg-blue-500 text-white border-blue-500 shadow-lg"
                        : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                    }
                  `}
                >
                  <span>{language}</span>
                  <span className="text-xs opacity-75">
                    ({songs.filter((song) => song.language === language).length})
                  </span>
                </button>
              ))}
            </div>

            {/* 오른쪽: 정렬 탭 (큰 화면에서만 표시) */}
            <div className="hidden lg:flex items-center gap-1 bg-white/50 dark:bg-gray-800/50 rounded-lg p-1 border border-light-primary/20 dark:border-dark-primary/20 flex-shrink-0">
              <div className="flex items-center gap-1 text-xs text-light-text/50 dark:text-dark-text/50 px-2">
                정렬
              </div>
              <div className="w-px h-4 bg-light-primary/20 dark:border-dark-primary/20"></div>
              <button
                onClick={() => setSortBy("default")}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 ${
                  sortBy === "default"
                    ? "bg-light-accent dark:bg-dark-accent text-white shadow-sm"
                    : "text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 hover:text-light-text dark:hover:text-dark-text"
                }`}
              >
                기본
              </button>
              <button
                onClick={() => {
                  setSortBy("random");
                  setRandomSeed(prev => prev + 1);
                }}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
                  sortBy === "random"
                    ? "bg-light-accent dark:bg-dark-accent text-white shadow-sm"
                    : "text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 hover:text-light-text dark:hover:text-dark-text"
                }`}
              >
                <ArrowsUpDownIcon className="w-3 h-3" />
                랜덤
              </button>
              <button
                onClick={() => {
                  if (sortBy === "likes") {
                    setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                  } else {
                    setSortBy("likes");
                    setSortOrder("desc");
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
                  sortBy === "likes"
                    ? "bg-light-accent dark:bg-dark-accent text-white shadow-sm"
                    : "text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 hover:text-light-text dark:hover:text-dark-text"
                }`}
              >
                <HeartIcon className="w-3 h-3" />
                좋아요
                {sortBy === "likes" && (
                  <span className="text-xs opacity-75">
                    {sortOrder === "desc" ? "↓" : "↑"}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  if (sortBy === "sungCount") {
                    setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                  } else {
                    setSortBy("sungCount");
                    setSortOrder("desc");
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
                  sortBy === "sungCount"
                    ? "bg-light-accent dark:bg-dark-accent text-white shadow-sm"
                    : "text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 hover:text-light-text dark:hover:text-dark-text"
                }`}
              >
                🎤 부른횟수
                {sortBy === "sungCount" && (
                  <span className="text-xs opacity-75">
                    {sortOrder === "desc" ? "↓" : "↑"}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  if (sortBy === "title") {
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy("title");
                    setSortOrder("asc");
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
                  sortBy === "title"
                    ? "bg-light-accent dark:bg-dark-accent text-white shadow-sm"
                    : "text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 hover:text-light-text dark:hover:text-dark-text"
                }`}
              >
                가나다
                {sortBy === "title" && (
                  <span className="text-xs opacity-75">
                    {sortOrder === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </button>
            </div>
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
              active={
                filterMode === "individual"
                  ? selectedSingleFilter === "liked"
                  : showLikedOnly
              }
              onClick={toggleLiked}
              icon={
                (
                  filterMode === "individual"
                    ? selectedSingleFilter === "liked"
                    : showLikedOnly
                )
                  ? HeartSolidIcon
                  : HeartIcon
              }
              label="좋아요"
              count={likedSongIds.length}
            />

            {/* Playlist filters */}
            {playlists.map((playlist) => (
              <FilterBadge
                key={playlist._id}
                active={
                  filterMode === "individual"
                    ? selectedSingleFilter === `playlist-${playlist._id}`
                    : activePlaylists.has(playlist._id)
                }
                onClick={() => togglePlaylist(playlist._id)}
                icon={ListBulletIcon}
                label={playlist.name}
                count={playlist.songCount}
              />
            ))}

            {/* Clear filters button */}
            {hasActiveFilters && (
              <>
                <div className="w-px h-6 bg-light-primary/20 dark:bg-dark-primary/20" />
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center"
                >
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium
                             bg-red-100 dark:bg-red-900/20 
                             hover:bg-red-200 dark:hover:bg-red-900/30 
                             text-red-800 dark:text-red-300 rounded-full transition-all duration-200
                             border border-red-200 dark:border-red-800 hover:scale-105"
                  >
                    <XMarkIcon className="w-4 h-4" />
                    초기화
                  </button>
                </motion.div>
              </>
            )}
          </div>

          {/* 세 번째 줄: 정렬 탭 (작은 화면에서만 표시) */}
          <div className="lg:hidden">
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-1 bg-white/50 dark:bg-gray-800/50 rounded-lg p-1 border border-light-primary/20 dark:border-dark-primary/20">
                <div className="flex items-center gap-1 text-xs text-light-text/50 dark:text-dark-text/50 px-2">
                  정렬
                </div>
                <div className="w-px h-4 bg-light-primary/20 dark:border-dark-primary/20"></div>
                <button
                  onClick={() => setSortBy("default")}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 ${
                    sortBy === "default"
                      ? "bg-light-accent dark:bg-dark-accent text-white shadow-sm"
                      : "text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 hover:text-light-text dark:hover:text-dark-text"
                  }`}
                >
                  기본
                </button>
                <button
                  onClick={() => {
                    setSortBy("random");
                    setRandomSeed(prev => prev + 1);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
                    sortBy === "random"
                      ? "bg-light-accent dark:bg-dark-accent text-white shadow-sm"
                      : "text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 hover:text-light-text dark:hover:text-dark-text"
                  }`}
                >
                  <ArrowsUpDownIcon className="w-3 h-3" />
                  랜덤
                </button>
                <button
                  onClick={() => {
                    if (sortBy === "likes") {
                      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                    } else {
                      setSortBy("likes");
                      setSortOrder("desc");
                    }
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
                    sortBy === "likes"
                      ? "bg-light-accent dark:bg-dark-accent text-white shadow-sm"
                      : "text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 hover:text-light-text dark:hover:text-dark-text"
                  }`}
                >
                  <HeartIcon className="w-3 h-3" />
                  좋아요
                  {sortBy === "likes" && (
                    <span className="text-xs opacity-75">
                      {sortOrder === "desc" ? "↓" : "↑"}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (sortBy === "sungCount") {
                      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                    } else {
                      setSortBy("sungCount");
                      setSortOrder("desc");
                    }
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
                    sortBy === "sungCount"
                      ? "bg-light-accent dark:bg-dark-accent text-white shadow-sm"
                      : "text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 hover:text-light-text dark:hover:text-dark-text"
                  }`}
                >
                  🎤 부른횟수
                  {sortBy === "sungCount" && (
                    <span className="text-xs opacity-75">
                      {sortOrder === "desc" ? "↓" : "↑"}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (sortBy === "title") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("title");
                      setSortOrder("asc");
                    }
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
                    sortBy === "title"
                      ? "bg-light-accent dark:bg-dark-accent text-white shadow-sm"
                      : "text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 hover:text-light-text dark:hover:text-dark-text"
                  }`}
                >
                  가나다
                  {sortBy === "title" && (
                    <span className="text-xs opacity-75">
                      {sortOrder === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
