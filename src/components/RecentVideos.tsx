'use client';

import { useState, useEffect } from 'react';
import { PlayIcon, EyeIcon, ClockIcon } from '@heroicons/react/24/outline';

interface Video {
  id: number;
  title: string;
  thumbnail: string;
  duration: string;
  publishDate: string;
  viewCount: string;
  url: string;
}

export default function RecentVideos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/chzzk-videos');
      const data = await response.json();
      setVideos(data.videos || []);
    } catch (error) {
      console.error('영상 가져오기 실패:', error);
      // 에러 시 더미 데이터
      setVideos([
        {
          id: 1,
          title: '최근 노래방송 하이라이트',
          thumbnail: '/api/placeholder/320/180',
          duration: '2:34:12',
          publishDate: '2일 전',
          viewCount: '1.2K',
          url: 'https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc/videos'
        },
        {
          id: 2,
          title: '게임방송 - 재미있는 순간들',
          thumbnail: '/api/placeholder/320/180',
          duration: '1:45:33',
          publishDate: '5일 전',
          viewCount: '856',
          url: 'https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc/videos'
        },
        {
          id: 3,
          title: '저스트채팅 - 시청자와의 수다',
          thumbnail: '/api/placeholder/320/180',
          duration: '1:12:44',
          publishDate: '1주 전',
          viewCount: '634',
          url: 'https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc/videos'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50/50 dark:bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary bg-clip-text text-transparent">
                최근 다시보기
              </span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              놓친 방송이 있나요? 최근 방송을 다시 시청해보세요.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg animate-pulse">
                <div className="aspect-video bg-gray-300 dark:bg-gray-700"></div>
                <div className="p-6">
                  <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50/50 dark:bg-gray-900/50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary bg-clip-text text-transparent">
              최근 다시보기
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            놓친 방송이 있나요? 최근 방송을 다시 시청해보세요.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {videos.map((video) => (
            <a
              key={video.id}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
            >
              <div className="relative aspect-video bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <img 
                  src={video.thumbnail} 
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* 재생 오버레이 */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <div className="bg-white/90 dark:bg-gray-900/90 rounded-full p-3">
                    <PlayIcon className="w-8 h-8 text-gray-900 dark:text-white" />
                  </div>
                </div>
                
                {/* 지속시간 */}
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                  {video.duration}
                </div>
              </div>
              
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white line-clamp-2 group-hover:text-light-accent dark:group-hover:text-dark-primary transition-colors duration-300">
                  {video.title}
                </h3>
                
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <EyeIcon className="w-4 h-4" />
                      <span>{video.viewCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ClockIcon className="w-4 h-4" />
                      <span>{video.publishDate}</span>
                    </div>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
        
        {/* 더보기 링크들 */}
        <div className="text-center mt-12">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc/videos"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary text-white font-medium rounded-xl hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <img 
                src="/chzzk Icon_02.png" 
                alt="Chzzk" 
                className="w-4 h-4 object-contain"
              />
              <span>치지직 다시보기</span>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            
            <a
              href="https://www.youtube.com/@AyaUke_Archive/videos"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/30 dark:border-gray-700/30 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-white/20 dark:hover:bg-gray-800/70 hover:-translate-y-1 transition-all duration-300"
            >
              <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              <span>다시보기 채널</span>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}