'use client';

import { motion } from 'framer-motion';
import { Song } from '@/types';
import Navigation from '@/components/Navigation';
import SongSearch from '@/components/SongSearch';
import SongCard from '@/components/SongCard';
import Footer from '@/components/Footer';
import { MusicalNoteIcon } from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';
import { useBulkLikes } from '@/hooks/useLikes';
import { useGlobalPlaylists } from '@/hooks/useGlobalPlaylists';

function useChunkedRender(items: Song[], chunkSize: number = 20) {
  const [visibleCount, setVisibleCount] = useState(chunkSize);
  
  useEffect(() => {
    if (items.length <= chunkSize) {
      setVisibleCount(items.length);
    } else {
      setVisibleCount(chunkSize);
    }
  }, [items.length, chunkSize]);
  
  useEffect(() => {
    if (visibleCount >= items.length) return;
    
    const handleScroll = () => {
      const scrollTop = window.pageYOffset;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      
      if (scrollTop + windowHeight >= docHeight - 1000) {
        setVisibleCount(prev => Math.min(prev + chunkSize, items.length));
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [visibleCount, items.length, chunkSize]);
  
  return items.slice(0, visibleCount);
}

interface SongbookClientProps {
  songs: Song[];
  error?: string | null;
}

export default function SongbookClient({ songs: initialSongs, error: serverError }: SongbookClientProps) {
  const [filteredSongs, setFilteredSongs] = useState<Song[]>(initialSongs);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { loadLikes } = useBulkLikes();
  const { refresh: refreshPlaylists } = useGlobalPlaylists();

  const visibleSongs = useChunkedRender(filteredSongs, 24);

  // 초기 데이터 로딩 (좋아요만, 플레이리스트는 useGlobalPlaylists에서 자동 처리)
  useEffect(() => {
    if (filteredSongs.length > 0) {
      // 좋아요 데이터 로딩 (우선순위 높음)
      const initialSongIds = filteredSongs.slice(0, 24).map(song => song.id);
      console.log('🚀 초기 24곡 좋아요 로딩 시작');
      loadLikes(initialSongIds, 'high').then(() => {
        console.log('✅ 초기 24곡 좋아요 로딩 완료');
        
        // 초기 로딩 완료 후 나머지 곡들 로딩 (우선순위 낮음)
        if (filteredSongs.length > 24) {
          const remainingSongIds = filteredSongs.slice(24).map(song => song.id);
          console.log('🔄 나머지 곡 좋아요 로딩 시작');
          loadLikes(remainingSongIds, 'low').then(() => {
            console.log('✅ 모든 곡 좋아요 로딩 완료');
          });
        }
      });
    }
  }, [filteredSongs.length, loadLikes]); // 필터된 곡 수와 loadLikes 함수에 의존

  // 주석: 중복 로딩 방지를 위해 제거됨 - 초기 로딩에서 모든 곡 처리

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset;
      setShowScrollTop(scrollTop > 400);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  if (serverError) {
    return (
      <div className="min-h-screen bg-light-background dark:bg-dark-background">
        <Navigation currentPath="/songbook" />
        <div className="pt-16 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-8 bg-light-primary/20 dark:bg-dark-primary/20 
                           rounded-full flex items-center justify-center">
              <MusicalNoteIcon className="w-12 h-12 text-light-text/40 dark:text-dark-text/40" />
            </div>
            <h2 className="text-2xl font-bold text-light-text dark:text-dark-text mb-4">
              오류가 발생했습니다
            </h2>
            <p className="text-light-text/70 dark:text-dark-text/70 mb-4">
              {serverError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSongPlay = (song: Song) => {
    if (song.mrLinks && song.mrLinks.length > 0) {
      window.open(song.mrLinks[0], '_blank');
    } else {
      const searchQuery = encodeURIComponent(`${song.title} ${song.artist} karaoke MR`);
      window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background">
      <Navigation currentPath="/songbook" />
      
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-light-accent/5 dark:bg-dark-accent/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-light-secondary/5 dark:bg-dark-secondary/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-light-purple/5 dark:bg-dark-purple/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
      </div>

      <main className="relative z-10 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <MusicalNoteIcon className="w-12 h-12 text-light-accent dark:text-dark-accent" />
            <h1 className="text-5xl sm:text-6xl font-bold font-display gradient-text">
              노래책
            </h1>
          </div>
          <p className="text-xl text-light-text/70 dark:text-dark-text/70 mb-6">
            아야가 부르는 노래들을 모아둔 특별한 공간입니다
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-light-text/60 dark:text-dark-text/60">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-light-accent dark:bg-dark-accent rounded-full"></div>
              <span>총 {initialSongs.length}곡</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-light-secondary dark:bg-dark-secondary rounded-full"></div>
              <span>검색된 곡: {filteredSongs.length}곡</span>
            </div>
            {visibleSongs.length < filteredSongs.length && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-light-purple dark:bg-dark-purple rounded-full"></div>
                <span>표시 중: {visibleSongs.length}곡</span>
              </div>
            )}
          </div>
        </motion.div>

        <SongSearch songs={initialSongs} onFilteredSongs={setFilteredSongs} />

        {filteredSongs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visibleSongs.map((song, index) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "0px 0px -20% 0px" }}
                transition={{ 
                  duration: 0.3, 
                  delay: Math.min(index % 8, 6) * 0.03,
                  ease: "easeOut"
                }}
              >
                <SongCard song={song} onPlay={handleSongPlay} />
              </motion.div>
            ))}
            
            {visibleSongs.length < filteredSongs.length && (
              <div className="col-span-full flex justify-center py-8">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-light-text/60 dark:text-dark-text/60"
                >
                  <div className="w-4 h-4 border-2 border-light-accent/30 dark:border-dark-accent/30 
                                  border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin"></div>
                  <span>더 많은 노래 로딩 중...</span>
                </motion.div>
              </div>
            )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center py-16"
          >
            <div className="w-24 h-24 mx-auto mb-6 bg-light-primary/20 dark:bg-dark-primary/20 
                           rounded-full flex items-center justify-center">
              <MusicalNoteIcon className="w-12 h-12 text-light-text/40 dark:text-dark-text/40" />
            </div>
            <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-2">
              검색 결과가 없습니다
            </h3>
            <p className="text-light-text/70 dark:text-dark-text/70 mb-6">
              다른 검색어나 필터를 시도해보세요
            </p>
            <button
              onClick={() => setFilteredSongs(initialSongs)}
              className="px-6 py-3 bg-gradient-to-r from-light-accent to-light-purple 
                       dark:from-dark-accent dark:to-dark-purple text-white 
                       rounded-lg hover:shadow-lg transition-all duration-200"
            >
              모든 노래 보기
            </button>
          </motion.div>
        )}

        {initialSongs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6"
          >
            <div className="text-center p-6 bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm 
                            rounded-xl border border-light-primary/20 dark:border-dark-primary/20">
              <div className="text-2xl font-bold gradient-text mb-1">
                {initialSongs.filter(song => song.language === 'Korean').length}
              </div>
              <div className="text-sm text-light-text/70 dark:text-dark-text/70">
                한국어 노래
              </div>
            </div>
            <div className="text-center p-6 bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm 
                            rounded-xl border border-light-primary/20 dark:border-dark-primary/20">
              <div className="text-2xl font-bold gradient-text mb-1">
                {initialSongs.filter(song => song.language === 'English').length}
              </div>
              <div className="text-sm text-light-text/70 dark:text-dark-text/70">
                영어 노래
              </div>
            </div>
            <div className="text-center p-6 bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm 
                            rounded-xl border border-light-primary/20 dark:border-dark-primary/20">
              <div className="text-2xl font-bold gradient-text mb-1">
                {initialSongs.filter(song => song.language === 'Japanese').length}
              </div>
              <div className="text-sm text-light-text/70 dark:text-dark-text/70">
                일본어 노래
              </div>
            </div>
            {/* <div className="text-center p-6 bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm 
                            rounded-xl border border-light-primary/20 dark:border-dark-primary/20">
              <div className="text-2xl font-bold gradient-text mb-1">
                {initialSongs.filter(song => song.tags?.includes('Original')).length}
              </div>
              <div className="text-sm text-light-text/70 dark:text-dark-text/70">
                오리지널 곡
              </div>
            </div> */}
          </motion.div>
        )}
      </main>


      <motion.button
        onClick={scrollToTop}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ 
          opacity: showScrollTop ? 1 : 0, 
          scale: showScrollTop ? 1 : 0 
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-primary dark:to-dark-secondary 
                   text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300
                   flex items-center justify-center group"
        aria-label="맨 위로 가기"
      >
        <svg 
          className="w-6 h-6 transform group-hover:-translate-y-0.5 transition-transform duration-200" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </motion.button>
      
      <Footer />
    </div>
  );
}