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
    sungDate: '',
    description: '',
    startTime: 0,
    endTime: undefined as number | undefined
  });
  const [isAddingVideo, setIsAddingVideo] = useState(false);

  // 선택된 영상 정보
  const selectedVideo = songVideos[selectedVideoIndex];

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
    if (!songId || !addVideoData.videoUrl || !addVideoData.sungDate) return;

    setIsAddingVideo(true);
    try {
      const response = await fetch(`/api/songs/${songId}/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(addVideoData),
      });

      if (response.ok) {
        const result = await response.json();
        // 새 영상을 목록에 추가
        setSongVideos(prev => [result.video, ...prev]);
        // 폼 초기화
        setAddVideoData({
          videoUrl: '',
          sungDate: '',
          description: '',
          startTime: 0,
          endTime: undefined
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
    <div className="flex flex-col h-full min-h-0 p-4 sm:p-6 xl:p-0">
      {!showAddVideoForm ? (
        videosLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-light-accent dark:border-dark-accent"></div>
          </div>
        ) : songVideos.length > 0 ? (
          <div className="flex flex-col flex-1 min-h-0">
            {/* 유튜브 플레이어 */}
            <div className="aspect-video w-full mb-4 bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
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
            
            {/* 영상 목록 */}
            <div className="flex-1 min-h-0">
              <div className="flex items-center justify-between mb-3">
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
              
              <div className="scrollable-content space-y-2 overflow-y-auto min-h-0" onWheel={handleScrollableAreaScroll}>
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
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="p-6 bg-gradient-to-br from-light-primary/10 to-light-accent/5 
                        dark:from-dark-primary/10 dark:to-dark-accent/5 
                        border border-light-accent/20 dark:border-dark-accent/20 
                        rounded-2xl backdrop-blur-sm
                        overflow-y-auto max-h-full"
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
            {/* YouTube URL 입력 */}
            <div>
              <label className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                유튜브 URL *
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={addVideoData.videoUrl}
                  onChange={(e) => setAddVideoData({...addVideoData, videoUrl: e.target.value})}
                  placeholder="https://www.youtube.com/watch?v=..."
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
            </div>

            {/* 날짜와 시간 입력 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                  부른 날짜 *
                </label>
                <input
                  type="date"
                  value={addVideoData.sungDate}
                  onChange={(e) => setAddVideoData({...addVideoData, sungDate: e.target.value})}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-800/50 
                           border border-light-accent/30 dark:border-dark-accent/30 
                           rounded-xl outline-none 
                           focus:border-light-accent dark:focus:border-dark-accent 
                           focus:ring-2 focus:ring-light-accent/20 dark:focus:ring-dark-accent/20
                           text-light-text dark:text-dark-text"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-light-text/80 dark:text-dark-text/80 mb-2">
                  시작 시간 (초)
                </label>
                <input
                  type="number"
                  value={addVideoData.startTime}
                  onChange={(e) => setAddVideoData({...addVideoData, startTime: parseInt(e.target.value) || 0})}
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
                </label>
                <input
                  type="number"
                  value={addVideoData.endTime || ''}
                  onChange={(e) => setAddVideoData({...addVideoData, endTime: e.target.value ? parseInt(e.target.value) : undefined})}
                  placeholder="자동"
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
                onClick={() => setShowAddVideoForm(false)}
                className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 
                         text-gray-700 dark:text-gray-300 
                         rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 
                         transition-colors duration-200 font-medium"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isAddingVideo || !addVideoData.videoUrl || !addVideoData.sungDate}
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