'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Song } from '@/types';
import { fetchSongsFromSheet, getErrorMessage } from '@/lib/googleSheets';
// import Navigation from '@/components/Navigation';
import SongSearch from '@/components/SongSearch';
import SongCard from '@/components/SongCard';
import { MusicalNoteIcon } from '@heroicons/react/24/outline';
// import { ThemeProvider } from '@/contexts/ThemeContext';

export default function SongbookPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadSongs = async () => {
      try {
        const songsData = await fetchSongsFromSheet();
        setSongs(songsData);
        setFilteredSongs(songsData);
        setError(null);
      } catch (err) {
        console.error('Error loading songs:', err);
        setError(err as Error);
        setSongs([]);
        setFilteredSongs([]);
      } finally {
        setLoading(false);
      }
    };

    loadSongs();
  }, []);

  const retryLoading = async () => {
    setLoading(true);
    setError(null);
    try {
      const songsData = await fetchSongsFromSheet();
      setSongs(songsData);
      setFilteredSongs(songsData);
      setError(null);
    } catch (err) {
      console.error('Error loading songs:', err);
      setError(err as Error);
      setSongs([]);
      setFilteredSongs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSongPlay = (song: Song) => {
    // MR 링크가 있으면 새 탭에서 열기
    if (song.mrLinks && song.mrLinks.length > 0) {
      window.open(song.mrLinks[0], '_blank');
    } else {
      // MR 링크가 없으면 YouTube에서 검색
      const searchQuery = encodeURIComponent(`${song.title} ${song.artist} karaoke MR`);
      window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-light-background dark:bg-dark-background">
        {/* Simple Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold">
                  A
                </div>
                <span className="text-xl font-bold text-light-text dark:text-dark-text">AyaUke</span>
              </div>
              <div className="flex items-center space-x-8">
                <a href="/" className="text-light-text dark:text-dark-text hover:text-purple-600">홈</a>
                <a href="/songbook" className="text-light-text dark:text-dark-text hover:text-purple-600">노래책</a>
                <button 
                  onClick={() => {
                    const isDark = document.documentElement.classList.contains('dark');
                    if (isDark) {
                      document.documentElement.classList.remove('dark');
                      localStorage.setItem('theme', 'light');
                    } else {
                      document.documentElement.classList.add('dark');
                      localStorage.setItem('theme', 'dark');
                    }
                  }}
                  className="p-2 rounded-full bg-purple-100 dark:bg-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800"
                >
                  🌙
                </button>
              </div>
            </div>
          </div>
        </nav>
        <div className="pt-16 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-light-accent/20 dark:border-dark-accent/20 
                           border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin"></div>
            <p className="text-light-text/70 dark:text-dark-text/70">노래책을 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const errorInfo = getErrorMessage(error);
    return (
      <div className="min-h-screen bg-light-background dark:bg-dark-background">
        {/* Simple Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold">
                  A
                </div>
                <span className="text-xl font-bold text-light-text dark:text-dark-text">AyaUke</span>
              </div>
              <div className="flex items-center space-x-8">
                <a href="/" className="text-light-text dark:text-dark-text hover:text-purple-600">홈</a>
                <a href="/songbook" className="text-light-text dark:text-dark-text hover:text-purple-600">노래책</a>
                <button 
                  onClick={() => {
                    const isDark = document.documentElement.classList.contains('dark');
                    if (isDark) {
                      document.documentElement.classList.remove('dark');
                      localStorage.setItem('theme', 'light');
                    } else {
                      document.documentElement.classList.add('dark');
                      localStorage.setItem('theme', 'dark');
                    }
                  }}
                  className="p-2 rounded-full bg-purple-100 dark:bg-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800"
                >
                  🌙
                </button>
              </div>
            </div>
          </div>
        </nav>
        
        {/* Background decoration */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-96 h-96 bg-light-accent/5 dark:bg-dark-accent/5 
                          rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 right-20 w-96 h-96 bg-light-secondary/5 dark:bg-dark-secondary/5 
                          rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>

        <main className="relative z-10 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="w-24 h-24 mx-auto mb-8 bg-light-primary/20 dark:bg-dark-primary/20 
                           rounded-full flex items-center justify-center">
              <MusicalNoteIcon className="w-12 h-12 text-light-text/40 dark:text-dark-text/40" />
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-bold font-display mb-4">
              <span className="gradient-text">{errorInfo.title}</span>
            </h1>
            
            <p className="text-xl text-light-text/70 dark:text-dark-text/70 mb-4">
              {errorInfo.message}
            </p>
            
            <div className="mb-8 p-6 bg-light-primary/10 dark:bg-dark-primary/10 
                           border border-light-primary/20 dark:border-dark-primary/20 
                           rounded-xl backdrop-blur-sm">
              <p className="text-light-text/80 dark:text-dark-text/80 mb-4">
                <strong>해결 방법:</strong>
              </p>
              <p className="text-light-text/70 dark:text-dark-text/70">
                {errorInfo.suggestion}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={retryLoading}
                className="px-6 py-3 bg-gradient-to-r from-light-accent to-light-purple 
                         dark:from-dark-accent dark:to-dark-purple text-white 
                         rounded-lg hover:shadow-lg transition-all duration-200 font-medium"
              >
                다시 시도
              </button>
              
              <a
                href="/"
                className="px-6 py-3 bg-light-primary/20 dark:bg-dark-primary/20 
                         text-light-text dark:text-dark-text rounded-lg 
                         hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 
                         transition-all duration-200 font-medium"
              >
                홈으로 돌아가기
              </a>
            </div>

            {error.message === 'MISSING_API_KEY' && (
              <div className="mt-8 text-sm text-light-text/60 dark:text-dark-text/60">
                <p>
                  개발자라면 <code className="px-2 py-1 bg-light-primary/20 dark:bg-dark-primary/20 rounded">
                    GOOGLE_SHEETS_SETUP.md
                  </code> 파일을 확인해보세요.
                </p>
              </div>
            )}
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background">
      {/* Simple Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold">
                A
              </div>
              <span className="text-xl font-bold text-light-text dark:text-dark-text">AyaUke</span>
            </div>
            <div className="flex items-center space-x-8">
              <a href="/" className="text-light-text dark:text-dark-text hover:text-purple-600">홈</a>
              <a href="/songbook" className="text-light-text dark:text-dark-text hover:text-purple-600">노래책</a>
              <button 
                onClick={() => {
                  const isDark = document.documentElement.classList.contains('dark');
                  if (isDark) {
                    document.documentElement.classList.remove('dark');
                    localStorage.setItem('theme', 'light');
                  } else {
                    document.documentElement.classList.add('dark');
                    localStorage.setItem('theme', 'dark');
                  }
                }}
                className="p-2 rounded-full bg-light-primary/20 dark:bg-dark-primary/20 hover:bg-light-primary/30 dark:hover:bg-dark-primary/30"
              >
                🌙
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-light-accent/5 dark:bg-dark-accent/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-light-secondary/5 dark:bg-dark-secondary/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-light-purple/5 dark:bg-dark-purple/5 
                        rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
      </div>

      <main className="relative z-10 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
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
            아야가 부른 노래들을 모아둔 특별한 공간입니다TE
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-light-text/60 dark:text-dark-text/60">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-light-accent dark:bg-dark-accent rounded-full"></div>
              <span>총 {songs.length}곡</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-light-secondary dark:bg-dark-secondary rounded-full"></div>
              <span>검색된 곡: {filteredSongs.length}곡</span>
            </div>
          </div>
        </motion.div>

        {/* Search and filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <SongSearch songs={songs} onFilteredSongs={setFilteredSongs} />
        </motion.div>

        {/* Songs grid */}
        {filteredSongs.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {filteredSongs.map((song, index) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <SongCard song={song} onPlay={handleSongPlay} />
              </motion.div>
            ))}
          </motion.div>
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
              onClick={() => setFilteredSongs(songs)}
              className="px-6 py-3 bg-gradient-to-r from-light-accent to-light-purple 
                       dark:from-dark-accent dark:to-dark-purple text-white 
                       rounded-lg hover:shadow-lg transition-all duration-200"
            >
              모든 노래 보기
            </button>
          </motion.div>
        )}

        {/* Statistics */}
        {songs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6"
          >
          <div className="text-center p-6 bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm 
                          rounded-xl border border-light-primary/20 dark:border-dark-primary/20">
            <div className="text-2xl font-bold gradient-text mb-1">
              {songs.filter(song => song.language === 'Korean').length}
            </div>
            <div className="text-sm text-light-text/70 dark:text-dark-text/70">
              한국어 노래
            </div>
          </div>
          <div className="text-center p-6 bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm 
                          rounded-xl border border-light-primary/20 dark:border-dark-primary/20">
            <div className="text-2xl font-bold gradient-text mb-1">
              {songs.filter(song => song.language === 'English').length}
            </div>
            <div className="text-sm text-light-text/70 dark:text-dark-text/70">
              영어 노래
            </div>
          </div>
          <div className="text-center p-6 bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm 
                          rounded-xl border border-light-primary/20 dark:border-dark-primary/20">
            <div className="text-2xl font-bold gradient-text mb-1">
              {songs.filter(song => song.language === 'Japanese').length}
            </div>
            <div className="text-sm text-light-text/70 dark:text-dark-text/70">
              일본어 노래
            </div>
          </div>
          <div className="text-center p-6 bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm 
                          rounded-xl border border-light-primary/20 dark:border-dark-primary/20">
            <div className="text-2xl font-bold gradient-text mb-1">
              {songs.filter(song => song.tags?.includes('Original')).length}
            </div>
            <div className="text-sm text-light-text/70 dark:text-dark-text/70">
              오리지널 곡
            </div>
          </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}