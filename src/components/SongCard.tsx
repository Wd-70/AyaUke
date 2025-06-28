'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Song } from '@/types';
import { MusicalNoteIcon, PlayIcon, LinkIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { HeartIcon } from '@heroicons/react/24/solid';

interface SongCardProps {
  song: Song;
  onPlay?: (song: Song) => void;
}

export default function SongCard({ song, onPlay }: SongCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const languageColors = {
    Korean: 'bg-blue-500',
    English: 'bg-purple-500',
    Japanese: 'bg-pink-500',
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlay) {
      onPlay(song);
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
  };

  const handleCardClick = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      {/* 확장 시 배경 오버레이 */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={handleCardClick}
        />
      )}
      
      {/* 확장된 모달 */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
          animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
          exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
          transition={{ duration: 0.3 }}
          className="fixed top-1/2 left-1/2 z-50 
                     w-[90vw] max-w-4xl max-h-[85vh] overflow-y-auto
                     bg-white dark:bg-gray-900 backdrop-blur-sm 
                     rounded-xl border border-light-primary/20 dark:border-dark-primary/20 
                     shadow-2xl"
        >
          {/* Background gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-light-accent/5 to-light-purple/5 
                          dark:from-dark-accent/5 dark:to-dark-purple/5 rounded-xl"></div>

          <div className="relative p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl md:text-3xl font-semibold text-light-text dark:text-dark-text 
                               text-light-accent dark:text-dark-accent">
                  {song.title}
                </h3>
                <p className="text-lg md:text-xl text-light-text/70 dark:text-dark-text/70 mb-2">
                  {song.artist}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCardClick}
                  className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/30 
                             transition-colors duration-200"
                  title="닫기"
                >
                  <XMarkIcon className="w-5 h-5 text-red-500" />
                </button>
                <button
                  onClick={handleLike}
                  className="p-2 rounded-full hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                             transition-colors duration-200"
                >
                  <HeartIcon 
                    className={`w-5 h-5 transition-colors duration-200 
                               ${isLiked 
                                 ? 'text-red-500 fill-current' 
                                 : 'text-light-text/40 dark:text-dark-text/40 hover:text-red-400'}`}
                  />
                </button>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`px-2 py-1 rounded-full text-xs font-medium text-white 
                               ${languageColors[song.language as keyof typeof languageColors] || 'bg-gray-500'}`}>
                {song.language}
              </span>
            </div>

            {/* Tags */}
            {song.tags && song.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {song.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 rounded-full text-xs 
                             bg-light-secondary/20 dark:bg-dark-secondary/20 
                             text-light-text/70 dark:text-dark-text/70"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Lyrics section */}
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="mb-8 p-6 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20"
            >
              <h4 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4 flex items-center gap-3">
                <MusicalNoteIcon className="w-6 h-6 text-light-accent dark:text-dark-accent" />
                가사
              </h4>
              {song.lyrics ? (
                <div className="text-light-text/80 dark:text-dark-text/80 whitespace-pre-line leading-relaxed text-base md:text-lg max-h-[40vh] overflow-y-auto">
                  {song.lyrics}
                </div>
              ) : (
                <div className="text-center py-12 text-light-text/50 dark:text-dark-text/50">
                  <MusicalNoteIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg mb-2">아직 가사가 등록되지 않았습니다</p>
                  <p className="text-base">곧 업데이트될 예정입니다</p>
                </div>
              )}
            </motion.div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handlePlay}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 text-lg
                         bg-gradient-to-r from-light-accent to-light-purple 
                         dark:from-dark-accent dark:to-dark-purple text-white 
                         rounded-lg hover:shadow-lg transform hover:scale-105 
                         transition-all duration-200 font-medium"
              >
                <PlayIcon className="w-5 h-5" />
                <span>재생</span>
              </button>
              
              {song.mrLinks && song.mrLinks.length > 0 && (
                <button 
                  onClick={(e) => e.stopPropagation()}
                  className="p-3 rounded-lg bg-light-primary/20 dark:bg-dark-primary/20 
                           hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 
                           transition-colors duration-200"
                  title="MR 링크"
                >
                  <LinkIcon className="w-5 h-5 text-light-text dark:text-dark-text" />
                </button>
              )}
            </div>

            {/* Date added */}
            {song.dateAdded && (
              <div className="mt-4 text-sm text-light-text/50 dark:text-dark-text/50">
                추가일: {new Date(song.dateAdded).toLocaleDateString('ko-KR')}
              </div>
            )}
          </div>
        </motion.div>
      )}
      
      {/* 일반 카드 */}
      {!isExpanded && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -5 }}
          transition={{ duration: 0.3 }}
          onClick={handleCardClick}
          className="group relative bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm 
                     rounded-xl border border-light-primary/20 dark:border-dark-primary/20 
                     hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer"
        >
          {/* Background gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-light-accent/5 to-light-purple/5 
                          dark:from-dark-accent/5 dark:to-dark-purple/5 opacity-0 
                          group-hover:opacity-100 transition-opacity duration-300"></div>

            <div className="relative p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-light-text dark:text-dark-text 
                                 line-clamp-1 group-hover:text-light-accent dark:group-hover:text-dark-accent 
                                 transition-colors duration-300">
                    {song.title}
                  </h3>
                  <p className="text-sm text-light-text/70 dark:text-dark-text/70 mb-2">
                    {song.artist}
                  </p>
                </div>
                <button
                  onClick={handleLike}
                  className="p-2 rounded-full hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 
                             transition-colors duration-200"
                >
                  <HeartIcon 
                    className={`w-5 h-5 transition-colors duration-200 
                               ${isLiked 
                                 ? 'text-red-500 fill-current' 
                                 : 'text-light-text/40 dark:text-dark-text/40 hover:text-red-400'}`}
                  />
                </button>
              </div>

              {/* Language tag */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium text-white 
                                 ${languageColors[song.language as keyof typeof languageColors] || 'bg-gray-500'}`}>
                  {song.language}
                </span>
              </div>

              {/* Tags */}
              {song.tags && song.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {song.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 rounded-full text-xs 
                               bg-light-secondary/20 dark:bg-dark-secondary/20 
                               text-light-text/70 dark:text-dark-text/70"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePlay}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 
                           bg-gradient-to-r from-light-accent to-light-purple 
                           dark:from-dark-accent dark:to-dark-purple text-white 
                           rounded-lg hover:shadow-lg transform hover:scale-105 
                           transition-all duration-200 font-medium"
                >
                  <PlayIcon className="w-4 h-4" />
                  <span>재생</span>
                </button>
                
                {song.mrLinks && song.mrLinks.length > 0 && (
                  <button 
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-lg bg-light-primary/20 dark:bg-dark-primary/20 
                             hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 
                             transition-colors duration-200"
                    title="MR 링크"
                  >
                    <LinkIcon className="w-4 h-4 text-light-text dark:text-dark-text" />
                  </button>
                )}
                
                <button 
                  onClick={handleCardClick}
                  className="p-2 rounded-lg bg-light-primary/20 dark:bg-dark-primary/20 
                           hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 
                           transition-colors duration-200"
                  title="가사 보기"
                >
                  <MusicalNoteIcon className="w-4 h-4 text-light-text dark:text-dark-text" />
                </button>
              </div>

              {/* Date added */}
              {song.dateAdded && (
                <div className="mt-3 text-xs text-light-text/50 dark:text-dark-text/50">
                  추가일: {new Date(song.dateAdded).toLocaleDateString('ko-KR')}
                </div>
              )}
            </div>

            {/* Hover effect border */}
            <div className="absolute inset-0 rounded-xl border-2 border-transparent 
                            group-hover:border-light-accent/20 dark:group-hover:border-dark-accent/20 
                            transition-colors duration-300 pointer-events-none"></div>
          </motion.div>
        )}
      </>
    );
}