'use client';

import { motion } from 'framer-motion';
import { Song } from '@/types';
import Navigation from '@/components/Navigation';
import SongSearch from '@/components/SongSearch';
import SongCard from '@/components/SongCard';
import Footer from '@/components/Footer';
import SongbookHeader from '@/components/SongbookHeader';
import { MusicalNoteIcon, Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';
import { useBulkLikes } from '@/hooks/useLikes';
import { useSongFilters } from '@/hooks/useSongFilters';
import { useScrollNav } from '@/hooks/useScrollNav';
import { useActivity } from '@/hooks/useActivity';

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
  // songbook 페이지 활동 추적
  useActivity()
  
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false); // 번호 표시 상태
  // 보기 모드: grid(카드) | list(compact). 브라우저에 저장
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('songbookViewMode');
      if (saved === 'grid' || saved === 'list') return saved;
    }
    return 'grid';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('songbookViewMode', viewMode);
  }, [viewMode]);
  const [isLoading, setIsLoading] = useState(!initialSongs || initialSongs.length === 0); // 로딩 상태
  const [hasOpenDialog, setHasOpenDialog] = useState(false); // 다이얼로그 열림 상태
  const { loadLikes } = useBulkLikes();
  // 필터/정렬 상태와 파생 결과를 부모가 소유(단일 진실원). SongSearch는 이걸 받아 렌더만.
  // (useSongFilters 내부에서 useGlobalPlaylists를 호출하므로 플레이리스트 프리페치도 포함)
  const filters = useSongFilters(initialSongs || []);
  const filteredSongs = filters.filteredSongs;
  // 스크롤 연동 네비/스티키 바 (songbook 한정). CSS 변수(--nav-shift/--nav-height)를
  // 갱신하면 네비·검색바가 이를 CSS로 읽어 함께 움직인다(props 불필요).
  // 검색 바 셀렉터를 넘겨, 필터 접힘 앵커링 보정 + 바 고정(stuck) 동기 계산.
  const barStuck = useScrollNav('[data-sticky-bar]');

  const visibleSongs = useChunkedRender(filteredSongs, 24);

  // initialSongs가 도착하면 로딩 해제 (filteredSongs는 useSongFilters에서 파생)
  useEffect(() => {
    if (initialSongs && initialSongs.length > 0) {
      setIsLoading(false);
    }
  }, [initialSongs]);

  // 초기 데이터 로딩 (좋아요만, 플레이리스트는 useGlobalPlaylists에서 자동 처리)
  useEffect(() => {
    if (filteredSongs.length > 0) {
      // 좋아요 데이터 로딩 (보이는 24곡 우선, 나머지는 낮은 우선순위)
      const initialSongIds = filteredSongs.slice(0, 24).map(song => song.id);
      loadLikes(initialSongIds, 'high').then(() => {
        if (filteredSongs.length > 24) {
          const remainingSongIds = filteredSongs.slice(24).map(song => song.id);
          loadLikes(remainingSongIds, 'low');
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


  // 번호 표시 토글 함수
  const handleToggleNumbers = (show: boolean) => {
    setShowNumbers(show);
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

      <main className="relative z-10 pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-4 lg:px-6 xl:px-8 max-w-[1400px] mx-auto">
        <SongbookHeader 
          totalSongs={initialSongs?.length || 0}
          filteredSongs={filteredSongs.length || 0}
          visibleSongs={visibleSongs.length}
          isLoading={isLoading}
        />

        <SongSearch
          filters={filters}
          stuck={barStuck}
          showNumbers={showNumbers}
          onToggleNumbers={handleToggleNumbers}
        />

        {isLoading ? (
          // 데이터 로딩 중 — 단일 스피너 대신 카드 스켈레톤(체감 속도·완성도↑)
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-52 rounded-xl border border-light-primary/20 dark:border-dark-primary/20
                           bg-white/50 dark:bg-gray-900/40 p-6 flex flex-col animate-pulse"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-5 w-2/3 rounded bg-light-primary/15 dark:bg-dark-primary/20" />
                    <div className="h-3.5 w-1/3 rounded bg-light-primary/10 dark:bg-dark-primary/15" />
                  </div>
                  <div className="h-7 w-10 rounded-full bg-light-primary/10 dark:bg-dark-primary/15" />
                </div>
                <div className="h-6 w-16 rounded-full bg-light-primary/10 dark:bg-dark-primary/15" />
                <div className="mt-auto h-9 w-full rounded-lg bg-light-primary/10 dark:bg-dark-primary/15" />
              </div>
            ))}
          </div>
        ) : initialSongs && initialSongs.length > 0 ? (
          filteredSongs.length > 0 ? (
          <>
          {/* 보기 모드 토글 (그리드 / 리스트) */}
          <div className="flex justify-end mb-3">
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 bg-white/50 dark:bg-gray-800/50">
              <button
                onClick={() => setViewMode('grid')}
                title="카드 보기"
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-light-accent dark:bg-dark-accent text-white' : 'text-light-text/60 dark:text-dark-text/60 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'}`}
              >
                <Squares2X2Icon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="리스트 보기"
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-light-accent dark:bg-dark-accent text-white' : 'text-light-text/60 dark:text-dark-text/60 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'}`}
              >
                <ListBulletIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className={viewMode === 'list'
            ? "grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3"
            : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6"}>
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
                <SongCard
                  song={song}
                  showNumber={showNumbers}
                  number={index + 1}
                  compact={viewMode === 'list'}
                  onDialogStateChange={setHasOpenDialog}
                />
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
          </>
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
              onClick={() => filters.clearFilters()}
              className="px-6 py-3 bg-gradient-to-r from-light-accent to-light-purple
                       dark:from-dark-accent dark:to-dark-purple text-white 
                       rounded-lg hover:shadow-lg transition-all duration-200"
            >
              모든 노래 보기
            </button>
          </motion.div>
        )
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
              데이터가 없습니다
            </h3>
            <p className="text-light-text/70 dark:text-dark-text/70">
              노래 데이터를 불러올 수 없습니다
            </p>
          </motion.div>
        )}

        {!isLoading && initialSongs && initialSongs.length > 0 && (
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
          opacity: (showScrollTop && !hasOpenDialog) ? 1 : 0, 
          scale: (showScrollTop && !hasOpenDialog) ? 1 : 0 
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