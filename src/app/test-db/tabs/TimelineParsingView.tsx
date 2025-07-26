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
  ChevronUpIcon
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

export default function TimelineParsingView() {
  const [loading, setLoading] = useState(false);
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
  const [filterType, setFilterType] = useState<'all' | 'relevant' | 'excluded' | 'matched' | 'unmatched'>('all');
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchingClip, setMatchingClip] = useState<LiveClipItem | null>(null);
  const [songMatches, setSongMatches] = useState<any[]>([]);
  const [matchingLoading, setMatchingLoading] = useState(false);

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

  // 클립 관련성 토글
  const toggleClipRelevance = async (clipId: string) => {
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
        setLiveClips(prev => prev.map(clip => 
          clip.id === clipId 
            ? { ...clip, isRelevant: !clip.isRelevant }
            : clip
        ));
      } else {
        alert(result.error || '업데이트 실패');
      }
    } catch (error) {
      console.error('관련성 업데이트 오류:', error);
      alert('업데이트 중 오류가 발생했습니다.');
    }
  };

  // 클립 제외/포함 토글
  const toggleClipExclusion = async (clipId: string) => {
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
        setLiveClips(prev => prev.map(clip => 
          clip.id === clipId 
            ? { ...clip, isExcluded: !clip.isExcluded }
            : clip
        ));
      } else {
        alert(result.error || '업데이트 실패');
      }
    } catch (error) {
      console.error('제외 상태 업데이트 오류:', error);
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

  // 필터링된 클립들
  const filteredClips = liveClips.filter(clip => {
    switch (filterType) {
      case 'relevant': return clip.isRelevant && !clip.isExcluded;
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

  useEffect(() => {
    // 초기 로드 시 기존 타임라인 데이터 확인
    parseTimelineComments();
  }, []);

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 p-6 overflow-hidden">
      <div className="w-full h-full flex flex-col space-y-6">
        {/* 헤더 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                타임라인 파싱 관리
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                댓글에서 추출된 타임라인 정보를 분석하고 라이브 클립 등록을 준비합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={parseTimelineComments}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    파싱 중...
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4" />
                    타임라인 파싱
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mt-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalVideos}</div>
              <div className="text-xs text-blue-700 dark:text-blue-300">비디오</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.totalTimelineComments}</div>
              <div className="text-xs text-purple-700 dark:text-purple-300">타임라인 댓글</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.parsedItems}</div>
              <div className="text-xs text-green-700 dark:text-green-300">파싱 완료</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.relevantItems}</div>
              <div className="text-xs text-yellow-700 dark:text-yellow-300">관련성 있음</div>
            </div>
            <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">{stats.matchedSongs}</div>
              <div className="text-xs text-pink-700 dark:text-pink-300">매칭된 곡</div>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.uniqueSongs}</div>
              <div className="text-xs text-indigo-700 dark:text-indigo-300">고유 곡 수</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
          {/* 타임라인 항목 목록 */}
          <div className="flex-1 xl:flex-[2] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  라이브 클립 ({filteredClips.length}개)
                </h3>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">전체</option>
                  <option value="relevant">관련성 있음</option>
                  <option value="excluded">제외됨</option>
                  <option value="matched">매칭 완료</option>
                  <option value="unmatched">미매칭</option>
                </select>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">파싱 중...</p>
                </div>
              ) : filteredClips.length === 0 ? (
                <div className="p-8 text-center">
                  <MusicalNoteIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">라이브 클립 데이터가 없습니다.</p>
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
                          <div className="flex gap-1 flex-shrink-0">
                            {clip.isRelevant && (
                              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">
                                관련성 있음
                              </span>
                            )}
                            {clip.isExcluded && (
                              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
                                제외됨
                              </span>
                            )}
                            {clip.matchedSong && (
                              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs">
                                매칭됨
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400 mb-2">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            {new Date(clip.uploadedDate).toLocaleDateString('ko-KR')}
                          </span>
                          <span className="flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" />
                            {formatSeconds(clip.startTimeSeconds)}
                            {clip.endTimeSeconds && ` ~ ${formatSeconds(clip.endTimeSeconds)}`}
                          </span>
                          {clip.duration && (
                            <span className="flex items-center gap-1">
                              <PlayIcon className="w-3 h-3" />
                              {formatDuration(clip.duration)}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500 dark:text-gray-500 truncate">
                          {clip.videoTitle}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleClipRelevance(clip.id);
                          }}
                          className={`p-1 rounded transition-colors ${
                            clip.isRelevant 
                              ? 'text-green-600 hover:text-green-700' 
                              : 'text-gray-400 hover:text-green-600'
                          }`}
                          title={clip.isRelevant ? '관련성 해제' : '관련성 표시'}
                        >
                          <CheckCircleIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleClipExclusion(clip.id);
                          }}
                          className={`p-1 rounded transition-colors ${
                            clip.isExcluded 
                              ? 'text-red-600 hover:text-red-700' 
                              : 'text-gray-400 hover:text-red-600'
                          }`}
                          title={clip.isExcluded ? '제외 해제' : '제외 표시'}
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                        
                        {/* 곡 매칭 관련 버튼 */}
                        {clip.matchedSong ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSongMatch(clip.id);
                            }}
                            className="p-1 rounded transition-colors text-purple-600 hover:text-red-600"
                            title="매칭 해제"
                          >
                            <MusicalNoteIcon className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              findSongMatches(clip.id);
                            }}
                            disabled={matchingLoading}
                            className="p-1 rounded transition-colors text-gray-400 hover:text-purple-600 disabled:opacity-50"
                            title="곡 매칭 찾기"
                          >
                            {matchingLoading ? (
                              <div className="w-4 h-4 border border-gray-400 border-t-purple-600 rounded-full animate-spin" />
                            ) : (
                              <MusicalNoteIcon className="w-4 h-4" />
                            )}
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selectedClip ? '라이브 클립 상세' : '상세 정보'}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!selectedClip ? (
                <div className="p-8 text-center">
                  <EyeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">라이브 클립을 선택해주세요.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">곡 정보</h4>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm">
                      <p className="font-medium text-lg">{selectedClip.artist} - {selectedClip.songTitle}</p>
                      <div className="mt-2 space-y-1 text-gray-600 dark:text-gray-400">
                        <p>시작 시간: {formatSeconds(selectedClip.startTimeSeconds)}</p>
                        {selectedClip.endTimeSeconds && (
                          <p>종료 시간: {formatSeconds(selectedClip.endTimeSeconds)}</p>
                        )}
                        {selectedClip.duration && (
                          <p>재생 길이: {formatDuration(selectedClip.duration)}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">비디오 정보</h4>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm">
                      <p className="font-medium">{selectedClip.videoTitle}</p>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">
                        업로드: {new Date(selectedClip.uploadedDate).toLocaleDateString('ko-KR')}
                      </p>
                      {selectedClip.originalDateString && (
                        <p className="text-gray-600 dark:text-gray-400">
                          추출된 날짜: {selectedClip.originalDateString}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">비디오 링크</h4>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm">
                      <div className="space-y-2">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">기본 URL:</span>
                          <a 
                            href={selectedClip.videoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block text-blue-600 dark:text-blue-400 hover:underline text-xs break-all mt-1"
                          >
                            {selectedClip.videoUrl}
                          </a>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">시작 시간 포함:</span>
                          <a 
                            href={`${selectedClip.videoUrl}${selectedClip.videoUrl.includes('?') ? '&' : '?'}t=${selectedClip.startTimeSeconds}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block text-blue-600 dark:text-blue-400 hover:underline text-xs break-all mt-1"
                          >
                            {selectedClip.videoUrl}?t={selectedClip.startTimeSeconds}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">원본 댓글</h4>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm max-h-40 overflow-y-auto">
                      <div className="text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{__html: selectedClip.originalComment}} />
                    </div>
                  </div>

                  {selectedClip.matchedSong && (
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">매칭된 곡</h4>
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded text-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {selectedClip.matchedSong.title}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400">
                              {selectedClip.matchedSong.artist}
                            </p>
                          </div>
                          <span className="text-xs bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                            {Math.round(selectedClip.matchedSong.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
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
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {songMatches.length === 0 ? (
                <div className="text-center py-8">
                  <MusicalNoteIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    매칭 후보를 찾을 수 없습니다.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    신뢰도 60% 이상의 매칭이 없습니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {songMatches.map((match, index) => (
                    <div
                      key={match.songId}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 dark:text-white">
                                {match.title}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {match.artist}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  match.confidence >= 0.9 
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                    : match.confidence >= 0.8 
                                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                    : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                                }`}>
                                  {Math.round(match.confidence * 100)}%
                                </span>
                                {match.matchedField === 'alias' && (
                                  <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                    별칭 매칭
                                  </span>
                                )}
                              </div>
                            </div>
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