"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Song, SongVideo } from "@/types";
import {
  MusicalNoteIcon,
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon,
  QueueListIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon, MicrophoneIcon } from "@heroicons/react/24/solid";
import { useLike } from "@/hooks/useLikes";
import { useSongPlaylists } from "@/hooks/useGlobalPlaylists";
import PlaylistContextMenu from "./PlaylistContextMenu";
import SongDetailModal from "./SongDetailModal";
import OfficialCornerFold from "./OfficialCornerFold";
import { isOfficialSong } from "@/shared/utils/song-source";

interface SongCardProps {
  song: Song;
  showNumber?: boolean;
  number?: number;
  /** 리스트(compact) 보기: 슬림한 한 줄 행으로 렌더 */
  compact?: boolean;
  onDialogStateChange?: (isOpen: boolean) => void;
}

export default function SongCard({
  song,
  showNumber = false,
  number,
  compact = false,
  onDialogStateChange,
}: SongCardProps) {
  const { liked, isLoading: likeLoading, toggleLike } = useLike(song.id);
  const { playlists: songPlaylists } = useSongPlaylists(song.id);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  // 라이브 클립 데이터 (SongDetailModal과 공유 — 모달이 열릴 때 모달에서 로드 트리거)
  const [songVideos, setSongVideos] = useState<SongVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  // 라이브 클립 데이터 로드
  const loadSongVideos = useCallback(async () => {
    setVideosLoading(true);
    try {
      const response = await fetch(`/api/songs/${song.id}/videos`);
      if (response.ok) {
        const data = await response.json();
        setSongVideos(data.videos || []);
      } else {
        console.error("라이브 클립 로딩 실패");
      }
    } catch (error) {
      console.error("라이브 클립 로딩 오류:", error);
    } finally {
      setVideosLoading(false);
    }
  }, [song.id]);

  // 곡이 바뀌면 라이브 클립 상태 초기화
  useEffect(() => {
    setSongVideos([]);
    setVideosLoading(false);
  }, [song.id]);

  // 다이얼로그 닫기
  const handleCloseDialog = useCallback(() => {
    setIsExpanded(false);
  }, []);

  // ESC 키로 닫기
  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCloseDialog();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, handleCloseDialog]);

  const languageColors = {
    Korean: "bg-blue-500",
    English: "bg-purple-500",
    Japanese: "bg-pink-500",
  };

  // 키 조절 포맷팅 함수
  const formatKeyAdjustment = (keyAdjustment: number | null | undefined) => {
    if (keyAdjustment === null || keyAdjustment === undefined) return null;
    if (keyAdjustment === 0) return "원본키";
    return keyAdjustment > 0 ? `+${keyAdjustment}키` : `${keyAdjustment}키`;
  };

  // 표시할 제목과 아티스트 결정
  const displayTitle = song.titleAlias || song.title;
  const displayArtist = song.artistAlias || song.artist;

  // 이미지 없는 카드용: 제목 시드 기반 브랜드 계열 그라데이션 (곡마다 고유, 결정적)
  const noImageGradient = useMemo(() => {
    const palettes = [
      "from-light-accent/15 to-light-purple/10 dark:from-dark-accent/20 dark:to-dark-purple/15",
      "from-light-purple/15 to-light-secondary/10 dark:from-dark-purple/20 dark:to-dark-secondary/15",
      "from-light-secondary/15 to-light-accent/10 dark:from-dark-secondary/20 dark:to-dark-accent/15",
      "from-light-primary/15 to-light-accent/10 dark:from-dark-primary/25 dark:to-dark-accent/15",
    ];
    const seed = `${song.title}${song.artist}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return palettes[h % palettes.length];
  }, [song.title, song.artist]);

  // YouTube URL에서 비디오 ID 추출
  const getYouTubeVideoId = (url: string) => {
    const regex =
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // MR 링크에서 YouTube URL 찾기
  const getYouTubeMRLink = () => {
    // mrLinks 사용
    const mrLinks = song.mrLinks;
    if (!mrLinks || mrLinks.length === 0) return null;
    const selectedMR = mrLinks[song.selectedMRIndex || 0];
    if (!selectedMR) return null;

    // URL에 시간 파라미터 추가
    let urlWithTime = selectedMR.url;
    if (selectedMR.skipSeconds && selectedMR.skipSeconds > 0) {
      // 기존 URL에 t 파라미터가 있는지 확인
      const hasTimeParam =
        urlWithTime.includes("&t=") || urlWithTime.includes("?t=");
      if (!hasTimeParam) {
        const separator = urlWithTime.includes("?") ? "&" : "?";
        urlWithTime = `${urlWithTime}${separator}t=${selectedMR.skipSeconds}`;
      }
    }

    const videoId = getYouTubeVideoId(urlWithTime);
    return videoId
      ? {
          videoId,
          skipSeconds: selectedMR.skipSeconds || 0,
          fullUrl: urlWithTime,
        }
      : null;
  };

  const youtubeMR = getYouTubeMRLink();

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (youtubeMR) {
      // MR 링크가 있으면 새 창에서 열기
      window.open(youtubeMR.fullUrl, "_blank");
    } else {
      // MR 링크가 없으면 검색 기능 실행
      handleMRSearch(e);
    }
  };

  const handleMRSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 직접 YouTube 검색 수행 (더 안정적)
    const searchQuery = encodeURIComponent(
      `${displayTitle} ${displayArtist} karaoke MR`
    );
    window.open(
      `https://www.youtube.com/results?search_query=${searchQuery}`,
      "_blank"
    );
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleLike();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({
      x: e.clientX,
      y: e.clientY,
    });
    setShowPlaylistMenu(true);
  };

  // 모달이 열린 동안 뷰포트 높이(--vh) 설정 + body 스크롤 잠금.
  // SongDetailModal이 높이 계산에 --vh에 의존하고 스크롤 잠금은 직접 하지 않으므로 여기서 관리.
  useEffect(() => {
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };
    const restore = () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      document.body.style.touchAction = "";
      document.documentElement.style.overflow = "";
    };

    if (isExpanded) {
      setViewportHeight();
      window.addEventListener("resize", setViewportHeight);
      window.addEventListener("orientationchange", setViewportHeight);
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = "0px";
      document.body.style.touchAction = "none";
      document.documentElement.style.overflow = "hidden";
    } else {
      window.removeEventListener("resize", setViewportHeight);
      window.removeEventListener("orientationchange", setViewportHeight);
      restore();
    }

    return () => {
      window.removeEventListener("resize", setViewportHeight);
      window.removeEventListener("orientationchange", setViewportHeight);
      restore();
    };
  }, [isExpanded]);

  // 다이얼로그 상태 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    onDialogStateChange?.(isExpanded);
  }, [isExpanded, onDialogStateChange]);

  const handleCardClick = () => {
    // 다이얼로그 토글 — 닫을 때는 공통 함수 사용
    if (isExpanded) {
      handleCloseDialog();
    } else {
      setIsExpanded(true);
    }
  };


  // SongCard 컴포넌트 메인 렌더링
  return (
    <>
      {/* 리스트(compact) 보기 — 슬림한 한 줄 행 */}
      {!isExpanded && compact && (
        <div
          onClick={handleCardClick}
          onContextMenu={handleContextMenu}
          className="group relative flex items-center gap-3 rounded-lg border border-light-primary/20 dark:border-dark-primary/20
                     bg-white/60 dark:bg-gray-900/50 px-3 py-2.5 cursor-pointer overflow-hidden
                     hover:border-light-accent/40 dark:hover:border-dark-accent/40 hover:bg-light-primary/5 dark:hover:bg-dark-primary/10
                     transition-colors duration-200"
        >
          {isOfficialSong(song) && <OfficialCornerFold size={16} />}
          {showNumber && number && (
            <span className="shrink-0 w-6 text-center text-xs font-bold text-light-accent dark:text-dark-accent">{number}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium text-sm text-light-text dark:text-dark-text">{displayTitle}</span>
              {song.language && (
                <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${languageColors[song.language as keyof typeof languageColors] || "bg-gray-400"}`} />
              )}
            </div>
            <p className="truncate text-xs text-light-text/55 dark:text-dark-text/55">{displayArtist}</p>
          </div>
          {song.sungCount !== undefined && song.sungCount > 0 && (
            <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-300">
              <MicrophoneIcon className="w-3 h-3" />{song.sungCount}
            </span>
          )}
          <button
            onClick={handleLike}
            disabled={likeLoading}
            className="shrink-0 p-1 rounded-full hover:bg-light-primary/10 dark:hover:bg-dark-primary/15 disabled:opacity-50"
            title={liked ? "좋아요 취소" : "좋아요"}
          >
            <HeartIcon className={`w-4 h-4 ${liked ? "text-red-500" : "text-light-text/40 dark:text-dark-text/40"}`} />
          </button>
        </div>
      )}

      {/* 일반 카드 */}
      {!isExpanded && !compact && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -5 }}
          transition={{ duration: 0.3 }}
          onClick={handleCardClick}
          onContextMenu={handleContextMenu}
          className="group relative rounded-xl border border-light-primary/20 dark:border-dark-primary/20
                     hover:border-light-accent/40 dark:hover:border-dark-accent/40
                     hover:shadow-xl hover:shadow-light-accent/5 dark:hover:shadow-dark-accent/10
                     transition-all duration-300 overflow-hidden cursor-pointer h-52"
        >
          {/* 공식 등록곡 — 좌상단 접힌 코너 (텍스트 없이 절제된 표식) */}
          {isOfficialSong(song) && <OfficialCornerFold size={22} />}
          {song.imageUrl ? (
            /* 앨범 이미지가 있을 때 */
            <>
              {/* 앨범 이미지 배경 */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                style={{ backgroundImage: `url(${song.imageUrl})` }}
              />

              {/* 라이트/다크모드별 오버레이 */}
              <div
                className="absolute inset-0 bg-white/30 dark:bg-black/20 
                              group-hover:bg-white/25 dark:group-hover:bg-black/15 
                              transition-colors duration-300"
              />

              {/* 하단 그라데이션 */}
              <div
                className="absolute inset-0 bg-gradient-to-t 
                              from-white/60 via-white/15 to-transparent
                              dark:from-black/50 dark:via-black/10 dark:to-transparent"
              />

              <div className="relative p-6 bg-white/20 dark:bg-gray-900/20 backdrop-blur-[1px] h-full">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3
                        className="text-lg font-semibold text-light-text dark:text-dark-text 
                                     line-clamp-1 group-hover:text-light-accent dark:group-hover:text-dark-accent 
                                     transition-colors duration-300 flex-1"
                      >
                        {showNumber && number && (
                          <span className="text-light-accent dark:text-dark-accent font-bold mr-2">
                            {number}.
                          </span>
                        )}
                        {displayTitle}
                      </h3>
                      {formatKeyAdjustment(song.keyAdjustment) && (
                        <span
                          className="px-2 py-1 text-xs font-medium rounded-md 
                                       bg-light-primary/10 dark:bg-dark-primary/25
                                       text-light-text/55 dark:text-dark-text/55 flex-shrink-0"
                        >
                          {formatKeyAdjustment(song.keyAdjustment)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-light-text/70 dark:text-dark-text/70 mb-3 line-clamp-1">
                      {displayArtist}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleLike}
                      disabled={likeLoading}
                      className="flex items-center justify-center gap-1 px-2 py-1 rounded-full
                                 bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm
                                 hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                                 transition-all duration-200 disabled:opacity-50
                                 border border-white/20 dark:border-gray-700/50"
                      title={liked ? "좋아요 취소" : "좋아요"}
                    >
                      <HeartIcon
                        className={`w-4 h-4 transition-all duration-200 
                                   ${
                                     likeLoading
                                       ? "text-red-400 fill-current opacity-60 animate-pulse scale-110"
                                       : liked
                                       ? "text-red-500 fill-current"
                                       : "text-light-text/60 dark:text-dark-text/60 hover:text-red-400"
                                   }`}
                      />
                      {song.likeCount !== undefined && (
                        <span
                          className={`text-xs font-medium transition-all duration-200 min-w-[1rem] text-center ${
                            liked
                              ? "text-red-500"
                              : "text-light-text/70 dark:text-dark-text/70"
                          }`}
                        >
                          {song.likeCount}
                        </span>
                      )}
                    </button>

                    {/* 부른 횟수 표시 */}
                    {song.sungCount !== undefined && song.sungCount > 0 && (
                      <div
                        className="flex items-center justify-center gap-1 px-2 py-1 rounded-full
                                    bg-amber-100/70 dark:bg-amber-500/15
                                    border border-amber-200/50 dark:border-amber-400/20"
                      >
                        <MicrophoneIcon className="w-3 h-3 text-amber-600 dark:text-amber-300" />
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                          {song.sungCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Language tag and playlist badges */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {song.language && (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium text-white 
                                     ${
                                       languageColors[
                                         song.language as keyof typeof languageColors
                                       ] || "bg-gray-500"
                                     }`}
                    >
                      {song.language}
                    </span>
                  )}
                  {songPlaylists.slice(0, 2).map((playlist) => (
                    <span
                      key={playlist._id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
                               bg-light-purple/10 dark:bg-dark-secondary/20
                               text-light-purple dark:text-dark-secondary
                               border border-light-purple/20 dark:border-dark-secondary/25"
                    >
                      <QueueListIcon className="w-3 h-3" />
                      {playlist.name}
                    </span>
                  ))}
                  {songPlaylists.length > 2 && (
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium
                                   bg-gray-100 dark:bg-gray-800 
                                   text-gray-600 dark:text-gray-400"
                    >
                      +{songPlaylists.length - 2}
                    </span>
                  )}
                </div>

                {/* MR 버튼 - 링크 유무에 따라 다르게 표시 */}
                <div className="mt-auto pt-1 pb-2">
                  <button
                    onClick={handlePlay}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                             text-light-accent dark:text-dark-accent
                             bg-light-accent/10 dark:bg-dark-accent/15
                             border border-light-accent/25 dark:border-dark-accent/30
                             hover:bg-gradient-to-r hover:from-light-accent hover:to-light-purple
                             dark:hover:from-dark-accent dark:hover:to-dark-purple
                             hover:text-white hover:border-transparent hover:shadow-md
                             transition-all duration-200"
                  >
                    {youtubeMR ? (
                      <>
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        <span>MR 열기</span>
                      </>
                    ) : (
                      <>
                        <MagnifyingGlassIcon className="w-4 h-4" />
                        <span>MR 검색</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Hover effect border */}
              <div
                className="absolute inset-0 rounded-xl border-2 border-transparent 
                              group-hover:border-light-accent/20 dark:group-hover:border-dark-accent/20 
                              transition-colors duration-300 pointer-events-none"
              ></div>
            </>
          ) : (
            /* 이미지가 없을 때 - 곡별 고유 그라데이션 + 음표 워터마크 */
            <>
              {/* 곡 시드 기반 소프트 그라데이션 배경 (이미지 카드와의 격차 완화) */}
              <div className={`absolute inset-0 bg-gradient-to-br ${noImageGradient}`}></div>
              {/* 음표 워터마크 — 우하단에 은은하게 */}
              <MusicalNoteIcon
                className="absolute -bottom-4 -right-3 w-28 h-28 text-light-accent/10 dark:text-dark-accent/10
                           rotate-12 pointer-events-none transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
              />
              {/* 호버 시 살짝 더 진해지는 오버레이 */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-light-accent/5 to-light-purple/5
                              dark:from-dark-accent/5 dark:to-dark-purple/5 opacity-0
                              group-hover:opacity-100 transition-opacity duration-300"
              ></div>

              <div className="relative p-6 bg-white/45 dark:bg-gray-900/45 backdrop-blur-sm h-full">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3
                        className="text-lg font-semibold text-light-text dark:text-dark-text 
                                     line-clamp-1 group-hover:text-light-accent dark:group-hover:text-dark-accent 
                                     transition-colors duration-300 flex-1"
                      >
                        {showNumber && number && (
                          <span className="text-light-accent dark:text-dark-accent font-bold mr-2">
                            {number}.
                          </span>
                        )}
                        {displayTitle}
                      </h3>
                      {formatKeyAdjustment(song.keyAdjustment) && (
                        <span
                          className="px-2 py-1 text-xs font-medium rounded-md 
                                       bg-light-primary/10 dark:bg-dark-primary/25
                                       text-light-text/55 dark:text-dark-text/55 flex-shrink-0"
                        >
                          {formatKeyAdjustment(song.keyAdjustment)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-light-text/70 dark:text-dark-text/70 mb-3 line-clamp-1">
                      {displayArtist}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleLike}
                      disabled={likeLoading}
                      className="flex items-center justify-center gap-1 px-2 py-1 rounded-full
                                 bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm
                                 hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                                 transition-all duration-200 disabled:opacity-50
                                 border border-white/20 dark:border-gray-700/50"
                      title={liked ? "좋아요 취소" : "좋아요"}
                    >
                      <HeartIcon
                        className={`w-4 h-4 transition-all duration-200 
                                   ${
                                     likeLoading
                                       ? "text-red-400 fill-current opacity-60 animate-pulse scale-110"
                                       : liked
                                       ? "text-red-500 fill-current"
                                       : "text-light-text/60 dark:text-dark-text/60 hover:text-red-400"
                                   }`}
                      />
                      {song.likeCount !== undefined && (
                        <span
                          className={`text-xs font-medium transition-all duration-200 min-w-[1rem] text-center ${
                            liked
                              ? "text-red-500"
                              : "text-light-text/70 dark:text-dark-text/70"
                          }`}
                        >
                          {song.likeCount}
                        </span>
                      )}
                    </button>

                    {/* 부른 횟수 표시 */}
                    {song.sungCount !== undefined && song.sungCount > 0 && (
                      <div
                        className="flex items-center justify-center gap-1 px-2 py-1 rounded-full
                                    bg-amber-100/70 dark:bg-amber-500/15
                                    border border-amber-200/50 dark:border-amber-400/20"
                      >
                        <MicrophoneIcon className="w-3 h-3 text-amber-600 dark:text-amber-300" />
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                          {song.sungCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Language tag and playlist badges */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {song.language && (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium text-white 
                                     ${
                                       languageColors[
                                         song.language as keyof typeof languageColors
                                       ] || "bg-gray-500"
                                     }`}
                    >
                      {song.language}
                    </span>
                  )}
                  {songPlaylists.slice(0, 2).map((playlist) => (
                    <span
                      key={playlist._id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
                               bg-light-purple/10 dark:bg-dark-secondary/20
                               text-light-purple dark:text-dark-secondary
                               border border-light-purple/20 dark:border-dark-secondary/25"
                    >
                      <QueueListIcon className="w-3 h-3" />
                      {playlist.name}
                    </span>
                  ))}
                  {songPlaylists.length > 2 && (
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium
                                   bg-gray-100 dark:bg-gray-800 
                                   text-gray-600 dark:text-gray-400"
                    >
                      +{songPlaylists.length - 2}
                    </span>
                  )}
                </div>

                {/* MR 버튼 - 링크 유무에 따라 다르게 표시 */}
                <div className="mt-auto pt-1 pb-2">
                  <button
                    onClick={handlePlay}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                             text-light-accent dark:text-dark-accent
                             bg-light-accent/10 dark:bg-dark-accent/15
                             border border-light-accent/25 dark:border-dark-accent/30
                             hover:bg-gradient-to-r hover:from-light-accent hover:to-light-purple
                             dark:hover:from-dark-accent dark:hover:to-dark-purple
                             hover:text-white hover:border-transparent hover:shadow-md
                             transition-all duration-200"
                  >
                    {youtubeMR ? (
                      <>
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        <span>MR 열기</span>
                      </>
                    ) : (
                      <>
                        <MagnifyingGlassIcon className="w-4 h-4" />
                        <span>MR 검색</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Hover effect border */}
              <div
                className="absolute inset-0 rounded-xl border-2 border-transparent 
                              group-hover:border-light-accent/20 dark:group-hover:border-dark-accent/20 
                              transition-colors duration-300 pointer-events-none"
              ></div>
            </>
          )}
        </motion.div>
      )}


      {/* 플레이리스트 컨텍스트 메뉴 */}
      <PlaylistContextMenu
        songId={song.id}
        isOpen={showPlaylistMenu}
        position={menuPosition}
        onClose={() => setShowPlaylistMenu(false)}
      />

      {/* 새로운 SongDetailModal */}
      <SongDetailModal
        song={song}
        isExpanded={isExpanded}
        onClose={() => setIsExpanded(false)}
        isMobileScreen={typeof window !== 'undefined' ? window.innerWidth < 768 : false}
        songVideos={songVideos}
        setSongVideos={setSongVideos}
        videosLoading={videosLoading}
        loadSongVideos={loadSongVideos}
      />
    </>
  );
}
