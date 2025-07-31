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
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import {
  CheckCircleIcon as CheckCircleIconSolid,
  PlayIcon as PlayIconSolid,
} from "@heroicons/react/24/solid";

interface ClipData {
  _id: string;
  songId: string;
  title: string;
  artist: string;
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
    language: string;
    sungCount: number;
  };
}

interface ClipStats {
  total: number;
  verified: number;
  unverified: number;
  topContributors: Array<{ name: string; count: number }>;
  topSongs: Array<{ songId: string; title: string; artist: string; count: number }>;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type SortBy = 'recent' | 'addedBy' | 'songTitle' | 'verified' | 'sungDate';
type FilterBy = 'all' | 'verified' | 'unverified';

export default function LiveClipManagementTab() {
  const [clips, setClips] = useState<ClipData[]>([]);
  const [stats, setStats] = useState<ClipStats | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
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

  // 편집 상태
  const [editingClip, setEditingClip] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState<number>(0);
  const [editEndTime, setEditEndTime] = useState<number>(0);
  const [editDescription, setEditDescription] = useState('');

  // UI 상태
  const [showFilters, setShowFilters] = useState(false);
  const [showPlayer, setShowPlayer] = useState(true);

  const playerRef = useRef<HTMLIFrameElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // 클립 데이터 로드
  const loadClips = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        filterBy,
        ...(search && { search }),
        ...(addedBy && { addedBy }),
        ...(selectedSongId && { songId: selectedSongId }),
      });

      const response = await fetch(`/api/admin/clips?${params}`);
      if (!response.ok) throw new Error('Failed to fetch clips');

      const data = await response.json();
      setClips(data.clips);
      setStats(data.stats);
      // pagination 업데이트에서 page는 제외 (무한 루프 방지)
      setPagination(prev => ({
        ...prev,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
        limit: data.pagination.limit
      }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // 초기 로드 및 페이지 변경 시
  useEffect(() => {
    loadClips();
  }, [pagination.page]);

  // 정렬/필터 변경 시 즉시 로드
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination(prev => ({ ...prev, page: 1 }));
    } else {
      loadClips();
    }
  }, [sortBy, filterBy]);

  // 검색 관련 디바운스 처리
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (pagination.page !== 1) {
        setPagination(prev => ({ ...prev, page: 1 }));
      } else {
        loadClips();
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search, addedBy, selectedSongId]);

  // 클립 액션 (검증, 수정, 삭제)
  const handleClipAction = async (clipId: string, action: string, data?: any) => {
    try {
      const response = await fetch('/api/admin/clips', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId, action, data }),
      });

      if (!response.ok) throw new Error('Failed to update clip');

      // 목록 새로고침
      loadClips();
      
      // 선택된 클립 업데이트
      if (selectedClip && selectedClip._id === clipId) {
        const updatedClip = clips.find(c => c._id === clipId);
        if (updatedClip) setSelectedClip(updatedClip);
      }
    } catch (err) {
      console.error('Clip action error:', err);
      alert('작업 중 오류가 발생했습니다.');
    }
  };

  // 클립 삭제
  const handleDeleteClip = async (clipId: string) => {
    if (!confirm('정말로 이 클립을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/admin/clips?clipId=${clipId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete clip');

      loadClips();
      if (selectedClip && selectedClip._id === clipId) {
        setSelectedClip(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 플레이어 제어
  const playClip = (clip: ClipData) => {
    setSelectedClip(clip);
    setIsPlaying(true);
    if (clip.startTime) {
      setCurrentTime(clip.startTime);
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const seekTo = (time: number) => {
    setCurrentTime(time);
    // YouTube player API 호출 (실제 구현에서는 YouTube API 사용)
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
          <button
            onClick={() => setShowPlayer(!showPlayer)}
            className="px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            {showPlayer ? '플레이어 숨기기' : '플레이어 보기'}
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <iframe
                    ref={playerRef}
                    src={`https://www.youtube.com/embed/${selectedClip.videoId}?start=${selectedClip.startTime || 0}&end=${selectedClip.endTime || 0}&autoplay=${isPlaying ? 1 : 0}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                
                {/* 플레이어 컨트롤 */}
                <div className="mt-4 bg-gray-900/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={togglePlay}
                        className="w-10 h-10 bg-light-accent dark:bg-dark-accent rounded-full flex items-center justify-center text-white hover:opacity-90"
                      >
                        {isPlaying ? (
                          <PauseIcon className="w-5 h-5" />
                        ) : (
                          <PlayIconSolid className="w-5 h-5 ml-0.5" />
                        )}
                      </button>
                      <button
                        onClick={() => seekTo((selectedClip.startTime || 0) - 10)}
                        className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600"
                      >
                        <BackwardIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => seekTo((selectedClip.startTime || 0) + 10)}
                        className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600"
                      >
                        <ForwardIcon className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm">
                        {formatTime(currentTime)} / {formatTime(selectedClip.endTime || duration)}
                      </span>
                    </div>
                  </div>

                  {/* 시간 설정 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white text-sm mb-1">시작 시간</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editingClip === selectedClip._id ? editStartTime : (selectedClip.startTime || 0)}
                          onChange={(e) => setEditStartTime(Number(e.target.value))}
                          className="flex-1 px-3 py-1 bg-gray-800 text-white rounded text-sm"
                          min="0"
                        />
                        <button
                          onClick={() => setEditStartTime(currentTime)}
                          className="px-2 py-1 bg-light-accent dark:bg-dark-accent text-white rounded text-xs hover:opacity-90"
                        >
                          현재
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-white text-sm mb-1">종료 시간</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editingClip === selectedClip._id ? editEndTime : (selectedClip.endTime || 0)}
                          onChange={(e) => setEditEndTime(Number(e.target.value))}
                          className="flex-1 px-3 py-1 bg-gray-800 text-white rounded text-sm"
                          min="0"
                        />
                        <button
                          onClick={() => setEditEndTime(currentTime)}
                          className="px-2 py-1 bg-light-accent dark:bg-dark-accent text-white rounded text-xs hover:opacity-90"
                        >
                          현재
                        </button>
                      </div>
                    </div>
                  </div>

                  {editingClip === selectedClip._id && (
                    <div className="flex items-center gap-2 mt-4">
                      <button
                        onClick={() => {
                          handleClipAction(selectedClip._id, 'updateTimes', {
                            startTime: editStartTime,
                            endTime: editEndTime
                          });
                          setEditingClip(null);
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingClip(null)}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 클립 정보 */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-2">
                    {selectedClip.title}
                  </h3>
                  <p className="text-light-text/70 dark:text-dark-text/70">
                    {selectedClip.artist}
                  </p>
                </div>

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
                  <div className="flex items-center gap-2">
                    {selectedClip.isVerified ? (
                      <CheckCircleIconSolid className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircleIcon className="w-4 h-4 text-orange-500" />
                    )}
                    <span className="text-light-text/70 dark:text-dark-text/70">
                      {selectedClip.isVerified ? '검증됨' : '미검증'}
                    </span>
                  </div>
                </div>

                {selectedClip.description && (
                  <div>
                    <h4 className="text-sm font-medium text-light-text dark:text-dark-text mb-1">
                      설명
                    </h4>
                    <p className="text-sm text-light-text/70 dark:text-dark-text/70">
                      {selectedClip.description}
                    </p>
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex flex-col gap-2 pt-4 border-t border-light-primary/20 dark:border-dark-primary/20">
                  <button
                    onClick={() => {
                      if (editingClip === selectedClip._id) {
                        setEditingClip(null);
                      } else {
                        setEditingClip(selectedClip._id);
                        setEditStartTime(selectedClip.startTime || 0);
                        setEditEndTime(selectedClip.endTime || 0);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    <PencilIcon className="w-4 h-4" />
                    {editingClip === selectedClip._id ? '편집 취소' : '시간 편집'}
                  </button>
                  
                  <button
                    onClick={() => 
                      handleClipAction(
                        selectedClip._id, 
                        selectedClip.isVerified ? 'unverify' : 'verify'
                      )
                    }
                    className={`flex items-center gap-2 px-4 py-2 rounded text-sm ${
                      selectedClip.isVerified
                        ? 'bg-orange-600 hover:bg-orange-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {selectedClip.isVerified ? (
                      <>
                        <XCircleIcon className="w-4 h-4" />
                        검증 해제
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-4 h-4" />
                        검증 승인
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => handleDeleteClip(selectedClip._id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                  >
                    <TrashIcon className="w-4 h-4" />
                    삭제
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 필터 및 검색 */}
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
            className="flex items-center gap-2 px-4 py-2 bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent rounded-lg hover:bg-light-accent/20 dark:hover:bg-dark-accent/20"
          >
            <FunnelIcon className="w-5 h-5" />
            필터
            <ChevronDownIcon className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* 확장된 필터 */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-light-primary/20 dark:border-dark-primary/20"
            >
              <div>
                <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                  정렬 기준
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                >
                  <option value="recent">최근 등록순</option>
                  <option value="sungDate">부른 날짜순</option>
                  <option value="addedBy">등록자별</option>
                  <option value="songTitle">곡 제목순</option>
                  <option value="verified">검증 상태별</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                  검증 상태
                </label>
                <select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value as FilterBy)}
                  className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                >
                  <option value="all">전체</option>
                  <option value="verified">검증됨</option>
                  <option value="unverified">미검증</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                  등록자 필터
                </label>
                <input
                  type="text"
                  placeholder="등록자 이름으로 필터링"
                  value={addedBy}
                  onChange={(e) => setAddedBy(e.target.value)}
                  className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg text-light-text dark:text-dark-text placeholder-light-text/40 dark:placeholder-dark-text/40 focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 클립 리스트 */}
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
            {clips.map((clip) => (
              <div
                key={clip._id}
                className={`p-4 hover:bg-light-primary/5 dark:hover:bg-dark-primary/5 transition-colors ${
                  selectedClip?._id === clip._id ? 'bg-light-accent/5 dark:bg-dark-accent/5' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* 썸네일 */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={clip.thumbnailUrl || `https://img.youtube.com/vi/${clip.videoId}/mqdefault.jpg`}
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
                          {clip.title}
                        </h3>
                        <p className="text-sm text-light-text/70 dark:text-dark-text/70 truncate">
                          {clip.artist}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-light-text/60 dark:text-dark-text/60">
                          <span>{clip.addedByName}</span>
                          <span>{new Date(clip.createdAt).toLocaleDateString()}</span>
                          {clip.startTime && clip.endTime && (
                            <span>
                              {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 상태 및 액션 */}
                      <div className="flex items-center gap-2 ml-4">
                        {clip.isVerified ? (
                          <CheckCircleIconSolid className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircleIcon className="w-5 h-5 text-orange-500" />
                        )}
                        
                        <button
                          onClick={() => 
                            handleClipAction(
                              clip._id, 
                              clip.isVerified ? 'unverify' : 'verify'
                            )
                          }
                          className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                            clip.isVerified ? 'text-orange-600' : 'text-green-600'
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
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-red-600"
                          title="삭제"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-light-primary/20 dark:border-dark-primary/20">
            <div className="flex items-center justify-between">
              <div className="text-sm text-light-text/60 dark:text-dark-text/60">
                전체 {pagination.total}개 중 {((pagination.page - 1) * pagination.limit) + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)}개 표시
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                
                <span className="px-3 py-1 bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent rounded">
                  {pagination.page} / {pagination.totalPages}
                </span>
                
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
                  className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}