"use client";
import { hasPermission, Permission } from "@/lib/permissions";

import { useState, useEffect, useCallback, useRef, useMemo, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { DUR, EASE_IN, EASE_OUT, SPRING_SHEET, SPRING_SNAPPY } from "@/shared/motion/tokens";
import { Song, SongVideo } from "@/types";
import {
  MusicalNoteIcon,
  XMarkIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon,
  ListBulletIcon,
  ComputerDesktopIcon,
  MicrophoneIcon,
  CalendarDaysIcon,
  ClockIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import LikeHeart from "./LikeHeart";
import YouTube from "react-youtube";
import { useLike } from "@/hooks/useLikes";
import { useSongPlaylists } from "@/hooks/useGlobalPlaylists";
import PlaylistContextMenu from "./PlaylistContextMenu";
import LiveClipManager from "./LiveClipManager";
import { useClipRangeEditor } from './clip/range/ClipRangeProvider';
import SongEditForm, { type SongEditFormHandle } from "./SongEditForm";
import OfficialBadge from "./OfficialBadge";
import { isOfficialSong } from "@/shared/utils/song-source";
import { useToast } from "./Toast";
import { useSession } from "next-auth/react";

// YouTube 플레이어 타입 정의
interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
}

interface SongDetailModalProps {
  onSongUpdated?: (song: Song) => void;
  song: Song;
  isExpanded: boolean;
  onClose: () => void;
  isMobileScreen: boolean;
  songVideos: SongVideo[];
  setSongVideos: Dispatch<SetStateAction<SongVideo[]>>;
  videosLoading: boolean;
  loadSongVideos: () => Promise<void>;
  /** 카드에서 모핑으로 여닫을 때 — framer 진입/퇴장 없이 즉시 렌더(View Transition이 움직임을 맡음) */
  instant?: boolean;
}

export default function SongDetailModal({
  onSongUpdated,
  song,
  isExpanded,
  onClose,
  isMobileScreen,
  songVideos,
  setSongVideos,
  videosLoading,
  loadSongVideos,
  instant = false,
}: SongDetailModalProps) {
  const { data: session } = useSession();
  const rangeEditor = useClipRangeEditor();
  const { showSuccess, showError } = useToast();
  const { liked, isLoading: likeLoading, toggleLike } = useLike(song.id);
  const [likePop, setLikePop] = useState(0);
  const { playlists: songPlaylists } = useSongPlaylists(song.id);
  const [isEditMode, setIsEditMode] = useState(false);
  const editFormRef = useRef<SongEditFormHandle>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const [editorViewportHeight, setEditorViewportHeight] = useState<number>();
  useEffect(() => {
    if (!isEditMode) return;
    const update = () => setEditorViewportHeight(window.visualViewport?.height ?? window.innerHeight);
    update(); window.visualViewport?.addEventListener('resize', update);
    return () => window.visualViewport?.removeEventListener('resize', update);
  }, [isEditMode]);
  const [isPlaying, setIsPlaying] = useState(false);
  // 마지막으로 보던 탭을 브라우저에 저장(모든 곡 공용) → 다음에 열 때 그 탭으로
  const [activeTab, setActiveTab] = useState<'mr' | 'clips'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('songDetailModalTab');
      if (saved === 'mr' || saved === 'clips') return saved;
    }
    return 'mr';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('songDetailModalTab', activeTab);
  }, [activeTab]);
  // 다이얼로그가 열릴 때마다 저장된 탭을 다시 읽어 반영한다.
  // (모달이 카드마다 인스턴스로 존재 → 초기화(카드 마운트) 시점에만 읽으면, 같은 세션에서
  //  다른 카드가 바꾼 값이 반영되지 않아 "저장이 안 먹는" 것처럼 보인다.)
  useEffect(() => {
    if (!isExpanded || typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('songDetailModalTab');
    if (saved === 'mr' || saved === 'clips') setActiveTab(saved);
  }, [isExpanded]);
  const [selectedMRIndex, setSelectedMRIndex] = useState(song.selectedMRIndex || 0);
  useEffect(() => { setSelectedMRIndex(song.selectedMRIndex || 0); }, [song.id, song.selectedMRIndex, isExpanded]);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [playlistMenuPos, setPlaylistMenuPos] = useState({ x: 0, y: 0 });
  const [showLyricsMenu, setShowLyricsMenu] = useState(false);
  const [obsActive, setObsActive] = useState(false);
  const [obsLoading, setObsLoading] = useState(false);
  const playerRef = useRef<YouTubePlayer | null>(null);

  // 플레이리스트 메뉴를 버튼 위치 기준으로 연다 (fixed 좌표 계산)
  const openPlaylistMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (showPlaylistMenu) {
      setShowPlaylistMenu(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 280;
    // 버튼 왼쪽에 메뉴를 띄우되, 화면 밖으로 나가면 보정 (PlaylistContextMenu가 추가 보정)
    setPlaylistMenuPos({ x: rect.left - menuWidth - 8, y: rect.top });
    setShowLyricsMenu(false);
    setShowPlaylistMenu(true);
  };

  // 관리자 권한 체크
  const isAdmin = hasPermission(session?.user, Permission.SONGS_EDIT);

  // 현재 표시되는 제목과 아티스트 (alias 우선)
  const displayTitle = song.titleAlias || song.title;
  const displayArtist = song.artistAlias || song.artist;

  // YouTube MR 데이터 처리 (MRLink 객체 → videoId 추출)
  const youtubeMRs = useMemo(() => {
    if (!song.mrLinks || !Array.isArray(song.mrLinks)) {
      return [];
    }
    return song.mrLinks
      .map((link, index) => {
        if (!link?.url) return null;
        const url = link.url;
        const skipSeconds = link.skipSeconds || 0;

        const match = url.match(/(?:v=|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (match) {
          return { videoId: match[1], skipSeconds, originalUrl: url, index };
        }
        return null;
      })
      .filter(Boolean) as Array<{
        videoId: string;
        skipSeconds: number;
        originalUrl: string;
        index: number;
      }>;
  }, [song.mrLinks]);

  // selectedMRIndex is an index into all MR links, not the YouTube-only subset.
  const youtubeMR = youtubeMRs.find(mr => mr.index === selectedMRIndex) || null;

  // 라이브 클립 메타데이터 로드는 useSongVideos(enabled: isExpanded)가 자동 처리한다.
  // (loadSongVideos는 클립 추가/편집/삭제 후 강제 새로고침용으로 LiveClipManager에 전달)

  // Escape 처리: 팝오버/편집 모드가 열려 있으면 그것만 닫고 모달은 유지한다.
  // (부모 SongCard에도 document Escape 리스너가 있어, capture 단계에서 먼저
  //  가로채 전파를 막지 않으면 팝오버를 닫으려는 Escape에 모달이 통째로 닫힌다.)
  useEffect(() => {
    if (!isExpanded || rangeEditor.isOpen) return;
    const onKeyDownCapture = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (showPlaylistMenu || showLyricsMenu) {
        setShowPlaylistMenu(false);
        setShowLyricsMenu(false);
        event.stopPropagation();
        event.preventDefault();
      } else if (isEditMode) {
        editFormRef.current?.requestCancel();
        event.stopPropagation();
        event.preventDefault();
      }
      // 그 외에는 부모(SongCard)가 모달을 닫도록 그대로 둔다.
    };
    document.addEventListener("keydown", onKeyDownCapture, true);
    return () => document.removeEventListener("keydown", onKeyDownCapture, true);
  }, [isExpanded, showPlaylistMenu, showLyricsMenu, isEditMode, rangeEditor.isOpen]);

  // YouTube 플레이어 이벤트 핸들러
  const onYouTubeReady = useCallback((event: any) => {
    playerRef.current = event.target;
  }, []);

  const onYouTubeStateChange = useCallback((event: any) => {
    const YT = (window as any).YT;
    if (YT) {
      if (event.data === YT.PlayerState.PLAYING) {
        setIsPlaying(true);
      } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        setIsPlaying(false);
      }
    }
  }, []);

  // 키 조절 포맷팅 함수
  const formatKeyAdjustment = (keyAdjustment: number | null | undefined) => {
    if (keyAdjustment === null || keyAdjustment === undefined) return null;
    if (keyAdjustment === 0) return "원본키";
    return keyAdjustment > 0 ? `+${keyAdjustment}키` : `${keyAdjustment}키`;
  };

  const languageColors = {
    Korean: "bg-blue-500",
    English: "bg-purple-500",
    Japanese: "bg-pink-500",
    Chinese: "bg-red-500",
  };

  // 편집 모드 토글
  const toggleEditMode = () => {
    setShowPlaylistMenu(false); setShowLyricsMenu(false);
    playerRef.current?.pauseVideo();
    setIsEditMode(true);
  };

  // 편집 저장 핸들러
  const handleSaveEdit = (updatedSong: Song) => {
    const next = { ...song, ...updatedSong, id: song.id };
    setSelectedMRIndex(next.selectedMRIndex || 0);
    onSongUpdated?.(next);
    setIsEditMode(false);
    requestAnimationFrame(() => editButtonRef.current?.focus());
  };

  // 편집 취소 핸들러
  const handleCancelEdit = () => {
    setIsEditMode(false);
    requestAnimationFrame(() => editButtonRef.current?.focus());
  };

  // MR 검색: 유튜브에서 노래방/MR 영상 검색 (MR 링크가 없을 때 대체 수단)
  const handleMRSearch = () => {
    const q = encodeURIComponent(`${displayTitle} ${displayArtist} karaoke MR`);
    window.open(`https://www.youtube.com/results?search_query=${q}`, "_blank");
  };

  // 모달 닫기 핸들러 (OBS가 켜져 있으면 함께 정리)
  const handleClose = () => {
    if (isEditMode) { editFormRef.current?.requestCancel(); return; }
    if (obsActive && session?.user?.userId) {
      fetch("/api/obs/delete", { method: "DELETE" }).catch((error) => {
        console.error("OBS 상태 정리 오류:", error);
      });
    }
    onClose();
  };

  // 가사 검색 링크 (저작권상 가사 원문을 직접 노출하지 않고 검색으로 연결)
  const lyricsSearchLinks = useMemo(() => {
    const query = `${displayTitle} ${displayArtist}`;
    const q = encodeURIComponent(query);
    return [
      { name: 'Google', url: `https://www.google.com/search?q=${encodeURIComponent(`${query} 가사`)}` },
      { name: '네이버', url: `https://search.naver.com/search.naver?query=${encodeURIComponent(`${query} 가사`)}` },
      { name: '나무위키', url: `https://namu.wiki/Search?q=${q}` },
      { name: '멜론', url: `https://www.melon.com/search/total/index.htm?q=${q}` },
      { name: 'Bugs', url: `https://music.bugs.co.kr/search/integrated?q=${q}` },
    ];
  }, [displayTitle, displayArtist]);

  // OBS 오버레이 토글 (현재 곡을 OBS 오버레이로 송출 ON/OFF)
  const toggleOBS = async () => {
    if (!session?.user?.userId) {
      showError("로그인 필요", "OBS 기능을 사용하려면 로그인이 필요합니다.");
      return;
    }
    if (obsLoading) return;

    setObsLoading(true);
    try {
      if (obsActive) {
        await fetch("/api/obs/delete", { method: "DELETE" });
        setObsActive(false);
      } else {
        const response = await fetch("/api/obs/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentSong: { title: displayTitle, artist: displayArtist } }),
        });
        const result = await response.json();
        if (result.success) {
          setObsActive(true);
        } else if (response.status === 409) {
          setObsActive(true);
          showError("OBS 이미 활성화됨", "다른 곡의 OBS가 활성화되어 있습니다. 먼저 끄고 다시 시도하세요.");
        } else {
          showError("OBS 오류", result.error || "OBS 켜기에 실패했습니다.");
        }
      }
    } catch (error) {
      console.error("OBS 토글 오류:", error);
      showError("OBS 오류", "OBS 설정 중 오류가 발생했습니다.");
    } finally {
      setObsLoading(false);
    }
  };

  // OBS 오버레이 링크 복사
  const copyOBSLink = async () => {
    if (!session?.user?.userId) {
      showError("로그인 필요", "OBS 링크 복사 기능을 사용하려면 로그인이 필요합니다.");
      return;
    }
    const obsUrl = `${window.location.origin}/obs/overlay/${session.user.userId}`;
    try {
      await navigator.clipboard.writeText(obsUrl);
      showSuccess("복사 완료", "OBS 링크가 클립보드에 복사되었습니다!");
    } catch {
      showError("복사 실패", "클립보드 복사에 실패했습니다.");
    }
  };

  // 액션 아이콘 버튼 셋 — 데스크톱 세로/모바일 수평 양쪽에서 재사용
  const renderActionButtons = (orientation: 'vertical' | 'horizontal') => {
    // 팝오버가 열리는 방향: 세로바는 왼쪽으로, 수평바는 위로
    const popoverPos =
      orientation === 'vertical'
        ? 'right-full mr-2 top-0'
        : 'bottom-full mb-2 left-1/2 -translate-x-1/2';

    const iconBtn =
      'relative p-2.5 rounded-full transition-colors duration-200 ' +
      'text-light-text/70 dark:text-dark-text/70 ' +
      'bg-light-primary/5 dark:bg-dark-primary/10 ' +
      'hover:bg-light-primary/15 dark:hover:bg-dark-primary/20';

    return (
      <>
        {/* 좋아요 */}
        <button
          onClick={() => { if (!liked) setLikePop((p) => p + 1); void toggleLike(); }}
          disabled={likeLoading}
          className={`${iconBtn} ${liked ? '!text-red-500' : ''}`}
          title={liked ? '좋아요 취소' : '좋아요'}
        >
          <LikeHeart liked={liked} popKey={likePop} className={`w-5 h-5 ${liked ? 'text-red-500' : 'text-current'}`} />
          {(song.likeCount ?? 0) > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 flex items-center justify-center text-[10px] font-medium rounded-full bg-red-500 text-white">
              {song.likeCount}
            </span>
          )}
        </button>

        {/* 플레이리스트 */}
        <button
          onClick={openPlaylistMenu}
          className={`${iconBtn} ${showPlaylistMenu ? '!text-light-accent dark:!text-dark-accent' : ''}`}
          title="플레이리스트에 추가"
        >
          <ListBulletIcon className="w-5 h-5" />
          {songPlaylists.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 flex items-center justify-center text-[10px] font-medium rounded-full bg-light-accent dark:bg-dark-accent text-white">
              {songPlaylists.length}
            </span>
          )}
        </button>

        {/* 가사 검색 (팝오버) */}
        <div className="relative">
          <button
            onClick={() => { setShowLyricsMenu((v) => !v); setShowPlaylistMenu(false); }}
            className={`${iconBtn} ${showLyricsMenu ? '!text-light-accent dark:!text-dark-accent' : ''}`}
            title="가사 검색"
          >
            <MagnifyingGlassIcon className="w-5 h-5" />
          </button>
          {showLyricsMenu && (
            <>
              {/* 바깥 클릭 닫기 */}
              <div className="fixed inset-0 z-10" onClick={() => setShowLyricsMenu(false)} />
              <div
                className={`absolute z-20 ${popoverPos} w-36 py-1 rounded-lg shadow-xl
                           bg-white dark:bg-gray-800 border border-light-primary/20 dark:border-dark-primary/20`}
              >
                <div className="px-3 py-1.5 text-[11px] text-light-text/50 dark:text-dark-text/50 border-b border-light-primary/10 dark:border-dark-primary/10">
                  가사 검색
                </div>
                {lyricsSearchLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowLyricsMenu(false)}
                    className="flex items-center justify-between px-3 py-2 text-sm text-light-text/80 dark:text-dark-text/80
                               hover:bg-light-primary/10 dark:hover:bg-dark-primary/20 transition-colors"
                  >
                    {link.name}
                    <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 opacity-60" />
                  </a>
                ))}
              </div>
            </>
          )}
        </div>

        {/* OBS 오버레이 (로그인 시) */}
        {session && (
          <button
            onClick={toggleOBS}
            onContextMenu={(e) => { e.preventDefault(); copyOBSLink(); }}
            disabled={obsLoading}
            className={`${iconBtn} ${obsActive ? '!bg-light-accent !text-white dark:!bg-dark-accent' : ''}`}
            title={obsActive ? 'OBS 송출 중 (클릭: 끄기 / 우클릭: 링크 복사)' : 'OBS 오버레이로 송출 (우클릭: 링크 복사)'}
          >
            {obsLoading ? (
              <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : (
              <ComputerDesktopIcon className="w-5 h-5" />
            )}
          </button>
        )}
      </>
    );
  };

  if (typeof document === "undefined") return null;

  // body로 포털 — 카드 그리드(main z-10)의 쌓임 맥락에 갇혀 헤더·하단 탭 아래로 깔리던 문제 방지.
  // AnimatePresence로 감싸 닫힐 때도 퇴장 애니메이션이 돈다.
  const body = isExpanded && (
    <div key="song-detail">
      {/* 배경 오버레이 */}
      <motion.div
        initial={instant ? false : { opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: DUR.fade } }}
        exit={{ opacity: 0, transition: { duration: DUR.exit } }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80]"
        onClick={handleClose}
      />

      {/* 확장된 모달 */}
      <motion.div
        // 모바일: 아래에서 올라오는 시트(클립 상세와 같은 문법) / 데스크톱: 가운데 다이얼로그
        initial={instant ? false : isMobileScreen && !isEditMode ? { x: "-50%", y: "100%" } : { opacity: 0, scale: 0.97, x: "-50%", y: 16 }}
        animate={isMobileScreen && !isEditMode
          ? { x: "-50%", y: 0, transition: SPRING_SHEET }
          : { opacity: 1, scale: 1, x: "-50%", y: 0, transition: { duration: DUR.enter, ease: EASE_OUT } }}
        exit={isMobileScreen && !isEditMode
          ? { x: "-50%", y: "100%", transition: { duration: 0.2, ease: EASE_IN } }
          : { opacity: 0, scale: 0.98, x: "-50%", y: 8, transition: { duration: DUR.exit, ease: EASE_IN } }}
        data-song-sheet
        role="dialog" aria-modal="true" aria-label={isEditMode ? `곡 정보 수정: ${displayTitle}` : displayTitle}
        className={`fixed top-20 sm:top-20 left-1/2 z-[80]
                   ${isEditMode ? "w-[calc(100vw-16px)] rounded-2xl sm:w-[95vw] sm:max-w-[1600px]" : isMobileScreen ? "w-full rounded-t-3xl pb-[env(safe-area-inset-bottom)]" : "w-[95vw] max-w-[1600px] rounded-xl"} overflow-hidden
                   bg-white dark:bg-gray-900 backdrop-blur-sm 
                   border border-light-primary/20 dark:border-dark-primary/20
                   shadow-2xl transform -translate-x-1/2`}
        style={{
          // 모바일 보기: 화면 아래에 붙은 시트(위쪽 3rem은 뒤 화면이 살짝 보이게)
          top: isEditMode && isMobileScreen ? 8 : isMobileScreen ? "auto" : "5rem",
          bottom: isMobileScreen && !isEditMode ? 0 : undefined,
          height: isEditMode && isMobileScreen ? (editorViewportHeight ? `${Math.max(0, editorViewportHeight - 16)}px` : "calc(100dvh - 16px)") : isMobileScreen
            ? "calc(var(--vh, 1vh) * 100 - 3rem)"
            : "calc(var(--vh, 1vh) * 100 - 6rem)",
        }}
      >
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-light-accent/5 to-light-purple/5
                        dark:from-dark-accent/5 dark:to-dark-purple/5 rounded-xl"></div>

        {/* 우상단 고정: 편집(관리자) + 닫기 */}
        {!isEditMode && <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          {isAdmin && (
            <button
              ref={editButtonRef}
              aria-label="곡 정보 수정"
              onClick={toggleEditMode}
              className={`p-2 rounded-full transition-colors duration-200 ${
                isEditMode
                  ? "bg-light-accent/20 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent"
                  : "bg-light-primary/10 dark:bg-dark-primary/20 text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/20 dark:hover:bg-dark-primary/30"
              }`}
              title={isEditMode ? "편집 중" : "편집"}
            >
              <PencilIcon className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleClose}
            className="p-2 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-500 transition-colors duration-200"
            aria-label="닫기"
            title="닫기"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>}

        <div className={`relative flex h-full flex-col ${isEditMode ? 'gap-2 p-2 sm:p-4' : 'gap-3 p-3 sm:p-4 md:p-5 lg:p-6'}`}>
          {/* 메타데이터 헤더 (제목/아티스트/태그) */}
          {isEditMode ? <header className="shrink-0 border-b border-slate-200 pb-2 dark:border-slate-700"><h2 className="text-xl font-semibold text-light-text dark:text-dark-text">곡 정보 수정</h2><p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-400">{displayTitle} · {displayArtist}</p></header> : <div className="flex flex-col gap-2 pr-24 md:pr-24">
            <div className="flex items-center gap-3 min-w-0">
              <h3 className="min-w-0 text-lg md:text-xl lg:text-2xl font-bold text-light-text dark:text-dark-text truncate">
                {displayTitle}
              </h3>
              {isOfficialSong(song) && (
                <OfficialBadge size={22} className="shrink-0" title="공식 등록곡 (스트리머 노래책)" />
              )}
              {!isOfficialSong(song) && (
                <span
                  title="팬 추가곡 — 스트리머 공식 노래책에는 없고 팬이 추가한 곡이에요"
                  className="shrink-0 inline-flex items-center cursor-help text-light-text/35 dark:text-dark-text/35
                             hover:text-light-text/70 dark:hover:text-dark-text/70 transition-colors"
                >
                  <UserPlusIcon className="w-[18px] h-[18px]" />
                </span>
              )}
              {song.keyAdjustment !== null && song.keyAdjustment !== undefined && (
                <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full whitespace-nowrap">
                  {formatKeyAdjustment(song.keyAdjustment)}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm md:text-base lg:text-lg text-light-text/70 dark:text-dark-text/70">
                {displayArtist}
              </p>
              {song.language && (
                <span
                  className={`px-2 py-1 text-xs text-white rounded-full ${
                    languageColors[song.language as keyof typeof languageColors] || "bg-gray-500"
                  }`}
                >
                  {song.language}
                </span>
              )}
              {song.searchTags &&
                song.searchTags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs bg-light-secondary/20 dark:bg-dark-secondary/20
                           text-light-text/70 dark:text-dark-text/70 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
            </div>
          </div>}

          {/* 본문: 영상/콘텐츠 (좌) + 액션 아이콘바 (우, 데스크톱) */}
          <div className="flex flex-row gap-3 lg:gap-4 flex-1 min-h-0 min-w-0">
            {/* 콘텐츠 영역 (전폭) — min-w-0: 플레이어(aspect-video+min-h)의 min-content 너비가
                flex 아이템을 못 줄이게 해 모바일에서 가로로 삐져나가던 문제 방지 */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              {isEditMode ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 flex flex-col flex-1 min-h-0"
                >
                  <SongEditForm
                    ref={editFormRef}
                    key={song.id}
                    song={song}
                    isVisible={true}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                  />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 flex flex-col flex-1 min-h-0"
                >
                  {/* 탭 헤더 */}
                  <div className="flex border-b border-light-primary/20 dark:border-dark-primary/20">
                    <button
                      onClick={() => setActiveTab('mr')}
                      className={`relative px-4 py-3 font-medium transition-colors duration-200 ${
                        activeTab === 'mr'
                          ? 'text-light-accent dark:text-dark-accent'
                          : 'text-light-text/70 dark:text-dark-text/70 hover:text-light-text dark:hover:text-dark-text'
                      }`}
                    >
                      MR 영상
                      {activeTab === 'mr' && (
                        <motion.span layoutId="song-detail-tab" transition={SPRING_SNAPPY} aria-hidden
                          className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-light-accent dark:bg-dark-accent" />
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab('clips')}
                      className={`relative px-4 py-3 font-medium transition-colors duration-200 ${
                        activeTab === 'clips'
                          ? 'text-light-accent dark:text-dark-accent'
                          : 'text-light-text/70 dark:text-dark-text/70 hover:text-light-text dark:hover:text-dark-text'
                      }`}
                    >
                      라이브클립 ({song.sungCount || 0})
                      {activeTab === 'clips' && (
                        <motion.span layoutId="song-detail-tab" transition={SPRING_SNAPPY} aria-hidden
                          className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-light-accent dark:bg-dark-accent" />
                      )}
                    </button>
                  </div>

                  {/* 탭 콘텐츠 */}
                  <div className="flex-1 min-h-0 p-2 sm:p-4 flex flex-col">
                    {activeTab === 'mr' ? (
                      <div className="flex-1 flex flex-col justify-center min-h-0">
                        {youtubeMR ? (
                          <div className="flex flex-col min-h-0 gap-3">
                            <div className="w-full max-w-4xl mx-auto aspect-video bg-black rounded-lg overflow-hidden">
                              <YouTube
                                key={`modal-mr-${song.id}-${youtubeMR.videoId}`}
                                videoId={youtubeMR.videoId}
                                opts={{
                                  width: "100%",
                                  height: "100%",
                                  playerVars: {
                                    autoplay: 0,
                                    controls: 1,
                                    rel: 0,
                                    modestbranding: 1,
                                    start: youtubeMR.skipSeconds || 0,
                                    iv_load_policy: 3,
                                    cc_load_policy: 0,
                                  },
                                }}
                                onReady={onYouTubeReady}
                                onStateChange={onYouTubeStateChange}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                onEnd={() => setIsPlaying(false)}
                                className="w-full h-full"
                              />
                            </div>
                            {/* MR 검색: 등록된 MR이 마음에 안 들 때 유튜브에서 다른 MR 찾기 */}
                            <div className="flex justify-center">
                              <button
                                onClick={handleMRSearch}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg
                                           text-light-text/70 dark:text-dark-text/70
                                           border border-light-primary/20 dark:border-dark-primary/20
                                           hover:border-light-accent/50 dark:hover:border-dark-accent/50
                                           hover:text-light-accent dark:hover:text-dark-accent transition-colors"
                              >
                                <MagnifyingGlassIcon className="w-4 h-4" />
                                YouTube에서 다른 MR 검색
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center">
                            <div className="text-center text-light-text/50 dark:text-dark-text/50">
                              <MusicalNoteIcon className="w-16 h-16 mx-auto mb-4" />
                              <p className="mb-4">등록된 MR 영상이 없습니다</p>
                              <button
                                onClick={handleMRSearch}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white
                                           bg-gradient-to-r from-light-accent to-light-purple
                                           dark:from-dark-accent dark:to-dark-purple
                                           hover:shadow-lg transition-all duration-200"
                              >
                                <MagnifyingGlassIcon className="w-4 h-4" />
                                YouTube에서 MR 검색
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 min-h-0">
                        <LiveClipManager
                          songId={song.id}
                          songTitle={song.title}
                          songVideos={songVideos}
                          setSongVideos={setSongVideos}
                          videosLoading={videosLoading}
                          loadSongVideos={loadSongVideos}
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* 데스크톱 액션바: 우측 세로 스택 */}
            {!isEditMode && <div className="hidden md:flex flex-col items-center gap-1.5 flex-shrink-0">
              {renderActionButtons('vertical')}
            </div>}
          </div>

          {/* 하단 메타 정보 바 (부른 횟수 · 추가일 · 마지막 부른날) — 탭 무관 항상 표시 */}
          {!isEditMode && (song.sungCount || song.dateAdded || song.lastSungDate) && (
            <div className="flex items-center justify-center gap-4 flex-wrap flex-shrink-0 text-xs text-light-text/60 dark:text-dark-text/60">
              {song.sungCount ? (
                <span className="inline-flex items-center gap-1">
                  <MicrophoneIcon className="w-3.5 h-3.5" />
                  {song.sungCount}회 불렀어요
                </span>
              ) : null}
              {song.dateAdded && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDaysIcon className="w-3.5 h-3.5" />
                  추가 {song.dateAdded}
                </span>
              )}
              {song.lastSungDate && (
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="w-3.5 h-3.5" />
                  최근 {song.lastSungDate}
                </span>
              )}
            </div>
          )}

          {/* 모바일 액션바: 하단 고정 수평 바 */}
          {!isEditMode && <div className="flex md:hidden items-center justify-around flex-shrink-0 pt-2 border-t border-light-primary/15 dark:border-dark-primary/15">
            {renderActionButtons('horizontal')}
          </div>}
        </div>
      </motion.div>

      {/* 플레이리스트 메뉴: 모달의 transform 밖(포털 루트)에 둔다 (fixed=뷰포트 기준) */}
      <PlaylistContextMenu
        songId={song.id}
        isOpen={showPlaylistMenu}
        onClose={() => setShowPlaylistMenu(false)}
        position={playlistMenuPos}
      />
    </div>
  );

  // 모핑 모드는 즉시 붙였다 떼고(전환 콜백 안에서 DOM이 바로 바뀌어야 함), 아니면 퇴장 애니메이션을 돌린다.
  return createPortal(
    instant ? body : <AnimatePresence>{body}</AnimatePresence>,
    document.body
  );
}
