"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MagnifyingGlassIcon,
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
  MicrophoneIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import type { SongFilters } from "@/hooks/useSongFilters";

interface SongSearchProps {
  /** useSongFilters() 반환값 — 필터 상태·핸들러·파생 결과 일체 (부모가 소유) */
  filters: SongFilters;
  /** 검색 바가 sticky top에 고정됐는지 (useScrollNav가 같은 rAF에서 동기 계산) */
  stuck?: boolean;
  showNumbers?: boolean;
  onToggleNumbers?: (show: boolean) => void;
}

export default function SongSearch({
  filters,
  stuck = false,
  showNumbers = false,
  onToggleNumbers,
}: SongSearchProps) {
  const {
    songs,
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
    playlists,
    languages,
    likedSongIds,
    hasActiveFilters,
    toggleLanguage,
    togglePlaylist,
    toggleLiked,
    toggleFilterMode,
    clearFilters,
  } = filters;

  // 필터 모드 표시 정보 (아이콘 등 프레젠테이션 — filterMode에서 파생)
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

  // stuck(고정 여부)은 부모의 useScrollNav가 --nav-shift와 같은 rAF에서 동기 계산해
  // prop으로 내려준다(IO의 비동기 "한 박자 늦음" 제거).

  // 필터 패널 자동 접기/펼치기 (인메모리·페이지 한정):
  // 기본은 stuck이면 접고 해제되면 펼친다. 단, 사용자가 직접 토글한 뒤로는 그 상태를
  // 유지하고 자동 동작을 멈춘다(한 번 펼쳐두면 재진입해도 펼친 채 유지).
  const userToggledFilterRef = useRef(false);
  const prevStuckRef = useRef(stuck);
  // 자동 접힘/펼침은 스크롤 중에 일어나므로 즉시(0초) 처리해 "줄어드는 동안" 구간이
  // 스크롤과 겹치지 않게 한다. 수동 토글만 부드럽게 애니메이션.
  const [filterAnimSec, setFilterAnimSec] = useState(0.3);
  useEffect(() => {
    if (userToggledFilterRef.current) {
      prevStuckRef.current = stuck;
      return;
    }
    if (stuck !== prevStuckRef.current) {
      setFilterAnimSec(0); // 자동 = 즉시
      setIsFilterOpen(!stuck);
      prevStuckRef.current = stuck;
    }
  }, [stuck, setIsFilterOpen]);

  const handleToggleFilter = () => {
    userToggledFilterRef.current = true; // 이후 자동 접기/펼치기 중단
    setFilterAnimSec(0.3); // 수동 = 애니메이션
    setIsFilterOpen(!isFilterOpen);
  };

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
    <>
      <div
        data-sticky-bar
        // top은 --nav-height - --nav-shift 로 스크롤에 연동(트랜지션 없이 rAF가 매끄럽게
        // 갱신). 배경/보더/그림자만 stuck 시 트랜지션. 변수 미설정 페이지는 64px 기본.
        style={{ top: "calc(var(--nav-height, 64px) - var(--nav-shift, 0px))" }}
        className={`sticky z-30 mb-8 py-3 transition-[background-color,border-color,box-shadow] duration-200 ${
          stuck
            ? "bg-light-background/95 dark:bg-dark-background/95 backdrop-blur-md border-b border-light-primary/20 dark:border-dark-primary/20 shadow-sm -mx-3 sm:-mx-4 lg:-mx-6 xl:-mx-8 px-3 sm:px-4 lg:px-6 xl:px-8"
            : ""
        }`}
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
            onClick={handleToggleFilter}
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
        transition={{ duration: filterAnimSec }}
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
                    transition-all duration-200 hover:scale-105 border
                    ${
                      activeLanguages.has(language)
                        ? "bg-light-accent dark:bg-dark-accent text-white border-transparent shadow-md"
                        : "bg-light-primary/10 dark:bg-dark-primary/15 text-light-text/70 dark:text-dark-text/70 border-light-primary/25 dark:border-dark-primary/30 hover:bg-light-primary/20 dark:hover:bg-dark-primary/25"
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
                <MicrophoneIcon className="w-3 h-3" />
                부른횟수
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
                  <MicrophoneIcon className="w-3 h-3" />
                  부른횟수
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
    </>
  );
}
