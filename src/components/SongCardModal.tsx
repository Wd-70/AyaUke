'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SongData } from '@/types';
import { 
  MusicalNoteIcon, 
  VideoCameraIcon, 
  PlayIcon, 
  PauseIcon,
  XMarkIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  HeartIcon,
  ListBulletIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import YouTube from 'react-youtube';
import LiveClipManager from './LiveClipManager';
import SongEditForm from './SongEditForm';
import { useSession } from 'next-auth/react';

// YouTube 플레이어 타입 정의
interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
}

interface SongCardModalProps {
  song: SongData;
  isExpanded: boolean;
  onClose: () => void;
  onPlay?: (song: SongData) => void;
  isMobileScreen: boolean;
}

export default function SongCardModal({ 
  song, 
  isExpanded, 
  onClose, 
  onPlay,
  isMobileScreen 
}: SongCardModalProps) {
  const { data: session } = useSession();
  const [currentTab, setCurrentTab] = useState<'lyrics' | 'mr' | 'videos'>('lyrics');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [youtubePlayer, setYoutubePlayer] = useState<YouTubePlayer | null>(null);

  // 관리자 권한 체크
  const isAdmin = session?.user?.isAdmin || false;

  // 현재 표시되는 제목과 아티스트 (alias 우선)
  const displayTitle = song.titleAlias || song.title;
  const displayArtist = song.artistAlias || song.artist;

  // 유튜브 MR 링크 처리
  const youtubeMR = song.mrLinks && song.mrLinks.length > 0 
    ? song.mrLinks[song.selectedMRIndex || 0]?.url 
    : null;

  // XL 화면에서는 MR 탭을 기본으로 설정
  useEffect(() => {
    const updateDefaultTab = () => {
      const isXL = window.innerWidth >= 1280;
      if (isExpanded && isXL && currentTab === 'lyrics') {
        setCurrentTab('mr');
      }
    };
    
    if (isExpanded) {
      updateDefaultTab();
      window.addEventListener('resize', updateDefaultTab);
    }
    
    return () => {
      window.removeEventListener('resize', updateDefaultTab);
    };
  }, [isExpanded, currentTab]);

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

  // 탭 전환 핸들러
  const switchTab = (tab: 'lyrics' | 'mr' | 'videos') => {
    setCurrentTab(tab);
  };

  // 모달 재생 버튼 핸들러
  const handleModalPlay = () => {
    if (youtubePlayer) {
      if (isPlaying) {
        youtubePlayer.pauseVideo();
      } else {
        youtubePlayer.playVideo();
      }
    } else if (onPlay) {
      onPlay(song);
    }
  };

  // MR 검색 핸들러
  const handleMRSearch = () => {
    const searchQuery = `${song.title} ${song.artist} MR 반주`;
    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    window.open(youtubeSearchUrl, '_blank');
  };

  // 스크롤 핸들러
  const handleDialogScroll = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  const handleScrollableAreaScroll = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  // 키 조절 포맷팅 함수
  const formatKeyAdjustment = (keyAdjustment: number | null | undefined) => {
    if (keyAdjustment === null || keyAdjustment === undefined) return null;
    if (keyAdjustment === 0) return '원본키';
    return keyAdjustment > 0 ? `+${keyAdjustment}키` : `${keyAdjustment}키`;
  };

  const languageColors = {
    Korean: 'bg-blue-500',
    English: 'bg-purple-500',
    Japanese: 'bg-pink-500',
  };

  if (!isExpanded) return null;

  return (
    <>
      {/* 확장 시 배경 오버레이 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* 확장된 모달 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-10%' }}
        animate={{ opacity: 1, scale: 1, x: '-50%', y: '0%' }}
        exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-10%' }}
        transition={{ duration: 0.3 }}
        className="fixed top-20 sm:top-20 left-1/2 z-40 
                   w-[90vw] max-w-7xl overflow-hidden
                   bg-white dark:bg-gray-900 backdrop-blur-sm 
                   rounded-xl border border-light-primary/20 dark:border-dark-primary/20 
                   shadow-2xl transform -translate-x-1/2 youtube-dialog-container"
        style={{ 
          top: isMobileScreen ? '4.5rem' : '5rem',
          height: isMobileScreen ? 'calc(var(--vh, 1vh) * 100 - 5rem)' : 'calc(var(--vh, 1vh) * 100 - 6rem)',
          overscrollBehavior: 'contain' 
        }}
        onWheel={handleDialogScroll}
      >
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-light-accent/5 to-light-purple/5 
                        dark:from-dark-accent/5 dark:to-dark-purple/5 rounded-xl"></div>

        <div className="relative p-4 sm:p-6 xl:p-8 flex flex-col xl:flex-row h-full gap-4 sm:gap-6 xl:gap-8">
          {/* 왼쪽: 가사 전용 영역 (XL 이상에서만) */}
          <div className="hidden xl:flex xl:w-1/2 flex-col min-h-0">
            <div className="flex items-center gap-3 mb-4">
              <MusicalNoteIcon className="w-6 h-6 text-light-accent dark:text-dark-accent" />
              <h4 className="text-xl font-semibold text-light-text dark:text-dark-text">가사</h4>
            </div>
            <div className="flex-1 p-6 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 flex flex-col min-h-0">
              {song.lyrics ? (
                <div 
                  className="scrollable-content text-light-text/80 dark:text-dark-text/80 whitespace-pre-line leading-relaxed text-base md:text-lg overflow-y-auto flex-1 min-h-0"
                  style={{ 
                    overscrollBehavior: 'contain',
                    willChange: 'scroll-position',
                    transform: 'translateZ(0)'
                  }}
                >
                  {song.lyrics}
                </div>
              ) : (
                <div className="text-center flex flex-col items-center justify-center text-light-text/50 dark:text-dark-text/50 flex-1">
                  <MusicalNoteIcon className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg mb-2">아직 가사가 등록되지 않았습니다</p>
                  <p className="text-base">곧 업데이트될 예정입니다</p>
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 모든 다른 요소들 */}
          <div className="flex-1 xl:w-1/2 flex flex-col min-h-0 relative">
            {/* 편집 액션 버튼들 - 맨 위에 배치 */}
            {isAdmin && (
              <div className="flex justify-end gap-2 mb-4">
                <button
                  onClick={toggleEditMode}
                  className={`p-2 rounded-full transition-colors duration-200 ${
                    isEditMode 
                      ? 'bg-light-accent/20 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent' 
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  title={isEditMode ? "편집 중" : "편집"}
                >
                  <PencilIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/30 
                           transition-colors duration-200"
                  title="닫기"
                >
                  <XMarkIcon className="w-5 h-5 text-red-500" />
                </button>
              </div>
            )}

            {/* 메타데이터 섹션 */}
            <div className="mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                {/* 제목과 아티스트 */}
                <div className="flex-1">
                  <h3 className="text-xl sm:text-2xl xl:text-3xl font-bold text-light-text dark:text-dark-text mb-2">
                    {displayTitle}
                  </h3>
                  <p className="text-base sm:text-lg xl:text-xl text-light-text/70 dark:text-dark-text/70 mb-3">
                    {displayArtist}
                  </p>
                  
                  {/* 메타데이터 섹션 - 키 조절, 언어, 기타 정보 */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {/* 키 조절 표시 */}
                    {song.keyAdjustment !== null && song.keyAdjustment !== undefined && (
                      <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full">
                        {formatKeyAdjustment(song.keyAdjustment)}
                      </span>
                    )}
                    
                    {/* 언어 표시 */}
                    {song.language && (
                      <span className={`px-2 py-1 text-xs text-white rounded-full ${
                        languageColors[song.language as keyof typeof languageColors] || 'bg-gray-500'
                      }`}>
                        {song.language}
                      </span>
                    )}
                    
                    {/* 즐겨찾기 표시 */}
                    {song.isFavorite && (
                      <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-full">
                        ★ 즐겨찾기
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 태그들 */}
              {song.searchTags && song.searchTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {song.searchTags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 text-xs bg-light-secondary/20 dark:bg-dark-secondary/20 
                               text-light-text/70 dark:text-dark-text/70 rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 큰 화면에서의 영상 섹션 - 플레이어 대상 영역 */}
            <div className="hidden xl:flex flex-col flex-1 gap-6 min-h-0">
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
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="p-6 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 flex flex-col flex-1 min-h-0"
                >
                  {/* XL 화면 탭 네비게이션 */}
                  <div className="flex border-b border-light-primary/20 dark:border-dark-primary/20 mb-4">
                    <button
                      onClick={() => switchTab('mr')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                        currentTab === 'mr'
                          ? 'text-light-accent dark:text-dark-accent border-b-2 border-light-accent dark:border-dark-accent bg-light-primary/10 dark:bg-dark-primary/10'
                          : 'text-gray-600 dark:text-gray-400 hover:text-light-accent dark:hover:text-dark-accent hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'
                      }`}
                    >
                      <VideoCameraIcon className="w-5 h-5" />
                      <span>MR 영상</span>
                    </button>
                    <button
                      onClick={() => switchTab('videos')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                        currentTab === 'videos'
                          ? 'text-light-accent dark:text-dark-accent border-b-2 border-light-accent dark:border-dark-accent bg-light-primary/10 dark:bg-dark-primary/10'
                          : 'text-gray-600 dark:text-gray-400 hover:text-light-accent dark:hover:text-dark-accent hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'
                      }`}
                    >
                      <PlayIcon className="w-5 h-5" />
                      <span>라이브 클립</span>
                    </button>
                  </div>

                  {/* XL 화면 MR 섹션 */}
                  <div className={`${currentTab === 'mr' ? 'flex' : 'hidden'} flex-col flex-1 min-h-0`}>
                    {/* 기존 YouTube 플레이어 */}
                    {youtubeMR && (
                      <div 
                        id="xl-player-target" 
                        className="w-full flex-1 min-h-0 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        style={{
                          height: '100%',
                          maxHeight: '100%',
                          overflow: 'hidden'
                        }}
                      >
                        {/* 통합 플레이어가 여기에 위치함 */}
                      </div>
                    )}
                  </div>

                  {/* XL 화면 유튜브 영상 섹션 */}
                  <div className={`${currentTab === 'videos' ? 'flex' : 'hidden'} flex-col h-full min-h-0 relative`}>
                    <LiveClipManager 
                      songId={song.id}
                      songTitle={displayTitle}
                      isVisible={currentTab === 'videos'}
                    />
                  </div>
                </motion.div>
              )}
            </div>

            {/* LiveClipManager - 독립적으로 렌더링, 탭 콘텐츠 영역에만 표시 */}
            {/* 모바일 화면 */}
            <div className="xl:hidden" style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%', 
              pointerEvents: 'none',
              zIndex: 1
            }}>
              <div style={{ 
                position: 'absolute',
                bottom: currentTab === 'videos' ? '5rem' : '-100vh', // Action buttons 위에 위치
                left: 0,
                right: 0,
                top: '7.5rem', // 탭 메뉴와 충분한 여백 확보
                pointerEvents: currentTab === 'videos' ? 'auto' : 'none'
              }}>
                <LiveClipManager 
                  songId={song.id}
                  songTitle={displayTitle}
                  isVisible={currentTab === 'videos'}
                />
              </div>
            </div>

            {/* 작은 화면에서의 탭 섹션 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="xl:hidden bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 relative flex flex-col flex-1 min-h-0"
            >
              {/* 탭 네비게이션 */}
              <div className="flex border-b border-light-primary/20 dark:border-dark-primary/20">
                <button
                  onClick={() => switchTab('lyrics')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                    currentTab === 'lyrics'
                      ? 'text-light-accent dark:text-dark-accent border-b-2 border-light-accent dark:border-dark-accent bg-light-primary/10 dark:bg-dark-primary/10'
                      : 'text-gray-600 dark:text-gray-400 hover:text-light-accent dark:hover:text-dark-accent hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'
                  }`}
                >
                  <MusicalNoteIcon className="w-4 h-4" />
                  <span>가사</span>
                </button>
                <button
                  onClick={() => switchTab('mr')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                    currentTab === 'mr'
                      ? 'text-light-accent dark:text-dark-accent border-b-2 border-light-accent dark:border-dark-accent bg-light-primary/10 dark:bg-dark-primary/10'
                      : 'text-gray-600 dark:text-gray-400 hover:text-light-accent dark:hover:text-dark-accent hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'
                  }`}
                >
                  <VideoCameraIcon className="w-4 h-4" />
                  <span>MR</span>
                </button>
                <button
                  onClick={() => switchTab('videos')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                    currentTab === 'videos'
                      ? 'text-light-accent dark:text-dark-accent border-b-2 border-light-accent dark:border-dark-accent bg-light-primary/10 dark:bg-dark-primary/10'
                      : 'text-gray-600 dark:text-gray-400 hover:text-light-accent dark:hover:text-dark-accent hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'
                  }`}
                >
                  <PlayIcon className="w-4 h-4" />
                  <span>라이브 클립</span>
                </button>
              </div>

              {/* 탭 콘텐츠 */}
              <div className={`flex-1 min-h-0 ${currentTab === 'videos' ? '' : 'p-4 sm:p-6'}`}>
                {/* MR 영상/편집 영역 */}
                <div className={`${currentTab === 'mr' ? 'flex' : 'hidden'} flex-col h-full min-h-0`}>
                  {/* 기존 YouTube 플레이어 */}
                  {youtubeMR && (
                    <div className="flex-1 flex flex-col min-h-0">
                      <div 
                        id="mobile-player-target" 
                        className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg flex-1"
                        style={{
                          minHeight: '240px',
                          overflow: 'hidden'
                        }}
                      >
                        {/* 통합 플레이어가 여기에 위치함 */}
                      </div>
                    </div>
                  )}
                </div>

                {/* 가사 섹션 */}
                <div className={`${currentTab === 'lyrics' ? 'flex' : 'hidden'} flex-col h-full min-h-0`}>
                  {song.lyrics ? (
                    <div 
                      className="scrollable-content text-light-text/80 dark:text-dark-text/80 whitespace-pre-line leading-relaxed text-base md:text-lg overflow-y-auto flex-1 min-h-0"
                      style={{ 
                        overscrollBehavior: 'contain',
                        willChange: 'scroll-position',
                        transform: 'translateZ(0)'
                      }}
                      onWheel={handleScrollableAreaScroll}
                    >
                      {song.lyrics}
                    </div>
                  ) : (
                    <div className="text-center h-full flex flex-col items-center justify-center text-light-text/50 dark:text-dark-text/50">
                      <MusicalNoteIcon className="w-16 h-16 mb-4 opacity-30" />
                      <p className="text-lg mb-2">아직 가사가 등록되지 않았습니다</p>
                      <p className="text-base">곧 업데이트될 예정입니다</p>
                    </div>
                  )}
                </div>

                {/* 유튜브 영상 섹션 */}
                <div className={`${currentTab === 'videos' ? 'flex' : 'hidden'} flex-col h-full min-h-0`}>
                  {/* 빈 공간 - LiveClipManager는 독립적으로 렌더링됨 */}
                </div>
              </div>
            </motion.div>

            {/* Action buttons - 편집 모드가 아닐 때만 표시 */}
            {!isEditMode && (
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap mt-3 sm:mt-4">
                {youtubeMR ? (
                  // MR 링크가 있을 때 - 3개 버튼으로 분리
                  <>
                    {/* 재생/일시정지 버튼 */}
                    <button
                      onClick={handleModalPlay}
                      className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base
                               bg-gradient-to-r from-light-accent to-light-purple 
                               dark:from-dark-accent dark:to-dark-purple text-white 
                               rounded-lg hover:shadow-lg transform hover:scale-105 
                               transition-all duration-200 font-medium"
                    >
                      {isPlaying ? (
                        <>
                          <PauseIcon className="w-5 h-5" />
                          <span>일시정지</span>
                        </>
                      ) : (
                        <>
                          <PlayIcon className="w-5 h-5" />
                          <span>재생</span>
                        </>
                      )}
                    </button>
                    
                    {/* MR 검색 버튼 */}
                    <button
                      onClick={handleMRSearch}
                      className="px-3 sm:px-4 py-2 sm:py-3 bg-light-secondary/20 dark:bg-dark-secondary/20 
                               hover:bg-light-secondary/30 dark:hover:bg-dark-secondary/30
                               text-light-text dark:text-dark-text rounded-lg
                               transition-colors duration-200 flex items-center gap-2"
                      title="YouTube에서 MR 검색"
                    >
                      <MagnifyingGlassIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">MR 검색</span>
                    </button>
                  </>
                ) : (
                  // MR 링크가 없을 때 - 단일 버튼
                  <button
                    onClick={handleMRSearch}
                    className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base
                             bg-gradient-to-r from-light-accent to-light-purple 
                             dark:from-dark-accent dark:to-dark-purple text-white 
                             rounded-lg hover:shadow-lg transform hover:scale-105 
                             transition-all duration-200 font-medium"
                  >
                    <MagnifyingGlassIcon className="w-5 h-5" />
                    <span>MR 검색</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}