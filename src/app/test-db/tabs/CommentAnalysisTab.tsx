'use client';

import { useState, useEffect } from 'react';
import { 
  PlayIcon,
  ChatBubbleBottomCenterTextIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  PencilIcon,
  ArrowRightIcon,
  TagIcon,
  ExclamationTriangleIcon,
  LinkIcon
} from '@heroicons/react/24/outline';
import TimelineParsingView from './TimelineParsingView';
import SyncResultDialog from '@/components/SyncResultDialog';

interface VideoData {
  videoId: string;
  title: string;
  publishedAt: string;
  totalComments: number;
  timelineComments: number;
  lastCommentSync: string;
  lastNewCommentAt?: string;
  thumbnailUrl: string;
  channelName?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface CommentData {
  commentId: string;
  videoId: string;
  authorName: string;
  textContent: string;
  publishedAt: string;
  likeCount: number;
  isTimeline: boolean;
  extractedTimestamps: string[];
  isProcessed: boolean;
  processedBy?: string;
  processedAt?: string;
  manuallyMarked?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ChannelStats {
  totalVideos: number;
  totalComments: number;
  timelineComments: number;
  processedComments: number;
}

interface TimelineStats {
  parsedItems: number;
  relevantItems: number;
  matchedSongs: number;
  uniqueMatchedSongs: number;
  verifiedItems: number;
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalVideos: number;
  limit: number;
}

interface CommentAnalysisTabProps {
  viewMode?: 'comments' | 'timeline';
}

export default function CommentAnalysisTab({ viewMode: propViewMode }: CommentAnalysisTabProps = {}) {
  const [viewMode, setViewMode] = useState<'comments' | 'timeline'>(propViewMode || 'comments');
  const [loading, setLoading] = useState(false);
  const [skipProcessed, setSkipProcessed] = useState(true); // 처리완료 댓글 스킵 옵션
  
  // 다이얼로그 상태
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogMessage, setDialogMessage] = useState('');
  const [dialogResult, setDialogResult] = useState<any>(null);
  const [dialogIsError, setDialogIsError] = useState(false);

  // HTML 태그 제거 함수 (줄바꿈 유지)
  const stripHtmlTags = (html: string): string => {
    return html
      .replace(/<br\s*\/?>/gi, '\n') // <br> 태그를 줄바꿈으로 변환
      .replace(/<[^>]*>/g, '') // 다른 HTML 태그 제거
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
  };
  const [syncing, setSyncing] = useState(false);
  const [timelineParsing, setTimelineParsing] = useState(false);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [stats, setStats] = useState<ChannelStats>({
    totalVideos: 0,
    totalComments: 0,
    timelineComments: 0,
    processedComments: 0
  });
  const [timelineStats, setTimelineStats] = useState<TimelineStats>({
    parsedItems: 0,
    relevantItems: 0,
    matchedSongs: 0,
    uniqueMatchedSongs: 0,
    verifiedItems: 0
  });

  // 라이브 클립 업로드 트리거 함수
  const triggerUpload = () => {
    if ((window as any).triggerTimelineUpload) {
      (window as any).triggerTimelineUpload();
    }
  };
  const [isMobile, setIsMobile] = useState(false);
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 1,
    totalVideos: 0,
    limit: 20
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'timeline' | 'non-timeline' | 'processed' | 'unprocessed'>('all');
  
  // 수동 영상 추가 상태
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualVideoUrl, setManualVideoUrl] = useState('');
  const [addingVideo, setAddingVideo] = useState(false);
  
  // 정렬 옵션
  const [sortBy, setSortBy] = useState<'uploadDate' | 'titleDate' | 'recentUpdate'>('uploadDate');

  // 제목에서 날짜 추출 함수 (YY.MM.DD 형식)
  const extractDateFromTitle = (title: string): Date | null => {
    const dateMatch = title.match(/\[?(\d{2})\.(\d{2})\.(\d{2})\]?/);
    if (!dateMatch) return null;
    
    const [, year, month, day] = dateMatch;
    // 20XX년으로 가정 (25 이하면 2025년, 그 이상이면 19XX년)
    const fullYear = parseInt(year) <= 25 ? 2000 + parseInt(year) : 1900 + parseInt(year);
    
    return new Date(fullYear, parseInt(month) - 1, parseInt(day));
  };

  // 비디오 정렬 함수
  const sortVideos = (videos: VideoData[]): VideoData[] => {
    return [...videos].sort((a, b) => {
      if (sortBy === 'titleDate') {
        const dateA = extractDateFromTitle(a.title);
        const dateB = extractDateFromTitle(b.title);
        
        // 날짜가 있는 것을 우선으로, 없으면 업로드 날짜 사용
        if (dateA && dateB) {
          return dateB.getTime() - dateA.getTime(); // 최신순
        } else if (dateA && !dateB) {
          return -1; // dateA 우선
        } else if (!dateA && dateB) {
          return 1; // dateB 우선
        } else {
          // 둘 다 날짜가 없으면 업로드 날짜로 정렬
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        }
      } else if (sortBy === 'recentUpdate') {
        // 최근 댓글순 정렬 (lastNewCommentAt 기준, 새 댓글이 없으면 맨 뒤로)
        const getCommentDate = (video: VideoData) => {
          return video.lastNewCommentAt ? new Date(video.lastNewCommentAt).getTime() : 0;
        };
        
        const dateA = getCommentDate(a);
        const dateB = getCommentDate(b);
        
        // 둘 다 새 댓글이 없으면 업로드 날짜로 정렬
        if (dateA === 0 && dateB === 0) {
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        }
        
        return dateB - dateA; // 최신 댓글순
      } else {
        // 업로드 날짜순 정렬
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }
    });
  };

  // 채널 데이터 로드
  const loadChannelData = async (page: number = 1, search: string = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'channel-stats',
        page: page.toString(),
        limit: '20',
        sortBy: sortBy,  // 정렬 옵션 전달
        ...(search && { search })
      });
      
      const response = await fetch(`/api/youtube-comments?${params}`);
      const result = await response.json();
      
      if (result.success) {
        // titleDate는 클라이언트에서 정렬 (제목 파싱 필요)
        setVideos(sortBy === 'titleDate' ? sortVideos(result.data.videos) : result.data.videos);
        setStats(result.data.stats);
        setPagination(result.data.pagination);
      } else {
        alert(result.error || '데이터 로드 실패');
      }
    } catch (error) {
      console.error('채널 데이터 로드 오류:', error);
      alert('데이터 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };


  // 다이얼로그 열기 헬퍼 함수
  const showDialog = (title: string, message: string, result?: any, isError = false) => {
    setDialogTitle(title);
    setDialogMessage(message);
    setDialogResult(result);
    setDialogIsError(isError);
    setDialogOpen(true);
  };

  // 전체 채널 동기화
  const syncChannelData = async () => {
    if (!confirm('전체 채널을 동기화하시겠습니까? 시간이 오래 걸릴 수 있습니다.')) return;
    
    setSyncing(true);
    try {
      const response = await fetch('/api/youtube-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync-channel'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        showDialog('동기화 완료', result.message, result.data);
        await loadChannelData(pagination.currentPage, searchQuery);
      } else {
        showDialog('동기화 실패', result.error || '동기화 중 오류가 발생했습니다.', null, true);
      }
    } catch (error) {
      console.error('채널 동기화 오류:', error);
      showDialog('동기화 오류', '동기화 중 네트워크 오류가 발생했습니다.', null, true);
    } finally {
      setSyncing(false);
    }
  };

  // 개별 비디오 새로고침
  const refreshVideoComments = async (videoId: string) => {
    try {
      const response = await fetch('/api/youtube-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync-video',
          videoId
        })
      });

      const result = await response.json();
      
      if (result.success) {
        showDialog('비디오 새로고침 완료', result.message, result.data);
        await loadChannelData(pagination.currentPage, searchQuery);
        if (selectedVideo && selectedVideo.videoId === videoId) {
          await loadVideoComments(videoId);
        }
      } else {
        showDialog('새로고침 실패', result.error || '새로고침 중 오류가 발생했습니다.', null, true);
      }
    } catch (error) {
      console.error('비디오 새로고침 오류:', error);
      showDialog('새로고침 오류', '새로고침 중 네트워크 오류가 발생했습니다.', null, true);
    }
  };

  // 수동 영상 추가
  const addManualVideo = async () => {
    if (!manualVideoUrl.trim()) {
      alert('YouTube URL을 입력해주세요.');
      return;
    }

    // YouTube URL에서 비디오 ID 추출
    const videoIdMatch = manualVideoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    if (!videoIdMatch) {
      alert('올바른 YouTube URL을 입력해주세요.');
      return;
    }

    const videoId = videoIdMatch[1];
    setAddingVideo(true);

    try {
      const response = await fetch('/api/youtube-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-manual-video',
          videoId: videoId,
          videoUrl: manualVideoUrl
        })
      });

      const result = await response.json();
      
      if (result.success) {
        showDialog('영상 추가 완료', result.message, result.data);
        setManualVideoUrl('');
        setShowManualAdd(false);
        await loadChannelData(pagination.currentPage, searchQuery);
      } else {
        showDialog('영상 추가 실패', result.error || '영상 추가 중 오류가 발생했습니다.', null, true);
      }
    } catch (error) {
      console.error('수동 영상 추가 오류:', error);
      showDialog('영상 추가 오류', '영상 추가 중 네트워크 오류가 발생했습니다.', null, true);
    } finally {
      setAddingVideo(false);
    }
  };

  // 비디오 댓글 상세 조회
  const loadVideoComments = async (videoId: string) => {
    try {
      const response = await fetch(`/api/youtube-comments?action=video-details&videoId=${videoId}`);
      const result = await response.json();
      
      if (result.success) {
        setComments(result.data.comments);
        setSelectedVideo(result.data.video);
      } else {
        showDialog('댓글 로드 실패', result.error || '댓글 로드 중 오류가 발생했습니다.', null, true);
      }
    } catch (error) {
      console.error('댓글 로드 오류:', error);
      showDialog('댓글 로드 오류', '댓글 로드 중 네트워크 오류가 발생했습니다.', null, true);
    }
  };

  // 댓글 상태 업데이트
  const updateCommentStatus = async (commentId: string, updates: { isProcessed?: boolean; isTimeline?: boolean }) => {
    try {
      const response = await fetch('/api/youtube-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-comment',
          commentId,
          data: updates
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // 로컬 상태 업데이트
        setComments(prev => prev.map(comment => 
          comment.commentId === commentId 
            ? { ...comment, ...updates }
            : comment
        ));
      } else {
        showDialog('업데이트 실패', result.error || '업데이트 중 오류가 발생했습니다.', null, true);
      }
    } catch (error) {
      console.error('댓글 업데이트 오류:', error);
      showDialog('업데이트 오류', '업데이트 중 네트워크 오류가 발생했습니다.', null, true);
    }
  };

  // 타임스탬프 파서로 이동
  const sendToTimestampParser = (comment: CommentData) => {
    // 타임스탬프 파서 탭으로 데이터 전달하는 로직
    // 부모 컴포넌트의 상태 관리를 통해 구현 필요
    console.log('타임스탬프 파서로 전송:', comment);
    alert(`타임스탬프 파서로 이동: ${comment.extractedTimestamps.join(', ')}`);
  };

  // 필터링된 댓글
  const filteredComments = comments.filter(comment => {
    switch (filterType) {
      case 'timeline': return comment.isTimeline;
      case 'non-timeline': return !comment.isTimeline;
      case 'processed': return comment.isProcessed;
      case 'unprocessed': return !comment.isProcessed;
      default: return true;
    }
  });

  // 타임라인 파싱 실행
  const parseTimelineComments = async () => {
    setTimelineParsing(true);
    try {
      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'parse-timeline-comments',
          skipProcessed: skipProcessed
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setTimelineStats(result.data.stats);
        showDialog('타임라인 파싱 완료', result.message || '타임라인 파싱이 완료되었습니다.');
      } else {
        showDialog('타임라인 파싱 실패', result.error || '타임라인 파싱 중 오류가 발생했습니다.', null, true);
      }
    } catch (error) {
      console.error('타임라인 파싱 오류:', error);
      showDialog('타임라인 파싱 오류', '타임라인 파싱 중 네트워크 오류가 발생했습니다.', null, true);
    } finally {
      setTimelineParsing(false);
    }
  };


  // 기존 데이터를 개선된 파싱 방식으로 업데이트
  const reprocessAllTimelines = async () => {
    if (!confirm('기존 파싱된 타임라인 데이터를 개선된 멀티라인 파싱 방식으로 업데이트하시겠습니까?\n새로운 요소는 추가되지 않고 기존 데이터만 업데이트됩니다.')) return;
    
    setTimelineParsing(true);
    try {
      const response = await fetch('/api/timeline-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reprocess-timeline-comments'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        showDialog('데이터 업데이트 완료', result.message, result.data);
      } else {
        showDialog('업데이트 실패', result.error || '데이터 업데이트 중 오류가 발생했습니다.', null, true);
      }
    } catch (error) {
      console.error('데이터 업데이트 오류:', error);
      showDialog('업데이트 오류', '데이터 업데이트 중 네트워크 오류가 발생했습니다.', null, true);
    } finally {
      setTimelineParsing(false);
    }
  };

  // 검색 핸들러
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadChannelData(1, searchQuery);
  };
  
  // 페이지 변경
  const handlePageChange = (newPage: number) => {
    loadChannelData(newPage, searchQuery);
  };

  // 모바일 감지
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  useEffect(() => {
    loadChannelData();
  }, []);

  // 정렬 옵션 변경 시 데이터 새로고침
  useEffect(() => {
    loadChannelData(pagination?.currentPage || 1, searchQuery);
  }, [sortBy]);

  return (
    <div className={`h-full bg-gray-50 dark:bg-gray-900 ${isMobile ? 'p-2' : 'p-6'} overflow-hidden`}>
      <div className={`w-full h-full flex flex-col ${isMobile ? 'space-y-3' : 'space-y-6'} min-h-0`}>
        {/* 헤더 */}
        <div className={`bg-white dark:bg-gray-800 rounded-lg ${isMobile ? 'p-3' : 'p-6'} border border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0`}>
          <div className={`flex flex-col lg:flex-row lg:items-center justify-between ${isMobile ? 'gap-3' : 'gap-6'}`}>
            <div>
              <h2 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-gray-900 dark:text-white ${isMobile ? 'mb-1' : 'mb-2'}`}>
                {viewMode === 'comments' ? 'YouTube 댓글 분석' : '타임라인 파싱 관리'}
              </h2>
              <p className={`text-gray-600 dark:text-gray-400 ${isMobile ? 'text-sm' : ''}`}>
                {viewMode === 'comments' 
                  ? '아야 다시보기 채널의 댓글을 수집하고 타임라인 정보를 분석합니다.'
                  : '타임라인 댓글에서 곡 정보를 파싱하고 라이브 클립 데이터를 관리합니다.'
                }
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {viewMode === 'comments' && (
                <>
                  <button
                    onClick={() => loadChannelData(pagination.currentPage, searchQuery)}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                    새로고침
                  </button>
                  <button
                    onClick={syncChannelData}
                    disabled={syncing}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg flex items-center gap-2 transition-colors"
                  >
                    {syncing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        동기화 중...
                      </>
                    ) : (
                      <>
                        <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                        전체 동기화
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowManualAdd(!showManualAdd)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <LinkIcon className="w-4 h-4" />
                    영상 추가
                  </button>
                </>
              )}

              {/* 수동 영상 추가 폼 */}
              {viewMode === 'comments' && showManualAdd && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-3">
                    영상 추가
                  </h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualVideoUrl}
                      onChange={(e) => setManualVideoUrl(e.target.value)}
                      placeholder="YouTube URL을 입력하세요 (예: https://www.youtube.com/watch?v=...)"
                      className="flex-1 px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg 
                               bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      disabled={addingVideo}
                    />
                    <button
                      onClick={addManualVideo}
                      disabled={addingVideo || !manualVideoUrl.trim()}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 
                               text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                      {addingVideo ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          추가 중...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="w-4 h-4" />
                          추가
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowManualAdd(false);
                        setManualVideoUrl('');
                      }}
                      className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
                      disabled={addingVideo}
                    >
                      취소
                    </button>
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                    다른 채널의 YouTube 영상도 추가할 수 있습니다.
                  </p>
                </div>
              )}

              {/* 정렬 옵션 */}
              {viewMode === 'comments' && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">정렬:</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sortBy"
                      value="uploadDate"
                      checked={sortBy === 'uploadDate'}
                      onChange={(e) => setSortBy(e.target.value as 'uploadDate' | 'titleDate' | 'recentUpdate')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-600 dark:text-gray-400">업로드 날짜순</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sortBy"
                      value="titleDate"
                      checked={sortBy === 'titleDate'}
                      onChange={(e) => setSortBy(e.target.value as 'uploadDate' | 'titleDate' | 'recentUpdate')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-600 dark:text-gray-400">제목 날짜순</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sortBy"
                      value="recentUpdate"
                      checked={sortBy === 'recentUpdate'}
                      onChange={(e) => setSortBy(e.target.value as 'uploadDate' | 'titleDate' | 'recentUpdate')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-600 dark:text-gray-400">최근 댓글순</span>
                  </label>
                </div>
              )}
              
              {viewMode === 'timeline' && (
                <div className="flex flex-col gap-2">
                  {/* 파싱 옵션 */}
                  <div className="flex items-center gap-3 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skipProcessed}
                        onChange={(e) => setSkipProcessed(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-600 dark:text-gray-400">
                        처리완료된 댓글 스킵
                      </span>
                    </label>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      ({skipProcessed ? '빠른 파싱' : '전체 재파싱'})
                    </span>
                  </div>
                  
                  {/* 버튼들 */}
                  <div className="flex gap-2">
                    <button
                      onClick={parseTimelineComments}
                      disabled={timelineParsing}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                      {timelineParsing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          처리 중...
                        </>
                      ) : (
                        <>
                          <LinkIcon className="w-4 h-4" />
                          타임라인 파싱
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={triggerUpload}
                      disabled={(timelineStats?.matchedSongs || 0) === 0 && (timelineStats?.verifiedItems || 0) === 0}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <ArrowPathIcon className="w-4 h-4" />
                      라이브 클립 업로드
                    </button>
                    
                    <button
                      onClick={reprocessAllTimelines}
                      disabled={timelineParsing}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                      데이터 업데이트
                    </button>
                  </div>
                </div>
              )}
              
              {/* 뷰 모드 토글 - 오른쪽 끝으로 이동 (propViewMode가 있으면 숨김) */}
              {!propViewMode && (
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('comments')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'comments'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <ChatBubbleBottomCenterTextIcon className="w-4 h-4 mr-2 inline" />
                    댓글 분석
                  </button>
                  <button
                    onClick={() => setViewMode('timeline')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'timeline'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <LinkIcon className="w-4 h-4 mr-2 inline" />
                    타임라인 파싱
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 통계 - 모드에 따라 다르게 표시 */}
          {viewMode === 'comments' ? (
            <div className={`grid grid-cols-2 lg:grid-cols-4 ${isMobile ? 'gap-2 mt-3' : 'gap-4 mt-6'}`}>
              <div className={`bg-blue-50 dark:bg-blue-900/20 ${isMobile ? 'p-3' : 'p-6'} rounded-lg`}>
                <div className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-blue-600 dark:text-blue-400`}>{stats.totalVideos}</div>
                <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-blue-700 dark:text-blue-300`}>총 비디오</div>
              </div>
              <div className={`bg-green-50 dark:bg-green-900/20 ${isMobile ? 'p-3' : 'p-6'} rounded-lg`}>
                <div className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-green-600 dark:text-green-400`}>{stats.totalComments}</div>
                <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-green-700 dark:text-green-300`}>총 댓글</div>
              </div>
              <div className={`bg-purple-50 dark:bg-purple-900/20 ${isMobile ? 'p-3' : 'p-6'} rounded-lg`}>
                <div className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-purple-600 dark:text-purple-400`}>{stats.timelineComments}</div>
                <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-purple-700 dark:text-purple-300`}>타임라인 댓글</div>
              </div>
              <div className={`bg-orange-50 dark:bg-orange-900/20 ${isMobile ? 'p-3' : 'p-6'} rounded-lg`}>
                <div className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-orange-600 dark:text-orange-400`}>{stats.processedComments}</div>
                <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-orange-700 dark:text-orange-300`}>처리 완료</div>
              </div>
            </div>
          ) : (
            <div className={`grid grid-cols-2 lg:grid-cols-5 ${isMobile ? 'gap-2 mt-3' : 'gap-4 mt-6'}`}>
              <div className={`bg-green-50 dark:bg-green-900/20 ${isMobile ? 'p-2' : 'p-4'} rounded-lg`}>
                <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-green-600 dark:text-green-400`}>{timelineStats?.parsedItems || 0}</div>
                <div className="text-xs text-green-700 dark:text-green-300">파싱된 항목</div>
              </div>
              <div className={`bg-yellow-50 dark:bg-yellow-900/20 ${isMobile ? 'p-2' : 'p-4'} rounded-lg`}>
                <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-yellow-600 dark:text-yellow-400`}>{timelineStats?.relevantItems || 0}</div>
                <div className="text-xs text-yellow-700 dark:text-yellow-300">관련성 있음</div>
              </div>
              <div className={`bg-indigo-50 dark:bg-indigo-900/20 ${isMobile ? 'p-2' : 'p-4'} rounded-lg`}>
                <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-indigo-600 dark:text-indigo-400`}>{timelineStats?.matchedSongs || 0}</div>
                <div className="text-xs text-indigo-700 dark:text-indigo-300">매칭된 곡</div>
              </div>
              <div className={`bg-pink-50 dark:bg-pink-900/20 ${isMobile ? 'p-2' : 'p-4'} rounded-lg`}>
                <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-pink-600 dark:text-pink-400`}>{timelineStats?.uniqueMatchedSongs || 0}</div>
                <div className="text-xs text-pink-700 dark:text-pink-300">고유 곡</div>
              </div>
              <div className={`bg-blue-50 dark:bg-blue-900/20 ${isMobile ? 'p-2' : 'p-4'} rounded-lg`}>
                <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-blue-600 dark:text-blue-400`}>{timelineStats?.verifiedItems || 0}</div>
                <div className="text-xs text-blue-700 dark:text-blue-300">검증완료</div>
              </div>
            </div>
          )}
        </div>

        {/* 콘텐츠 영역 - 조건부 렌더링 */}
        {viewMode === 'timeline' ? (
          <TimelineParsingView onStatsUpdate={setTimelineStats} onUploadRequest={triggerUpload} />
        ) : (
          <div className={`flex ${isMobile ? 'flex-col' : 'flex-col xl:flex-row'} gap-6 flex-1 min-h-0`}>
            {/* 비디오 목록 */}
            <div className="flex-1 xl:flex-[1] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-screen min-h-0">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                비디오 목록 ({pagination.totalVideos}개)
              </h3>
            </div>
            
            {/* 검색창 */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="비디오 제목 검색..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                           focus:border-blue-500 dark:focus:border-blue-400 outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
              >
                검색
              </button>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    loadChannelData(1, '');
                  }}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                >
                  초기화
                </button>
              )}
            </form>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">로딩 중...</p>
              </div>
            ) : videos.length === 0 ? (
              <div className="p-8 text-center">
                <ChatBubbleBottomCenterTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">비디오 데이터가 없습니다.</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">전체 동기화를 실행해주세요.</p>
              </div>
            ) : (
              videos.map((video) => (
                <div
                  key={video.videoId}
                  className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                    selectedVideo?.videoId === video.videoId ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                  onClick={() => loadVideoComments(video.videoId)}
                >
                  <div className="flex gap-4">
                    <img 
                      src={video.thumbnailUrl} 
                      alt={video.title}
                      className="w-24 h-18 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white leading-5" 
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                        {video.title}
                      </h4>
                      {/* 채널 정보 */}
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        📺 {video.channelName || '알 수 없는 채널'}
                      </div>
                      
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                          {video.totalComments}개
                        </span>
                        <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                          <ClockIcon className="w-4 h-4" />
                          {video.timelineComments}개
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-500 mt-1">
                        <div className="flex items-center gap-4">
                          <span>업로드: {new Date(video.publishedAt).toLocaleDateString('ko-KR')}</span>
                          {(() => {
                            const titleDate = extractDateFromTitle(video.title);
                            return titleDate ? (
                              <span className="text-green-600 dark:text-green-400">
                                제목: {titleDate.toLocaleDateString('ko-KR')}
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <div className="flex items-center gap-4">
                          <span>마지막 동기화: {new Date(video.lastCommentSync).toLocaleDateString('ko-KR')}</span>
                          {video.lastNewCommentAt && (
                            <span className="text-red-600 dark:text-red-400">
                              새 댓글: {new Date(video.lastNewCommentAt).toLocaleDateString('ko-KR')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          refreshVideoComments(video.videoId);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="댓글 새로고침"
                      >
                        <ArrowPathIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* 페이지네이션 */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {pagination.currentPage}페이지 / {pagination.totalPages}페이지 
                  (총 {pagination.totalVideos}개)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={pagination.currentPage === 1}
                    className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 
                               rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    이전
                  </button>
                  
                  {/* 페이지 번호들 */}
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const startPage = Math.max(1, pagination.currentPage - 2);
                    const pageNum = startPage + i;
                    if (pageNum > pagination.totalPages) return null;
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-1 rounded text-sm ${
                          pageNum === pagination.currentPage
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={pagination.currentPage === pagination.totalPages}
                    className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 
                               rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    다음
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 댓글 상세 */}
        <div className="flex-1 xl:flex-[1] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-screen min-h-0">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selectedVideo ? selectedVideo.title : '댓글 상세'}
              </h3>
              {selectedVideo && (
                <div className="flex gap-2">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">전체</option>
                    <option value="timeline">타임라인만</option>
                    <option value="non-timeline">일반 댓글만</option>
                    <option value="processed">처리완료만</option>
                    <option value="unprocessed">미처리만</option>
                  </select>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!selectedVideo ? (
              <div className="p-8 text-center">
                <EyeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">비디오를 선택해주세요.</p>
              </div>
            ) : filteredComments.length === 0 ? (
              <div className="p-8 text-center">
                <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">필터에 맞는 댓글이 없습니다.</p>
              </div>
            ) : (
              filteredComments.map((comment) => (
                <div
                  key={comment.commentId}
                  className="p-4 border-b border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {comment.authorName}
                          </span>
                          <div className="flex gap-1 flex-shrink-0">
                            {comment.isTimeline && (
                              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs">
                                타임라인
                              </span>
                            )}
                            {comment.isProcessed && (
                              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">
                                처리완료
                              </span>
                            )}
                            {comment.manuallyMarked && (
                              <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs">
                                수동수정
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                          <span>
                            작성: {new Date(comment.publishedAt).toLocaleDateString('ko-KR', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                          {comment.createdAt && (
                            <span>
                              수집: {new Date(comment.createdAt).toLocaleDateString('ko-KR', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 text-sm mb-3 whitespace-pre-wrap leading-relaxed">
                        {stripHtmlTags(comment.textContent)}
                      </p>
                      
                      {/* 타임스탬프 */}
                      {comment.extractedTimestamps.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {comment.extractedTimestamps.map((timestamp, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs"
                            >
                              {timestamp}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {comment.isTimeline && (
                        <button
                          onClick={() => sendToTimestampParser(comment)}
                          className="p-1 text-blue-600 hover:text-blue-700 transition-colors"
                          title="타임스탬프 파서로 전송"
                        >
                          <ArrowRightIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => updateCommentStatus(comment.commentId, { 
                          isProcessed: !comment.isProcessed 
                        })}
                        className={`p-1 transition-colors ${
                          comment.isProcessed 
                            ? 'text-green-600 hover:text-green-700' 
                            : 'text-gray-400 hover:text-green-600'
                        }`}
                        title={comment.isProcessed ? '처리완료 해제' : '처리완료 표시'}
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateCommentStatus(comment.commentId, { 
                          isTimeline: !comment.isTimeline 
                        })}
                        className={`p-1 transition-colors ${
                          comment.isTimeline 
                            ? 'text-purple-600 hover:text-purple-700' 
                            : 'text-gray-400 hover:text-purple-600'
                        }`}
                        title={comment.isTimeline ? '일반 댓글로 변경' : '타임라인 댓글로 변경'}
                      >
                        <TagIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
            </div>
          </div>
          </div>
        )}
        
        {/* 결과 다이얼로그 */}
        <SyncResultDialog
          isOpen={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={dialogTitle}
          message={dialogMessage}
          result={dialogResult}
          isError={dialogIsError}
        />
      </div>
    </div>
  );
}