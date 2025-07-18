'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Song } from '@/types';
import { MusicalNoteIcon, PlayIcon, PauseIcon, XMarkIcon, VideoCameraIcon, MagnifyingGlassIcon, ArrowTopRightOnSquareIcon, ListBulletIcon, PencilIcon, CheckIcon, PlusIcon, MinusIcon, TrashIcon, StarIcon } from '@heroicons/react/24/outline';
import { HeartIcon } from '@heroicons/react/24/solid';
import YouTube from 'react-youtube';
import { useLike } from '@/hooks/useLikes';
import { useSongPlaylists } from '@/hooks/useGlobalPlaylists';
import PlaylistContextMenu from './PlaylistContextMenu';
import { useSession } from 'next-auth/react';

// YouTube 플레이어 타입 정의
interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
}

interface SongCardProps {
  song: Song;
  onPlay?: (song: Song) => void;
  showNumber?: boolean;
  number?: number;
}

export default function SongCard({ song, onPlay, showNumber = false, number }: SongCardProps) {
  const { data: session } = useSession();
  const { liked, isLoading: likeLoading, error: likeError, toggleLike } = useLike(song.id);
  const { playlists: songPlaylists } = useSongPlaylists(song.id);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [youtubePlayer, setYoutubePlayer] = useState<YouTubePlayer | null>(null);
  const [playerPosition, setPlayerPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [isXLScreen, setIsXLScreen] = useState(false);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  
  // 편집 모드 상태
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    artist: '',
    titleAlias: '',
    artistAlias: '',
    lyrics: '',
    personalNotes: '',
    keyAdjustment: null as number | null, // null과 0을 구분
    language: '',
    searchTags: [] as string[],
    mrLinks: [] as Array<{
      url: string;
      skipSeconds?: number;
      label?: string;
      duration?: string;
    }>,
    selectedMRIndex: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [newTag, setNewTag] = useState('');
  
  // 관리자 권한 체크
  const isAdmin = session?.user?.isAdmin || false;

  // 편집 모드 진입 시 데이터 초기화
  const initializeEditData = () => {
    const mrLinks = song.mrLinks || [];
    setEditData({
      title: song.title || '', // 원본 제목 (참조용)
      artist: song.artist || '', // 원본 아티스트 (참조용)
      titleAlias: displayTitle, // 현재 표시되는 제목 (alias 우선)
      artistAlias: displayArtist, // 현재 표시되는 아티스트 (alias 우선)
      lyrics: song.lyrics || '',
      personalNotes: song.personalNotes || '',
      keyAdjustment: song.keyAdjustment ?? null, // null과 0을 구분
      language: song.language || '',
      searchTags: song.searchTags || [],
      mrLinks: mrLinks.length > 0 ? mrLinks.map(link => ({
        url: link.url || '',
        skipSeconds: link.skipSeconds || 0,
        label: link.label || '',
        duration: link.duration || '',
      })) : [{ url: '', skipSeconds: 0, label: '', duration: '' }],
      selectedMRIndex: song.selectedMRIndex || 0,
    });
  };

  // 편집 모드 토글
  const toggleEditMode = () => {
    if (!isEditMode) {
      initializeEditData();
    }
    setIsEditMode(!isEditMode);
  };

  // 태그 관리 함수들
  const addTag = () => {
    if (newTag.trim() && !editData.searchTags.includes(newTag.trim())) {
      setEditData({
        ...editData,
        searchTags: [...editData.searchTags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setEditData({
      ...editData,
      searchTags: editData.searchTags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  // 편집 데이터 저장
  const saveEditData = async () => {
    if (!song.id) return;
    
    setIsSaving(true);
    try {
      // 저장할 데이터 준비 - alias 로직 처리
      const saveData = {
        ...editData,
        // 제목: 기본값과 다르면 alias로 저장, 같거나 비어있으면 alias 삭제
        titleAlias: (!editData.titleAlias.trim() || editData.titleAlias.trim() === song.title.trim()) ? null : editData.titleAlias.trim(),
        // 아티스트: 기본값과 다르면 alias로 저장, 같거나 비어있으면 alias 삭제  
        artistAlias: (!editData.artistAlias.trim() || editData.artistAlias.trim() === song.artist.trim()) ? null : editData.artistAlias.trim(),
        // MR 링크: 빈 URL 제거 후 저장
        mrLinks: editData.mrLinks.filter(link => link.url.trim() !== ''),
      };
      
      // 기본값은 제거 (수정 불가능)
      delete saveData.title;
      delete saveData.artist;

      // 디버깅을 위한 로깅
      console.log('🚀 저장할 데이터:', JSON.stringify(saveData, null, 2));
      console.log('🚀 MR 링크 데이터:', saveData.mrLinks);

      const response = await fetch(`/api/songdetails/${song.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saveData),
      });

      const result = await response.json();

      if (result.success) {
        // 성공적으로 저장되면 song 객체를 업데이트
        console.log('✅ 저장 성공, 반환된 데이터:', result.song);
        console.log('✅ 기존 song 객체:', song);
        Object.assign(song, result.song);
        console.log('✅ 업데이트된 song 객체:', song);
        
        // 강제 리렌더링 트리거
        setForceUpdate(prev => prev + 1);
        setIsEditMode(false);
        alert('곡 정보가 성공적으로 수정되었습니다.');
      } else {
        alert(result.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 편집 취소
  const cancelEdit = () => {
    setIsEditMode(false);
    initializeEditData();
  };

  // MR 링크 관리 함수들
  const addMRLink = () => {
    setEditData({
      ...editData,
      mrLinks: [...editData.mrLinks, { url: '', skipSeconds: 0, label: '', duration: '' }]
    });
  };

  const removeMRLink = (index: number) => {
    if (editData.mrLinks.length > 1) {
      const newLinks = editData.mrLinks.filter((_, i) => i !== index);
      setEditData({
        ...editData,
        mrLinks: newLinks,
        selectedMRIndex: Math.min(editData.selectedMRIndex, newLinks.length - 1)
      });
    }
  };

  const updateMRLink = (index: number, field: string, value: string | number) => {
    const updatedLinks = editData.mrLinks.map((link, i) => 
      i === index ? { ...link, [field]: value } : link
    );
    setEditData({
      ...editData,
      mrLinks: updatedLinks
    });
  };

  const setMainMRLink = (index: number) => {
    setEditData({
      ...editData,
      selectedMRIndex: index
    });
  };

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
    // mrLinks 사용
    const mrLinks = song.mrLinks;
    if (!mrLinks || mrLinks.length === 0) return null;
    const selectedMR = mrLinks[song.selectedMRIndex || 0];
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
      handleMRSearch(e);
    }
  };

  const handleModalPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (youtubeMR) {
      // MR 링크가 있을 때만 재생 기능 실행
      if (youtubePlayer && typeof youtubePlayer.playVideo === 'function' && typeof youtubePlayer.pauseVideo === 'function') {
        // 플레이어가 준비되었을 때
        try {
          if (isPlaying) {
            youtubePlayer.pauseVideo();
            setIsPlaying(false);
          } else {
            youtubePlayer.playVideo();
            setIsPlaying(true);
          }
        } catch (error) {
          console.warn('YouTube player control error:', error);
          // 에러 발생 시 영상 탭으로 전환
          setShowVideo(true);
        }
      } else {
        // 플레이어가 아직 준비되지 않았을 때 - 영상 탭으로 전환
        console.log('YouTube player not ready, showing video tab');
        setShowVideo(true);
      }
    } else {
      // MR 링크가 없을 때는 검색 기능 실행
      handleMRSearch(e);
    }
  };

  const handleMRSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 직접 YouTube 검색 수행 (더 안정적)
    const searchQuery = encodeURIComponent(`${displayTitle} ${displayArtist} karaoke MR`);
    window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
  };

  const handleOpenInNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (youtubeMR) {
      window.open(youtubeMR.fullUrl, '_blank');
    }
  };

  const onYouTubeReady = (event: { target: YouTubePlayer }) => {
    console.log('YouTube player ready:', event.target);
    setYoutubePlayer(event.target);
    
    // 플레이어가 준비되면 자동 재생 방지
    try {
      if (event.target && typeof event.target.pauseVideo === 'function') {
        // 약간의 지연 후 일시정지 (플레이어 초기화 완료 대기)
        setTimeout(() => {
          try {
            event.target.pauseVideo();
            setIsPlaying(false);
          } catch (err) {
            console.warn('Failed to pause video on ready:', err);
          }
        }, 100);
      }
    } catch (error) {
      console.warn('YouTube player ready error:', error);
    }
  };

  const onYouTubeStateChange = (event: { data: number }) => {
    try {
      // YouTube 플레이어 상태와 동기화
      // -1: 시작되지 않음, 0: 종료, 1: 재생 중, 2: 일시정지, 3: 버퍼링, 5: 동영상 신호
      const playerState = event.data;
      const isCurrentlyPlaying = playerState === 1;
      setIsPlaying(isCurrentlyPlaying);
    } catch (error) {
      console.warn('YouTube state change error:', error);
    }
  };

  const toggleVideoView = () => {
    setShowVideo(!showVideo);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleLike();
  };

  const handlePlaylistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 로그인하지 않은 경우 플레이리스트 메뉴 표시하지 않음
    if (!songPlaylists && songPlaylists.length === 0) {
      console.log('🔒 로그인이 필요한 기능입니다');
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({
      x: rect.left,
      y: rect.bottom + 8
    });
    setShowPlaylistMenu(true);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({
      x: e.clientX,
      y: e.clientY
    });
    setShowPlaylistMenu(true);
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
      // 모달이 닫힐 때 YouTube 플레이어 초기화
      setYoutubePlayer(null);
      setIsPlaying(false);
      setShowVideo(false);
    }

    // 컴포넌트 언마운트 시 정리
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      setYoutubePlayer(null);
      setIsPlaying(false);
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
    
    if (song.mrLinks?.length) {
      console.log('🎤 MR 정보:', {
        mrLinks: song.mrLinks,
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
    
    // 다이얼로그 닫을 때 편집 모드 및 비디오 상태 초기화
    if (isExpanded) {
      setIsEditMode(false);
      setShowVideo(false);
    }
    
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
                {isEditMode ? (
                  <textarea
                    value={editData.lyrics}
                    onChange={(e) => setEditData({...editData, lyrics: e.target.value})}
                    className="text-light-text/80 dark:text-dark-text/80 whitespace-pre-line leading-relaxed text-base md:text-lg 
                               bg-transparent border border-light-accent/30 dark:border-dark-accent/30 rounded-lg p-4 
                               outline-none resize-none flex-1 min-h-0"
                    placeholder="가사를 입력하세요..."
                  />
                ) : (
                  song.lyrics ? (
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
                  )
                )}
              </div>
            </div>

            {/* 오른쪽: 모든 다른 요소들 */}
            <div className="flex-1 xl:w-1/2 flex flex-col min-h-0">
              {/* Header */}
              <div className="mb-3 sm:mb-4">
                {isEditMode ? (
                  /* 편집 모드 - 세로 레이아웃 */
                  <div className="space-y-4">
                    {/* 편집 액션 버튼들 - 맨 위에 배치 */}
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-light-accent dark:text-dark-accent">곡 정보 편집</h4>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveEditData}
                          disabled={isSaving}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 
                                     transition-colors duration-200 disabled:opacity-50 text-green-600 dark:text-green-400"
                          title="저장"
                        >
                          {isSaving ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-4 h-4 border-2 border-green-600/30 border-t-green-600 rounded-full"
                            />
                          ) : (
                            <CheckIcon className="w-4 h-4" />
                          )}
                          <span className="text-sm font-medium">저장</span>
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={isSaving}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 
                                     transition-colors duration-200 disabled:opacity-50 text-gray-600 dark:text-gray-400"
                          title="취소"
                        >
                          <XMarkIcon className="w-4 h-4" />
                          <span className="text-sm font-medium">취소</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* 곡 제목 */}
                    <div>
                      <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">곡 제목</label>
                      <input
                        type="text"
                        value={editData.titleAlias}
                        onChange={(e) => setEditData({...editData, titleAlias: e.target.value})}
                        className="w-full text-xl sm:text-2xl font-semibold text-light-accent dark:text-dark-accent 
                                   bg-transparent border-b-2 border-light-accent dark:border-dark-accent 
                                   outline-none pb-1"
                        placeholder="곡 제목"
                      />
                    </div>
                    
                    {/* 아티스트 */}
                    <div>
                      <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">아티스트</label>
                      <input
                        type="text"
                        value={editData.artistAlias}
                        onChange={(e) => setEditData({...editData, artistAlias: e.target.value})}
                        className="w-full text-lg text-light-text/70 dark:text-dark-text/70 
                                   bg-transparent border-b border-light-accent/50 dark:border-dark-accent/50 
                                   outline-none pb-1"
                        placeholder="아티스트"
                      />
                    </div>
                    
                    {/* 키 조절과 언어 - 나란히 배치 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">키 조절</label>
                        <div className="flex items-center gap-2 bg-light-primary/10 dark:bg-dark-primary/10 rounded-lg p-2">
                          <button
                            onClick={() => setEditData({...editData, keyAdjustment: editData.keyAdjustment === null ? -1 : Math.max(-12, editData.keyAdjustment - 1)})}
                            className="p-1 rounded-md hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                                       transition-colors duration-200"
                            title="키 내리기"
                          >
                            <MinusIcon className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                          </button>
                          <span className="px-3 py-1 text-sm font-medium min-w-[4rem] text-center
                                         bg-yellow-100 dark:bg-yellow-900 
                                         text-yellow-800 dark:text-yellow-200 rounded-md">
                            {editData.keyAdjustment === null ? '미등록' : formatKeyAdjustment(editData.keyAdjustment) || '원본키'}
                          </span>
                          <button
                            onClick={() => setEditData({...editData, keyAdjustment: editData.keyAdjustment === null ? 1 : Math.min(12, editData.keyAdjustment + 1)})}
                            className="p-1 rounded-md hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                                       transition-colors duration-200"
                            title="키 올리기"
                          >
                            <PlusIcon className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                          </button>
                          <button
                            onClick={() => setEditData({...editData, keyAdjustment: 0})}
                            className="ml-2 px-2 py-1 text-xs rounded-md bg-blue-500/20 hover:bg-blue-500/30 
                                       transition-colors duration-200 text-blue-600 dark:text-blue-400"
                            title="원본키로 설정"
                          >
                            원본키
                          </button>
                          <button
                            onClick={() => setEditData({...editData, keyAdjustment: null})}
                            className="px-2 py-1 text-xs rounded-md bg-gray-500/20 hover:bg-gray-500/30 
                                       transition-colors duration-200 text-gray-600 dark:text-gray-400"
                            title="키 정보 삭제"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">언어</label>
                        <select
                          value={editData.language}
                          onChange={(e) => setEditData({...editData, language: e.target.value})}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-light-accent/50 dark:border-dark-accent/50 
                                     rounded-lg outline-none text-light-text dark:text-dark-text"
                        >
                          <option value="">선택안함</option>
                          <option value="Korean">한국어</option>
                          <option value="English">영어</option>
                          <option value="Japanese">일본어</option>
                          <option value="Chinese">중국어</option>
                          <option value="Other">기타</option>
                        </select>
                      </div>
                    </div>

                    {/* 검색 태그 편집 */}
                    <div>
                      <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">검색 태그</label>
                      <div className="space-y-3">
                        {/* 새 태그 추가 */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 relative">
                            <input
                              type="text"
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              onKeyPress={handleTagKeyPress}
                              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 
                                         border border-light-accent/50 dark:border-dark-accent/50 
                                         rounded-lg outline-none text-light-text dark:text-dark-text
                                         focus:border-light-accent dark:focus:border-dark-accent
                                         focus:ring-1 focus:ring-light-accent dark:focus:ring-dark-accent"
                              placeholder="새 태그 입력 (Enter로 추가)"
                            />
                          </div>
                          <button
                            onClick={addTag}
                            disabled={!newTag.trim() || editData.searchTags.includes(newTag.trim())}
                            className="px-3 py-2 rounded-lg bg-light-accent/20 hover:bg-light-accent/30 
                                       dark:bg-dark-accent/20 dark:hover:bg-dark-accent/30
                                       transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                                       text-light-accent dark:text-dark-accent"
                            title="태그 추가"
                          >
                            <PlusIcon className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* 기존 태그들 */}
                        <div className="flex flex-wrap gap-2">
                          {editData.searchTags.map((tag, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 
                                         text-blue-800 dark:text-blue-200 text-sm"
                            >
                              <span>#{tag}</span>
                              <button
                                onClick={() => removeTag(tag)}
                                className="p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 
                                           transition-colors duration-200"
                                title="태그 삭제"
                              >
                                <XMarkIcon className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {editData.searchTags.length === 0 && (
                            <span className="text-light-text/50 dark:text-dark-text/50 text-sm italic">
                              검색 태그가 없습니다
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 일반 모드 - 기존 레이아웃 */
                  <div className="flex items-start justify-between">
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
                        {songPlaylists.map((playlist) => (
                          <span
                            key={playlist._id}
                            className="px-2 py-1 rounded-full text-xs 
                                     bg-purple-100 dark:bg-purple-900 
                                     text-purple-800 dark:text-purple-200"
                          >
                            🎵 {playlist.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <button
                          onClick={toggleEditMode}
                          className="p-2 rounded-full hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                                     transition-colors duration-200"
                          title="편집"
                        >
                          <PencilIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
                        </button>
                      )}
                      <button
                        onClick={handlePlaylistClick}
                        className="p-2 rounded-full hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                                   transition-colors duration-200"
                        title="플레이리스트 관리"
                      >
                        <ListBulletIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
                      </button>
                      <button
                        onClick={handleLike}
                        disabled={likeLoading}
                        className="p-2 rounded-full hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                                   transition-colors duration-200 disabled:opacity-50"
                        title={liked ? '좋아요 취소' : '좋아요'}
                      >
                        <HeartIcon 
                          className={`w-5 h-5 transition-all duration-200 
                                     ${likeLoading 
                                       ? 'text-red-400 fill-current opacity-60 animate-pulse scale-110' 
                                       : liked 
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
                )}
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
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="p-6 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 flex flex-col flex-1 min-h-0"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <VideoCameraIcon className="w-6 h-6 text-light-accent dark:text-dark-accent" />
                    <h4 className="text-xl font-semibold text-light-text dark:text-dark-text">
                      {isEditMode ? "MR 링크 관리" : "MR 영상"}
                    </h4>
                  </div>
                  
                  {isEditMode ? (
                    /* MR 링크 편집 UI - XL 화면 */
                    <div className="flex-1 space-y-4 overflow-y-auto min-h-0">
                      {editData.mrLinks.map((link, index) => (
                        <div key={index} className="p-4 bg-light-primary/10 dark:bg-dark-primary/10 rounded-lg border border-light-primary/20 dark:border-dark-primary/20">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setMainMRLink(index)}
                                className={`p-1 rounded-full transition-colors duration-200 ${
                                  editData.selectedMRIndex === index
                                    ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                                    : 'bg-gray-500/20 text-gray-600 dark:text-gray-400 hover:bg-gray-500/30'
                                }`}
                                title={editData.selectedMRIndex === index ? "메인 MR" : "메인으로 설정"}
                              >
                                <StarIcon className="w-4 h-4" />
                              </button>
                              <span className="text-sm font-medium text-light-text/70 dark:text-dark-text/70">
                                MR 링크 {index + 1}
                                {editData.selectedMRIndex === index && (
                                  <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">(메인)</span>
                                )}
                              </span>
                            </div>
                            {editData.mrLinks.length > 1 && (
                              <button
                                onClick={() => removeMRLink(index)}
                                className="p-1 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30 transition-colors duration-200"
                                title="삭제"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-light-text/70 dark:text-dark-text/70 mb-1">URL</label>
                              <input
                                type="url"
                                value={link.url}
                                onChange={(e) => updateMRLink(index, 'url', e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-light-accent/50 dark:border-dark-accent/50 
                                           rounded-md outline-none text-light-text dark:text-dark-text"
                                placeholder="https://youtube.com/watch?v=..."
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-light-text/70 dark:text-dark-text/70 mb-1">시작 시간 (초)</label>
                                <input
                                  type="number"
                                  value={link.skipSeconds}
                                  onChange={(e) => updateMRLink(index, 'skipSeconds', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-light-accent/50 dark:border-dark-accent/50 
                                             rounded-md outline-none text-light-text dark:text-dark-text"
                                  min="0"
                                  placeholder="0"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-light-text/70 dark:text-dark-text/70 mb-1">라벨</label>
                                <input
                                  type="text"
                                  value={link.label}
                                  onChange={(e) => updateMRLink(index, 'label', e.target.value)}
                                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-light-accent/50 dark:border-dark-accent/50 
                                             rounded-md outline-none text-light-text dark:text-dark-text"
                                  placeholder="공식 MR"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <div className="flex gap-2">
                        <button
                          onClick={addMRLink}
                          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed 
                                     border-light-accent/50 dark:border-dark-accent/50 rounded-lg
                                     text-light-accent dark:text-dark-accent hover:bg-light-accent/10 dark:hover:bg-dark-accent/10
                                     transition-colors duration-200"
                        >
                          <PlusIcon className="w-5 h-5" />
                          <span>MR 링크 추가</span>
                        </button>
                        <button
                          onClick={handleMRSearch}
                          className="px-4 py-3 bg-light-secondary/20 dark:bg-dark-secondary/20 
                                     hover:bg-light-secondary/30 dark:hover:bg-dark-secondary/30
                                     text-light-text dark:text-dark-text rounded-lg
                                     transition-colors duration-200 flex items-center gap-2"
                          title="YouTube에서 MR 검색"
                        >
                          <MagnifyingGlassIcon className="w-5 h-5" />
                          <span>MR 검색</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 기존 YouTube 플레이어 */
                    youtubeMR && (
                      <div id="xl-player-target" className="aspect-video w-full flex-1 min-h-0 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        {/* 플레이어가 여기에 CSS로 배치됨 */}
                      </div>
                    )
                  )}
                </motion.div>
              </div>

              {/* 작은 화면에서의 기존 토글 섹션 */}
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="xl:hidden p-4 sm:p-6 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 relative flex flex-col flex-1 min-h-0"
              >
                {/* MR 영상/편집 영역 */}
                <div className={`${showVideo ? 'flex' : 'hidden'} flex-col flex-1 min-h-0`}>
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h4 className="text-lg sm:text-xl font-semibold text-light-text dark:text-dark-text flex items-center gap-2 sm:gap-3">
                      <VideoCameraIcon className="w-5 h-5 sm:w-6 sm:h-6 text-light-accent dark:text-dark-accent" />
                      {isEditMode ? "MR 링크 관리" : "MR 영상"}
                    </h4>
                    <button
                      onClick={toggleVideoView}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                               bg-light-primary/20 dark:bg-dark-primary/20 
                               hover:bg-light-primary/30 dark:hover:bg-dark-primary/30
                               text-light-text dark:text-dark-text transition-colors duration-200"
                      title={isEditMode ? "가사 수정" : "가사 보기"}
                    >
                      <MusicalNoteIcon className="w-4 h-4" />
                      <span>{isEditMode ? "가사 수정" : "가사 보기"}</span>
                    </button>
                  </div>
                  
                  {isEditMode ? (
                    /* MR 링크 편집 UI */
                    <div className="flex-1 space-y-4 overflow-y-auto min-h-0">
                      {editData.mrLinks.map((link, index) => (
                        <div key={index} className="p-4 bg-light-primary/10 dark:bg-dark-primary/10 rounded-lg border border-light-primary/20 dark:border-dark-primary/20">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setMainMRLink(index)}
                                className={`p-1 rounded-full transition-colors duration-200 ${
                                  editData.selectedMRIndex === index
                                    ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                                    : 'bg-gray-500/20 text-gray-600 dark:text-gray-400 hover:bg-gray-500/30'
                                }`}
                                title={editData.selectedMRIndex === index ? "메인 MR" : "메인으로 설정"}
                              >
                                <StarIcon className="w-4 h-4" />
                              </button>
                              <span className="text-sm font-medium text-light-text/70 dark:text-dark-text/70">
                                MR 링크 {index + 1}
                                {editData.selectedMRIndex === index && (
                                  <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">(메인)</span>
                                )}
                              </span>
                            </div>
                            {editData.mrLinks.length > 1 && (
                              <button
                                onClick={() => removeMRLink(index)}
                                className="p-1 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30 transition-colors duration-200"
                                title="삭제"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-light-text/70 dark:text-dark-text/70 mb-1">URL</label>
                              <input
                                type="url"
                                value={link.url}
                                onChange={(e) => updateMRLink(index, 'url', e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-light-accent/50 dark:border-dark-accent/50 
                                           rounded-md outline-none text-light-text dark:text-dark-text"
                                placeholder="https://youtube.com/watch?v=..."
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-light-text/70 dark:text-dark-text/70 mb-1">시작 시간 (초)</label>
                                <input
                                  type="number"
                                  value={link.skipSeconds}
                                  onChange={(e) => updateMRLink(index, 'skipSeconds', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-light-accent/50 dark:border-dark-accent/50 
                                             rounded-md outline-none text-light-text dark:text-dark-text"
                                  min="0"
                                  placeholder="0"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-light-text/70 dark:text-dark-text/70 mb-1">라벨</label>
                                <input
                                  type="text"
                                  value={link.label}
                                  onChange={(e) => updateMRLink(index, 'label', e.target.value)}
                                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-light-accent/50 dark:border-dark-accent/50 
                                             rounded-md outline-none text-light-text dark:text-dark-text"
                                  placeholder="공식 MR"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <div className="flex gap-2">
                        <button
                          onClick={addMRLink}
                          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed 
                                     border-light-accent/50 dark:border-dark-accent/50 rounded-lg
                                     text-light-accent dark:text-dark-accent hover:bg-light-accent/10 dark:hover:bg-dark-accent/10
                                     transition-colors duration-200"
                        >
                          <PlusIcon className="w-5 h-5" />
                          <span>MR 링크 추가</span>
                        </button>
                        <button
                          onClick={handleMRSearch}
                          className="px-4 py-3 bg-light-secondary/20 dark:bg-dark-secondary/20 
                                     hover:bg-light-secondary/30 dark:hover:bg-dark-secondary/30
                                     text-light-text dark:text-dark-text rounded-lg
                                     transition-colors duration-200 flex items-center gap-2"
                          title="YouTube에서 MR 검색"
                        >
                          <MagnifyingGlassIcon className="w-5 h-5" />
                          <span className="hidden sm:inline">MR 검색</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 기존 YouTube 플레이어 */
                    youtubeMR && (
                      <div id="mobile-player-target" className="flex-1 w-full min-h-0 aspect-video bg-gray-50 dark:bg-gray-800 rounded-lg">
                        {/* 플레이어가 여기에 CSS로 배치됨 */}
                      </div>
                    )
                  )}
                </div>

                {/* 가사 섹션 - 작은 화면에서만 표시 */}
                <div className={`${!showVideo ? 'flex' : 'hidden'} flex-col flex-1 min-h-0`}>
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h4 className="text-lg sm:text-xl font-semibold text-light-text dark:text-dark-text flex items-center gap-2 sm:gap-3">
                      <MusicalNoteIcon className="w-5 h-5 sm:w-6 sm:h-6 text-light-accent dark:text-dark-accent" />
                      가사
                    </h4>
                    <button
                      onClick={toggleVideoView}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                               bg-light-primary/20 dark:bg-dark-primary/20 
                               hover:bg-light-primary/30 dark:hover:bg-dark-primary/30
                               text-light-text dark:text-dark-text transition-colors duration-200"
                      title={isEditMode ? "MR 링크 수정" : "영상 보기"}
                    >
                      <VideoCameraIcon className="w-4 h-4" />
                      <span>{isEditMode ? "MR 링크 수정" : "영상 보기"}</span>
                    </button>
                  </div>
                  {isEditMode ? (
                    <textarea
                      value={editData.lyrics}
                      onChange={(e) => setEditData({...editData, lyrics: e.target.value})}
                      className="text-light-text/80 dark:text-dark-text/80 whitespace-pre-line leading-relaxed text-base md:text-lg 
                                 bg-transparent border border-light-accent/30 dark:border-dark-accent/30 rounded-lg p-4 
                                 outline-none resize-none flex-1 min-h-0"
                      placeholder="가사를 입력하세요..."
                    />
                  ) : (
                    song.lyrics ? (
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
                    )
                  )}
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
                      className="px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-light-primary/20 dark:bg-dark-primary/20 
                               hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 
                               transition-colors duration-200 text-light-text dark:text-dark-text
                               flex items-center gap-2"
                      title="YouTube에서 MR 검색"
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
                    onClick={handleMRSearch}
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
              )}

              {/* Date added - 편집 모드가 아닐 때만 표시 */}
              {!isEditMode && song.dateAdded && (
                <div className="mt-3 sm:mt-4 text-sm text-light-text/50 dark:text-dark-text/50">
                  추가일: {new Date(song.dateAdded).toLocaleDateString('ko-KR')}
                </div>
              )}
            </div>
          </div>

          {/* 단일 YouTube 플레이어 - Absolute 위치로 이동 */}
          {youtubeMR && !isEditMode && (
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
                key={`youtube-${song.id}-${youtubeMR.videoId}`}
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
                onError={(error) => {
                  console.warn('YouTube player error:', error);
                  setYoutubePlayer(null);
                  setIsPlaying(false);
                }}
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
          onContextMenu={handleContextMenu}
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
                        {showNumber && number && (
                          <span className="text-light-accent dark:text-dark-accent font-bold mr-2">
                            {number}.
                          </span>
                        )}
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
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={handleLike}
                      disabled={likeLoading}
                      className="p-2 rounded-full hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                                 transition-colors duration-200 disabled:opacity-50"
                      title={liked ? '좋아요 취소' : '좋아요'}
                    >
                      <HeartIcon 
                        className={`w-5 h-5 transition-all duration-200 
                                   ${likeLoading 
                                     ? 'text-red-400 fill-current opacity-60 animate-pulse scale-110' 
                                     : liked 
                                       ? 'text-red-500 fill-current' 
                                       : 'text-light-text/40 dark:text-dark-text/40 hover:text-red-400'}`}
                      />
                    </button>
                    <button
                      onClick={handlePlaylistClick}
                      className="p-2 rounded-full hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                                 transition-colors duration-200"
                      title="플레이리스트 관리"
                    >
                      <ListBulletIcon className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                    </button>
                  </div>
                </div>

                {/* Language tag and playlist badges */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {song.language && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium text-white 
                                     ${languageColors[song.language as keyof typeof languageColors] || 'bg-gray-500'}`}>
                      {song.language}
                    </span>
                  )}
                  {songPlaylists.slice(0, 2).map((playlist) => (
                    <span
                      key={playlist._id}
                      className="px-2 py-1 rounded-full text-xs font-medium
                               bg-purple-100 dark:bg-purple-900 
                               text-purple-800 dark:text-purple-200"
                    >
                      🎵 {playlist.name}
                    </span>
                  ))}
                  {songPlaylists.length > 2 && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium
                                   bg-gray-100 dark:bg-gray-800 
                                   text-gray-600 dark:text-gray-400">
                      +{songPlaylists.length - 2}
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
                        {showNumber && number && (
                          <span className="text-light-accent dark:text-dark-accent font-bold mr-2">
                            {number}.
                          </span>
                        )}
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
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={handleLike}
                      disabled={likeLoading}
                      className="p-2 rounded-full hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                                 transition-colors duration-200 disabled:opacity-50"
                      title={liked ? '좋아요 취소' : '좋아요'}
                    >
                      <HeartIcon 
                        className={`w-5 h-5 transition-all duration-200 
                                   ${likeLoading 
                                     ? 'text-red-400 fill-current opacity-60 animate-pulse scale-110' 
                                     : liked 
                                       ? 'text-red-500 fill-current' 
                                       : 'text-light-text/40 dark:text-dark-text/40 hover:text-red-400'}`}
                      />
                    </button>
                    <button
                      onClick={handlePlaylistClick}
                      className="p-2 rounded-full hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                                 transition-colors duration-200"
                      title="플레이리스트 관리"
                    >
                      <ListBulletIcon className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                    </button>
                  </div>
                </div>

                {/* Language tag and playlist badges */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {song.language && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium text-white 
                                     ${languageColors[song.language as keyof typeof languageColors] || 'bg-gray-500'}`}>
                      {song.language}
                    </span>
                  )}
                  {songPlaylists.slice(0, 2).map((playlist) => (
                    <span
                      key={playlist._id}
                      className="px-2 py-1 rounded-full text-xs font-medium
                               bg-purple-100 dark:bg-purple-900 
                               text-purple-800 dark:text-purple-200"
                    >
                      🎵 {playlist.name}
                    </span>
                  ))}
                  {songPlaylists.length > 2 && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium
                                   bg-gray-100 dark:bg-gray-800 
                                   text-gray-600 dark:text-gray-400">
                      +{songPlaylists.length - 2}
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
      
      {/* 플레이리스트 컨텍스트 메뉴 */}
      <PlaylistContextMenu
        songId={song.id}
        isOpen={showPlaylistMenu}
        position={menuPosition}
        onClose={() => setShowPlaylistMenu(false)}
      />
      </>
    );
}