'use client';

import { motion } from 'framer-motion';
import { MusicalNoteIcon, PlayIcon } from '@heroicons/react/24/outline';

export default function ContentShowcase() {
  const featuredSongs = [
    {
      id: 1,
      title: 'Perfect Night',
      artist: 'LE SSERAFIM',
      type: 'cover',
      thumbnail: '/api/placeholder/300/300',
      youtubeId: 'mock1',
      views: '12.5K',
      likes: '892'
    },
    {
      id: 2,
      title: '사랑받을 준비완료!♡',
      artist: 'HONEYZ',
      type: 'original',
      thumbnail: '/api/placeholder/300/300',
      youtubeId: 'mock2',
      views: '25.8K',
      likes: '1.2K'
    },
    {
      id: 3,
      title: 'Until I Found You',
      artist: 'Stephen Sanchez',
      type: 'cover',
      thumbnail: '/api/placeholder/300/300',
      youtubeId: 'mock3',
      views: '8.7K',
      likes: '654'
    }
  ];

  const popularGames = [
    {
      id: 1,
      title: 'League of Legends',
      category: '온라인 게임',
      status: 'ongoing',
      thumbnail: '/api/placeholder/200/200',
      playTime: '350시간+'
    },
    {
      id: 2,
      title: 'Valorant',
      category: 'FPS',
      status: 'ongoing',
      thumbnail: '/api/placeholder/200/200',
      playTime: '120시간+'
    },
    {
      id: 3,
      title: 'Among Us',
      category: '파티게임',
      status: 'completed',
      thumbnail: '/api/placeholder/200/200',
      playTime: '45시간'
    },
    {
      id: 4,
      title: 'Minecraft',
      category: '샌드박스',
      status: 'ongoing',
      thumbnail: '/api/placeholder/200/200',
      playTime: '80시간+'
    }
  ];

  const popularClips = [
    {
      id: 1,
      title: '아야의 완벽한 하이톤 시연',
      category: '노래',
      thumbnail: '/api/placeholder/320/180',
      duration: '0:45',
      views: '15.2K'
    },
    {
      id: 2,
      title: '롤에서 펜타킬 달성!',
      category: '게임',
      thumbnail: '/api/placeholder/320/180',
      duration: '1:23',
      views: '22.1K'
    },
    {
      id: 3,
      title: '고양이 소리내기 도전',
      category: '재미',
      thumbnail: '/api/placeholder/320/180',
      duration: '0:38',
      views: '18.7K'
    }
  ];

  const statusColors = {
    ongoing: 'bg-green-500',
    completed: 'bg-blue-500',
    dropped: 'bg-red-500'
  };

  const statusLabels = {
    ongoing: '진행중',
    completed: '완료',
    dropped: '중단'
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
          <span className="gradient-text">주요 콘텐츠</span>
        </h2>
        <p className="text-lg text-light-text/70 dark:text-dark-text/70">
          아야의 대표 노래와 게임, 인기 클립을 만나보세요
        </p>
      </motion.div>

      {/* Featured Songs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mb-20"
      >
        <div className="flex items-center gap-3 mb-8">
          <MusicalNoteIcon className="w-8 h-8 text-light-accent dark:text-dark-accent" />
          <h3 className="text-3xl font-bold gradient-text">대표 노래</h3>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredSongs.map((song, index) => (
            <motion.div
              key={song.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="group relative overflow-hidden rounded-2xl bg-white/50 dark:bg-gray-900/50 
                         backdrop-blur-sm border border-light-primary/20 dark:border-dark-primary/20 
                         hover:shadow-xl transition-all duration-300 card-hover-effect"
            >
              <div className="aspect-square bg-gradient-to-br from-light-primary to-light-accent 
                              dark:from-dark-primary dark:to-dark-accent relative overflow-hidden">
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center
                                  group-hover:scale-110 transition-transform duration-300">
                    <PlayIcon className="w-8 h-8 text-white ml-1" />
                  </div>
                </div>
                {song.type === 'original' && (
                  <div className="absolute top-3 left-3 px-2 py-1 bg-light-secondary dark:bg-dark-secondary 
                                  text-white text-xs font-medium rounded-full">
                    Original
                  </div>
                )}
              </div>
              <div className="p-4">
                <h4 className="font-semibold text-light-text dark:text-dark-text mb-1 line-clamp-1">
                  {song.title}
                </h4>
                <p className="text-sm text-light-text/70 dark:text-dark-text/70 mb-3">
                  {song.artist}
                </p>
                <div className="flex items-center justify-between text-xs text-light-text/60 dark:text-dark-text/60">
                  <span>조회수 {song.views}</span>
                  <span>좋아요 {song.likes}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Popular Games */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mb-20"
      >
        <div className="flex items-center gap-3 mb-8">
          <span className="text-3xl">🎮</span>
          <h3 className="text-3xl font-bold gradient-text">주요 게임</h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {popularGames.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="group relative overflow-hidden rounded-xl bg-white/50 dark:bg-gray-900/50 
                         backdrop-blur-sm border border-light-primary/20 dark:border-dark-primary/20 
                         hover:shadow-lg transition-all duration-300 card-hover-effect"
            >
              <div className="aspect-square bg-gradient-to-br from-light-purple to-light-accent 
                              dark:from-dark-purple dark:to-dark-accent relative overflow-hidden">
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="absolute top-2 right-2">
                  <div className={`w-3 h-3 ${statusColors[game.status as keyof typeof statusColors]} rounded-full`}></div>
                </div>
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-xs rounded">
                    {statusLabels[game.status as keyof typeof statusLabels]}
                  </div>
                </div>
              </div>
              <div className="p-3">
                <h4 className="font-medium text-light-text dark:text-dark-text mb-1 text-sm line-clamp-1">
                  {game.title}
                </h4>
                <p className="text-xs text-light-text/70 dark:text-dark-text/70 mb-1">
                  {game.category}
                </p>
                <p className="text-xs text-light-text/60 dark:text-dark-text/60">
                  {game.playTime}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Popular Clips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-8">
          <span className="text-3xl">🎬</span>
          <h3 className="text-3xl font-bold gradient-text">인기 클립</h3>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {popularClips.map((clip, index) => (
            <motion.div
              key={clip.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="group cursor-pointer"
            >
              <div className="relative overflow-hidden rounded-xl bg-white/50 dark:bg-gray-900/50 
                             backdrop-blur-sm border border-light-primary/20 dark:border-dark-primary/20 
                             hover:shadow-lg transition-all duration-300 card-hover-effect">
                <div className="aspect-video bg-gradient-to-br from-light-accent to-light-purple 
                                dark:from-dark-accent dark:to-dark-purple relative overflow-hidden">
                  <div className="absolute inset-0 bg-black/20"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center
                                    group-hover:scale-110 transition-transform duration-300">
                      <PlayIcon className="w-6 h-6 text-white ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm 
                                  text-white text-xs rounded">
                    {clip.duration}
                  </div>
                  <div className="absolute top-2 left-2 px-2 py-1 bg-light-secondary/80 dark:bg-dark-secondary/80 
                                  text-white text-xs rounded-full">
                    {clip.category}
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="font-medium text-light-text dark:text-dark-text mb-2 line-clamp-2">
                    {clip.title}
                  </h4>
                  <p className="text-sm text-light-text/60 dark:text-dark-text/60">
                    조회수 {clip.views}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}