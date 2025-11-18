"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { SongData, LyricsLink, MRLink } from "@/types";
import {
  MusicalNoteIcon,
  XMarkIcon,
  PencilIcon,
  PlayIcon,
  PauseIcon,
  VideoCameraIcon,
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon,
  ListBulletIcon,
  ComputerDesktopIcon,
  DocumentDuplicateIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
  ExternalLinkIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon } from "@heroicons/react/24/solid";
import YouTube from "react-youtube";
import { useLike } from "@/hooks/useLikes";
import { useSongPlaylists } from "@/hooks/useGlobalPlaylists";
import PlaylistContextMenu from "./PlaylistContextMenu";
import LiveClipManager from "./LiveClipManager";
import LiveClipEditor from "./LiveClipEditor";
import SongEditForm from "./SongEditForm";
import { useSession } from "next-auth/react";
import { useToast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";

// YouTube 플레이어 타입 정의
interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
}

interface SongDetailModalProps {
  song: SongData;
  isExpanded: boolean;
  onClose: () => void;
  onPlay?: (song: SongData) => void;
  isMobileScreen: boolean;
  songVideos?: any[];
  setSongVideos?: (videos: any[]) => void;
  videosLoading?: boolean;
  loadSongVideos?: () => void;
}

export default function SongDetailModal({
  song,
  isExpanded,
  onClose,
  onPlay,
  isMobileScreen,
  songVideos = [],
  setSongVideos,
  videosLoading = false,
  loadSongVideos,
}: SongDetailModalProps) {
  // 디버그: 받은 song 데이터 확인
  console.log('🔍 SongDetailModal - 전체 song 데이터:', song);
  console.log('🔍 SongDetailModal - songVideos:', songVideos);
  console.log('🔍 SongDetailModal - loadSongVideos:', !!loadSongVideos);
  
  const { data: session } = useSession();
  const { liked, isLoading: likeLoading, toggleLike } = useLike(song.id);
  const { playlists: songPlaylists } = useSongPlaylists(song.id);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'mr' | 'clips'>('mr');
  const [selectedMRIndex, setSelectedMRIndex] = useState(song.selectedMRIndex || 0);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [editingLyricsLink, setEditingLyricsLink] = useState<number | null>(null);
  const [newLyricsLink, setNewLyricsLink] = useState({ title: '', url: '' });
  const [addingNewLink, setAddingNewLink] = useState(false);
  
  const playerRef = useRef<YouTubePlayer | null>(null);
  const showToast = useToast();
  const confirm = useConfirm();

  // 관리자 권한 체크
  const isAdmin = session?.user?.isAdmin || false;

  // 현재 표시되는 제목과 아티스트 (alias 우선)
  const displayTitle = song.titleAlias || song.title;
  const displayArtist = song.artistAlias || song.artist;

  // YouTube MR 데이터 처리
  const youtubeMRs = useMemo(() => {
    console.log('🔍 SongDetailModal - song.mrLinks:', song.mrLinks);
    if (!song.mrLinks || !Array.isArray(song.mrLinks)) {
      console.log('❌ MR links가 없거나 배열이 아님');
      return [];
    }
    const processed = song.mrLinks
      .map((link, index) => {
        // MRLink 객체인지 문자열인지 확인
        let url: string;
        let skipSeconds = 0;
        
        if (typeof link === 'string') {
          // 기존 문자열 형태
          url = link;
          const skipMatch = link.match(/[?&]t=(\d+)/);
          skipSeconds = skipMatch ? parseInt(skipMatch[1]) : 0;
        } else if (typeof link === 'object' && link.url) {
          // MRLink 객체 형태
          url = link.url;
          skipSeconds = link.skipSeconds || 0;
          console.log(`🔍 MRLink 객체 ${index}:`, link);
        } else {
          console.log(`❌ Link ${index}가 올바른 형식이 아님:`, link);
          return null;
        }
        
        const match = url.match(/(?:v=|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (match) {
          const videoId = match[1];
          console.log(`✅ MR 링크 ${index} 처리됨:`, { videoId, skipSeconds, originalUrl: url });
          return { videoId, skipSeconds, originalUrl: url, index };
        } else {
          console.log(`❌ YouTube URL 매칭 실패:`, url);
        }
        return null;
      })
      .filter(Boolean) as Array<{
        videoId: string;
        skipSeconds: number;
        originalUrl: string;
        index: number;
      }>;
    console.log('🎵 최종 처리된 MR 목록:', processed);
    return processed;
  }, [song.mrLinks]);

  const youtubeMR = youtubeMRs[selectedMRIndex] || null;

  // 모달이 열릴 때 라이브 클립 자동 로드
  useEffect(() => {
    if (isExpanded && loadSongVideos && songVideos.length === 0 && !videosLoading) {
      console.log('🚀 모달 열림 - 라이브 클립 자동 로드 시작');
      loadSongVideos();
    }
  }, [isExpanded, loadSongVideos, songVideos.length, videosLoading]);

  // 탭 변경 시 라이브 클립 로드
  useEffect(() => {
    if (isExpanded && activeTab === 'clips' && loadSongVideos && songVideos.length === 0 && !videosLoading) {
      console.log('🚀 라이브 클립 탭 활성화 - 자동 로드 시작');
      loadSongVideos();
    }
  }, [activeTab, isExpanded, loadSongVideos, songVideos.length, videosLoading]);

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

  // 플레이어 제어 함수들
  const handlePlay = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.playVideo();
    }
  }, []);

  const handlePause = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.pauseVideo();
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
    setIsEditMode(!isEditMode);
  };

  // 편집 저장 핸들러
  const handleSaveEdit = (updatedSong: SongData) => {
    Object.assign(song, updatedSong);
    setIsEditMode(false);
  };

  // 편집 취소 핸들러
  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  // 모달 닫기 핸들러
  const handleClose = () => {
    onClose();
  };

  // 가사 링크 추가 핸들러
  const handleAddLyricsLink = async () => {
    if (!newLyricsLink.title.trim() || !newLyricsLink.url.trim()) {
      showToast('제목과 URL을 모두 입력해주세요.', 'error');
      return;
    }

    try {
      new URL(newLyricsLink.url);
    } catch {
      showToast('올바른 URL 형식을 입력해주세요.', 'error');
      return;
    }

    // TODO: API 호출로 가사 링크 추가
    setNewLyricsLink({ title: '', url: '' });
    setAddingNewLink(false);
    showToast('가사 링크가 추가되었습니다.', 'success');
  };

  // 가사 링크 삭제 핸들러
  const handleDeleteLyricsLink = async (index: number) => {
    const confirmed = await confirm('이 가사 링크를 삭제하시겠습니까?');
    if (confirmed) {
      // TODO: API 호출로 가사 링크 삭제
      showToast('가사 링크가 삭제되었습니다.', 'success');
    }
  };

  // OBS 오버레이 핸들러
  const handleOBSOverlay = () => {
    const obsUrl = `/obs/overlay/${session?.user?.channelId}?song=${encodeURIComponent(displayTitle)}&artist=${encodeURIComponent(displayArtist)}`;
    window.open(obsUrl, '_blank');
  };

  if (!isExpanded) return null;

  return (
    <>
      {/* 배경 오버레이 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={handleClose}
      />

      {/* 확장된 모달 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-10%" }}
        animate={{ opacity: 1, scale: 1, x: "-50%", y: "0%" }}
        exit={{ opacity: 0, scale: 0.9, x: "-50%", y: "-10%" }}
        transition={{ duration: 0.3 }}
        className="fixed top-20 sm:top-20 left-1/2 z-40 
                   w-[95vw] max-w-[1600px] overflow-hidden
                   bg-white dark:bg-gray-900 backdrop-blur-sm 
                   rounded-xl border border-light-primary/20 dark:border-dark-primary/20 
                   shadow-2xl transform -translate-x-1/2"
        style={{
          top: isMobileScreen ? "4.5rem" : "5rem",
          height: isMobileScreen
            ? "calc(var(--vh, 1vh) * 100 - 5rem)"
            : "calc(var(--vh, 1vh) * 100 - 6rem)",
        }}
      >
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-light-accent/5 to-light-purple/5 
                        dark:from-dark-accent/5 dark:to-dark-purple/5 rounded-xl"></div>

        <div className="relative p-4 md:p-5 lg:p-6 flex flex-col h-full gap-4">
          {/* 메타데이터 헤더 */}
          <div className="flex flex-col gap-2">
            {/* 첫 번째 줄: 제목, 키, 편집/닫기 버튼 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <h3 className="text-lg md:text-xl lg:text-2xl font-bold text-light-text dark:text-dark-text truncate">
                  {displayTitle}
                </h3>
                {song.keyAdjustment !== null && song.keyAdjustment !== undefined && (
                  <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full whitespace-nowrap">
                    {formatKeyAdjustment(song.keyAdjustment)}
                  </span>
                )}
              </div>
              
              <div className="flex gap-2 ml-4">
                {isAdmin && (
                  <button
                    onClick={toggleEditMode}
                    className={`p-2 rounded-full transition-colors duration-200 ${
                      isEditMode
                        ? "bg-light-accent/20 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                    title={isEditMode ? "편집 중" : "편집"}
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/30 
                           transition-colors duration-200"
                  title="닫기"
                >
                  <XMarkIcon className="w-5 h-5 text-red-500" />
                </button>
              </div>
            </div>

            {/* 두 번째 줄: 아티스트, 언어, 태그들 */}
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

              {song.isFavorite && (
                <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-full">
                  ★ 즐겨찾기
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
          </div>

          {/* 메인 콘텐츠 영역 */}
          <div className="flex flex-col md:flex-row gap-4 md:gap-4 lg:gap-6 flex-1 min-h-0">
            {/* 왼쪽: MR 영상 / 라이브클립 (md: 60%, lg: 70% 공간) */}
            <div className="flex-1 md:flex-none md:w-[60%] lg:flex-none lg:w-[70%] flex flex-col min-h-0">
              {isEditMode ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 flex flex-col flex-1 min-h-0"
                >
                  <SongEditForm
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
                      className={`px-4 py-3 font-medium transition-colors duration-200 ${
                        activeTab === 'mr'
                          ? 'text-light-accent dark:text-dark-accent border-b-2 border-light-accent dark:border-dark-accent'
                          : 'text-light-text/70 dark:text-dark-text/70 hover:text-light-text dark:hover:text-dark-text'
                      }`}
                    >
                      MR 영상
                    </button>
                    <button
                      onClick={() => setActiveTab('clips')}
                      className={`px-4 py-3 font-medium transition-colors duration-200 ${
                        activeTab === 'clips'
                          ? 'text-light-accent dark:text-dark-accent border-b-2 border-light-accent dark:border-dark-accent'
                          : 'text-light-text/70 dark:text-dark-text/70 hover:text-light-text dark:hover:text-dark-text'
                      }`}
                    >
                      라이브클립 ({song.sungCount || 0})
                    </button>
                  </div>

                  {/* 탭 콘텐츠 */}
                  <div className="flex-1 min-h-0 p-4">
                    {activeTab === 'mr' ? (
                      <div className="h-full flex flex-col justify-center">
                        {youtubeMR ? (
                          <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
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
                        ) : (
                          <div className="flex-1 flex items-center justify-center">
                            <div className="text-center text-light-text/50 dark:text-dark-text/50">
                              <MusicalNoteIcon className="w-16 h-16 mx-auto mb-4" />
                              <p>MR 영상이 없습니다</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-full">
                        {/* 디버그 정보 출력 */}
                        {console.log('🔍 LiveClipManager props:', { 
                          songId: song.id, 
                          songTitle: song.title,
                          songVideos: songVideos, 
                          videosLoading: videosLoading,
                          loadSongVideos: !!loadSongVideos 
                        })}
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

            {/* 오른쪽: 사이드바 (md: 40%, lg: 30% 공간) */}
            <div className="w-full md:flex-none md:w-[40%] lg:flex-none lg:w-[30%] flex flex-col gap-4 min-h-0">
              {/* 가사 링크 섹션 */}
              <div className="bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <MusicalNoteIcon className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                    가사 링크
                  </h4>
                  {isAdmin && !addingNewLink && (
                    <button
                      onClick={() => setAddingNewLink(true)}
                      className="p-1 rounded text-light-accent dark:text-dark-accent hover:bg-light-accent/10 dark:hover:bg-dark-accent/10"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {/* 기존 가사 링크들 */}
                  {song.lyricsLinks && song.lyricsLinks.length > 0 ? (
                    song.lyricsLinks.map((link, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <ExternalLinkIcon className="w-3 h-3" />
                          {link.title}
                          {link.verified && (
                            <CheckIcon className="w-3 h-3 text-green-500" />
                          )}
                        </a>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteLyricsLink(index)}
                            className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                          >
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">가사 링크가 없습니다</p>
                  )}

                  {/* 새 링크 추가 폼 */}
                  {addingNewLink && (
                    <div className="space-y-2 border-t pt-2">
                      <input
                        type="text"
                        placeholder="사이트명 (예: 멜론)"
                        value={newLyricsLink.title}
                        onChange={(e) => setNewLyricsLink(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-light-accent dark:focus:ring-dark-accent"
                      />
                      <input
                        type="url"
                        placeholder="가사 페이지 URL"
                        value={newLyricsLink.url}
                        onChange={(e) => setNewLyricsLink(prev => ({ ...prev, url: e.target.value }))}
                        className="w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-light-accent dark:focus:ring-dark-accent"
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={handleAddLyricsLink}
                          className="px-2 py-1 text-xs bg-light-accent dark:bg-dark-accent text-white rounded hover:opacity-80"
                        >
                          추가
                        </button>
                        <button
                          onClick={() => {
                            setAddingNewLink(false);
                            setNewLyricsLink({ title: '', url: '' });
                          }}
                          className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:opacity-80"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 좋아요/플레이리스트 섹션 */}
              <div className="bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 p-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <HeartIcon className="w-4 h-4 text-red-500" />
                  좋아요/플레이리스트
                </h4>
                
                <div className="space-y-3">
                  {/* 좋아요 버튼 */}
                  <button
                    onClick={toggleLike}
                    disabled={likeLoading}
                    className="w-full flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <HeartIcon
                        className={`w-4 h-4 transition-all duration-200 ${
                          liked ? 'text-red-500' : 'text-gray-400'
                        }`}
                      />
                      <span className="text-sm">{liked ? '좋아요 취소' : '좋아요'}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {song.likeCount || 0}
                    </span>
                  </button>

                  {/* 플레이리스트 목록 */}
                  <div className="relative">
                    <button
                      onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}
                      className="w-full flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <ListBulletIcon className="w-4 h-4" />
                        <span className="text-sm">플레이리스트</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {songPlaylists.length}개
                      </span>
                    </button>
                    
                    {showPlaylistMenu && (
                      <PlaylistContextMenu
                        songId={song.id}
                        isOpen={showPlaylistMenu}
                        onClose={() => setShowPlaylistMenu(false)}
                        position={{ x: 0, y: 0 }}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* 추가 기능 섹션 */}
              <div className="bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 p-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <ComputerDesktopIcon className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                  추가 기능
                </h4>
                
                <div className="space-y-2">
                  {session && (
                    <button
                      onClick={handleOBSOverlay}
                      className="w-full flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <ComputerDesktopIcon className="w-4 h-4" />
                      <span className="text-sm">OBS 오버레이</span>
                    </button>
                  )}
                </div>

                {/* 추가일 / 마지막 부른날 */}
                <div className="mt-4 pt-3 border-t border-light-primary/20 dark:border-dark-primary/20">
                  <div className="space-y-1 text-xs text-light-text/60 dark:text-dark-text/60">
                    {song.dateAdded && (
                      <div>추가일: {song.dateAdded}</div>
                    )}
                    {song.lastSungDate && (
                      <div>마지막 부른날: {song.lastSungDate}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}