"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MusicalNoteIcon } from "@heroicons/react/24/outline";

interface SongbookHeaderProps {
  totalSongs?: number;
  filteredSongs?: number;
  visibleSongs?: number;
  isLoading?: boolean;
}

export default function SongbookHeader({ 
  totalSongs = 0, 
  filteredSongs = 0, 
  visibleSongs = 0, 
  isLoading = false 
}: SongbookHeaderProps) {
  // 클라이언트에서 즉시 헤더를 표시하기 위한 상태
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="text-center mb-8 sm:mb-12">
      {/* 제목과 설명은 항상 즉시 표시 */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <MusicalNoteIcon className="w-8 h-8 sm:w-12 sm:h-12 text-light-accent dark:text-dark-accent" />
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-display gradient-text">
            노래책
          </h1>
        </div>
        <p className="text-base sm:text-lg md:text-xl text-light-text/70 dark:text-dark-text/70">
          아야가 부르는 노래들을 모아둔 특별한 공간입니다
        </p>
      </div>
      
      {/* 통계 부분만 조건부 렌더링 */}
      {mounted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm md:text-base text-light-text/60 dark:text-dark-text/60"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-light-primary/30 dark:border-dark-primary/30 
                              border-t-light-primary dark:border-t-dark-primary rounded-full animate-spin"></div>
              <span>노래 데이터를 불러오는 중...</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-light-accent dark:bg-dark-accent rounded-full"></div>
                <span>총 {totalSongs}곡</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-light-secondary dark:bg-dark-secondary rounded-full"></div>
                <span>검색된 곡: {filteredSongs}곡</span>
              </div>
              {(visibleSongs < filteredSongs && filteredSongs > 0) && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-light-purple dark:bg-dark-purple rounded-full"></div>
                  <span>표시 중: {visibleSongs}곡</span>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}