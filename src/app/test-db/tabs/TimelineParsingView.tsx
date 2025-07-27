'use client';

import { useState, useEffect } from 'react';
import { 
  PlayIcon,
  ChatBubbleBottomCenterTextIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  LinkIcon,
  MusicalNoteIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon
} from '@heroicons/react/24/outline';

interface LiveClipItem {
  id: string;
  videoId: string;
  videoTitle: string;
  uploadedDate: string;
  originalDateString?: string;
  artist: string;
  songTitle: string;
  videoUrl: string;
  startTimeSeconds: number;
  endTimeSeconds?: number;
  duration?: number;
  isRelevant: boolean;
  isExcluded: boolean;
  matchedSong?: {
    songId: string;
    title: string;
    artist: string;
    confidence: number;
  };
  originalComment: string;
}

interface TimelineStats {
  totalVideos: number;
  totalTimelineComments: number;
  parsedItems: number;
  relevantItems: number;
  matchedSongs: number;
  uniqueSongs: number;
}

interface TimelineParsingViewProps {
  onStatsUpdate?: (stats: TimelineStats) => void;
}

export default function TimelineParsingView({ onStatsUpdate }: TimelineParsingViewProps) {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [liveClips, setLiveClips] = useState<LiveClipItem[]>([]);
  const [stats, setStats] = useState<TimelineStats>({
    totalVideos: 0,
    totalTimelineComments: 0,
    parsedItems: 0,
    relevantItems: 0,
    matchedSongs: 0,
    uniqueSongs: 0
  });
  const [selectedClip, setSelectedClip] = useState<LiveClipItem | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'relevant' | 'irrelevant' | 'excluded' | 'matched' | 'unmatched'>('all');
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchingClip, setMatchingClip] = useState<LiveClipItem | null>(null);
  const [songMatches, setSongMatches] = useState<any[]>([]);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingData, setEditingData] = useState<{
    artist: string;
    songTitle: string;
    startTimeSeconds: number;
    endTimeSeconds?: number;
  } | null>(null);

  // 타임라인 파싱 실행
  const parseTimelineComments = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'parse-timeline-comments'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setLiveClips(result.data.items);
        setStats(result.data.stats);
        onStatsUpdate?.(result.data.stats);
      } else {
        alert(result.error || '타임라인 파싱 실패');
      }
    } catch (error) {
      console.error('타임라인 파싱 오류:', error);
      alert('타임라인 파싱 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 기존 데이터 로드 상태를 토글하여 새로고침
  const loadExistingData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/timeline-parser?action=get-parsed-items');
      const result = await response.json();
      
      if (result.success) {
        setLiveClips(result.data);
      }
    } catch (error) {
      console.error('기존 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 제외 상태 토글
  const toggleExcluded = async (clipId: string) => {
    try {
      const clip = liveClips.find(c => c.id === clipId);
      if (!clip) return;

      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-item-exclusion',
          itemId: clipId,
          isExcluded: !clip.isExcluded
        })
      });

      const result = await response.json();
      
      if (result.success) {
        const updatedClips = liveClips.map(clip => 
          clip.id === clipId 
            ? { ...clip, isExcluded: !clip.isExcluded }
            : clip
        );
        setLiveClips(updatedClips);
        
        // 통계 재계산
        const relevantItems = updatedClips.filter(clip => clip.isRelevant && !clip.isExcluded).length;
        const matchedItems = updatedClips.filter(clip => clip.matchedSong).length;
        const uniqueSongs = new Set(updatedClips.map(clip => `${clip.artist}_${clip.songTitle}`)).size;
        
        setStats(prev => ({
          ...prev,
          relevantItems: relevantItems,
          matchedSongs: matchedItems,
          uniqueSongs: uniqueSongs
        }));
      } else {
        alert(result.error || '업데이트 실패');
      }
    } catch (error) {
      console.error('제외 상태 업데이트 오류:', error);
      alert('업데이트 중 오류가 발생했습니다.');
    }
  };

  // 관련성 상태 토글
  const toggleRelevance = async (clipId: string) => {
    try {
      const clip = liveClips.find(c => c.id === clipId);
      if (!clip) return;

      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-item-relevance',
          itemId: clipId,
          isRelevant: !clip.isRelevant
        })
      });

      const result = await response.json();
      
      if (result.success) {
        const updatedClips = liveClips.map(clip => 
          clip.id === clipId 
            ? { ...clip, isRelevant: !clip.isRelevant }
            : clip
        );
        setLiveClips(updatedClips);
        
        // 통계 재계산
        const relevantItems = updatedClips.filter(clip => clip.isRelevant && !clip.isExcluded).length;
        const matchedItems = updatedClips.filter(clip => clip.matchedSong).length;
        const uniqueSongs = new Set(updatedClips.map(clip => `${clip.artist}_${clip.songTitle}`)).size;
        
        setStats(prev => ({
          ...prev,
          relevantItems: relevantItems,
          matchedSongs: matchedItems,
          uniqueSongs: uniqueSongs
        }));
      } else {
        alert(result.error || '업데이트 실패');
      }
    } catch (error) {
      console.error('관련성 상태 업데이트 오류:', error);
      alert('업데이트 중 오류가 발생했습니다.');
    }
  };

  // 곡 매칭 후보 찾기
  const findSongMatches = async (clipId: string) => {
    setMatchingLoading(true);
    try {
      const clip = liveClips.find(c => c.id === clipId);
      if (!clip) return;

      setMatchingClip(clip);

      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'find-song-matches',
          itemId: clipId
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setSongMatches(result.data.matches);
        setShowMatchModal(true);
      } else {
        alert(result.error || '매칭 후보를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('곡 매칭 오류:', error);
      alert('매칭 중 오류가 발생했습니다.');
    } finally {
      setMatchingLoading(false);
    }
  };

  // 곡 매칭 할당
  const assignSongMatch = async (songId: string, confidence: number) => {
    try {
      if (!matchingClip) return;

      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign-song-match',
          itemId: matchingClip.id,
          songId,
          confidence
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // 로컬 상태 업데이트
        const selectedSong = songMatches.find(match => match.songId === songId);
        if (selectedSong) {
          setLiveClips(prev => prev.map(clip => 
            clip.id === matchingClip.id 
              ? { 
                  ...clip, 
                  matchedSong: {
                    songId,
                    title: selectedSong.title,
                    artist: selectedSong.artist,
                    confidence
                  }
                }
              : clip
          ));
        }
        setShowMatchModal(false);
        setMatchingClip(null);
        setSongMatches([]);
      } else {
        alert(result.error || '매칭 할당 실패');
      }
    } catch (error) {
      console.error('곡 매칭 할당 오류:', error);
      alert('매칭 할당 중 오류가 발생했습니다.');
    }
  };

  // 곡 매칭 해제
  const removeSongMatch = async (clipId: string) => {
    try {
      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove-song-match',
          itemId: clipId
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setLiveClips(prev => prev.map(clip => 
          clip.id === clipId 
            ? { ...clip, matchedSong: undefined }
            : clip
        ));
      } else {
        alert(result.error || '매칭 해제 실패');
      }
    } catch (error) {
      console.error('곡 매칭 해제 오류:', error);
      alert('매칭 해제 중 오류가 발생했습니다.');
    }
  };

  // 편집 시작
  const startEdit = () => {
    if (!selectedClip) return;
    setEditingData({
      artist: selectedClip.artist,
      songTitle: selectedClip.songTitle,
      startTimeSeconds: selectedClip.startTimeSeconds,
      endTimeSeconds: selectedClip.endTimeSeconds
    });
    setIsEditing(true);
  };

  // 편집 취소
  const cancelEdit = () => {
    setIsEditing(false);
    setEditingData(null);
  };

  // 편집 저장
  const saveEdit = async () => {
    if (!selectedClip || !editingData) return;

    try {
      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-live-clip',
          itemId: selectedClip.id,
          artist: editingData.artist,
          songTitle: editingData.songTitle,
          startTimeSeconds: editingData.startTimeSeconds,
          endTimeSeconds: editingData.endTimeSeconds
        })
      });

      const result = await response.json();

      if (result.success) {
        // 로컬 상태 업데이트
        setLiveClips(prev => prev.map(clip => 
          clip.id === selectedClip.id 
            ? { 
                ...clip, 
                artist: editingData.artist,
                songTitle: editingData.songTitle,
                startTimeSeconds: editingData.startTimeSeconds,
                endTimeSeconds: editingData.endTimeSeconds,
                duration: editingData.endTimeSeconds && editingData.endTimeSeconds > editingData.startTimeSeconds
                  ? editingData.endTimeSeconds - editingData.startTimeSeconds
                  : clip.duration
              }
            : clip
        ));

        // 선택된 클립도 업데이트
        setSelectedClip(prev => prev ? {
          ...prev,
          artist: editingData.artist,
          songTitle: editingData.songTitle,
          startTimeSeconds: editingData.startTimeSeconds,
          endTimeSeconds: editingData.endTimeSeconds,
          duration: editingData.endTimeSeconds && editingData.endTimeSeconds > editingData.startTimeSeconds
            ? editingData.endTimeSeconds - editingData.startTimeSeconds
            : prev.duration
        } : null);

        setIsEditing(false);
        setEditingData(null);
        
        console.log('편집 내용이 데이터베이스에 저장되었습니다.');
      } else {
        alert(result.error || '편집 저장 실패');
      }
    } catch (error) {
      console.error('편집 저장 오류:', error);
      alert('편집 저장 중 오류가 발생했습니다.');
    }
  };

  // 필터링된 클립들
  const filteredClips = liveClips.filter(clip => {
    switch (filterType) {
      case 'relevant': return clip.isRelevant && !clip.isExcluded;
      case 'irrelevant': return !clip.isRelevant && !clip.isExcluded;
      case 'excluded': return clip.isExcluded;
      case 'matched': return clip.matchedSong;
      case 'unmatched': return !clip.matchedSong;
      default: return true;
    }
  });

  // 초를 MM:SS 형식으로 변환
  const formatSeconds = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // 시간 길이를 분:초 형식으로 변환
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    return formatSeconds(seconds);
  };

  // 기존 파싱된 데이터 로드
  const loadExistingDataOnMount = async () => {
    try {
      const response = await fetch('/api/timeline-parser?action=get-parsed-items');
      const result = await response.json();
      
      if (result.success) {
        setLiveClips(result.data);
        // 통계 계산
        const totalItems = result.data.length;
        const relevantItems = result.data.filter((clip: LiveClipItem) => clip.isRelevant && !clip.isExcluded).length;
        const matchedItems = result.data.filter((clip: LiveClipItem) => clip.matchedSong).length;
        const uniqueSongs = new Set(result.data.map((clip: LiveClipItem) => `${clip.artist}_${clip.songTitle}`)).size;
        
        const newStats = {
          totalVideos: 0,
          totalTimelineComments: 0,
          parsedItems: totalItems,
          relevantItems: relevantItems,
          matchedSongs: matchedItems,
          uniqueSongs: uniqueSongs
        };
        
        setStats(newStats);
      }
    } catch (error) {
      console.error('기존 데이터 로드 오류:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    // 초기 로드 시 기존 타임라인 데이터만 로드
    loadExistingDataOnMount();
  }, []);

  // 통계 업데이트를 위한 별도 useEffect
  useEffect(() => {
    onStatsUpdate?.(stats);
  }, [stats, onStatsUpdate]);

  return (
    <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
      {/* 파싱된 타임라인 목록 */}
      <div className="flex-1 xl:flex-[1] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              파싱된 타임라인 ({filteredClips.length}개)
            </h3>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">전체</option>
              <option value="relevant">관련성 있음</option>
              <option value="irrelevant">관련성 없음</option>
              <option value="excluded">제외됨</option>
              <option value="matched">매칭 완료</option>
              <option value="unmatched">미매칭</option>
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {(loading || initialLoading) ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {loading ? '파싱 중...' : '데이터 로딩 중...'}
              </p>
            </div>
          ) : filteredClips.length === 0 ? (
            <div className="p-8 text-center">
              <MusicalNoteIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">파싱된 타임라인 데이터가 없습니다.</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">타임라인 파싱을 실행해주세요.</p>
            </div>
          ) : (
            filteredClips.map((clip) => (
              <div
                key={clip.id}
                className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                  selectedClip?.id === clip.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
                onClick={() => setSelectedClip(clip)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                        {clip.artist} - {clip.songTitle}
                      </h4>
                      <div className="flex gap-1">
                        {!clip.isRelevant && (
                          <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs">
                            관련성 없음
                          </span>
                        )}
                        {clip.isExcluded && (
                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
                            제외됨
                          </span>
                        )}
                        {clip.matchedSong && (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">
                            매칭완료
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      {formatSeconds(clip.startTimeSeconds)}
                      {clip.endTimeSeconds && ` ~ ${formatSeconds(clip.endTimeSeconds)}`}
                      {clip.duration && ` (${formatDuration(clip.duration)})`}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {clip.videoTitle}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRelevance(clip.id);
                      }}
                      className={`p-1 rounded transition-colors ${
                        clip.isRelevant 
                          ? 'text-green-600 hover:text-green-700' 
                          : 'text-orange-400 hover:text-orange-600'
                      }`}
                      title={clip.isRelevant ? '관련성 없음으로 변경' : '관련성 있음으로 변경'}
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExcluded(clip.id);
                      }}
                      className={`p-1 rounded transition-colors ${
                        clip.isExcluded 
                          ? 'text-red-600 hover:text-red-700' 
                          : 'text-gray-400 hover:text-red-600'
                      }`}
                      title={clip.isExcluded ? '제외 해제' : '제외'}
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                    {clip.isRelevant && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          findSongMatches(clip.id);
                        }}
                        disabled={matchingLoading}
                        className="p-1 text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50"
                        title="곡 매칭"
                      >
                        <LinkIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 상세 정보 */}
      <div className="flex-1 xl:flex-[1] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedClip ? '파싱된 타임라인 상세' : '상세 정보'}
            </h3>
            {selectedClip && (
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={saveEdit}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                    >
                      저장
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startEdit}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors flex items-center gap-1"
                  >
                    <PencilIcon className="w-4 h-4" />
                    편집
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedClip ? (
            <div className="p-8 text-center">
              <EyeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">항목을 선택해주세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 기본 정보 */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">기본 정보</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      아티스트
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingData?.artist || ''}
                        onChange={(e) => setEditingData(prev => prev ? {...prev, artist: e.target.value} : null)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded
                                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 dark:text-white">{selectedClip.artist}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      곡명
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingData?.songTitle || ''}
                        onChange={(e) => setEditingData(prev => prev ? {...prev, songTitle: e.target.value} : null)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded
                                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 dark:text-white">{selectedClip.songTitle}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        시작 시간 (초)
                      </label>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editingData?.startTimeSeconds || 0}
                          onChange={(e) => setEditingData(prev => prev ? {...prev, startTimeSeconds: parseInt(e.target.value) || 0} : null)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded
                                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      ) : (
                        <p className="text-sm text-gray-900 dark:text-white">
                          {selectedClip.startTimeSeconds} ({formatSeconds(selectedClip.startTimeSeconds)})
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        종료 시간 (초)
                      </label>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editingData?.endTimeSeconds || ''}
                          onChange={(e) => setEditingData(prev => prev ? {...prev, endTimeSeconds: e.target.value ? parseInt(e.target.value) : undefined} : null)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded
                                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      ) : (
                        <p className="text-sm text-gray-900 dark:text-white">
                          {selectedClip.endTimeSeconds ? `${selectedClip.endTimeSeconds} (${formatSeconds(selectedClip.endTimeSeconds)})` : '없음'}
                        </p>
                      )}
                    </div>
                  </div>
                  {selectedClip.duration && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        지속 시간
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {selectedClip.duration}초 ({formatDuration(selectedClip.duration)})
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 비디오 정보 */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">비디오 정보</h4>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">제목</label>
                    <p className="text-sm text-gray-900 dark:text-white">{selectedClip.videoTitle}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">업로드 날짜</label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {new Date(selectedClip.uploadedDate).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">링크</label>
                    <a 
                      href={`${selectedClip.videoUrl}&t=${selectedClip.startTimeSeconds}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      YouTube에서 보기
                    </a>
                  </div>
                </div>
              </div>

              {/* 매칭 정보 */}
              {selectedClip.matchedSong && (
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-green-800 dark:text-green-200">매칭된 곡</h4>
                    <button
                      onClick={() => removeSongMatch(selectedClip.id)}
                      className="text-xs text-red-600 hover:text-red-700 transition-colors"
                    >
                      매칭 해제
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-green-700 dark:text-green-300 mb-1">아티스트</label>
                      <p className="text-sm text-green-800 dark:text-green-200">{selectedClip.matchedSong.artist}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-green-700 dark:text-green-300 mb-1">제목</label>
                      <p className="text-sm text-green-800 dark:text-green-200">{selectedClip.matchedSong.title}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-green-700 dark:text-green-300 mb-1">신뢰도</label>
                      <p className="text-sm text-green-800 dark:text-green-200">
                        {Math.round(selectedClip.matchedSong.confidence * 100)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 상태 정보 */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">상태</h4>
                <div className="flex flex-wrap gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    selectedClip.isRelevant 
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                      : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200'
                  }`}>
                    {selectedClip.isRelevant ? '관련성 있음' : '관련성 없음'}
                  </span>
                  {selectedClip.isExcluded && (
                    <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full text-xs font-medium">
                      제외됨
                    </span>
                  )}
                  {selectedClip.matchedSong && (
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-xs font-medium">
                      매칭 완료
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 곡 매칭 모달 */}
      {showMatchModal && matchingClip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    곡 매칭 후보
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {matchingClip.artist} - {matchingClip.songTitle}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowMatchModal(false);
                    setMatchingClip(null);
                    setSongMatches([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-96">
              {songMatches.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">매칭 후보를 찾을 수 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {songMatches.map((match, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {match.artist} - {match.title}
                            </h4>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              match.confidence >= 0.9 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
                              match.confidence >= 0.8 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' :
                              'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200'
                            }`}>
                              {Math.round(match.confidence * 100)}% 일치
                            </span>
                            {match.matchedField === 'alias' && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded text-xs font-medium">
                                별칭 매칭
                              </span>
                            )}
                          </div>
                          
                          <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-500">
                            <div>
                              아티스트 유사도: {Math.round(match.artistSimilarity * 100)}% | 
                              제목 유사도: {Math.round(match.titleSimilarity * 100)}%
                            </div>
                            <button
                              onClick={() => assignSongMatch(match.songId, match.confidence)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                            >
                              매칭 선택
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowMatchModal(false);
                    setMatchingClip(null);
                    setSongMatches([]);
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}