'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import YouTube from 'react-youtube';
import { 
  PlayIcon,
  PauseIcon,
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
  PencilIcon,
  CheckIcon,
  Square3Stack3DIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import SongMatchingDialog from '@/components/SongMatchingDialog';
import TimeVerificationSection from '@/components/TimeVerificationSection';
import { updateTimeVerification } from '@/utils/timeVerification';

interface ParsedTimelineItem {
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
  commentAuthor: string;
  commentId: string;
  commentPublishedAt: string;
  // 수동 검증 관련 필드
  isTimeVerified?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  createdAt: string;
  updatedAt: string;
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

// YouTube 플레이어 타입 정의
interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  seekTo(seconds: number): void;
}

// requestIdleCallback 타입 정의 추가
declare global {
  interface Window {
    requestIdleCallback?: (callback: (deadline: IdleDeadline) => void, options?: { timeout?: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  }
  interface IdleDeadline {
    timeRemaining(): number;
    readonly didTimeout: boolean;
  }
}

export default function TimelineParsingView({ onStatsUpdate }: TimelineParsingViewProps) {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [parsedTimelines, setParsedTimelines] = useState<ParsedTimelineItem[]>([]);
  const [stats, setStats] = useState<TimelineStats>({
    totalVideos: 0,
    totalTimelineComments: 0,
    parsedItems: 0,
    relevantItems: 0,
    matchedSongs: 0,
    uniqueSongs: 0
  });
  const [selectedTimeline, setSelectedTimeline] = useState<ParsedTimelineItem | null>(null);
  const [selectedTimelineIds, setSelectedTimelineIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1);
  const [filterType, setFilterType] = useState<'all' | 'relevant' | 'irrelevant' | 'excluded' | 'matched' | 'unmatched'>('all');
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchingTimeline, setMatchingTimeline] = useState<ParsedTimelineItem | null>(null);
  const [songMatches, setSongMatches] = useState<any[]>([]);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingData, setEditingData] = useState<{
    artist: string;
    songTitle: string;
    startTimeSeconds: number;
    endTimeSeconds?: number;
  } | null>(null);
  
  // 곡 매칭 다이얼로그 상태
  const [showMatchingDialog, setShowMatchingDialog] = useState(false);
  const [matchingTimelineItem, setMatchingTimelineItem] = useState<ParsedTimelineItem | null>(null);
  
  // 일괄 검색 상태
  const [batchSearchLoading, setBatchSearchLoading] = useState(false);
  const [batchSearchProgress, setBatchSearchProgress] = useState<{
    current: number;
    total: number;
    message: string;
  } | null>(null);
  
  // 일괄 검색 결과 저장 (메모리)
  const [batchSearchResults, setBatchSearchResults] = useState<Map<string, any[]>>(new Map());
  
  // 페이지네이션 상태 추가
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100);
  
  // YouTube 플레이어 상태
  const [youtubePlayer, setYoutubePlayer] = useState<YouTubePlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

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
        setParsedTimelines(result.data.items);
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
        setParsedTimelines(result.data);
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
      const timeline = parsedTimelines.find(c => c.id === clipId);
      if (!timeline) return;

      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-item-exclusion',
          itemId: clipId,
          isExcluded: !timeline.isExcluded
        })
      });

      const result = await response.json();
      
      if (result.success) {
        const updatedTimelines = parsedTimelines.map(timeline => 
          timeline.id === clipId 
            ? { ...timeline, isExcluded: !timeline.isExcluded }
            : timeline
        );
        setParsedTimelines(updatedTimelines);
        
        // 통계 재계산
        const relevantItems = updatedTimelines.filter(timeline => timeline.isRelevant && !timeline.isExcluded).length;
        const matchedItems = updatedTimelines.filter(timeline => timeline.matchedSong).length;
        const uniqueSongs = new Set(updatedTimelines.map(timeline => `${timeline.artist}_${timeline.songTitle}`)).size;
        
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
      const timeline = parsedTimelines.find(c => c.id === clipId);
      if (!timeline) return;

      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-item-relevance',
          itemId: clipId,
          isRelevant: !timeline.isRelevant
        })
      });

      const result = await response.json();
      
      if (result.success) {
        const updatedTimelines = parsedTimelines.map(timeline => 
          timeline.id === clipId 
            ? { ...timeline, isRelevant: !timeline.isRelevant }
            : timeline
        );
        setParsedTimelines(updatedTimelines);
        
        // 통계 재계산
        const relevantItems = updatedTimelines.filter(timeline => timeline.isRelevant && !timeline.isExcluded).length;
        const matchedItems = updatedTimelines.filter(timeline => timeline.matchedSong).length;
        const uniqueSongs = new Set(updatedTimelines.map(timeline => `${timeline.artist}_${timeline.songTitle}`)).size;
        
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
      const timeline = parsedTimelines.find(c => c.id === clipId);
      if (!timeline) return;

      setMatchingTimeline(timeline);

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
      if (!matchingTimeline) return;

      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign-song-match',
          itemId: matchingTimeline.id,
          songId,
          confidence
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // 로컬 상태 업데이트
        const selectedSong = songMatches.find(match => match.songId === songId);
        if (selectedSong) {
          setParsedTimelines(prev => prev.map(timeline => 
            timeline.id === matchingTimeline.id 
              ? { 
                  ...timeline, 
                  matchedSong: {
                    songId,
                    title: selectedSong.title,
                    artist: selectedSong.artist,
                    confidence
                  }
                }
              : timeline
          ));
        }
        setShowMatchModal(false);
        setMatchingTimeline(null);
        setSongMatches([]);
      } else {
        alert(result.error || '매칭 할당 실패');
      }
    } catch (error) {
      console.error('곡 매칭 할당 오류:', error);
      alert('매칭 할당 중 오류가 발생했습니다.');
    }
  };

  // 곡 매칭 다이얼로그 열기
  const openMatchingDialog = (timeline: ParsedTimelineItem) => {
    setMatchingTimelineItem(timeline);
    setShowMatchingDialog(true);
  };

  // 곡 매칭 처리
  // 직접 타임라인 아이템을 받는 매칭 함수 (후보 클릭용)
  const handleDirectSongMatch = async (timeline: ParsedTimelineItem, songId: string | null, confidence?: number) => {
    try {
      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'match-timeline-song',
          timelineId: timeline.id,
          songId: songId,
          confidence: confidence || 0
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // 로컬 상태 업데이트
        setParsedTimelines(prev => prev.map(t => 
          t.id === timeline.id 
            ? { 
                ...t, 
                matchedSong: songId ? {
                  songId: songId,
                  title: result.data.matchInfo?.title || t.songTitle,
                  artist: result.data.matchInfo?.artist || t.artist,
                  confidence: confidence || 0
                } : undefined
              }
            : t
        ));
        
        // 매칭 완료 시 해당 타임라인의 후보 목록을 메모리에서 제거
        if (songId) {
          setBatchSearchResults(prev => {
            const newResults = new Map(prev);
            newResults.delete(timeline.id);
            return newResults;
          });
        } else {
          // 매칭 해제 시 개별 검색을 다시 실행하여 후보 목록 복원
          try {
            const searchResponse = await fetch('/api/timeline-parser', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'search-song-matches',
                searchArtist: timeline.artist,
                searchTitle: timeline.songTitle,
              })
            });

            const searchResult = await searchResponse.json();
            if (searchResult.success && searchResult.data.candidates.length > 0) {
              setBatchSearchResults(prev => {
                const newResults = new Map(prev);
                newResults.set(timeline.id, searchResult.data.candidates);
                return newResults;
              });
            }
          } catch (searchError) {
            console.error('매칭 해제 후 재검색 오류:', searchError);
          }
        }
        
        // 선택된 타임라인이 현재 수정된 타임라인이면 상태 업데이트
        if (selectedTimeline && selectedTimeline.id === timeline.id) {
          setSelectedTimeline(prev => prev ? {
            ...prev,
            matchedSong: songId ? {
              songId: songId,
              title: result.data.matchInfo?.title || prev.songTitle,
              artist: result.data.matchInfo?.artist || prev.artist,
              confidence: confidence || 0
            } : undefined
          } : null);
        }
        
        // 통계 재계산
        const updatedTimelines = parsedTimelines.map(t => 
          t.id === timeline.id 
            ? { 
                ...t, 
                matchedSong: songId ? {
                  songId: songId,
                  title: result.data.matchInfo?.title || t.songTitle,
                  artist: result.data.matchInfo?.artist || t.artist,
                  confidence: confidence || 0
                } : undefined
              }
            : t
        );
        
        const matchedItems = updatedTimelines.filter(t => t.matchedSong).length;
        setStats(prev => ({
          ...prev,
          matchedSongs: matchedItems
        }));
        
        if (onStatsUpdate) {
          onStatsUpdate({
            ...stats,
            matchedSongs: matchedItems
          });
        }
      } else {
        alert(`매칭 ${songId ? '설정' : '해제'} 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('매칭 오류:', error);
      alert(`매칭 ${songId ? '설정' : '해제'} 중 오류가 발생했습니다.`);
    }
  };

  const handleSongMatch = async (songId: string | null, confidence?: number) => {
    if (!matchingTimelineItem) return;

    try {
      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'match-timeline-song',
          timelineId: matchingTimelineItem.id,
          songId: songId,
          confidence: confidence || 0
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // 로컬 상태 업데이트
        setParsedTimelines(prev => prev.map(timeline => 
          timeline.id === matchingTimelineItem.id 
            ? { 
                ...timeline, 
                matchedSong: songId ? {
                  songId: songId,
                  title: result.data.matchInfo?.title || timeline.songTitle,
                  artist: result.data.matchInfo?.artist || timeline.artist,
                  confidence: confidence || 0
                } : undefined
              }
            : timeline
        ));
        
        // 매칭 완료 시 해당 타임라인의 후보 목록을 메모리에서 제거
        if (songId) {
          setBatchSearchResults(prev => {
            const newResults = new Map(prev);
            newResults.delete(matchingTimelineItem.id);
            return newResults;
          });
        }
        
        // 통계 재계산
        const updatedTimelines = parsedTimelines.map(timeline => 
          timeline.id === matchingTimelineItem.id 
            ? { 
                ...timeline, 
                matchedSong: songId ? {
                  songId: songId,
                  title: result.data.matchInfo?.title || timeline.songTitle,
                  artist: result.data.matchInfo?.artist || timeline.artist,
                  confidence: confidence || 0
                } : undefined
              }
            : timeline
        );
        
        const matchedItems = updatedTimelines.filter(timeline => timeline.matchedSong).length;
        setStats(prev => ({
          ...prev,
          matchedSongs: matchedItems
        }));
      } else {
        alert(result.error || '매칭 처리 실패');
      }
    } catch (error) {
      console.error('곡 매칭 처리 오류:', error);
      alert('매칭 처리 중 오류가 발생했습니다.');
    }
  };

  // 곡 매칭 해제
  const removeSongMatch = async (clipId: string) => {
    try {
      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'match-timeline-song',
          timelineId: clipId,
          songId: null,
          confidence: 0
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setParsedTimelines(prev => prev.map(timeline => 
          timeline.id === clipId 
            ? { ...timeline, matchedSong: undefined }
            : timeline
        ));
        
        // 통계 재계산
        const updatedTimelines = parsedTimelines.map(timeline => 
          timeline.id === clipId 
            ? { ...timeline, matchedSong: undefined }
            : timeline
        );
        
        const matchedItems = updatedTimelines.filter(timeline => timeline.matchedSong).length;
        setStats(prev => ({
          ...prev,
          matchedSongs: matchedItems
        }));
      } else {
        alert(result.error || '매칭 해제 실패');
      }
    } catch (error) {
      console.error('곡 매칭 해제 오류:', error);
      alert('매칭 해제 중 오류가 발생했습니다.');
    }
  };

  // 편집 시작
  const startEdit = useCallback(() => {
    if (!selectedTimeline) return;
    setEditingData({
      artist: selectedTimeline.artist,
      songTitle: selectedTimeline.songTitle,
      startTimeSeconds: selectedTimeline.startTimeSeconds,
      endTimeSeconds: selectedTimeline.endTimeSeconds
    });
    setIsEditing(true);
  }, [selectedTimeline]);

  // 편집 취소
  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditingData(null);
  }, []);

  // 입력 핸들러들 (성능 최적화) - 함수형 업데이트로 의존성 제거
  const handleArtistChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingData(prev => prev ? {...prev, artist: e.target.value} : null);
  }, []);

  const handleSongTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingData(prev => prev ? {...prev, songTitle: e.target.value} : null);
  }, []);

  const handleStartTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setEditingData(prev => prev ? {...prev, startTimeSeconds: value} : null);
  }, []);

  const handleEndTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value) : undefined;
    setEditingData(prev => prev ? {...prev, endTimeSeconds: value} : null);
  }, []);

  // 편집 저장
  const saveEdit = async () => {
    if (!selectedTimeline || !editingData) return;

    // 입력 검증 (저장 시에만)
    const artist = editingData.artist.trim();
    const songTitle = editingData.songTitle.trim();
    
    if (!artist || !songTitle) {
      alert('아티스트와 곡명은 필수 입력 항목입니다.');
      return;
    }

    if (editingData.startTimeSeconds < 0) {
      alert('시작 시간은 0 이상이어야 합니다.');
      return;
    }

    if (editingData.endTimeSeconds && editingData.endTimeSeconds <= editingData.startTimeSeconds) {
      alert('종료 시간은 시작 시간보다 커야 합니다.');
      return;
    }

    try {
      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-live-clip',
          itemId: selectedTimeline.id,
          artist: artist,
          songTitle: songTitle,
          startTimeSeconds: editingData.startTimeSeconds,
          endTimeSeconds: editingData.endTimeSeconds
        })
      });

      const result = await response.json();

      if (result.success) {
        // 로컬 상태 업데이트
        setParsedTimelines(prev => prev.map(timeline => 
          timeline.id === selectedTimeline.id 
            ? { 
                ...timeline, 
                artist: artist,
                songTitle: songTitle,
                startTimeSeconds: editingData.startTimeSeconds,
                endTimeSeconds: editingData.endTimeSeconds,
                duration: editingData.endTimeSeconds && editingData.endTimeSeconds > editingData.startTimeSeconds
                  ? editingData.endTimeSeconds - editingData.startTimeSeconds
                  : timeline.duration
              }
            : timeline
        ));

        // 선택된 클립도 업데이트
        setSelectedTimeline(prev => prev ? {
          ...prev,
          artist: artist,
          songTitle: songTitle,
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

  // HTML 태그 제거 함수 (줄바꿈 유지)
  const stripHtmlTags = useCallback((html: string): string => {
    return html
      .replace(/<br\s*\/?>/gi, '\n') // <br> 태그를 줄바꿈으로 변환
      .replace(/<[^>]*>/g, '') // 다른 HTML 태그 제거
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
  }, []);

  // YouTube URL에서 비디오 ID 추출
  const extractVideoId = useCallback((url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }, []);

  // YouTube 플레이어 이벤트 핸들러
  const onYouTubeReady = useCallback((event: { target: YouTubePlayer }) => {
    setYoutubePlayer(event.target);
  }, []);

  const onYouTubeStateChange = useCallback((event: { data: number }) => {
    // 1 = playing, 2 = paused
    setIsPlaying(event.data === 1);
  }, []);

  // 비디오 재생 함수
  const playVideoAtTime = useCallback((videoId: string, startTime: number, endTime?: number) => {
    setShowPlayer(true);
    // 플레이어가 로드되면 자동으로 재생됨
  }, []);

  // 재생/일시정지 토글
  const togglePlayback = useCallback(() => {
    if (youtubePlayer) {
      if (isPlaying) {
        youtubePlayer.pauseVideo();
      } else {
        youtubePlayer.playVideo();
      }
    }
  }, [youtubePlayer, isPlaying]);

  // 현재 재생 시간을 시작 시간으로 설정
  const setCurrentTimeAsStart = useCallback(() => {
    if (youtubePlayer && editingData) {
      const currentTime = Math.floor(youtubePlayer.getCurrentTime());
      setEditingData(prev => prev ? { ...prev, startTimeSeconds: currentTime } : null);
    }
  }, [youtubePlayer, editingData]);

  // 현재 재생 시간을 종료 시간으로 설정
  const setCurrentTimeAsEnd = useCallback(() => {
    if (youtubePlayer && editingData) {
      const currentTime = Math.floor(youtubePlayer.getCurrentTime());
      setEditingData(prev => prev ? { ...prev, endTimeSeconds: currentTime } : null);
    }
  }, [youtubePlayer, editingData]);

  // 상세정보 로딩 - 복잡한 비동기 처리 제거하고 즉시 처리
  const loadTimelineDetails = useCallback((timeline: ParsedTimelineItem) => {
    setSelectedTimeline(timeline);
  }, []);


  // 다중 선택 처리 (현재 페이지 기준)
  const handleTimelineSelection = (timeline: ParsedTimelineItem, pageIndex: number, event: React.MouseEvent) => {
    // 기본 브라우저 동작 방지 (텍스트 선택 등)
    event.preventDefault();
    
    if (event.shiftKey && lastSelectedIndex !== -1) {
      // Shift + 클릭: 현재 페이지 내에서 범위 선택
      const startIndex = Math.min(lastSelectedIndex, pageIndex);
      const endIndex = Math.max(lastSelectedIndex, pageIndex);
      
      const newSelectedIds = new Set(selectedTimelineIds);
      for (let i = startIndex; i <= endIndex; i++) {
        if (paginationInfo.currentPageItems[i]) {
          newSelectedIds.add(paginationInfo.currentPageItems[i].id);
        }
      }
      setSelectedTimelineIds(newSelectedIds);
      loadTimelineDetails(timeline);
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd + 클릭: 개별 선택/해제
      const newSelectedIds = new Set(selectedTimelineIds);
      if (newSelectedIds.has(timeline.id)) {
        newSelectedIds.delete(timeline.id);
        // 선택 해제된 경우, 다른 선택된 항목이 있으면 그 중 하나를 상세보기
        if (newSelectedIds.size > 0) {
          const remainingTimeline = paginationInfo.currentPageItems.find(c => newSelectedIds.has(c.id)) || 
                               parsedTimelines.find(c => newSelectedIds.has(c.id));
          if (remainingTimeline) {
            loadTimelineDetails(remainingTimeline);
          }
        } else {
          setSelectedTimeline(null);
        }
      } else {
        newSelectedIds.add(timeline.id);
        loadTimelineDetails(timeline);
      }
      setSelectedTimelineIds(newSelectedIds);
      setLastSelectedIndex(pageIndex);
    } else {
      // 일반 클릭: 단일 선택
      setSelectedTimelineIds(new Set([timeline.id]));
      setLastSelectedIndex(pageIndex);
      loadTimelineDetails(timeline);
    }
  };

  // 필터링된 타임라인들 (메모이제이션으로 성능 최적화)
  const filteredTimelines = useMemo(() => {
    return parsedTimelines.filter(timeline => {
      switch (filterType) {
        case 'relevant': return timeline.isRelevant && !timeline.isExcluded;
        case 'irrelevant': return !timeline.isRelevant && !timeline.isExcluded;
        case 'excluded': return timeline.isExcluded;
        case 'matched': return timeline.matchedSong;
        case 'unmatched': return !timeline.matchedSong;
        default: return true;
      }
    });
  }, [parsedTimelines, filterType]);

  // 페이지네이션 계산 (메모이제이션으로 성능 최적화)
  const paginationInfo = useMemo(() => {
    const totalItems = filteredTimelines.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const currentPageItems = filteredTimelines.slice(startIndex, endIndex);
    
    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      currentPageItems,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    };
  }, [filteredTimelines, currentPage, itemsPerPage]);

  // 페이지 변경 시 선택 상태 초기화
  useEffect(() => {
    setSelectedTimelineIds(new Set());
    setLastSelectedIndex(-1);
    setSelectedTimeline(null);
  }, [currentPage, filterType]);

  // 현재 페이지 전체 선택/해제
  const toggleSelectAll = () => {
    const currentPageItemIds = new Set(paginationInfo.currentPageItems.map(timeline => timeline.id));
    const allCurrentPageSelected = paginationInfo.currentPageItems.every(timeline => selectedTimelineIds.has(timeline.id));
    
    if (allCurrentPageSelected) {
      // 현재 페이지 아이템들 선택 해제
      const newSelectedIds = new Set(selectedTimelineIds);
      paginationInfo.currentPageItems.forEach(clip => newSelectedIds.delete(clip.id));
      setSelectedTimelineIds(newSelectedIds);
      setLastSelectedIndex(-1);
    } else {
      // 현재 페이지 아이템들 전체 선택
      const newSelectedIds = new Set([...selectedTimelineIds, ...currentPageItemIds]);
      setSelectedTimelineIds(newSelectedIds);
      setLastSelectedIndex(paginationInfo.currentPageItems.length - 1);
    }
  };

  // 선택된 항목들에 대한 일괄 작업
  const bulkUpdateRelevance = async (isRelevant: boolean) => {
    if (selectedTimelineIds.size === 0) return;
    
    try {
      const updatePromises = Array.from(selectedTimelineIds).map(clipId =>
        fetch('/api/timeline-parser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update-item-relevance',
            itemId: clipId,
            isRelevant: isRelevant
          })
        })
      );

      await Promise.all(updatePromises);

      // 로컬 상태 업데이트
      const updatedTimelines = parsedTimelines.map(timeline => 
        selectedTimelineIds.has(timeline.id) 
          ? { ...timeline, isRelevant: isRelevant }
          : timeline
      );
      setParsedTimelines(updatedTimelines);
      
      // 통계 재계산
      const relevantItems = updatedTimelines.filter(timeline => timeline.isRelevant && !timeline.isExcluded).length;
      const matchedItems = updatedTimelines.filter(timeline => timeline.matchedSong).length;
      const uniqueSongs = new Set(updatedTimelines.map(timeline => `${timeline.artist}_${timeline.songTitle}`)).size;
      
      setStats(prev => ({
        ...prev,
        relevantItems: relevantItems,
        matchedSongs: matchedItems,
        uniqueSongs: uniqueSongs
      }));

      setSelectedTimelineIds(new Set());
      setLastSelectedIndex(-1);
    } catch (error) {
      console.error('일괄 관련성 업데이트 오류:', error);
      alert('일괄 업데이트 중 오류가 발생했습니다.');
    }
  };

  const bulkUpdateExclusion = async (isExcluded: boolean) => {
    if (selectedTimelineIds.size === 0) return;
    
    try {
      const updatePromises = Array.from(selectedTimelineIds).map(clipId =>
        fetch('/api/timeline-parser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update-item-exclusion',
            itemId: clipId,
            isExcluded: isExcluded
          })
        })
      );

      await Promise.all(updatePromises);

      // 로컬 상태 업데이트
      const updatedTimelines = parsedTimelines.map(timeline => 
        selectedTimelineIds.has(timeline.id) 
          ? { ...timeline, isExcluded: isExcluded }
          : timeline
      );
      setParsedTimelines(updatedTimelines);
      
      // 통계 재계산
      const relevantItems = updatedTimelines.filter(timeline => timeline.isRelevant && !timeline.isExcluded).length;
      const matchedItems = updatedTimelines.filter(timeline => timeline.matchedSong).length;
      const uniqueSongs = new Set(updatedTimelines.map(timeline => `${timeline.artist}_${timeline.songTitle}`)).size;
      
      setStats(prev => ({
        ...prev,
        relevantItems: relevantItems,
        matchedSongs: matchedItems,
        uniqueSongs: uniqueSongs
      }));

      setSelectedTimelineIds(new Set());
      setLastSelectedIndex(-1);
    } catch (error) {
      console.error('일괄 제외 업데이트 오류:', error);
      alert('일괄 업데이트 중 오류가 발생했습니다.');
    }
  };


  // 초를 MM:SS 형식으로 변환
  const formatSeconds = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // 시간 길이를 분:초 형식으로 변환 (메모이제이션)
  const formatDuration = useCallback((seconds?: number): string => {
    if (!seconds) return '';
    return formatSeconds(seconds);
  }, []);

  // 편집 중 미리보기 데이터 (메모이제이션으로 성능 최적화)
  const editingPreview = useMemo(() => {
    if (!isEditing || !editingData || !selectedTimeline) return null;
    
    return {
      duration: editingData.endTimeSeconds && editingData.startTimeSeconds && editingData.endTimeSeconds > editingData.startTimeSeconds
        ? editingData.endTimeSeconds - editingData.startTimeSeconds
        : null,
      isValidDuration: editingData.endTimeSeconds ? editingData.endTimeSeconds > editingData.startTimeSeconds : true,
      startTimeChanged: editingData.startTimeSeconds !== selectedTimeline.startTimeSeconds
    };
  }, [isEditing, editingData, selectedTimeline]);

  // 시간 검증 상태 업데이트 (컴포넌트용 래퍼)
  const handleTimeVerificationUpdate = async (timeline: ParsedTimelineItem, isVerified: boolean, notes?: string) => {
    const result = await updateTimeVerification(timeline, isVerified, notes);
    
    if (result.success && result.data) {
      // 로컬 상태 업데이트
      setParsedTimelines(prev => prev.map(t => 
        t.id === timeline.id 
          ? { 
              ...t, 
              isTimeVerified: result.data!.isTimeVerified,
              verifiedBy: result.data!.verifiedBy,
              verifiedAt: result.data!.verifiedAt,
              verificationNotes: notes
            }
          : t
      ));
      
      // 선택된 타임라인이 현재 수정된 타임라인이면 상태 업데이트
      if (selectedTimeline && selectedTimeline.id === timeline.id) {
        setSelectedTimeline(prev => prev ? {
          ...prev,
          isTimeVerified: result.data!.isTimeVerified,
          verifiedBy: result.data!.verifiedBy,
          verifiedAt: result.data!.verifiedAt,
          verificationNotes: notes
        } : null);
      }
    } else {
      alert(`시간 검증 ${isVerified ? '완료' : '해제'} 실패: ${result.error}`);
    }
  };

  // 전체 타임라인 일괄 검색
  const performBatchSearch = async () => {
    setBatchSearchLoading(true);
    setBatchSearchProgress({
      current: 0,
      total: 0,
      message: '일괄 검색 준비 중...'
    });

    try {
      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch-search-matches'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setBatchSearchProgress({
          current: result.data.processed,
          total: result.data.processed,
          message: `완료: ${result.data.matched}개 자동 매칭`
        });

        // 검색 결과를 메모리에 저장
        const searchResultsMap = new Map();
        result.data.results.forEach((item: any) => {
          if (item.candidates && item.candidates.length > 0) {
            searchResultsMap.set(item.timelineId, item.candidates);
          }
        });
        setBatchSearchResults(searchResultsMap);

        // 데이터 새로고침
        await loadExistingDataOnMount();

        const manualReviewCount = result.data.results.filter((item: any) => 
          !item.autoMatched && item.candidates.length > 0
        ).length;

        alert(`일괄 검색 완료!\n` +
              `처리된 항목: ${result.data.processed}개\n` +
              `자동 매칭: ${result.data.matched}개\n` +
              `수동 검토 필요: ${manualReviewCount}개`);
      } else {
        alert(`일괄 검색 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('일괄 검색 오류:', error);
      alert('일괄 검색 중 오류가 발생했습니다.');
    } finally {
      setBatchSearchLoading(false);
      setBatchSearchProgress(null);
    }
  };

  // 기존 파싱된 데이터 로드
  const loadExistingDataOnMount = async () => {
    try {
      const response = await fetch('/api/timeline-parser?action=get-parsed-items');
      const result = await response.json();
      
      if (result.success) {
        setParsedTimelines(result.data);
        // 통계 계산
        const totalItems = result.data.length;
        const relevantItems = result.data.filter((timeline: ParsedTimelineItem) => timeline.isRelevant && !timeline.isExcluded).length;
        const matchedItems = result.data.filter((timeline: ParsedTimelineItem) => timeline.matchedSong).length;
        const uniqueSongs = new Set(result.data.map((timeline: ParsedTimelineItem) => `${timeline.artist}_${timeline.songTitle}`)).size;
        
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

  // YouTube 플레이어의 현재 시간 업데이트
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (youtubePlayer && isPlaying) {
      interval = setInterval(() => {
        try {
          const time = youtubePlayer.getCurrentTime();
          setCurrentTime(Math.floor(time));
        } catch (error) {
          // 플레이어가 아직 준비되지 않은 경우 무시
        }
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [youtubePlayer, isPlaying]);


  return (
    <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
      {/* 파싱된 타임라인 목록 */}
      <div className="flex-1 xl:flex-[1] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                파싱된 타임라인 ({paginationInfo.totalItems}개)
              </h3>
              {paginationInfo.totalPages > 1 && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {paginationInfo.startIndex + 1}-{paginationInfo.endIndex} / {paginationInfo.totalItems}
                </span>
              )}
              {selectedTimelineIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    {selectedTimelineIds.size}개 선택됨
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    Shift+클릭으로 범위 선택, Ctrl+클릭으로 개별 선택
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedTimelineIds.size > 0 && (
                <div className="flex items-center gap-1 mr-2">
                  <button
                    onClick={() => bulkUpdateRelevance(true)}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition-colors"
                  >
                    관련성 있음
                  </button>
                  <button
                    onClick={() => bulkUpdateRelevance(false)}
                    className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs transition-colors"
                  >
                    관련성 없음
                  </button>
                  <button
                    onClick={() => bulkUpdateExclusion(true)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
                  >
                    제외
                  </button>
                  <button
                    onClick={() => bulkUpdateExclusion(false)}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs transition-colors"
                  >
                    제외 해제
                  </button>
                </div>
              )}
              <button
                onClick={performBatchSearch}
                disabled={batchSearchLoading}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white rounded text-xs transition-colors flex items-center gap-1"
              >
                {batchSearchLoading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    일괄 검색 중...
                  </>
                ) : (
                  <>
                    <Square3Stack3DIcon className="w-3 h-3" />
                    일괄 검색
                  </>
                )}
              </button>
              <button
                onClick={toggleSelectAll}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
              >
                {paginationInfo.currentPageItems.every(timeline => selectedTimelineIds.has(timeline.id)) ? '페이지 해제' : '페이지 선택'}
              </button>
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
          
          {/* 일괄 검색 진행 상황 */}
          {batchSearchProgress && (
            <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-purple-700 dark:text-purple-300">
                  {batchSearchProgress.message}
                </span>
                <span className="text-purple-600 dark:text-purple-400">
                  {batchSearchProgress.current} / {batchSearchProgress.total}
                </span>
              </div>
              {batchSearchProgress.total > 0 && (
                <div className="mt-2 w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2">
                  <div 
                    className="bg-purple-600 dark:bg-purple-400 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${(batchSearchProgress.current / batchSearchProgress.total) * 100}%` 
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {(loading || initialLoading) ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {loading ? '파싱 중...' : '데이터 로딩 중...'}
              </p>
            </div>
          ) : paginationInfo.totalItems === 0 ? (
            <div className="p-8 text-center">
              <MusicalNoteIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">파싱된 타임라인 데이터가 없습니다.</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">타임라인 파싱을 실행해주세요.</p>
            </div>
          ) : (
            paginationInfo.currentPageItems.map((timeline, pageIndex) => (
              <div
                key={timeline.id}
                className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors select-none ${
                  selectedTimelineIds.has(timeline.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                } ${selectedTimeline?.id === timeline.id ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
                onClick={(e) => handleTimelineSelection(timeline, pageIndex, e)}
                onMouseDown={(e) => e.preventDefault()} // 마우스 다운 시 기본 동작 방지
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 mt-1">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedTimelineIds.has(timeline.id) 
                          ? 'bg-blue-600 border-blue-600' 
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {selectedTimelineIds.has(timeline.id) && (
                          <CheckIcon className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                          {timeline.artist} - {timeline.songTitle}
                        </h4>
                        <div className="flex gap-1">
                          {!timeline.isRelevant && (
                            <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs">
                              관련성 없음
                            </span>
                          )}
                          {timeline.isExcluded && (
                            <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
                              제외됨
                            </span>
                          )}
                          {timeline.matchedSong && (
                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">
                              매칭완료
                            </span>
                          )}
                          {timeline.isTimeVerified && (
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs flex items-center gap-1">
                              <CheckCircleIcon className="w-3 h-3" />
                              검증완료
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {formatSeconds(timeline.startTimeSeconds)}
                        {timeline.endTimeSeconds && ` ~ ${formatSeconds(timeline.endTimeSeconds)}`}
                        {timeline.duration && ` (${formatDuration(timeline.duration)})`}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {timeline.videoTitle}
                      </div>
                      {timeline.commentAuthor && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          댓글 작성자: {timeline.commentAuthor}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        toggleRelevance(timeline.id);
                      }}
                      className={`p-1 rounded transition-colors select-none ${
                        timeline.isRelevant 
                          ? 'text-green-600 hover:text-green-700' 
                          : 'text-orange-400 hover:text-orange-600'
                      }`}
                      title={timeline.isRelevant ? '관련성 없음으로 변경' : '관련성 있음으로 변경'}
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        toggleExcluded(timeline.id);
                      }}
                      className={`p-1 rounded transition-colors select-none ${
                        timeline.isExcluded 
                          ? 'text-red-600 hover:text-red-700' 
                          : 'text-gray-400 hover:text-red-600'
                      }`}
                      title={timeline.isExcluded ? '제외 해제' : '제외'}
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                    {timeline.isRelevant && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          openMatchingDialog(timeline);
                        }}
                        disabled={matchingLoading}
                        className="p-1 text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50 select-none"
                        title="곡 매칭"
                      >
                        <MagnifyingGlassIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* 페이지네이션 컨트롤 */}
        {paginationInfo.totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                페이지 {currentPage} / {paginationInfo.totalPages} 
                ({paginationInfo.startIndex + 1}-{paginationInfo.endIndex} / {paginationInfo.totalItems}개)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 
                             rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  처음
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={!paginationInfo.hasPrevPage}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 
                             rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  이전
                </button>
                
                {/* 페이지 번호들 */}
                {Array.from({ length: Math.min(5, paginationInfo.totalPages) }, (_, i) => {
                  const startPage = Math.max(1, currentPage - 2);
                  const pageNum = startPage + i;
                  if (pageNum > paginationInfo.totalPages) return null;
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 rounded text-sm ${
                        pageNum === currentPage
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!paginationInfo.hasNextPage}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 
                             rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  다음
                </button>
                <button
                  onClick={() => setCurrentPage(paginationInfo.totalPages)}
                  disabled={currentPage === paginationInfo.totalPages}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 
                             rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  마지막
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 상세 정보 */}
      <div className="flex-1 xl:flex-[1] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedTimeline ? '파싱된 타임라인 상세' : '상세 정보'}
            </h3>
            {selectedTimeline && (
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-orange-600 dark:text-orange-400">
                        편집 모드 - 저장 버튼을 눌러 변경사항을 적용하세요
                      </span>
                    </div>
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
          {!selectedTimeline ? (
            <div className="p-8 text-center">
              <EyeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">항목을 선택해주세요.</p>
              {selectedTimelineIds.size > 1 && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  {selectedTimelineIds.size}개 항목이 선택되었습니다. 일괄 작업을 사용하세요.
                </p>
              )}
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
                        onChange={handleArtistChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded
                                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="아티스트 이름을 입력하세요"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 dark:text-white">{selectedTimeline.artist}</p>
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
                        onChange={handleSongTitleChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded
                                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="곡명을 입력하세요"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 dark:text-white">{selectedTimeline.songTitle}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        시작 시간 (초)
                      </label>
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="number"
                            min="0"
                            value={editingData?.startTimeSeconds || 0}
                            onChange={handleStartTimeChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded
                                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="초 단위"
                          />
                          {youtubePlayer && showPlayer && (
                            <button
                              type="button"
                              onClick={setCurrentTimeAsStart}
                              className="w-full px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors flex items-center justify-center gap-1"
                            >
                              <ClockIcon className="w-3 h-3" />
                              현재 시간으로 설정
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-900 dark:text-white">
                          {selectedTimeline.startTimeSeconds} ({formatSeconds(selectedTimeline.startTimeSeconds)})
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        종료 시간 (초)
                      </label>
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="number"
                            min="0"
                            value={editingData?.endTimeSeconds || ''}
                            onChange={handleEndTimeChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded
                                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="선택사항 (초 단위)"
                          />
                          {youtubePlayer && showPlayer && (
                            <button
                              type="button"
                              onClick={setCurrentTimeAsEnd}
                              className="w-full px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors flex items-center justify-center gap-1"
                            >
                              <ClockIcon className="w-3 h-3" />
                              현재 시간으로 설정
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-900 dark:text-white">
                          {selectedTimeline.endTimeSeconds ? `${selectedTimeline.endTimeSeconds} (${formatSeconds(selectedTimeline.endTimeSeconds)})` : '없음'}
                        </p>
                      )}
                    </div>
                  </div>
                  {(selectedTimeline.duration || (isEditing && editingData?.endTimeSeconds && editingData?.startTimeSeconds)) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        지속 시간
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {editingPreview?.duration ? (
                          <>
                            {editingPreview.duration}초 ({formatDuration(editingPreview.duration)})
                            <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">(미리보기)</span>
                          </>
                        ) : editingPreview && !editingPreview.isValidDuration ? (
                          <span className="text-red-600 dark:text-red-400">종료 시간이 시작 시간보다 작습니다</span>
                        ) : selectedTimeline.duration ? (
                          `${selectedTimeline.duration}초 (${formatDuration(selectedTimeline.duration)})`
                        ) : (
                          '없음'
                        )}
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
                    <p className="text-sm text-gray-900 dark:text-white">{selectedTimeline.videoTitle}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">업로드 날짜</label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {new Date(selectedTimeline.uploadedDate).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">링크</label>
                    <a 
                      href={`${selectedTimeline.videoUrl}&t=${editingPreview && editingData ? editingData.startTimeSeconds : selectedTimeline.startTimeSeconds}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      YouTube에서 보기
                      {editingPreview?.startTimeChanged && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">(편집된 시간으로)</span>
                      )}
                    </a>
                  </div>
                </div>
              </div>

              {/* 매칭 정보 */}
              {selectedTimeline.matchedSong && (
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-green-800 dark:text-green-200 flex items-center gap-2">
                      <CheckCircleIcon className="w-5 h-5" />
                      매칭 완료
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        selectedTimeline.matchedSong.confidence >= 0.95 
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : selectedTimeline.matchedSong.confidence >= 0.8
                          ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'  
                          : 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
                      }`}>
                        {selectedTimeline.matchedSong.confidence >= 0.95 ? '정확한 매칭' :
                         selectedTimeline.matchedSong.confidence >= 0.8 ? '높은 신뢰도' : '수동 매칭'}
                      </span>
                      <button
                        onClick={() => handleDirectSongMatch(selectedTimeline, null, 0)}
                        className="text-xs text-red-600 hover:text-red-700 transition-colors flex items-center gap-1"
                      >
                        <XMarkIcon className="w-3 h-3" />
                        해제
                      </button>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-green-700 dark:text-green-300 mb-1">아티스트</label>
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">{selectedTimeline.matchedSong.artist}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-green-700 dark:text-green-300 mb-1">곡명</label>
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">{selectedTimeline.matchedSong.title}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-green-700 dark:text-green-300">매칭 신뢰도</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-green-200 dark:bg-green-800 rounded-full h-2">
                            <div 
                              className="bg-green-600 dark:bg-green-400 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${selectedTimeline.matchedSong.confidence * 100}%` }}
                            />
                          </div>
                          <span className="font-medium text-green-800 dark:text-green-200">
                            {Math.round(selectedTimeline.matchedSong.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 일괄 검색 후보 목록 */}
              {!selectedTimeline.matchedSong && batchSearchResults.has(selectedTimeline.id) && (
                <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-purple-800 dark:text-purple-200">검색 후보</h4>
                    <span className="text-xs text-purple-600 dark:text-purple-400">
                      {batchSearchResults.get(selectedTimeline.id)?.length || 0}개 후보
                    </span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {batchSearchResults.get(selectedTimeline.id)?.map((candidate: any, index: number) => (
                      <div 
                        key={candidate.song._id}
                        className="bg-white dark:bg-gray-800 rounded p-3 border border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
                        onClick={() => handleDirectSongMatch(selectedTimeline, candidate.song._id, candidate.overallSimilarity)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {candidate.song.artist} - {candidate.song.title}
                            </p>
                            {(candidate.song.artistAlias || candidate.song.titleAlias) && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {candidate.song.artistAlias && `아티스트 별명: ${candidate.song.artistAlias}`}
                                {candidate.song.artistAlias && candidate.song.titleAlias && ' | '}
                                {candidate.song.titleAlias && `곡명 별명: ${candidate.song.titleAlias}`}
                              </p>
                            )}
                            {candidate.song.searchTags && candidate.song.searchTags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {candidate.song.searchTags.map((tag: string, tagIndex: number) => (
                                  <span 
                                    key={tagIndex}
                                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="ml-3 text-right">
                            <div className="text-sm font-medium text-purple-700 dark:text-purple-300">
                              {Math.round(candidate.overallSimilarity * 100)}%
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              A: {Math.round(candidate.artistSimilarity * 100)}% | 
                              T: {Math.round(candidate.titleSimilarity * 100)}%
                            </div>
                            {candidate.isExactMatch && (
                              <span className="inline-block mt-1 px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                                완전 일치
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )) || []}
                  </div>
                  <div className="mt-3 text-xs text-purple-600 dark:text-purple-400">
                    💡 후보를 클릭하면 해당 곡으로 매칭됩니다.
                  </div>
                </div>
              )}

              {/* 상태 정보 */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">상태</h4>
                <div className="flex flex-wrap gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    selectedTimeline.isRelevant 
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                      : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200'
                  }`}>
                    {selectedTimeline.isRelevant ? '관련성 있음' : '관련성 없음'}
                  </span>
                  {selectedTimeline.isExcluded && (
                    <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full text-xs font-medium">
                      제외됨
                    </span>
                  )}
                  {selectedTimeline.matchedSong && (
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-xs font-medium">
                      매칭 완료
                    </span>
                  )}
                </div>
              </div>

              {/* 시간 검증 */}
              <TimeVerificationSection 
                timeline={selectedTimeline}
                onVerificationUpdate={handleTimeVerificationUpdate}
              />

              {/* YouTube 재생 */}
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-3">YouTube 재생</h4>
                <div className="space-y-3">
                  {(() => {
                    const videoId = extractVideoId(selectedTimeline.videoUrl);
                    const startTime = editingData?.startTimeSeconds || selectedTimeline.startTimeSeconds;
                    const endTime = editingData?.endTimeSeconds || selectedTimeline.endTimeSeconds;
                    
                    if (!videoId) {
                      return (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          올바르지 않은 YouTube URL입니다.
                        </p>
                      );
                    }

                    return (
                      <>
                        {showPlayer ? (
                          /* YouTube 플레이어 */
                          <div className="space-y-3">
                            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                              <YouTube
                                videoId={videoId}
                                className="absolute inset-0 w-full h-full"
                                iframeClassName="w-full h-full rounded-lg"
                                opts={{
                                  width: '100%',
                                  height: '100%',
                                  playerVars: {
                                    autoplay: 1,
                                    start: startTime,
                                    end: endTime,
                                    modestbranding: 1,
                                    rel: 0,
                                  },
                                }}
                                onReady={onYouTubeReady}
                                onStateChange={onYouTubeStateChange}
                              />
                            </div>
                            
                            {/* 플레이어 컨트롤 */}
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-blue-700 dark:text-blue-300">
                                <p>현재: {formatSeconds(currentTime)}</p>
                                <p>시작: {formatSeconds(startTime)}</p>
                                {endTime && <p>종료: {formatSeconds(endTime)}</p>}
                                {endTime && startTime && (
                                  <p>재생 시간: {formatDuration(endTime - startTime)}</p>
                                )}
                              </div>
                              
                              <div className="flex gap-2">
                                <button
                                  onClick={togglePlayback}
                                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                  {isPlaying ? (
                                    <PauseIcon className="w-4 h-4" />
                                  ) : (
                                    <PlayIcon className="w-4 h-4" />
                                  )}
                                  {isPlaying ? '일시정지' : '재생'}
                                </button>
                                <button
                                  onClick={() => {
                                    setShowPlayer(false);
                                    setIsPlaying(false);
                                  }}
                                  className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium transition-colors"
                                >
                                  닫기
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* 썸네일과 재생 버튼 */
                          <>
                            <div className="relative">
                              <Image 
                                src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                                alt="YouTube 썸네일"
                                width={320}
                                height={180}
                                className="w-full h-40 object-cover rounded-lg"
                                unoptimized
                              />
                              <button
                                onClick={() => playVideoAtTime(videoId, startTime, endTime)}
                                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors rounded-lg"
                              >
                                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors shadow-lg">
                                  <PlayIcon className="w-6 h-6 text-white ml-1" />
                                </div>
                              </button>
                            </div>
                            
                            {/* 재생 정보 */}
                            <div className="text-sm text-blue-700 dark:text-blue-300">
                              <p>시작: {formatSeconds(startTime)}</p>
                              {endTime && <p>종료: {formatSeconds(endTime)}</p>}
                              {endTime && startTime && (
                                <p>재생 시간: {formatDuration(endTime - startTime)}</p>
                              )}
                            </div>

                            {/* 재생 버튼들 */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => playVideoAtTime(videoId, startTime, endTime)}
                                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                              >
                                <PlayIcon className="w-4 h-4" />
                                구간 재생
                              </button>
                              <button
                                onClick={() => {
                                  const url = `https://www.youtube.com/watch?v=${videoId}`;
                                  window.open(url, '_blank');
                                }}
                                className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium transition-colors"
                              >
                                새 탭에서 열기
                              </button>
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* 원본 댓글 */}
              <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-3">원본 댓글</h4>
                {/* 댓글 작성자 정보 */}
                {selectedTimeline.commentAuthor && (
                  <div className="mb-3 text-xs text-yellow-600 dark:text-yellow-400">
                    <span className="font-medium">작성자:</span> {selectedTimeline.commentAuthor}
                    {selectedTimeline.commentPublishedAt && (
                      <span className="ml-3">
                        <span className="font-medium">작성일:</span> {new Date(selectedTimeline.commentPublishedAt).toLocaleDateString('ko-KR')}
                      </span>
                    )}
                  </div>
                )}
                <div className="text-sm text-yellow-700 dark:text-yellow-300 bg-white dark:bg-gray-800 rounded p-3 border border-yellow-200 dark:border-yellow-800">
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {stripHtmlTags(selectedTimeline.originalComment)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 곡 매칭 다이얼로그 */}
      {matchingTimelineItem && (
        <SongMatchingDialog
          isOpen={showMatchingDialog}
          onClose={() => {
            setShowMatchingDialog(false);
            setMatchingTimelineItem(null);
          }}
          timelineItem={{
            id: matchingTimelineItem.id,
            artist: matchingTimelineItem.artist,
            songTitle: matchingTimelineItem.songTitle,
            timeText: `${formatSeconds(matchingTimelineItem.startTimeSeconds)}${matchingTimelineItem.endTimeSeconds ? ` ~ ${formatSeconds(matchingTimelineItem.endTimeSeconds)}` : ''}`,
            matchedSong: matchingTimelineItem.matchedSong
          }}
          onMatch={handleSongMatch}
        />
      )}
    </div>
  );
}