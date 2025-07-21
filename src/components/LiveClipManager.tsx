'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SongVideo } from '@/types';
import { PlayIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import YouTube from 'react-youtube';
import { useSession } from 'next-auth/react';

// YouTube 플레이어 타입 정의
interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
}

interface LiveClipManagerProps {
  songId: string;
  songTitle: string;
  isVisible: boolean;
}

export default function LiveClipManager({ songId, songTitle, isVisible }: LiveClipManagerProps) {
  const { data: session } = useSession();
  
  // 라이브 클립 관련 상태
  const [songVideos, setSongVideos] = useState<SongVideo[]>([]);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videoPlayer, setVideoPlayer] = useState<YouTubePlayer | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showAddVideoForm, setShowAddVideoForm] = useState(false);
  const [addVideoData, setAddVideoData] = useState({
    videoUrl: '',
    endVideoUrl: '', // 종료 시간용 URL
    sungDate: '',
    description: '',
    startTime: 0,
    endTime: undefined as number | undefined
  });
  
  // 영상 메타데이터 상태
  const [videoMetadata, setVideoMetadata] = useState({
    title: '',
    extractedDate: '',
    parsedStartTime: 0,
    parsedEndTime: undefined as number | undefined
  });
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);

  // 선택된 영상 정보
  const selectedVideo = songVideos[selectedVideoIndex];

  // YouTube URL에서 시간 파라미터 추출
  const extractTimeFromUrl = (url: string): number => {
    if (!url) return 0;
    
    // t 파라미터 추출 (예: &t=25416 또는 ?t=25416)
    const timeMatch = url.match(/[?&]t=(\d+)/);
    if (timeMatch) {
      return parseInt(timeMatch[1], 10);
    }
    
    // start 파라미터 추출 (예: &start=25416)
    const startMatch = url.match(/[?&]start=(\d+)/);
    if (startMatch) {
      return parseInt(startMatch[1], 10);
    }
    
    return 0;
  };

  // YouTube 제목에서 날짜 추출
  const extractDateFromTitle = (title: string): string => {
    if (!title) return '';
    
    // [YY.MM.DD] 또는 [YYYY.MM.DD] 형식 찾기
    const dateMatch = title.match(/\[(\d{2,4})\.(\d{1,2})\.(\d{1,2})\]/);
    if (dateMatch) {
      let year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10);
      const day = parseInt(dateMatch[3], 10);
      
      // 2자리 년도인 경우 20XX로 변환
      if (year < 100) {
        year += 2000;
      }
      
      // YYYY-MM-DD 형식으로 변환
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    
    return '';
  };

  // YouTube API로 영상 메타데이터 가져오기 (제목 추출용)
  const fetchVideoMetadata = async (videoUrl: string) => {
    try {
      const parsedStartTime = extractTimeFromUrl(videoUrl);
      
      console.log('🔍 메타데이터 요청:', videoUrl);
      
      // API로 메타데이터 가져오기
      const response = await fetch(`/api/youtube/metadata?url=${encodeURIComponent(videoUrl)}`);
      
      console.log('📡 API 응답 상태:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📄 API 응답 데이터:', data);
        
        if (data.success && data.metadata) {
          const metadata = data.metadata;
          
          console.log('✅ 메타데이터 처리:', {
            title: metadata.title,
            extractedDate: metadata.extractedDate,
            parsedStartTime
          });
          
          setVideoMetadata(prev => ({
            ...prev,
            title: metadata.title,
            extractedDate: metadata.extractedDate,
            parsedStartTime
          }));
          
          // 자동 감지된 날짜가 있으면 설정
          if (metadata.extractedDate) {
            console.log('📅 날짜 자동 설정:', metadata.extractedDate);
            setAddVideoData(prev => ({
              ...prev,
              sungDate: metadata.extractedDate,
              startTime: parsedStartTime
            }));
          } else {
            console.log('⚠️ 날짜 추출 실패');
            setAddVideoData(prev => ({
              ...prev,
              startTime: parsedStartTime
            }));
          }
          
          return;
        }
      }
      
      console.log('❌ API 실패, 기본 파싱만 수행');
      
      // API 실패 시 기본 파싱만 수행
      setVideoMetadata(prev => ({
        ...prev,
        parsedStartTime
      }));
      
      setAddVideoData(prev => ({
        ...prev,
        startTime: parsedStartTime
      }));
      
    } catch (error) {
      console.error('영상 메타데이터 추출 실패:', error);
      
      // 오류 시에도 시간 파싱은 수행
      const parsedStartTime = extractTimeFromUrl(videoUrl);
      setVideoMetadata(prev => ({
        ...prev,
        parsedStartTime
      }));
      
      setAddVideoData(prev => ({
        ...prev,
        startTime: parsedStartTime
      }));
    }
  };

  // URL 변경 시 자동 파싱
  const handleVideoUrlChange = async (url: string) => {
    setAddVideoData(prev => ({
      ...prev,
      videoUrl: url
    }));
    
    if (url) {
      await fetchVideoMetadata(url);
    }
  };

  // 종료 URL 변경 시 종료 시간 추출
  const handleEndVideoUrlChange = (url: string) => {
    setAddVideoData(prev => ({
      ...prev,
      endVideoUrl: url,
      endTime: url ? extractTimeFromUrl(url) : undefined
    }));
  };

  // 유튜브 영상 데이터 가져오기
  useEffect(() => {
    const fetchSongVideos = async () => {
      if (!songId || !isVisible) return;
      
      setVideosLoading(true);
      try {
        const response = await fetch(`/api/songs/${songId}/videos`);
        if (response.ok) {
          const data = await response.json();
          setSongVideos(data.videos || []);
        }
      } catch (error) {
        console.error('영상 목록 조회 실패:', error);
      } finally {
        setVideosLoading(false);
      }
    };

    fetchSongVideos();
  }, [songId, isVisible]);

  // 라이브 클립 추가 핸들러
  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!songId || !addVideoData.videoUrl) return;
    
    // 날짜가 없으면 기본값으로 오늘 날짜 사용
    const sungDate = addVideoData.sungDate || new Date().toISOString().split('T')[0];

    setIsAddingVideo(true);
    try {
      const response = await fetch(`/api/songs/${songId}/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...addVideoData,
          sungDate: sungDate
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // 새 영상을 목록에 추가
        setSongVideos(prev => [result.video, ...prev]);
        // 폼 초기화
        setAddVideoData({
          videoUrl: '',
          endVideoUrl: '',
          sungDate: '',
          description: '',
          startTime: 0,
          endTime: undefined
        });
        setVideoMetadata({
          title: '',
          extractedDate: '',
          parsedStartTime: 0,
          parsedEndTime: undefined
        });
        setShowAddVideoForm(false);
        console.log('라이브 클립이 성공적으로 추가되었습니다!');
      } else {
        const error = await response.json();
        console.error('라이브 클립 추가 실패:', error.error);
        alert(error.error || '라이브 클립 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('라이브 클립 추가 오류:', error);
      alert('라이브 클립 추가 중 오류가 발생했습니다.');
    } finally {
      setIsAddingVideo(false);
    }
  };

  const handleScrollableAreaScroll = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  if (!isVisible) return null;

  return (
    <div className="flex flex-col h-full min-h-0 p-4 pb-6 sm:p-6 xl:p-0 xl:pb-4">
      {!showAddVideoForm ? (
        videosLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-light-accent dark:border-dark-accent"></div>
          </div>
        ) : songVideos.length > 0 ? (
          <div className="flex flex-col flex-1 min-h-0">
            {/* 유튜브 플레이어 */}
            <div className="relative mb-4 flex-shrink-0">
              <div className={`w-full bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden transition-all duration-300 ${
                isPlayerMinimized 
                  ? 'aspect-video max-h-[20vh] min-h-[120px]' 
                  : 'aspect-video max-h-[30vh] sm:max-h-[35vh] min-h-[180px] sm:min-h-[200px]'
              }`}>
                {selectedVideo && (
                  <YouTube
                    key={`video-${selectedVideo._id}`}
                    videoId={selectedVideo.videoId}
                    opts={{
                      width: '100%',
                      height: '100%',
                      playerVars: {
                        autoplay: 0,
                        controls: 1,
                        rel: 0,
                        modestbranding: 1,
                        start: selectedVideo.startTime || 0,
                        end: selectedVideo.endTime || undefined,
                        iv_load_policy: 3,
                        cc_load_policy: 0,
                      },
                    }}
                    onReady={(event) => setVideoPlayer(event.target)}
                    onPlay={() => setIsVideoPlaying(true)}
                    onPause={() => setIsVideoPlaying(false)}
                    onEnd={() => setIsVideoPlaying(false)}
                    className="w-full h-full"
                  />
                )}
              </div>
              
              {/* 플레이어 크기 조절 버튼 */}
              <button
                onClick={() => setIsPlayerMinimized(!isPlayerMinimized)}
                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white 
                         rounded-lg transition-colors duration-200 backdrop-blur-sm z-10"
                title={isPlayerMinimized ? "플레이어 확대" : "플레이어 축소"}
              >
                {isPlayerMinimized ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12l-5-5m5 5l-5 5m5-5H4" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* 영상 목록 */}
            <div className="flex-1 min-h-0 flex flex-col min-h-[200px]"> {/* 목록을 위한 최소 공간 보장 */}
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <h5 className="text-sm font-medium text-light-text/70 dark:text-dark-text/70">
                  라이브 클립 ({songVideos.length}개)
                </h5>
                {session && (
                  <button
                    onClick={() => setShowAddVideoForm(true)}
                    className="px-3 py-1.5 text-xs bg-light-accent/20 dark:bg-dark-accent/20 
                             text-light-accent dark:text-dark-accent 
                             rounded-lg hover:bg-light-accent/30 dark:hover:bg-dark-accent/30 
                             transition-colors duration-200 font-medium
                             flex items-center gap-1"
                  >
                    <PlusIcon className="w-3 h-3" />
                    추가
                  </button>
                )}
              </div>
              
              <div className="scrollable-content space-y-2 overflow-y-auto min-h-0 flex-1 pr-2 pb-4" 
                   style={{
                     scrollbarWidth: 'thin',
                     scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
                   }}
                   onWheel={handleScrollableAreaScroll}>
                {songVideos.map((video, index) => (
                  <div
                    key={video._id}
                    onClick={() => setSelectedVideoIndex(index)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                      selectedVideoIndex === index
                        ? 'border-light-accent/50 dark:border-dark-accent/50 bg-light-accent/10 dark:bg-dark-accent/10'
                        : 'border-light-primary/20 dark:border-dark-primary/20 hover:border-light-accent/30 dark:hover:border-dark-accent/30 hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-light-text dark:text-dark-text truncate">
                          {new Date(video.sungDate).toLocaleDateString('ko-KR')}
                        </div>
                        {video.description && (
                          <div className="text-xs text-light-text/60 dark:text-dark-text/60 mt-1 truncate">
                            {video.description}
                          </div>
                        )}
                        <div className="text-xs text-light-text/50 dark:text-dark-text/50 mt-1">
                          {video.addedByName}
                          {video.isVerified && (
                            <span className="ml-2 text-green-600 dark:text-green-400">✓ 검증됨</span>
                          )}
                        </div>
                      </div>
                      {selectedVideoIndex === index && (
                        <PlayIcon className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-light-text/50 dark:text-dark-text/50 min-h-0">
            <div className="text-center">
              <PlayIcon className="w-16 h-16 mb-4 opacity-30 mx-auto" />
              <p className="text-lg mb-2">아직 등록된 라이브 클립이 없습니다</p>
              <p className="text-base">사용자가 라이브 클립을 추가할 수 있습니다</p>
              {session && (
                <button
                  onClick={() => setShowAddVideoForm(true)}
                  className="mt-4 px-4 py-2 bg-gradient-to-r from-light-accent to-light-purple 
                           dark:from-dark-accent dark:to-dark-purple text-white 
                           rounded-lg hover:shadow-lg transform hover:scale-105 
                           transition-all duration-200 font-medium"
                >
                  + 라이브 클립 추가
                </button>
              )}
            </div>
          </div>
        )
      ) : (
        /* 라이브 클립 추가 폼 */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col flex-1 min-h-0 h-full"
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-6 pb-8 bg-gradient-to-br from-light-primary/10 to-light-accent/5 
                        dark:from-dark-primary/10 dark:to-dark-accent/5 
                        border border-light-accent/20 dark:border-dark-accent/20 
                        rounded-2xl backdrop-blur-sm"
               style={{
                 scrollbarWidth: 'thin',
                 scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
               }}
          >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-light-accent to-light-purple 
                            dark:from-dark-accent dark:to-dark-purple 
                            flex items-center justify-center">
                <PlayIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-light-text dark:text-dark-text">
                  라이브 클립 추가
                </h4>
                <p className="text-sm text-light-text/60 dark:text-dark-text/60">
                  {songTitle}의 라이브 영상을 추가해보세요
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddVideoForm(false)}
              className="p-2 rounded-full hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                       transition-colors duration-200"
            >
              <XMarkIcon className="w-5 h-5 text-light-text/60 dark:text-dark-text/60" />
            </button>
          </div>

          <form onSubmit={handleAddVideo} className="space-y-6">
            {/* YouTube URL 입력 (시작 시간 포함) */}
            <div>
              <label className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                시작 위치 유튜브 URL * 
                <span className="text-xs text-light-text/60 dark:text-dark-text/60 ml-2">
                  (시간 파라미터 포함된 링크를 붙여넣으세요)
                </span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={addVideoData.videoUrl}
                  onChange={(e) => handleVideoUrlChange(e.target.value)}
                  placeholder="https://youtu.be/DbMJrwTVf0Q?t=25416"
                  className="w-full px-4 py-3 pl-12 bg-white/50 dark:bg-gray-800/50 
                           border border-light-accent/30 dark:border-dark-accent/30 
                           rounded-xl outline-none 
                           focus:border-light-accent dark:focus:border-dark-accent 
                           focus:ring-2 focus:ring-light-accent/20 dark:focus:ring-dark-accent/20
                           text-light-text dark:text-dark-text"
                  required
                />
                <PlayIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-light-accent dark:text-dark-accent" />
              </div>
              {videoMetadata.parsedStartTime > 0 && (
                <div className="mt-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                  ✅ 시작 시간 자동 인식: {Math.floor(videoMetadata.parsedStartTime / 3600)}:{String(Math.floor((videoMetadata.parsedStartTime % 3600) / 60)).padStart(2, '0')}:{String(videoMetadata.parsedStartTime % 60).padStart(2, '0')} → 아래 시작 시간 필드에 자동 입력됨
                </div>
              )}
            </div>

            {/* 종료 URL 입력 (선택사항) */}
            <div>
              <label className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                종료 위치 유튜브 URL (선택사항)
                <span className="text-xs text-light-text/60 dark:text-dark-text/60 ml-2">
                  (노래 끝나는 시점의 링크)
                </span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={addVideoData.endVideoUrl}
                  onChange={(e) => handleEndVideoUrlChange(e.target.value)}
                  placeholder="https://youtu.be/DbMJrwTVf0Q?t=25500"
                  className="w-full px-4 py-3 pl-12 bg-white/50 dark:bg-gray-800/50 
                           border border-light-accent/30 dark:border-dark-accent/30 
                           rounded-xl outline-none 
                           focus:border-light-accent dark:focus:border-dark-accent 
                           focus:ring-2 focus:ring-light-accent/20 dark:focus:ring-dark-accent/20
                           text-light-text dark:text-dark-text"
                />
                <PlayIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-red-500" />
              </div>
              {addVideoData.endTime && (
                <div className="mt-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                  ✅ 종료 시간 자동 인식: {Math.floor(addVideoData.endTime / 3600)}:{String(Math.floor((addVideoData.endTime % 3600) / 60)).padStart(2, '0')}:{String(addVideoData.endTime % 60).padStart(2, '0')} → 아래 종료 시간 필드에 자동 입력됨
                </div>
              )}
            </div>

            {/* 사용법 가이드 */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">💡 사용법 가이드</h5>
              <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <li>• 유튜브에서 노래 시작 부분으로 이동 후 "공유" → "시작시간" 체크 → 링크 복사</li>
                <li>• 종료 시간도 설정하려면 노래 끝나는 부분에서 같은 방식으로 링크 복사</li>
                <li>• "[25.06.01]" 형식의 제목이면 날짜가 자동으로 인식됩니다</li>
                <li>• 날짜 인식에 실패하면 "재분석" 버튼으로 다시 시도하거나 수동 입력하세요</li>
              </ul>
            </div>

            {/* 메타데이터 분석 상태 */}
            {addVideoData.videoUrl && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200">📺 영상 정보</h5>
                  <button
                    type="button"
                    onClick={() => fetchVideoMetadata(addVideoData.videoUrl)}
                    disabled={!addVideoData.videoUrl}
                    className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 
                             rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors duration-200
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🔄 재분석
                  </button>
                </div>
                {videoMetadata.title ? (
                  <>
                    <div className="text-xs text-gray-700 dark:text-gray-300 mb-2">
                      제목: {videoMetadata.title}
                    </div>
                    {videoMetadata.extractedDate ? (
                      <div className="text-xs text-green-600 dark:text-green-400">
                        ✅ 날짜 인식 성공: {videoMetadata.extractedDate}
                      </div>
                    ) : (
                      <div className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠️ 날짜 자동 인식 실패 - 수동으로 입력해주세요
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    💡 "재분석" 버튼을 클릭하여 영상 제목과 날짜를 자동으로 추출하세요
                  </div>
                )}
              </div>
            )}

            {/* 날짜와 수동 시간 입력 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                  부른 날짜 
                  <span className="text-xs text-light-text/60 dark:text-dark-text/60 ml-2">
                    (선택사항)
                  </span>
                </label>
                <input
                  type="date"
                  value={addVideoData.sungDate}
                  onChange={(e) => setAddVideoData(prev => ({...prev, sungDate: e.target.value}))}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-800/50 
                           border border-light-accent/30 dark:border-dark-accent/30 
                           rounded-xl outline-none 
                           focus:border-light-accent dark:focus:border-dark-accent 
                           focus:ring-2 focus:ring-light-accent/20 dark:focus:ring-dark-accent/20
                           text-light-text dark:text-dark-text"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                  시작 시간 (초)
                  {addVideoData.startTime > 0 && (
                    <span className="text-xs text-green-600 dark:text-green-400 ml-2">
                      ({Math.floor(addVideoData.startTime / 3600)}:{String(Math.floor((addVideoData.startTime % 3600) / 60)).padStart(2, '0')}:{String(addVideoData.startTime % 60).padStart(2, '0')})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={addVideoData.startTime}
                  onChange={(e) => setAddVideoData(prev => ({...prev, startTime: parseInt(e.target.value) || 0}))}
                  placeholder="0"
                  min="0"
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-800/50 
                           border border-light-accent/30 dark:border-dark-accent/30 
                           rounded-xl outline-none 
                           focus:border-light-accent dark:focus:border-dark-accent 
                           focus:ring-2 focus:ring-light-accent/20 dark:focus:ring-dark-accent/20
                           text-light-text dark:text-dark-text"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                  종료 시간 (초)
                  {addVideoData.endTime && (
                    <span className="text-xs text-green-600 dark:text-green-400 ml-2">
                      ({Math.floor(addVideoData.endTime / 3600)}:{String(Math.floor((addVideoData.endTime % 3600) / 60)).padStart(2, '0')}:{String(addVideoData.endTime % 60).padStart(2, '0')})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={addVideoData.endTime || ''}
                  onChange={(e) => setAddVideoData(prev => ({...prev, endTime: e.target.value ? parseInt(e.target.value) : undefined}))}
                  placeholder="자동 (영상 끝까지)"
                  min="0"
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-800/50 
                           border border-light-accent/30 dark:border-dark-accent/30 
                           rounded-xl outline-none 
                           focus:border-light-accent dark:focus:border-dark-accent 
                           focus:ring-2 focus:ring-light-accent/20 dark:focus:ring-dark-accent/20
                           text-light-text dark:text-dark-text"
                />
              </div>
            </div>

            {/* 설명 입력 */}
            <div>
              <label className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                설명 (선택사항)
              </label>
              <textarea
                value={addVideoData.description}
                onChange={(e) => setAddVideoData({...addVideoData, description: e.target.value})}
                placeholder="이 라이브 클립에 대한 간단한 설명을 적어주세요..."
                rows={3}
                className="w-full px-4 py-3 bg-white/50 dark:bg-gray-800/50 
                         border border-light-accent/30 dark:border-dark-accent/30 
                         rounded-xl outline-none resize-none
                         focus:border-light-accent dark:focus:border-dark-accent 
                         focus:ring-2 focus:ring-light-accent/20 dark:focus:ring-dark-accent/20
                         text-light-text dark:text-dark-text"
                maxLength={500}
              />
              <div className="text-xs text-light-text/50 dark:text-dark-text/50 mt-1 text-right">
                {addVideoData.description.length}/500
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddVideoForm(false);
                  // 폼 취소 시 초기화
                  setAddVideoData({
                    videoUrl: '',
                    endVideoUrl: '',
                    sungDate: '',
                    description: '',
                    startTime: 0,
                    endTime: undefined
                  });
                  setVideoMetadata({
                    title: '',
                    extractedDate: '',
                    parsedStartTime: 0,
                    parsedEndTime: undefined
                  });
                }}
                className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 
                         text-gray-700 dark:text-gray-300 
                         rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 
                         transition-colors duration-200 font-medium"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isAddingVideo || !addVideoData.videoUrl}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-light-accent to-light-purple 
                         dark:from-dark-accent dark:to-dark-purple text-white 
                         rounded-xl hover:shadow-lg transform hover:scale-105 
                         transition-all duration-200 font-medium
                         disabled:opacity-50 disabled:transform-none disabled:shadow-none
                         flex items-center justify-center gap-2"
              >
                {isAddingVideo ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    추가 중...
                  </>
                ) : (
                  <>
                    <PlusIcon className="w-4 h-4" />
                    라이브 클립 추가
                  </>
                )}
              </button>
            </div>
          </form>
          </div>
        </motion.div>
      )}
    </div>
  );
}