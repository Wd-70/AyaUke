"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ForwardIcon,
  BackwardIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ClockIcon,
  UserIcon,
  MusicalNoteIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  TrophyIcon,
  ChartBarIcon,
  MinusIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import {
  CheckCircleIcon as CheckCircleIconSolid,
  PlayIcon as PlayIconSolid,
} from "@heroicons/react/24/solid";
import ChzzkPlayer, { type ChzzkPlayerHandle } from "@/components/video/ChzzkPlayer";

// YouTube API 타입 정의
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface ClipData {
  _id: string;
  songId: string;
  title: string;
  artist: string;
  platform?: 'youtube' | 'chzzk';
  videoUrl: string;
  videoId: string;
  sungDate: string;
  description?: string;
  startTime?: number;
  endTime?: number;
  addedBy: string;
  addedByName: string;
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  thumbnailUrl?: string;
  duration?: string;
  createdAt: string;
  updatedAt: string;
  songDetail?: {
    _id: string;
    title: string;
    artist: string;
    titleAlias?: string;
    artistAlias?: string;
    language: string;
    sungCount: number;
  };
}

interface ClipStats {
  total: number;
  verified: number;
  unverified: number;
  topContributors: Array<{ name: string; count: number }>;
  topSongs: Array<{ 
    songId: string; 
    title: string; 
    artist: string; 
    titleAlias?: string;
    artistAlias?: string;
    count: number;
  }>;
}


type SortBy = 'recent' | 'addedBy' | 'songTitle' | 'verified' | 'sungDate';
type FilterBy = 'all' | 'verified' | 'unverified' | 'time-overlap';

export default function LiveClipManagementTab() {
  const [clips, setClips] = useState<ClipData[]>([]);
  const [allClips, setAllClips] = useState<ClipData[]>([]);
  const [filteredClips, setFilteredClips] = useState<ClipData[]>([]);
  const [displayedClips, setDisplayedClips] = useState<ClipData[]>([]);
  const [stats, setStats] = useState<ClipStats | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 필터 및 정렬 상태
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [search, setSearch] = useState('');
  const [addedBy, setAddedBy] = useState('');
  const [selectedSongId, setSelectedSongId] = useState('');

  // 플레이어 상태
  const [selectedClip, setSelectedClip] = useState<ClipData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [player, setPlayer] = useState<any>(null);
  const [playerReady, setPlayerReady] = useState(false);

  // 편집 상태
  const [editingClip, setEditingClip] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    videoUrl: '',
    startTime: 0,
    endTime: 0,
    description: ''
  });

  // UI 상태
  const [showFilters, setShowFilters] = useState(false);
  const [showPlayer, setShowPlayer] = useState(true);
  const [showTopSongs, setShowTopSongs] = useState(true);
  const [showTopContributors, setShowTopContributors] = useState(true);
  const [viewMode, setViewMode] = useState<'stats' | 'list'>('stats');

  const playerRef = useRef<HTMLIFrameElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // 시간 중복 검사 함수들
  const checkTimeOverlap = (clip1: ClipData, clip2: ClipData): boolean => {
    // 같은 플랫폼의 같은 영상이 아니면 중복 아님
    if ((clip1.platform || 'youtube') !== (clip2.platform || 'youtube')) return false;
    if (clip1.videoId !== clip2.videoId) return false;
    
    // 같은 클립이면 중복 아님
    if (clip1._id === clip2._id) return false;
    
    const start1 = clip1.startTime || 0;
    const end1 = clip1.endTime || Number.MAX_SAFE_INTEGER;
    const start2 = clip2.startTime || 0;
    const end2 = clip2.endTime || Number.MAX_SAFE_INTEGER;
    
    // 시작시간과 종료시간이 정확히 연결되는 경우는 정상 (중복 아님)
    if (end1 === start2 || end2 === start1) return false;
    
    // 중복 구간이 있는지 확인
    return Math.max(start1, start2) < Math.min(end1, end2);
  };

  // 전체 클립 데이터 로드
  const loadAllClips = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/clips?limit=999999'); // 모든 클립 가져오기
      if (!response.ok) throw new Error('Failed to fetch clips');

      const data = await response.json();
      setAllClips(data.clips || []);
      setStats(data.stats);
      console.log(`📊 전체 클립 로드 완료: ${data.clips?.length}개`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setAllClips([]);
    } finally {
      setLoading(false);
    }
  };

  // 비디오ID + 곡ID별로 클립들을 그룹화 (같은 영상의 같은 곡만 중복 검사)
  const getClipsByVideoAndSong = (clips: ClipData[]) => {
    const videoSongGroups: { [key: string]: ClipData[] } = {};
    
    clips.forEach(clip => {
      const key = `${clip.platform || 'youtube'}-${clip.videoId}-${clip.songId}`; // 플랫폼+videoId+songId 조합 키
      if (!videoSongGroups[key]) {
        videoSongGroups[key] = [];
      }
      videoSongGroups[key].push(clip);
    });
    
    return videoSongGroups;
  };

  // 시간 중복이 있는 클립들 찾기
  const getOverlappingClips = () => {
    const videoSongGroups = getClipsByVideoAndSong(allClips);
    const overlappingClipIds = new Set<string>();
    
    Object.values(videoSongGroups).forEach(videoSongClips => {
      // 같은 영상의 같은 곡 내에서만 중복 검사
      for (let i = 0; i < videoSongClips.length; i++) {
        for (let j = i + 1; j < videoSongClips.length; j++) {
          const clip1 = videoSongClips[i];
          const clip2 = videoSongClips[j];

          if (checkTimeOverlap(clip1, clip2)) {
            // 디버깅 로그 추가
            console.log('🔍 중복 감지된 클립들:', {
              clip1: {
                videoId: clip1.videoId,
                songId: clip1.songId,
                title: clip1.title,
                startTime: clip1.startTime,
                endTime: clip1.endTime,
                sungDate: clip1.sungDate
              },
              clip2: {
                videoId: clip2.videoId,
                songId: clip2.songId,
                title: clip2.title,
                startTime: clip2.startTime,
                endTime: clip2.endTime,
                sungDate: clip2.sungDate
              },
              overlapReason: `start1: ${clip1.startTime}, end1: ${clip1.endTime}, start2: ${clip2.startTime}, end2: ${clip2.endTime}`
            });

            overlappingClipIds.add(clip1._id);
            overlappingClipIds.add(clip2._id);
          }
        }
      }
    });
    
    return overlappingClipIds;
  };

  // 특정 클립의 중복 정보 가져오기
  const getClipOverlapInfo = (clip: ClipData) => {
    // 같은 영상의 같은 곡 클립들만 찾기
    const sameVideoSongClips = allClips.filter(c =>
      (c.platform || 'youtube') === (clip.platform || 'youtube') &&
      c.videoId === clip.videoId &&
      c.songId === clip.songId &&
      c._id !== clip._id
    );
    const overlappingClips: ClipData[] = [];
    
    sameVideoSongClips.forEach(otherClip => {
      if (checkTimeOverlap(clip, otherClip)) {
        overlappingClips.push(otherClip);
      }
    });
    
    return {
      hasOverlap: overlappingClips.length > 0,
      overlappingClips,
      overlappingCount: overlappingClips.length
    };
  };

  // 편집 관련 함수들
  const handleStartEdit = (clip: ClipData) => {
    setEditingClip(clip._id);
    setEditData({
      videoUrl: clip.videoUrl,
      startTime: clip.startTime || 0,
      endTime: clip.endTime || 0,
      description: clip.description || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingClip(null);
    setEditData({
      videoUrl: '',
      startTime: 0,
      endTime: 0,
      description: ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingClip) return;
    
    try {
      const response = await fetch('/api/admin/clips', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clipId: editingClip,
          action: 'updateClip',
          data: editData
        }),
      });

      if (response.ok) {
        setEditingClip(null);
        setEditData({
          videoUrl: '',
          startTime: 0,
          endTime: 0,
          description: ''
        });
        // 전체 데이터 다시 로드
        await loadAllClips();
      } else {
        console.error('클립 수정 실패');
      }
    } catch (error) {
      console.error('클립 수정 오류:', error);
    }
  };

  // 클라이언트 사이드 필터링 및 정렬
  const applyFiltersAndSorting = useCallback(() => {
    let filtered = [...allClips];

    // 검색 필터
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(clip => 
        getDisplayTitle(clip.title, clip.songDetail?.titleAlias).toLowerCase().includes(searchLower) ||
        getDisplayArtist(clip.artist, clip.songDetail?.artistAlias).toLowerCase().includes(searchLower) ||
        clip.addedByName.toLowerCase().includes(searchLower) ||
        (clip.description && clip.description.toLowerCase().includes(searchLower))
      );
    }

    // 등록자 필터
    if (addedBy) {
      filtered = filtered.filter(clip => 
        clip.addedByName.toLowerCase().includes(addedBy.toLowerCase())
      );
    }

    // 곡 필터
    if (selectedSongId) {
      filtered = filtered.filter(clip => clip.songId === selectedSongId);
    }

    // 상태 필터
    if (filterBy === 'verified') {
      filtered = filtered.filter(clip => clip.isVerified);
    } else if (filterBy === 'unverified') {
      filtered = filtered.filter(clip => !clip.isVerified);
    } else if (filterBy === 'time-overlap') {
      const overlappingClipIds = getOverlappingClips();
      filtered = filtered.filter(clip => overlappingClipIds.has(clip._id));
    }

    // 정렬
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'addedBy':
          return a.addedByName.localeCompare(b.addedByName);
        case 'songTitle':
          return getDisplayTitle(a.title, a.songDetail?.titleAlias).localeCompare(
            getDisplayTitle(b.title, b.songDetail?.titleAlias)
          );
        case 'verified':
          if (a.isVerified && !b.isVerified) return -1;
          if (!a.isVerified && b.isVerified) return 1;
          return 0;
        case 'sungDate':
          return new Date(b.sungDate).getTime() - new Date(a.sungDate).getTime();
        default:
          return 0;
      }
    });

    setFilteredClips(filtered);
    setClips(filtered); // 표시용으로도 설정
  }, [allClips, search, addedBy, selectedSongId, filterBy, sortBy]);

  // 초기 로드
  useEffect(() => {
    loadAllClips();
  }, []);

  // 필터링 및 정렬 적용
  useEffect(() => {
    if (allClips.length > 0) {
      applyFiltersAndSorting();
    }
  }, [allClips, applyFiltersAndSorting]);

  // 검색 관련 디바운스 처리
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      applyFiltersAndSorting();
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  // YouTube Player API 함수들
  const initializePlayer = (clip: ClipData) => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      
      (window as any).onYouTubeIframeAPIReady = () => {
        createPlayer(clip);
      };
    } else {
      createPlayer(clip);
    }
  };

  const createPlayer = (clip: ClipData) => {
    if (!playerRef.current) return;

    // 플레이어 생성 전 초기화
    setCurrentTime(clip.startTime || 0);
    setDuration(0);

    const newPlayer = new (window as any).YT.Player(playerRef.current, {
      videoId: clip.videoId,
      playerVars: {
        start: clip.startTime || 0,
        end: clip.endTime || 0,
        autoplay: 0,
        controls: 0,
        rel: 0
      },
      events: {
        onReady: (event: any) => {
          setPlayer(event.target);
          setPlayerReady(true);
          setDuration(event.target.getDuration());
          setCurrentTime(selectedClip?.startTime || 0);
        },
        onStateChange: (event: any) => {
          const YT = (window as any).YT;
          setIsPlaying(event.data === YT.PlayerState.PLAYING);
          
          if (event.data === YT.PlayerState.PLAYING) {
            const updateTime = () => {
              if (event.target && event.target.getCurrentTime) {
                const currentTime = event.target.getCurrentTime();
                setCurrentTime(currentTime);
                
                // 종료 시간에 도달하면 일시정지
                if (selectedClip && selectedClip.endTime && currentTime >= selectedClip.endTime) {
                  event.target.pauseVideo();
                  return;
                }
              }
              
              if (event.data === YT.PlayerState.PLAYING) {
                requestAnimationFrame(updateTime);
              }
            };
            updateTime();
          }
        }
      }
    });
  };

  // 플레이어 제어
  const playClip = (clip: ClipData) => {
    // 기존 플레이어 정리
    if (player) {
      try {
        player.destroy();
      } catch (error) {
        console.log('플레이어 정리 중 오류:', error);
      }
      setPlayer(null);
      setPlayerReady(false);
      setIsPlaying(false);
    }

    // 편집 모드 해제
    if (editingClip) {
      setEditingClip(null);
      setEditData({
        videoUrl: '',
        startTime: 0,
        endTime: 0,
        description: ''
      });
    }

    setSelectedClip(clip);
    setPlayerReady(false);
    setCurrentTime(clip.startTime || 0);
    // 치지직 클립은 ChzzkPlayer 컴포넌트가 마운트되면서 자체 초기화됨
    if ((clip.platform || 'youtube') !== 'chzzk') {
      initializePlayer(clip);
    }
  };

  // 치지직 플레이어를 기존 player 인터페이스에 맞추는 어댑터
  const chzzkPlayerAdapterRef = useCallback((handle: ChzzkPlayerHandle | null) => {
    if (handle) {
      setPlayer({
        playVideo: handle.play,
        pauseVideo: handle.pause,
        getCurrentTime: handle.getCurrentTime,
        getDuration: handle.getDuration,
        seekTo: (seconds: number) => handle.seekTo(seconds),
        destroy: () => {},
      });
      setPlayerReady(true);
    } else {
      setPlayer(null);
      setPlayerReady(false);
    }
  }, []);

  const togglePlay = () => {
    if (player && playerReady) {
      if (isPlaying) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    }
  };

  const seekTo = (time: number) => {
    if (player && playerReady) {
      player.seekTo(time, true);
      setCurrentTime(time);
    }
  };

  const skipTime = (seconds: number) => {
    if (player && playerReady) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      seekTo(newTime);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  };

  const getDisplayTitle = (title: string, titleAlias?: string) => {
    return titleAlias && titleAlias.trim() ? titleAlias : title;
  };

  const getDisplayArtist = (artist: string, artistAlias?: string) => {
    return artistAlias && artistAlias.trim() ? artistAlias : artist;
  };

  const handleStatsClick = (type: 'song' | 'contributor', value: string) => {
    if (type === 'song') {
      setSelectedSongId(value);
      setAddedBy('');
    } else {
      setAddedBy(value);
      setSelectedSongId('');
    }
    setSearch('');
    setViewMode('list');
  };

  // 클립 검증/해제
  const handleClipAction = async (clipId: string, action: string, data?: any) => {
    try {
      const response = await fetch('/api/admin/clips', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId, action, data }),
      });

      if (!response.ok) throw new Error('Failed to update clip');
      
      // 전체 데이터 다시 로드
      await loadAllClips();
      
      if (selectedClip && selectedClip._id === clipId) {
        const updatedClip = allClips.find(c => c._id === clipId);
        if (updatedClip) setSelectedClip(updatedClip);
      }
    } catch (err) {
      console.error('Clip action error:', err);
      alert('작업 중 오류가 발생했습니다.');
    }
  };

  // 클립 삭제
  const handleDeleteClip = async (clipId: string) => {
    const clip = allClips.find(c => c._id === clipId);
    if (!clip) return;

    const clipInfo = [
      `곡: ${getDisplayTitle(clip.title, clip.songDetail?.titleAlias)} - ${getDisplayArtist(clip.artist, clip.songDetail?.artistAlias)}`,
      `부른날: ${new Date(clip.sungDate).toLocaleDateString()}`,
      `시간: ${formatTime(clip.startTime || 0)} - ${formatTime(clip.endTime || 0)}`,
      clip.description ? `설명: ${clip.description}` : '설명: 없음'
    ].join('\n');

    if (!confirm(`정말로 이 클립을 삭제하시겠습니까?\n\n${clipInfo}`)) return;

    try {
      const response = await fetch(`/api/admin/clips?clipId=${clipId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete clip');
      
      // 전체 데이터 다시 로드
      await loadAllClips();
      
      if (selectedClip && selectedClip._id === clipId) {
        setSelectedClip(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading && clips.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-2 border-light-accent/30 dark:border-dark-accent/30 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 및 통계 */}
      <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-light-text dark:text-dark-text flex items-center gap-3">
              <PlayIcon className="w-8 h-8 text-light-accent dark:text-dark-accent" />
              라이브 클립 관리
            </h2>
            <p className="text-light-text/60 dark:text-dark-text/60 mt-2">
              등록된 라이브 클립을 관리하고 재생할 수 있습니다
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('stats')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'stats'
                    ? 'bg-light-accent dark:bg-dark-accent text-white shadow-sm'
                    : 'text-light-text/60 dark:text-dark-text/60 hover:text-light-text dark:hover:text-dark-text'
                }`}
              >
                📊 통계
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'list'
                    ? 'bg-light-accent dark:bg-dark-accent text-white shadow-sm'
                    : 'text-light-text/60 dark:text-dark-text/60 hover:text-light-text dark:hover:text-dark-text'
                }`}
              >
                📋 리스트 {(selectedSongId || addedBy || search) && '●'}
              </button>
            </div>
            <button
              onClick={() => setShowPlayer(!showPlayer)}
              className="px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              {showPlayer ? '플레이어 숨기기' : '플레이어 보기'}
            </button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-light-accent/10 dark:bg-dark-accent/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-light-accent dark:text-dark-accent">
                {stats.total.toLocaleString()}
              </div>
              <div className="text-sm text-light-text/60 dark:text-dark-text/60">
                총 클립 수
              </div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.verified.toLocaleString()}
              </div>
              <div className="text-sm text-light-text/60 dark:text-dark-text/60">
                검증된 클립
              </div>
            </div>
            <div className="bg-orange-500/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {stats.unverified.toLocaleString()}
              </div>
              <div className="text-sm text-light-text/60 dark:text-dark-text/60">
                미검증 클립
              </div>
            </div>
            <div 
              className="bg-amber-500/10 rounded-lg p-4 cursor-pointer hover:bg-amber-500/20 transition-colors" 
              onClick={() => {
                setFilterBy('time-overlap');
                setViewMode('list');
              }}
              title="클릭하여 시간 중복 클립만 보기"
            >
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {allClips.length > 0 ? getOverlappingClips().size.toLocaleString() : '로딩중...'}
              </div>
              <div className="text-sm text-light-text/60 dark:text-dark-text/60">
                시간 중복 클립 ⚠️
              </div>
            </div>
            <div className="bg-blue-500/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {Math.round((stats.verified / stats.total) * 100)}%
              </div>
              <div className="text-sm text-light-text/60 dark:text-dark-text/60">
                검증률
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 상세 통계 섹션 */}
      {viewMode === 'stats' && stats && (stats.topSongs.length > 0 || stats.topContributors.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 클립 수가 많은 곡 TOP 10 */}
          {stats.topSongs.length > 0 && (
            <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text flex items-center gap-2">
                  <ChartBarIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
                  클립 수가 많은 곡 TOP 10
                </h3>
                <button
                  onClick={() => setShowTopSongs(!showTopSongs)}
                  className="text-light-accent dark:text-dark-accent hover:opacity-70 transition-opacity"
                >
                  <ChevronDownIcon className={`w-5 h-5 transform transition-transform ${showTopSongs ? 'rotate-180' : ''}`} />
                </button>
              </div>
              
              <AnimatePresence>
                {showTopSongs && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    {stats.topSongs.slice(0, 10).map((song, index) => (
                      <div
                        key={song.songId}
                        className="flex items-center justify-between p-3 bg-light-primary/10 dark:bg-dark-primary/10 rounded-lg hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 transition-colors cursor-pointer"
                        onClick={() => handleStatsClick('song', song.songId)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-light-accent to-light-secondary dark:from-dark-accent to-dark-secondary">
                            {index < 3 ? (
                              <TrophyIcon className="w-4 h-4 text-white" />
                            ) : (
                              <span className="text-white text-sm font-bold">{index + 1}</span>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-light-text dark:text-dark-text">
                              {getDisplayTitle(song.title, song.titleAlias)}
                            </div>
                            <div className="text-sm text-light-text/60 dark:text-dark-text/60">
                              {getDisplayArtist(song.artist, song.artistAlias)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-light-accent dark:text-dark-accent">
                            {song.count}
                          </div>
                          <div className="text-xs text-light-text/60 dark:text-dark-text/60">
                            클립
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* 클립을 많이 올린 사용자 TOP 10 */}
          {stats.topContributors.length > 0 && (
            <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
                  클립을 많이 올린 사용자 TOP 10
                </h3>
                <button
                  onClick={() => setShowTopContributors(!showTopContributors)}
                  className="text-light-accent dark:text-dark-accent hover:opacity-70 transition-opacity"
                >
                  <ChevronDownIcon className={`w-5 h-5 transform transition-transform ${showTopContributors ? 'rotate-180' : ''}`} />
                </button>
              </div>
              
              <AnimatePresence>
                {showTopContributors && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    {stats.topContributors.slice(0, 10).map((contributor, index) => (
                      <div
                        key={contributor.name}
                        className="flex items-center justify-between p-3 bg-light-primary/10 dark:bg-dark-primary/10 rounded-lg hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 transition-colors cursor-pointer"
                        onClick={() => handleStatsClick('contributor', contributor.name)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-light-secondary to-light-accent dark:from-dark-secondary to-dark-accent">
                            {index < 3 ? (
                              <TrophyIcon className="w-4 h-4 text-white" />
                            ) : (
                              <span className="text-white text-sm font-bold">{index + 1}</span>
                            )}
                          </div>
                          <div className="font-medium text-light-text dark:text-dark-text">
                            {contributor.name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-light-secondary dark:text-dark-secondary">
                            {contributor.count}
                          </div>
                          <div className="text-xs text-light-text/60 dark:text-dark-text/60">
                            클립
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* 플레이어 섹션 */}
      <AnimatePresence>
        {showPlayer && selectedClip && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 비디오 플레이어 */}
              <div className="lg:col-span-2">
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  {(selectedClip.platform || 'youtube') === 'chzzk' ? (
                    <ChzzkPlayer
                      key={`admin-chzzk-${selectedClip._id}`}
                      ref={chzzkPlayerAdapterRef}
                      videoUrl={selectedClip.videoUrl}
                      videoNo={parseInt(selectedClip.videoId, 10)}
                      startTime={selectedClip.startTime || 0}
                      onTimeUpdate={setCurrentTime}
                      onDurationChange={setDuration}
                      className="w-full h-full"
                    />
                  ) : (
                    <div
                      ref={playerRef}
                      className="w-full h-full"
                    />
                  )}
                </div>
                
                {/* 플레이어 컨트롤 */}
                <div className="mt-4 bg-gray-900/50 rounded-lg p-4">
                  {/* 시간 표시 */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-white text-sm">
                      현재: <span className="font-mono">{formatTime(currentTime)}</span>
                    </div>
                    <div className="text-white/70 text-sm">
                      전체: <span className="font-mono">{formatTime(selectedClip.endTime || duration)}</span>
                    </div>
                  </div>

                  {/* 진행바 */}
                  <div className="mb-4">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-light-accent dark:bg-dark-accent h-2 rounded-full transition-all duration-150"
                        style={{ 
                          width: `${((currentTime - (selectedClip.startTime || 0)) / 
                            ((selectedClip.endTime || duration) - (selectedClip.startTime || 0))) * 100}%` 
                        }}
                      />
                    </div>
                  </div>

                  {/* 주요 컨트롤 */}
                  <div className="flex items-center justify-center gap-4 mb-4">
                    {/* 현재 시간을 시작 시간으로 설정 */}
                    {editingClip === selectedClip._id && (
                      <button
                        onClick={() => setEditData(prev => ({ ...prev, startTime: Math.floor(currentTime) }))}
                        disabled={!playerReady}
                        className="w-10 h-10 bg-green-600 hover:bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        title="현재 시간을 시작 시간으로 설정"
                      >
                        IN
                      </button>
                    )}

                    {/* 시작점으로 이동 */}
                    <button
                      onClick={() => seekTo(selectedClip.startTime || 0)}
                      disabled={!playerReady}
                      className="w-10 h-10 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      title="시작점으로 이동"
                    >
                      시작
                    </button>

                    {/* 재생/일시정지 */}
                    <button
                      onClick={togglePlay}
                      disabled={!playerReady}
                      className="w-12 h-12 bg-light-accent dark:bg-dark-accent rounded-full flex items-center justify-center text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPlaying ? (
                        <PauseIcon className="w-6 h-6" />
                      ) : (
                        <PlayIconSolid className="w-6 h-6 ml-0.5" />
                      )}
                    </button>

                    {/* 종료점-3초로 이동 */}
                    <button
                      onClick={() => {
                        const endTime = selectedClip.endTime || duration;
                        const targetTime = Math.max(selectedClip.startTime || 0, endTime - 3);
                        seekTo(targetTime);
                      }}
                      disabled={!playerReady}
                      className="w-10 h-10 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      title="종료점 3초 전으로 이동"
                    >
                      -3s
                    </button>

                    {/* 현재 시간을 종료 시간으로 설정 */}
                    {editingClip === selectedClip._id && (
                      <button
                        onClick={() => setEditData(prev => ({ ...prev, endTime: Math.floor(currentTime) }))}
                        disabled={!playerReady}
                        className="w-10 h-10 bg-orange-600 hover:bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        title="현재 시간을 종료 시간으로 설정"
                      >
                        OUT
                      </button>
                    )}
                  </div>

                  {/* 시간 이동 컨트롤 */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* 1분 이동 */}
                    <div className="text-center">
                      <div className="text-white/70 text-xs mb-1">1분</div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => skipTime(-60)}
                          disabled={!playerReady}
                          className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <MinusIcon className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                          onClick={() => skipTime(60)}
                          disabled={!playerReady}
                          className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <PlusIcon className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                    </div>

                    {/* 10초 이동 */}
                    <div className="text-center">
                      <div className="text-white/70 text-xs mb-1">10초</div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => skipTime(-10)}
                          disabled={!playerReady}
                          className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <MinusIcon className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                          onClick={() => skipTime(10)}
                          disabled={!playerReady}
                          className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <PlusIcon className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                    </div>

                    {/* 1초 이동 */}
                    <div className="text-center">
                      <div className="text-white/70 text-xs mb-1">1초</div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => skipTime(-1)}
                          disabled={!playerReady}
                          className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <MinusIcon className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                          onClick={() => skipTime(1)}
                          disabled={!playerReady}
                          className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <PlusIcon className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 클립 정보 */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-2">
                    {getDisplayTitle(selectedClip.title, selectedClip.songDetail?.titleAlias)}
                  </h3>
                  <p className="text-light-text/70 dark:text-dark-text/70">
                    {getDisplayArtist(selectedClip.artist, selectedClip.songDetail?.artistAlias)}
                  </p>
                </div>

{editingClip === selectedClip._id ? (
                  /* 편집 모드 */
                  <div className="space-y-4">
                    {/* 비디오 URL */}
                    <div>
                      <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                        비디오 URL
                      </label>
                      <input
                        type="url"
                        value={editData.videoUrl}
                        onChange={(e) => setEditData(prev => ({ ...prev, videoUrl: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-light-text dark:text-dark-text text-sm focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent"
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                    </div>

                    {/* 시간 설정 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                          시작 시간 (초)
                        </label>
                        <input
                          type="number"
                          value={editData.startTime}
                          onChange={(e) => setEditData(prev => ({ ...prev, startTime: parseInt(e.target.value) || 0 }))}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-light-text dark:text-dark-text text-sm focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                          종료 시간 (초)
                        </label>
                        <input
                          type="number"
                          value={editData.endTime}
                          onChange={(e) => setEditData(prev => ({ ...prev, endTime: parseInt(e.target.value) || 0 }))}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-light-text dark:text-dark-text text-sm focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* 설명 */}
                    <div>
                      <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                        설명
                      </label>
                      <textarea
                        value={editData.description}
                        onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-light-text dark:text-dark-text text-sm focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent resize-none"
                        placeholder="클립에 대한 설명을 입력하세요..."
                      />
                    </div>
                  </div>
                ) : (
                  /* 표시 모드 */
                  <div>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-light-text/60 dark:text-dark-text/60" />
                        <span className="text-light-text/70 dark:text-dark-text/70">
                          등록자: {selectedClip.addedByName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ClockIcon className="w-4 h-4 text-light-text/60 dark:text-dark-text/60" />
                        <span className="text-light-text/70 dark:text-dark-text/70">
                          부른 날짜: {new Date(selectedClip.sungDate).toLocaleDateString()}
                        </span>
                      </div>
                      {(selectedClip.startTime || selectedClip.endTime) && (
                        <div className="flex items-center gap-2">
                          <MusicalNoteIcon className="w-4 h-4 text-light-text/60 dark:text-dark-text/60" />
                          <span className="text-light-text/70 dark:text-dark-text/70">
                            {formatTime(selectedClip.startTime || 0)} - {formatTime(selectedClip.endTime || 0)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {selectedClip.isVerified ? (
                          <CheckCircleIconSolid className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircleIcon className="w-4 h-4 text-orange-500" />
                        )}
                        <span className={`text-sm ${
                          selectedClip.isVerified ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                        }`}>
                          {selectedClip.isVerified ? '검증됨' : '미검증'}
                        </span>
                      </div>
                    </div>

                    {selectedClip.description && (
                      <div className="mt-4 p-3 bg-light-primary/10 dark:bg-dark-primary/10 rounded-lg">
                        <p className="text-sm text-light-text/80 dark:text-dark-text/80">
                          {selectedClip.description}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="space-y-2">
                  {editingClip === selectedClip._id ? (
                    <div className="space-y-2">
                      <button
                        onClick={handleSaveEdit}
                        className="w-full py-2 px-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                      >
                        <CheckCircleIcon className="w-4 h-4 inline mr-2" />
                        저장
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-900/50 transition-colors"
                      >
                        <XCircleIcon className="w-4 h-4 inline mr-2" />
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartEdit(selectedClip)}
                      className="w-full py-2 px-4 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      <PencilIcon className="w-4 h-4 inline mr-2" />
                      수정
                    </button>
                  )}
                  <button
                    onClick={() => handleClipAction(selectedClip._id, selectedClip.isVerified ? 'unverify' : 'verify')}
                    className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      selectedClip.isVerified
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                    }`}
                  >
                    {selectedClip.isVerified ? (
                      <>
                        <XCircleIcon className="w-4 h-4 inline mr-2" />
                        검증 해제
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-4 h-4 inline mr-2" />
                        검증 승인
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteClip(selectedClip._id)}
                    className="w-full py-2 px-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4 inline mr-2" />
                    삭제
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 필터 상태 표시 */}
      {viewMode === 'list' && (selectedSongId || addedBy || search || filterBy !== 'all') && (
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700/50">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              필터 적용됨:
            </span>
            {selectedSongId && (
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                곡 필터: {clips.find(c => c.songId === selectedSongId)?.title || selectedSongId}
                <button
                  onClick={() => setSelectedSongId('')}
                  className="ml-2 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                >
                  ×
                </button>
              </span>
            )}
            {addedBy && (
              <span className="px-3 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded-full text-sm">
                사용자 필터: {addedBy}
                <button
                  onClick={() => setAddedBy('')}
                  className="ml-2 text-green-600 dark:text-green-300 hover:text-green-800 dark:hover:text-green-100"
                >
                  ×
                </button>
              </span>
            )}
            {search && (
              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-200 rounded-full text-sm">
                검색: {search}
                <button
                  onClick={() => setSearch('')}
                  className="ml-2 text-purple-600 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-100"
                >
                  ×
                </button>
              </span>
            )}
            {filterBy !== 'all' && (
              <span className={`px-3 py-1 rounded-full text-sm ${
                filterBy === 'time-overlap' 
                  ? 'bg-amber-100 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                  : 'bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200'
              }`}>
                상태: {
                  filterBy === 'verified' ? '검증됨' : 
                  filterBy === 'unverified' ? '미검증' : 
                  '⚠️ 시간 중복'
                }
                <button
                  onClick={() => setFilterBy('all')}
                  className={`ml-2 hover:opacity-75 ${
                    filterBy === 'time-overlap'
                      ? 'text-amber-600 dark:text-amber-300'
                      : 'text-indigo-600 dark:text-indigo-300'
                  }`}
                >
                  ×
                </button>
              </span>
            )}
            <button
              onClick={() => {
                setSelectedSongId('');
                setAddedBy('');
                setSearch('');
                setFilterBy('all');
              }}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              모든 필터 지우기
            </button>
          </div>
        </div>
      )}

      {/* 필터 및 검색 */}
      {viewMode === 'list' && (
        <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* 검색 */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-light-text/40 dark:text-dark-text/40" />
                <input
                  type="text"
                  placeholder="제목, 아티스트, 등록자, 설명으로 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg text-light-text dark:text-dark-text placeholder-light-text/40 dark:placeholder-dark-text/40 focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                />
              </div>
            </div>

            {/* 필터 토글 */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-light-primary/20 dark:bg-dark-primary/20 text-light-text dark:text-dark-text rounded-lg hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 transition-colors flex items-center gap-2"
            >
              <FunnelIcon className="w-4 h-4" />
              필터
            </button>
          </div>

          {/* 확장된 필터 */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <div>
                  <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">정렬</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortBy)}
                    className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                  >
                    <option value="recent">최근 등록순</option>
                    <option value="addedBy">등록자별</option>
                    <option value="songTitle">곡 제목순</option>
                    <option value="verified">검증 상태별</option>
                    <option value="sungDate">부른 날짜순</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">필터 유형</label>
                  <select
                    value={filterBy}
                    onChange={(e) => setFilterBy(e.target.value as FilterBy)}
                    className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                  >
                    <option value="all">전체</option>
                    <option value="verified">검증됨</option>
                    <option value="unverified">미검증</option>
                    <option value="time-overlap">⚠️ 시간 중복</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">등록자</label>
                  <input
                    type="text"
                    placeholder="등록자명 입력..."
                    value={addedBy}
                    onChange={(e) => setAddedBy(e.target.value)}
                    className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg text-light-text dark:text-dark-text placeholder-light-text/40 dark:placeholder-dark-text/40 focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 클립 리스트 */}
      {viewMode === 'list' && (
        <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl border border-light-primary/20 dark:border-dark-primary/20 overflow-hidden">
          {error ? (
            <div className="p-8 text-center">
              <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : clips.length === 0 ? (
            <div className="p-8 text-center">
              <MusicalNoteIcon className="w-12 h-12 text-light-text/30 dark:text-dark-text/30 mx-auto mb-4" />
              <p className="text-light-text/60 dark:text-dark-text/60">클립이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-light-primary/20 dark:divide-dark-primary/20">
              {clips.map((clip) => {
                const overlapInfo = getClipOverlapInfo(clip);
                return (
                <div
                  key={clip._id}
                  className={`p-4 hover:bg-light-primary/5 dark:hover:bg-dark-primary/5 transition-colors ${
                    selectedClip?._id === clip._id 
                      ? 'bg-light-accent/5 dark:bg-dark-accent/5' 
                      : overlapInfo.hasOverlap 
                        ? 'bg-amber-50/50 dark:bg-amber-900/10 border-l-4 border-amber-400' 
                        : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* 썸네일 */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={clip.thumbnailUrl || ((clip.platform || 'youtube') === 'youtube' ? `https://img.youtube.com/vi/${clip.videoId}/mqdefault.jpg` : '/honeyz_pink.png')}
                        alt=""
                        className="w-20 h-12 object-cover rounded"
                      />
                      <button
                        onClick={() => playClip(clip)}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded transition-colors"
                      >
                        <PlayIconSolid className="w-6 h-6 text-white ml-0.5" />
                      </button>
                    </div>

                    {/* 클립 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-light-text dark:text-dark-text truncate">
                            {getDisplayTitle(clip.title, clip.songDetail?.titleAlias)}
                          </h3>
                          <p className="text-sm text-light-text/70 dark:text-dark-text/70 truncate">
                            {getDisplayArtist(clip.artist, clip.songDetail?.artistAlias)}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-light-text/60 dark:text-dark-text/60">
                            <span>{clip.addedByName}</span>
                            <span>부른날: {new Date(clip.sungDate).toLocaleDateString()}</span>
                            <span>등록: {new Date(clip.createdAt).toLocaleDateString()}</span>
                            {(clip.startTime || clip.endTime) && (
                              <span>
                                {formatTime(clip.startTime || 0)} - {formatTime(clip.endTime || 0)}
                              </span>
                            )}
                          </div>
                          {clip.description && (
                            <div className="mt-2 text-xs text-light-text/50 dark:text-dark-text/50 bg-light-primary/5 dark:bg-dark-primary/5 px-2 py-1 rounded">
                              {clip.description}
                            </div>
                          )}
                        </div>

                        {/* 상태 및 액션 */}
                        <div className="flex items-center gap-2">
                          {(() => {
                            const overlapInfo = getClipOverlapInfo(clip);
                            return overlapInfo.hasOverlap && (
                              <div className="relative group">
                                <ExclamationTriangleIcon 
                                  className="w-5 h-5 text-amber-500" 
                                  title={`시간 중복: ${overlapInfo.overlappingCount}개 클립과 겹침`}
                                />
                                <div className="absolute right-0 top-6 w-64 p-2 bg-amber-50 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                                  <div className="text-xs text-amber-800 dark:text-amber-200">
                                    <div className="font-semibold mb-1">시간 중복 클립 ({overlapInfo.overlappingCount}개)</div>
                                    {overlapInfo.overlappingClips.slice(0, 3).map((overlappingClip, idx) => (
                                      <div key={idx} className="mb-1">
                                        • {getDisplayTitle(overlappingClip.title, overlappingClip.songDetail?.titleAlias)} ({formatTime(overlappingClip.startTime || 0)}-{formatTime(overlappingClip.endTime || 0)})
                                      </div>
                                    ))}
                                    {overlapInfo.overlappingCount > 3 && (
                                      <div className="text-amber-700 dark:text-amber-300">
                                        외 {overlapInfo.overlappingCount - 3}개...
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          {clip.isVerified ? (
                            <CheckCircleIconSolid className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircleIcon className="w-5 h-5 text-orange-500" />
                          )}
                          <button
                            onClick={() => handleClipAction(clip._id, clip.isVerified ? 'unverify' : 'verify')}
                            className={`p-1 rounded transition-colors ${
                              clip.isVerified 
                                ? 'hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-600' 
                                : 'hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600'
                            }`}
                            title={clip.isVerified ? '검증 해제' : '검증 승인'}
                          >
                            {clip.isVerified ? (
                              <XCircleIcon className="w-4 h-4" />
                            ) : (
                              <CheckCircleIcon className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteClip(clip._id)}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600"
                            title="삭제"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* 총 클립 수 표시 */}
          {clips.length > 0 && (
            <div className="p-4 border-t border-light-primary/20 dark:border-dark-primary/20">
              <div className="text-sm text-light-text/60 dark:text-dark-text/60 text-center">
                총 {clips.length.toLocaleString()}개의 클립이 표시되고 있습니다
                {filteredClips.length !== allClips.length && (
                  <span> (전체 {allClips.length.toLocaleString()}개 중 필터링됨)</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}