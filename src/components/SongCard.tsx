'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Song } from '@/types';
import { MusicalNoteIcon, PlayIcon, PauseIcon, XMarkIcon, VideoCameraIcon, MagnifyingGlassIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { HeartIcon } from '@heroicons/react/24/solid';
import YouTube from 'react-youtube';

// YouTube 플레이어 타입 정의
interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
}

interface SongCardProps {
  song: Song;
  onPlay?: (song: Song) => void;
}

export default function SongCard({ song, onPlay }: SongCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [youtubePlayer, setYoutubePlayer] = useState<YouTubePlayer | null>(null);
  const [playerPosition, setPlayerPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [isXLScreen, setIsXLScreen] = useState(false);

  const languageColors = {
    Korean: 'bg-blue-500',
    English: 'bg-purple-500',
    Japanese: 'bg-pink-500',
  };

  // 키 조절 포맷팅 함수
  const formatKeyAdjustment = (keyAdjustment: number | null | undefined) => {
    if (keyAdjustment === null || keyAdjustment === undefined) return null;
    if (keyAdjustment === 0) return '원본키';
    return keyAdjustment > 0 ? `+${keyAdjustment}키` : `${keyAdjustment}키`;
  };

  // 표시할 제목과 아티스트 결정
  const displayTitle = song.titleAlias || song.title;
  const displayArtist = song.artistAlias || song.artist;

  // YouTube URL에서 비디오 ID 추출
  const getYouTubeVideoId = (url: string) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // MR 링크에서 YouTube URL 찾기
  const getYouTubeMRLink = () => {
    if (!song.mrLinksDetailed || song.mrLinksDetailed.length === 0) return null;
    const selectedMR = song.mrLinksDetailed[song.selectedMRIndex || 0];
    if (!selectedMR) return null;
    
    // URL에 시간 파라미터 추가
    let urlWithTime = selectedMR.url;
    if (selectedMR.skipSeconds && selectedMR.skipSeconds > 0) {
      // 기존 URL에 t 파라미터가 있는지 확인
      const hasTimeParam = urlWithTime.includes('&t=') || urlWithTime.includes('?t=');
      if (!hasTimeParam) {
        const separator = urlWithTime.includes('?') ? '&' : '?';
        urlWithTime = `${urlWithTime}${separator}t=${selectedMR.skipSeconds}`;
      }
    }
    
    const videoId = getYouTubeVideoId(urlWithTime);
    return videoId ? { videoId, skipSeconds: selectedMR.skipSeconds || 0, fullUrl: urlWithTime } : null;
  };

  const youtubeMR = getYouTubeMRLink();

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (youtubeMR) {
      // MR 링크가 있으면 새 창에서 열기
      window.open(youtubeMR.fullUrl, '_blank');
    } else {
      // MR 링크가 없으면 검색 기능 실행
      if (onPlay) {
        onPlay(song);
      }
    }
  };

  const handleModalPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (youtubeMR) {
      // MR 링크가 있을 때만 재생 기능 실행
      if (youtubePlayer && youtubePlayer.playVideo) {
        // 플레이어가 준비되었을 때
        try {
          if (isPlaying) {
            setIsPlaying(false);
            youtubePlayer.pauseVideo();
          } else {
            setIsPlaying(true);
            youtubePlayer.playVideo();
          }
        } catch (error) {
          console.warn('YouTube player error:', error);
        }
      } else {
        // 플레이어가 아직 준비되지 않았을 때 - 영상 탭으로 전환
        setShowVideo(true);
      }
    } else {
      // MR 링크가 없을 때는 검색 기능 실행
      if (onPlay) {
        onPlay(song);
      }
    }
  };

  const handleMRSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlay) {
      onPlay(song);
    }
  };

  const handleOpenInNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (youtubeMR) {
      window.open(youtubeMR.fullUrl, '_blank');
    }
  };

  const onYouTubeReady = (event: { target: YouTubePlayer }) => {
    setYoutubePlayer(event.target);
    // 자동 재생 방지
    event.target.pauseVideo();
    // 초기 상태를 일시정지로 설정
    setIsPlaying(false);
  };

  const onYouTubeStateChange = (event: { data: number }) => {
    // YouTube 플레이어 상태와 동기화
    // -1: 시작되지 않음, 0: 종료, 1: 재생 중, 2: 일시정지, 3: 버퍼링, 5: 동영상 신호
    const playerState = event.data;
    const isCurrentlyPlaying = playerState === 1;
    setIsPlaying(isCurrentlyPlaying);
  };

  const toggleVideoView = () => {
    setShowVideo(!showVideo);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
  };

  // 다이얼로그 열릴 때 body 스크롤 비활성화
  useEffect(() => {
    if (isExpanded) {
      // body 스크롤 비활성화
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = '0px'; // 스크롤바 공간 보정
    } else {
      // body 스크롤 복원
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }

    // 컴포넌트 언마운트 시 정리
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [isExpanded]);

  // 스크롤 이벤트 전파 방지 핸들러 (다중 이벤트 처리)
  const handleScrollPreventPropagation = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  // 화면 크기에 따라 플레이어 위치 계산 (다이얼로그 기준)
  useEffect(() => {
    if (!isExpanded || !youtubeMR) return;

    const updatePlayerPosition = () => {
      const xlScreen = window.innerWidth >= 1280;
      setIsXLScreen(xlScreen);
      
      const dialogContainer = document.querySelector('.youtube-dialog-container');
      let targetContainer = null;
      
      if (xlScreen) {
        targetContainer = document.getElementById('xl-player-target');
      } else if (showVideo) {
        targetContainer = document.getElementById('mobile-player-target');
      }

      if (targetContainer && dialogContainer) {
        const dialogRect = dialogContainer.getBoundingClientRect();
        const targetRect = targetContainer.getBoundingClientRect();
        
        // 다이얼로그 기준 상대 위치 계산
        const relativeTop = targetRect.top - dialogRect.top;
        const relativeLeft = targetRect.left - dialogRect.left;
        
        setPlayerPosition(prev => {
          // 값이 실제로 변경된 경우에만 업데이트 (1px 허용 오차)
          if (Math.abs(prev.top - relativeTop) > 1 || Math.abs(prev.left - relativeLeft) > 1 || 
              Math.abs(prev.width - targetRect.width) > 1 || Math.abs(prev.height - targetRect.height) > 1) {
            return {
              top: relativeTop,
              left: relativeLeft,
              width: targetRect.width,
              height: targetRect.height
            };
          }
          return prev;
        });
      }
    };

    // DOM 렌더링 완료 후 위치 계산
    const timeoutId = setTimeout(updatePlayerPosition, 50);
    window.addEventListener('resize', updatePlayerPosition);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updatePlayerPosition);
    };
  }, [isExpanded, youtubeMR, showVideo]);


  const handleCardClick = () => {
    // 곡 데이터를 콘솔에 출력
    console.group(`🎵 ${song.title} - ${song.artist}`);
    console.log('📋 기본 정보:', {
      title: song.title,
      artist: song.artist,
      language: song.language,
      id: song.id
    });
    
    if (song.titleAlias || song.artistAlias) {
      console.log('🏷️ 별칭 정보:', {
        titleAlias: song.titleAlias,
        artistAlias: song.artistAlias
      });
    }
    
    if (song.sungCount !== undefined || song.lastSungDate || song.isFavorite !== undefined) {
      console.log('📊 활동 정보:', {
        sungCount: song.sungCount,
        lastSungDate: song.lastSungDate,
        isFavorite: song.isFavorite,
        keyAdjustment: song.keyAdjustment
      });
    }
    
    if (song.mrLinks?.length || song.mrLinksDetailed?.length) {
      console.log('🎤 MR 정보:', {
        basicMRLinks: song.mrLinks,
        detailedMRLinks: song.mrLinksDetailed,
        selectedMRIndex: song.selectedMRIndex
      });
    }
    
    if (song.playlists?.length || song.searchTags?.length) {
      console.log('🏷️ 태그/플레이리스트:', {
        tags: song.tags,
        searchTags: song.searchTags,
        playlists: song.playlists
      });
    }
    
    if (song.lyrics) {
      console.log('📝 가사:', song.lyrics.substring(0, 100) + (song.lyrics.length > 100 ? '...' : ''));
    }
    
    if (song.personalNotes) {
      console.log('📝 개인 메모:', song.personalNotes);
    }
    
    console.log('🔍 전체 객체:', song);
    console.groupEnd();
    
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      {/* 확장 시 배경 오버레이 */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={handleCardClick}
        />
      )}
      
      {/* 확장된 모달 */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-10%' }}
          animate={{ opacity: 1, scale: 1, x: '-50%', y: '0%' }}
          exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-10%' }}
          transition={{ duration: 0.3 }}
          className="fixed top-20 left-1/2 z-40 
                     w-[90vw] max-w-7xl h-[calc(100vh-6rem)] overflow-hidden
                     bg-white dark:bg-gray-900 backdrop-blur-sm 
                     rounded-xl border border-light-primary/20 dark:border-dark-primary/20 
                     shadow-2xl transform -translate-x-1/2 youtube-dialog-container"
          style={{ overscrollBehavior: 'contain' }}
          onWheel={handleScrollPreventPropagation}
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
                    className="text-light-text/80 dark:text-dark-text/80 whitespace-pre-line leading-relaxed text-base md:text-lg overflow-y-auto flex-1 min-h-0"
                    style={{ 
                      overscrollBehavior: 'contain' 
                    }}
                    onWheel={handleScrollPreventPropagation}
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
            <div className="flex-1 xl:w-1/2 flex flex-col min-h-0">
              {/* Header */}
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-semibold text-light-text dark:text-dark-text 
                                   text-light-accent dark:text-dark-accent">
                      {displayTitle}
                    </h3>
                    {formatKeyAdjustment(song.keyAdjustment) && (
                      <span className="px-2 py-1 text-sm font-medium rounded-md 
                                     bg-yellow-100 dark:bg-yellow-900 
                                     text-yellow-800 dark:text-yellow-200">
                        {formatKeyAdjustment(song.keyAdjustment)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap mb-1 sm:mb-2">
                    <p className="text-base sm:text-lg md:text-xl text-light-text/70 dark:text-dark-text/70 line-clamp-1">
                      {displayArtist}
                    </p>
                    {song.language && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium text-white 
                                       ${languageColors[song.language as keyof typeof languageColors] || 'bg-gray-500'}`}>
                        {song.language}
                      </span>
                    )}
                    {song.searchTags && song.searchTags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 rounded-full text-xs 
                                 bg-blue-100 dark:bg-blue-900 
                                 text-blue-800 dark:text-blue-200"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLike}
                    className="p-2 rounded-full hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                               transition-colors duration-200"
                  >
                    <HeartIcon 
                      className={`w-5 h-5 transition-colors duration-200 
                                 ${isLiked 
                                   ? 'text-red-500 fill-current' 
                                   : 'text-light-text/40 dark:text-dark-text/40 hover:text-red-400'}`}
                    />
                  </button>
                  <button
                    onClick={handleCardClick}
                    className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/30 
                               transition-colors duration-200"
                    title="닫기"
                  >
                    <XMarkIcon className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>

              {/* Legacy Tags (if exists) */}
              {song.tags && song.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2 sm:mb-4">
                  {song.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 rounded-full text-xs 
                               bg-light-secondary/20 dark:bg-dark-secondary/20 
                               text-light-text/70 dark:text-dark-text/70"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 큰 화면에서의 영상 섹션 - 플레이어 대상 영역 */}
              <div className="hidden xl:flex flex-col flex-1 gap-6 min-h-0">
                {youtubeMR && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="p-6 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 flex flex-col flex-1 min-h-0"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <VideoCameraIcon className="w-6 h-6 text-light-accent dark:text-dark-accent" />
                      <h4 className="text-xl font-semibold text-light-text dark:text-dark-text">MR 영상</h4>
                    </div>
                    <div id="xl-player-target" className="aspect-video w-full flex-1 min-h-0 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      {/* 플레이어가 여기에 CSS로 배치됨 */}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* 작은 화면에서의 기존 토글 섹션 */}
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="xl:hidden p-4 sm:p-6 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 relative flex flex-col flex-1 min-h-0"
              >
                {/* YouTube 플레이어 - MR 링크가 있으면 항상 로드하되 visibility로 제어 */}
                {youtubeMR && (
                  <div className={`${showVideo ? 'flex' : 'hidden'} flex-col flex-1 min-h-0`}>
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <h4 className="text-lg sm:text-xl font-semibold text-light-text dark:text-dark-text flex items-center gap-2 sm:gap-3">
                        <VideoCameraIcon className="w-5 h-5 sm:w-6 sm:h-6 text-light-accent dark:text-dark-accent" />
                        MR 영상
                      </h4>
                      <button
                        onClick={toggleVideoView}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                                 bg-light-primary/20 dark:bg-dark-primary/20 
                                 hover:bg-light-primary/30 dark:hover:bg-dark-primary/30
                                 text-light-text dark:text-dark-text transition-colors duration-200"
                        title="가사 보기"
                      >
                        <MusicalNoteIcon className="w-4 h-4" />
                        <span>가사 보기</span>
                      </button>
                    </div>
                    <div id="mobile-player-target" className="flex-1 w-full min-h-0 aspect-video bg-gray-50 dark:bg-gray-800 rounded-lg">
                      {/* 플레이어가 여기에 CSS로 배치됨 */}
                    </div>
                  </div>
                )}

                {/* 가사 섹션 - 작은 화면에서만 표시 */}
                <div className={`${!showVideo ? 'flex' : 'hidden'} flex-col flex-1 min-h-0`}>
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h4 className="text-lg sm:text-xl font-semibold text-light-text dark:text-dark-text flex items-center gap-2 sm:gap-3">
                      <MusicalNoteIcon className="w-5 h-5 sm:w-6 sm:h-6 text-light-accent dark:text-dark-accent" />
                      가사
                    </h4>
                    {youtubeMR && (
                      <button
                        onClick={toggleVideoView}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                                 bg-light-primary/20 dark:bg-dark-primary/20 
                                 hover:bg-light-primary/30 dark:hover:bg-dark-primary/30
                                 text-light-text dark:text-dark-text transition-colors duration-200"
                        title="영상 보기"
                      >
                        <VideoCameraIcon className="w-4 h-4" />
                        <span>영상 보기</span>
                      </button>
                    )}
                  </div>
                  {song.lyrics ? (
                    <div 
                      className="text-light-text/80 dark:text-dark-text/80 whitespace-pre-line leading-relaxed text-base md:text-lg flex-1 overflow-y-auto min-h-0" 
                      style={{ 
                        overscrollBehavior: 'contain' 
                      }}
                      onWheel={handleScrollPreventPropagation}
                    >
                      {song.lyrics}
                    </div>
                  ) : (
                    <div className="text-center flex-1 flex flex-col items-center justify-center text-light-text/50 dark:text-dark-text/50">
                      <MusicalNoteIcon className="w-16 h-16 mb-4 opacity-30" />
                      <p className="text-lg mb-2">아직 가사가 등록되지 않았습니다</p>
                      <p className="text-base">곧 업데이트될 예정입니다</p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Action buttons */}
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
                      className="px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-light-primary/20 dark:bg-dark-primary/20 
                               hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 
                               transition-colors duration-200 text-light-text dark:text-dark-text
                               flex items-center gap-2"
                      title="MR 검색"
                    >
                      <MagnifyingGlassIcon className="w-5 h-5" />
                      <span className="hidden sm:inline">MR 검색</span>
                    </button>
                    
                    {/* 새 창에서 열기 버튼 */}
                    <button
                      onClick={handleOpenInNewTab}
                      className="px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-light-primary/20 dark:bg-dark-primary/20 
                               hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 
                               transition-colors duration-200 text-light-text dark:text-dark-text
                               flex items-center gap-2"
                      title="새 창에서 MR 열기"
                    >
                      <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                      <span className="hidden sm:inline">새 창으로 열기</span>
                    </button>
                  </>
                ) : (
                  // MR 링크가 없을 때 - 기존 검색 버튼
                  <button
                    onClick={handleModalPlay}
                    className="flex-1 flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 text-base sm:text-lg
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

              {/* Date added */}
              {song.dateAdded && (
                <div className="mt-3 sm:mt-4 text-sm text-light-text/50 dark:text-dark-text/50">
                  추가일: {new Date(song.dateAdded).toLocaleDateString('ko-KR')}
                </div>
              )}
            </div>
          </div>

          {/* 단일 YouTube 플레이어 - Absolute 위치로 이동 */}
          {youtubeMR && (
            <div
              className="absolute z-50 pointer-events-auto"
              style={{
                top: playerPosition.top,
                left: playerPosition.left,
                width: playerPosition.width,
                height: playerPosition.height,
                display: (isXLScreen || showVideo) ? 'block' : 'none'
              }}
            >
              <YouTube
                videoId={youtubeMR.videoId}
                opts={{
                  height: '100%',
                  width: '100%',
                  playerVars: {
                    autoplay: 0,
                    start: youtubeMR.skipSeconds || 0,
                    controls: 1,
                    disablekb: 0,
                    enablejsapi: 1,
                    fs: 1,
                    modestbranding: 1,
                    rel: 0,
                    showinfo: 0,
                    iv_load_policy: 3,
                  },
                }}
                onReady={onYouTubeReady}
                onStateChange={onYouTubeStateChange}
                className="w-full h-full rounded-lg"
              />
            </div>
          )}
        </motion.div>
      )}
      
      {/* 일반 카드 */}
      {!isExpanded && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -5 }}
          transition={{ duration: 0.3 }}
          onClick={handleCardClick}
          className="group relative rounded-xl border border-light-primary/20 dark:border-dark-primary/20 
                     hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer h-52"
        >
          {song.imageUrl ? (
            /* 앨범 이미지가 있을 때 */
            <>
              {/* 앨범 이미지 배경 */}
              <div 
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                style={{ backgroundImage: `url(${song.imageUrl})` }}
              />
              
              {/* 라이트/다크모드별 오버레이 */}
              <div className="absolute inset-0 bg-white/30 dark:bg-black/20 
                              group-hover:bg-white/25 dark:group-hover:bg-black/15 
                              transition-colors duration-300" />
              
              {/* 하단 그라데이션 */}
              <div className="absolute inset-0 bg-gradient-to-t 
                              from-white/60 via-white/15 to-transparent
                              dark:from-black/50 dark:via-black/10 dark:to-transparent" />

              <div className="relative p-6 bg-white/20 dark:bg-gray-900/20 backdrop-blur-[1px] h-full">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="text-lg font-semibold text-light-text dark:text-dark-text 
                                     line-clamp-1 group-hover:text-light-accent dark:group-hover:text-dark-accent 
                                     transition-colors duration-300 flex-1">
                        {displayTitle}
                      </h3>
                      {formatKeyAdjustment(song.keyAdjustment) && (
                        <span className="px-2 py-1 text-xs font-medium rounded-md 
                                       bg-yellow-100 dark:bg-yellow-900 
                                       text-yellow-800 dark:text-yellow-200 flex-shrink-0">
                          {formatKeyAdjustment(song.keyAdjustment)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-light-text/70 dark:text-dark-text/70 mb-3 line-clamp-1">
                      {displayArtist}
                    </p>
                  </div>
                  <button
                    onClick={handleLike}
                    className="p-2 rounded-full hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                               transition-colors duration-200"
                  >
                    <HeartIcon 
                      className={`w-5 h-5 transition-colors duration-200 
                                 ${isLiked 
                                   ? 'text-red-500 fill-current' 
                                   : 'text-light-text/40 dark:text-dark-text/40 hover:text-red-400'}`}
                    />
                  </button>
                </div>

                {/* Language tag */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {song.language && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium text-white 
                                     ${languageColors[song.language as keyof typeof languageColors] || 'bg-gray-500'}`}>
                      {song.language}
                    </span>
                  )}
                </div>

                {/* MR 버튼 - 링크 유무에 따라 다르게 표시 */}
                <div className="mt-auto pt-1 pb-2">
                  <button
                    onClick={handlePlay}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 
                             bg-gradient-to-r from-light-accent to-light-purple 
                             dark:from-dark-accent dark:to-dark-purple text-white 
                             rounded-lg hover:shadow-lg transform hover:scale-105 
                             transition-all duration-200 font-medium"
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
              <div className="absolute inset-0 rounded-xl border-2 border-transparent 
                              group-hover:border-light-accent/20 dark:group-hover:border-dark-accent/20 
                              transition-colors duration-300 pointer-events-none"></div>
            </>
          ) : (
            /* 이미지가 없을 때 - 기존 디자인 */
            <>
              {/* Background gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-light-accent/5 to-light-purple/5 
                              dark:from-dark-accent/5 dark:to-dark-purple/5 opacity-0 
                              group-hover:opacity-100 transition-opacity duration-300"></div>

              <div className="relative p-6 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm h-full">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="text-lg font-semibold text-light-text dark:text-dark-text 
                                     line-clamp-1 group-hover:text-light-accent dark:group-hover:text-dark-accent 
                                     transition-colors duration-300 flex-1">
                        {displayTitle}
                      </h3>
                      {formatKeyAdjustment(song.keyAdjustment) && (
                        <span className="px-2 py-1 text-xs font-medium rounded-md 
                                       bg-yellow-100 dark:bg-yellow-900 
                                       text-yellow-800 dark:text-yellow-200 flex-shrink-0">
                          {formatKeyAdjustment(song.keyAdjustment)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-light-text/70 dark:text-dark-text/70 mb-3 line-clamp-1">
                      {displayArtist}
                    </p>
                  </div>
                  <button
                    onClick={handleLike}
                    className="p-2 rounded-full hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                               transition-colors duration-200"
                  >
                    <HeartIcon 
                      className={`w-5 h-5 transition-colors duration-200 
                                 ${isLiked 
                                   ? 'text-red-500 fill-current' 
                                   : 'text-light-text/40 dark:text-dark-text/40 hover:text-red-400'}`}
                    />
                  </button>
                </div>

                {/* Language tag */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {song.language && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium text-white 
                                     ${languageColors[song.language as keyof typeof languageColors] || 'bg-gray-500'}`}>
                      {song.language}
                    </span>
                  )}
                </div>


                {/* MR 버튼 - 링크 유무에 따라 다르게 표시 */}
                <div className="mt-auto pt-1 pb-2">
                  <button
                    onClick={handlePlay}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 
                             bg-gradient-to-r from-light-accent to-light-purple 
                             dark:from-dark-accent dark:to-dark-purple text-white 
                             rounded-lg hover:shadow-lg transform hover:scale-105 
                             transition-all duration-200 font-medium"
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
              <div className="absolute inset-0 rounded-xl border-2 border-transparent 
                              group-hover:border-light-accent/20 dark:group-hover:border-dark-accent/20 
                              transition-colors duration-300 pointer-events-none"></div>
            </>
          )}
        </motion.div>
      )}
      </>
    );
}