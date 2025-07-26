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
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface VideoData {
  videoId: string;
  title: string;
  publishedAt: string;
  totalComments: number;
  timelineComments: number;
  lastCommentSync: string;
  thumbnailUrl: string;
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
}

interface ChannelStats {
  totalVideos: number;
  totalComments: number;
  timelineComments: number;
  processedComments: number;
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalVideos: number;
  limit: number;
}

export default function CommentAnalysisTab() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [stats, setStats] = useState<ChannelStats>({
    totalVideos: 0,
    totalComments: 0,
    timelineComments: 0,
    processedComments: 0
  });
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 1,
    totalVideos: 0,
    limit: 20
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'timeline' | 'non-timeline' | 'processed' | 'unprocessed'>('all');

  // 채널 데이터 로드
  const loadChannelData = async (page: number = 1, search: string = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'channel-stats',
        page: page.toString(),
        limit: '20',
        ...(search && { search })
      });
      
      const response = await fetch(`/api/youtube-comments?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setVideos(result.data.videos);
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

  // API 연결 테스트
  const testAPIConnection = async () => {
    try {
      const response = await fetch('/api/youtube-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'test',
          artist: 'test'
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('YouTube API 연결 성공!');
      } else {
        alert(`API 테스트 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('API 테스트 오류:', error);
      alert('API 테스트 중 오류가 발생했습니다.');
    }
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
        alert(result.message);
        await loadChannelData(pagination.currentPage, searchQuery);
      } else {
        alert(result.error || '동기화 실패');
      }
    } catch (error) {
      console.error('채널 동기화 오류:', error);
      alert('동기화 중 오류가 발생했습니다.');
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
        alert(result.message);
        await loadChannelData(pagination.currentPage, searchQuery);
        if (selectedVideo && selectedVideo.videoId === videoId) {
          await loadVideoComments(videoId);
        }
      } else {
        alert(result.error || '새로고침 실패');
      }
    } catch (error) {
      console.error('비디오 새로고침 오류:', error);
      alert('새로고침 중 오류가 발생했습니다.');
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
        alert(result.error || '댓글 로드 실패');
      }
    } catch (error) {
      console.error('댓글 로드 오류:', error);
      alert('댓글 로드 중 오류가 발생했습니다.');
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
        alert(result.error || '업데이트 실패');
      }
    } catch (error) {
      console.error('댓글 업데이트 오류:', error);
      alert('업데이트 중 오류가 발생했습니다.');
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

  // 검색 핸들러
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadChannelData(1, searchQuery);
  };
  
  // 페이지 변경
  const handlePageChange = (newPage: number) => {
    loadChannelData(newPage, searchQuery);
  };

  useEffect(() => {
    loadChannelData();
  }, []);

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 p-6 overflow-hidden">
      <div className="w-full h-full flex flex-col space-y-6">
        {/* 헤더 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                YouTube 댓글 분석
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                아야 다시보기 채널의 댓글을 수집하고 타임라인 정보를 분석합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={testAPIConnection}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <CheckCircleIcon className="w-4 h-4" />
                API 테스트
              </button>
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
            </div>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.totalVideos}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300">총 비디오</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.totalComments}</div>
              <div className="text-sm text-green-700 dark:text-green-300">총 댓글</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.timelineComments}</div>
              <div className="text-sm text-purple-700 dark:text-purple-300">타임라인 댓글</div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-lg">
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{stats.processedComments}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300">처리 완료</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
        {/* 비디오 목록 */}
        <div className="flex-1 xl:flex-[1] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-full">
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
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {new Date(video.publishedAt).toLocaleDateString('ko-KR')}
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
        <div className="flex-1 xl:flex-[1] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-full">
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
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {comment.authorName}
                        </span>
                        <div className="flex gap-1">
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
                      <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                        {comment.textContent}
                      </p>
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
    </div>
    </div>
  );
}