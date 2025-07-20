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
import LiveClipManager from './LiveClipManager';
import SongEditForm from './SongEditForm';
import TagManager from './TagManager';
import MRLinkManager from './MRLinkManager';
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
  onDialogStateChange?: (isOpen: boolean) => void;
}

export default function SongCard({ song, onPlay, showNumber = false, number, onDialogStateChange }: SongCardProps) {
  const { data: session } = useSession();
  const { liked, isLoading: likeLoading, error: likeError, toggleLike } = useLike(song.id);
  const { playlists: songPlaylists } = useSongPlaylists(song.id);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTab, setCurrentTab] = useState<'lyrics' | 'mr' | 'videos'>('lyrics');
  const [youtubePlayer, setYoutubePlayer] = useState<YouTubePlayer | null>(null);
  const [isXLScreen, setIsXLScreen] = useState(false);
  const [playerPosition, setPlayerPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  
  // 편집 모드 상태
  const [isEditMode, setIsEditMode] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  
  // 임시 편집 관련 상태 (제거 예정)
  const [editData, setEditData] = useState({
    titleAlias: '',
    artistAlias: '',
    keyAdjustment: null as number | null,
    language: '',
    searchTags: [] as string[],
    mrLinks: [] as Array<{
      url: string;
      skipSeconds?: number;
      label?: string;
      duration?: string;
    }>,
    selectedMRIndex: 0,
    lyrics: ''
  });
  
  // 관리자 권한 체크
  const isAdmin = session?.user?.isAdmin || false;

  // 편집 데이터 초기화
  useEffect(() => {
    if (isEditMode) {
      setEditData({
        titleAlias: song.titleAlias || song.title,
        artistAlias: song.artistAlias || song.artist,
        keyAdjustment: song.keyAdjustment ?? null,
        language: song.language || '',
        searchTags: song.searchTags || [],
        mrLinks: song.mrLinks && song.mrLinks.length > 0 
          ? song.mrLinks.map(link => ({
              url: link.url || '',
              skipSeconds: link.skipSeconds || 0,
              label: link.label || '',
              duration: link.duration || ''
            }))
          : [{ url: '', skipSeconds: 0, label: '', duration: '' }],
        selectedMRIndex: song.selectedMRIndex || 0,
        lyrics: song.lyrics || ''
      });
    }
  }, [isEditMode, song]);

  // XL 화면에서는 MR 탭을 기본으로 설정
  useEffect(() => {
    const updateDefaultTab = () => {
      const isXL = window.innerWidth >= 1280;
      if (isExpanded && isXL && currentTab === 'lyrics') {
        // XL 화면에서 가사 탭이 선택되어 있으면 MR 탭으로 변경
        setCurrentTab('mr');
      }
    };
    
    // 다이얼로그가 열릴 때 실행
    if (isExpanded) {
      updateDefaultTab();
      // 화면 크기 변경 감지
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
    setForceUpdate(prev => prev + 1);
    setIsEditMode(false);
  };

  // 편집 취소 핸들러
  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  // 편집 데이터 저장
  const saveEditData = async () => {
    if (!song.id) return;
    
    setIsSaving(true);
    try {
      // 저장할 데이터 준비 - alias 로직 처리
      const saveData = {
        ...editData,
        titleAlias: (!editData.titleAlias.trim() || editData.titleAlias.trim() === song.title.trim()) ? null : editData.titleAlias.trim(),
        artistAlias: (!editData.artistAlias.trim() || editData.artistAlias.trim() === song.artist.trim()) ? null : editData.artistAlias.trim(),
        mrLinks: editData.mrLinks.filter(link => link.url.trim() !== ''),
      };
      
      // 기본값은 제거 (수정 불가능)
      delete saveData.title;
      delete saveData.artist;

      console.log('🚀 저장할 데이터:', JSON.stringify(saveData, null, 2));

      const response = await fetch(`/api/songdetails/${song.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saveData),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ 저장 성공, 반환된 데이터:', result.song);
        // 곡 데이터 업데이트
        Object.assign(song, result.song);
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
    // 편집 데이터 초기화
    setEditData({
      titleAlias: song.titleAlias || song.title,
      artistAlias: song.artistAlias || song.artist,
      keyAdjustment: song.keyAdjustment ?? null,
      language: song.language || '',
      searchTags: song.searchTags || [],
      mrLinks: song.mrLinks || [{ url: '', skipSeconds: 0, label: '', duration: '' }],
      selectedMRIndex: song.selectedMRIndex || 0,
      lyrics: song.lyrics || ''
    });
  };

  // 태그 변경 핸들러
  const handleTagsChange = (newTags: string[]) => {
    setEditData({
      ...editData,
      searchTags: newTags
    });
  };

  // MR 링크 변경 핸들러들
  const handleMRLinksChange = (newMRLinks: Array<{url: string; skipSeconds?: number; label?: string; duration?: string;}>) => {
    setEditData({
      ...editData,
      mrLinks: newMRLinks
    });
  };

  const handleSelectedMRIndexChange = (newIndex: number) => {
    setEditData({
      ...editData,
      selectedMRIndex: newIndex
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
          // 에러 발생 시 MR 탭으로 전환
          setCurrentTab('mr');
        }
      } else {
        // 플레이어가 아직 준비되지 않았을 때 - MR 탭으로 전환
        console.log('YouTube player not ready, switching to MR tab');
        setCurrentTab('mr');
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

  const switchTab = (tab: 'lyrics' | 'mr' | 'videos') => {
    setCurrentTab(tab);
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

  // 실제 뷰포트 높이 계산 및 body 스크롤 비활성화
  useEffect(() => {
    const setViewportHeight = () => {
      // 실제 뷰포트 높이 계산 (모바일 브라우저 주소창/메뉴바 고려)
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      
      // 모바일 화면 여부 체크
      setIsMobileScreen(window.innerWidth < 640);
    };

    if (isExpanded) {
      // 뷰포트 높이 설정
      setViewportHeight();
      
      // 리사이즈 이벤트 리스너 추가 (모바일에서 주소창이 사라질 때 감지)
      window.addEventListener('resize', setViewportHeight);
      window.addEventListener('orientationchange', setViewportHeight);
      
      // body 스크롤 완전 비활성화
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = '0px'; // 스크롤바 공간 보정
      document.body.style.touchAction = 'none'; // 터치 스크롤 방지
      document.documentElement.style.overflow = 'hidden'; // html 요소도 차단
    } else {
      // 이벤트 리스너 제거
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
      
      // body 스크롤 복원
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      // 모달이 닫힐 때 YouTube 플레이어 초기화
      setYoutubePlayer(null);
      setIsPlaying(false);
      setCurrentTab('lyrics');
    }

    // 컴포넌트 언마운트 시 정리
    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      setYoutubePlayer(null);
      setIsPlaying(false);
    };
  }, [isExpanded]);

  // 다이얼로그 상태 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    if (onDialogStateChange) {
      onDialogStateChange(isExpanded);
    }
  }, [isExpanded, onDialogStateChange]);

  // 스크롤 이벤트 전파 방지 핸들러 (다중 이벤트 처리)
  const handleScrollPreventPropagation = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  // 다이얼로그 전체에서 스크롤 이벤트 완전 차단
  const handleDialogScroll = (e: React.WheelEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // 추가 보안: 네이티브 이벤트도 차단
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  // 스크롤 가능한 영역에서만 스크롤 허용
  const handleScrollableAreaScroll = (e: React.WheelEvent) => {
    e.stopPropagation();
    // 여기서는 preventDefault를 호출하지 않아 자연스러운 스크롤 허용
  };

  // MR 플레이어 위치 계산 및 표시 조건
  useEffect(() => {
    if (!isExpanded || !youtubeMR || isEditMode) return;
    
    const updatePlayerPosition = () => {
      const xlScreen = window.innerWidth >= 1280;
      setIsXLScreen(xlScreen);
      
      // 플레이어가 표시되어야 하는 조건 확인
      let targetContainer = null;
      
      if (xlScreen && (currentTab === 'mr' || currentTab === 'lyrics')) {
        targetContainer = document.getElementById('xl-player-target');
      } else if (!xlScreen && currentTab === 'mr') {
        targetContainer = document.getElementById('mobile-player-target');
      }
      
      if (targetContainer) {
        const targetRect = targetContainer.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(targetContainer);
        
        // 패딩과 보더를 제외한 실제 내부 크기 계산
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
        const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
        const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
        const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
        const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
        
        const innerWidth = targetRect.width - paddingLeft - paddingRight - borderLeft - borderRight;
        const innerHeight = targetRect.height - paddingTop - paddingBottom - borderTop - borderBottom;
        
        // 최상위 컨테이너(.flex-1 min-h-0 p-4 sm:p-6)의 실제 높이 제한 확인
        let maxAvailableHeight = innerHeight;
        let currentElement = targetContainer.parentElement;
        
        // 부모 체인을 따라가면서 실제 제한 높이 찾기
        while (currentElement) {
          const rect = currentElement.getBoundingClientRect();
          const style = window.getComputedStyle(currentElement);
          
          // flex-1과 min-h-0 클래스를 가진 컨테이너 찾기
          if (currentElement.classList.contains('flex-1') && currentElement.classList.contains('min-h-0')) {
            const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
            const availableHeight = rect.height - padding;
            maxAvailableHeight = Math.min(maxAvailableHeight, availableHeight);
            break; // 최상위 flex-1 컨테이너를 찾았으므로 중단
          }
          
          currentElement = currentElement.parentElement;
        }
        
        setPlayerPosition(prev => {
          const newPosition = {
            top: Math.round(targetRect.top + paddingTop + borderTop),
            left: Math.round(targetRect.left + paddingLeft + borderLeft),
            width: Math.round(Math.max(innerWidth, 0)),
            height: Math.round(Math.max(maxAvailableHeight, 0))
          };
          
          // 위치가 실제로 변경된 경우에만 업데이트 (더 큰 허용 오차)
          if (Math.abs(prev.top - newPosition.top) > 5 || 
              Math.abs(prev.left - newPosition.left) > 5 || 
              Math.abs(prev.width - newPosition.width) > 5 || 
              Math.abs(prev.height - newPosition.height) > 5) {
            return newPosition;
          }
          return prev;
        });
      }
    };
    
    // 초기 위치 설정
    updatePlayerPosition();
    
    // 리사이즈 감지
    window.addEventListener('resize', updatePlayerPosition);
    
    return () => {
      window.removeEventListener('resize', updatePlayerPosition);
    };
  }, [isExpanded, youtubeMR, currentTab, isEditMode]);



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
      setCurrentTab('lyrics');
      // 모든 플레이어 상태 초기화
      setYoutubePlayer(null);
      setIsPlaying(false);
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
          className="fixed top-20 sm:top-20 left-1/2 z-40 
                     w-[90vw] max-w-7xl overflow-hidden
                     bg-white dark:bg-gray-900 backdrop-blur-sm 
                     rounded-xl border border-light-primary/20 dark:border-dark-primary/20 
                     shadow-2xl transform -translate-x-1/2 youtube-dialog-container"
          style={{ 
            top: isMobileScreen ? '4.5rem' : '5rem', // 모바일: 네비게이션 바(4rem) + 0.5rem 여백
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
                {isEditMode ? (
                  <textarea
                    value={editData.lyrics}
                    onChange={(e) => setEditData({...editData, lyrics: e.target.value})}
                    className="text-light-text/80 dark:text-dark-text/80 whitespace-pre-line leading-relaxed text-base md:text-lg 
                               bg-transparent border border-light-accent/30 dark:border-dark-accent/30 rounded-lg p-4 
                               outline-none resize-none flex-1 min-h-0"
                    placeholder="가사를 입력하세요..."
                    style={{
                      willChange: 'scroll-position',
                      transform: 'translateZ(0)'
                    }}
                  />
                ) : (
                  song.lyrics ? (
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
                    <TagManager 
                      tags={editData.searchTags}
                      onTagsChange={handleTagsChange}
                      isEditMode={true}
                    />
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
                        <TagManager 
                          tags={song.searchTags || []}
                          onTagsChange={() => {}}
                          isEditMode={false}
                        />
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
                      <span>{isEditMode ? "MR 링크 관리" : "MR 영상"}</span>
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
                    {isEditMode ? (
                      /* MR 링크 편집 UI */
                      <MRLinkManager 
                        mrLinks={editData.mrLinks}
                        selectedMRIndex={editData.selectedMRIndex}
                        onMRLinksChange={handleMRLinksChange}
                        onSelectedMRIndexChange={handleSelectedMRIndexChange}
                        isEditMode={true}
                        songTitle={displayTitle}
                        songArtist={displayArtist}
                      />
                    ) : (
                      /* 기존 YouTube 플레이어 */
                      youtubeMR && (
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
                      )
                    )}
                  </div>

                  {/* XL 화면 유튜브 영상 섹션 */}
                  <div className={`${currentTab === 'videos' ? 'flex' : 'hidden'} flex-col h-full min-h-0`}>
                    <LiveClipManager 
                      songId={song.id}
                      songTitle={displayTitle}
                      isVisible={currentTab === 'videos'}
                    />
                  </div>
                </motion.div>
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
                    {isEditMode ? (
                      /* MR 링크 편집 UI */
                      <MRLinkManager 
                        mrLinks={editData.mrLinks}
                        selectedMRIndex={editData.selectedMRIndex}
                        onMRLinksChange={handleMRLinksChange}
                        onSelectedMRIndexChange={handleSelectedMRIndexChange}
                        isEditMode={true}
                        songTitle={displayTitle}
                        songArtist={displayArtist}
                      />
                    ) : (
                      /* 기존 YouTube 플레이어 */
                      youtubeMR && (
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
                      )
                    )}
                  </div>

                  {/* 가사 섹션 */}
                  <div className={`${currentTab === 'lyrics' ? 'flex' : 'hidden'} flex-col h-full min-h-0`}>
                    {isEditMode ? (
                      <textarea
                        value={editData.lyrics}
                        onChange={(e) => setEditData({...editData, lyrics: e.target.value})}
                        className="text-light-text/80 dark:text-dark-text/80 whitespace-pre-line leading-relaxed text-base md:text-lg 
                                   bg-transparent border border-light-accent/30 dark:border-dark-accent/30 rounded-lg p-4 
                                   outline-none resize-none flex-1 min-h-0"
                        placeholder="가사를 입력하세요..."
                        style={{
                          willChange: 'scroll-position',
                          transform: 'translateZ(0)'
                        }}
                      />
                    ) : (
                      song.lyrics ? (
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
                      )
                    )}
                  </div>

                  {/* 유튜브 영상 섹션 */}
                  <div className={`${currentTab === 'videos' ? 'flex' : 'hidden'} flex-col h-full min-h-0`}>
                    <LiveClipManager 
                      songId={song.id}
                      songTitle={displayTitle}
                      isVisible={currentTab === 'videos'}
                    />
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
      
      {/* 통합 MR YouTube 플레이어 - wrapper로 크기 제한 */}
      {(() => {
        console.log('🎬 Player Debug:', {
          isExpanded,
          youtubeMR: !!youtubeMR,
          isEditMode,
          playerPosition,
          shouldRender: isExpanded && youtubeMR && !isEditMode
        });
        return null;
      })()}
      {isExpanded && youtubeMR && !isEditMode && (
        <div
          style={{
            position: 'fixed',
            top: (() => {
              const shouldShow = (isXLScreen && (currentTab === 'mr' || currentTab === 'lyrics')) || 
                                (!isXLScreen && currentTab === 'mr');
              const pos = shouldShow ? playerPosition.top : -9999;
              console.log('🎯 Player Position:', { shouldShow, top: pos, playerPosition });
              return pos;
            })(),
            left: (() => {
              const shouldShow = (isXLScreen && (currentTab === 'mr' || currentTab === 'lyrics')) || 
                                (!isXLScreen && currentTab === 'mr');
              return shouldShow ? playerPosition.left : -9999;
            })(),
            width: `${playerPosition.width || 0}px`,
            height: `${playerPosition.height || 0}px`,
            maxWidth: `${playerPosition.width || 0}px`,
            maxHeight: `${playerPosition.height || 0}px`,
            minWidth: 0,
            minHeight: 0,
            pointerEvents: 'auto',
            zIndex: 50,
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}
          className="rounded-lg"
        >
          <YouTube
            key={`unified-mr-${song.id}-${youtubeMR.videoId}`}
            videoId={youtubeMR.videoId}
            opts={{
              width: '100%',
              height: '100%',
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
            style={{
              width: '100%',
              height: '100%',
            }}
          />
        </div>
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