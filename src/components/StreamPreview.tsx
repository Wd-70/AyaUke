'use client';

import { motion } from 'framer-motion';
import { useStreamStatus } from '@/hooks/useStreamStatus';
import { CalendarIcon, ClockIcon, UsersIcon } from '@heroicons/react/24/outline';

export default function StreamPreview() {
  const streamInfo = useStreamStatus();

  const upcomingStreams = [
    {
      id: 1,
      title: '🎵 신청곡 노래방송',
      date: '2024-06-28',
      time: '20:00',
      type: 'karaoke' as const,
      description: '여러분의 신청곡을 불러드려요!'
    },
    {
      id: 2,
      title: '🎮 롤 랭크게임',
      date: '2024-06-29',
      time: '19:00',
      type: 'game' as const,
      description: '오늘은 승급할 수 있을까요?'
    },
    {
      id: 3,
      title: '💬 수다떨기 저챗',
      date: '2024-06-30',
      time: '21:00',
      type: 'chatting' as const,
      description: '편안하게 수다떨어요~'
    }
  ];

  const recentHighlights = [
    {
      id: 1,
      title: 'Perfect Night 커버',
      thumbnail: '/api/placeholder/320/180',
      duration: '3:42',
      views: '12.5K',
      url: '#'
    },
    {
      id: 2,
      title: '롤 솔랭 하이라이트',
      thumbnail: '/api/placeholder/320/180',
      duration: '8:15',
      views: '8.2K',
      url: '#'
    }
  ];

  const typeColors = {
    karaoke: 'from-pink-500 to-purple-500',
    game: 'from-blue-500 to-indigo-500',
    chatting: 'from-green-500 to-teal-500',
    collaboration: 'from-yellow-500 to-orange-500',
    special: 'from-red-500 to-pink-500'
  };

  const typeIcons = {
    karaoke: '🎵',
    game: '🎮',
    chatting: '💬',
    collaboration: '👥',
    special: '⭐'
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <h2 className="text-4xl sm:text-5xl font-bold font-display mb-4">
          <span className="gradient-text">방송 미리보기</span>
        </h2>
        <p className="text-lg text-light-text/70 dark:text-dark-text/70">
          다음 방송 일정과 최근 하이라이트를 확인해보세요
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-12">
        {/* 실시간 방송 상태 */}
        {streamInfo.isLive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-2 mb-8"
          >
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 p-6 text-white">
              <div className="absolute inset-0 bg-black/20"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                  <span className="font-bold text-lg">지금 방송 중!</span>
                  <div className="flex items-center gap-1 text-sm opacity-90">
                    <UsersIcon className="w-4 h-4" />
                    <span>{streamInfo.viewers?.toLocaleString()}명</span>
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-2">{streamInfo.title}</h3>
                <a
                  href="https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 
                           backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
                >
                  <span>지금 시청하기</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {/* 예정된 방송 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <h3 className="text-2xl font-bold mb-6 gradient-text">다음 방송 예정</h3>
          <div className="space-y-4">
            {upcomingStreams.map((stream, index) => (
              <motion.div
                key={stream.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="p-4 rounded-xl bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm 
                           border border-light-primary/20 dark:border-dark-primary/20 
                           hover:shadow-lg transition-all duration-300 card-hover-effect"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${typeColors[stream.type]} 
                                  flex items-center justify-center text-white text-xl flex-shrink-0`}>
                    {typeIcons[stream.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-light-text dark:text-dark-text mb-1">
                      {stream.title}
                    </h4>
                    <p className="text-sm text-light-text/70 dark:text-dark-text/70 mb-2">
                      {stream.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-light-text/60 dark:text-dark-text/60">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4" />
                        <span>{stream.date}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ClockIcon className="w-4 h-4" />
                        <span>{stream.time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* 최근 하이라이트 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h3 className="text-2xl font-bold mb-6 gradient-text">최근 하이라이트</h3>
          <div className="space-y-4">
            {recentHighlights.map((video, index) => (
              <motion.a
                key={video.id}
                href={video.url}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="block group"
              >
                <div className="p-4 rounded-xl bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm 
                               border border-light-primary/20 dark:border-dark-primary/20 
                               hover:shadow-lg transition-all duration-300 card-hover-effect">
                  <div className="flex gap-4">
                    <div className="relative w-24 h-16 bg-gradient-to-br from-light-primary to-light-accent 
                                    dark:from-dark-primary dark:to-dark-accent rounded-lg overflow-hidden 
                                    flex-shrink-0">
                      <div className="absolute inset-0 bg-black/20"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-6 h-6 bg-white/80 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </div>
                      <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/60 text-white text-xs rounded">
                        {video.duration}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-light-text dark:text-dark-text mb-1 
                                   group-hover:text-light-accent dark:group-hover:text-dark-accent 
                                   transition-colors">
                        {video.title}
                      </h4>
                      <p className="text-sm text-light-text/60 dark:text-dark-text/60">
                        조회수 {video.views}회
                      </p>
                    </div>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}