'use client';

import { motion } from 'framer-motion';
import { SongRequestStats } from '@/types';
import { MusicalNoteIcon, HeartIcon, EyeIcon, PlusIcon } from '@heroicons/react/24/outline';

interface SuggestionsHeaderProps {
  stats: SongRequestStats | null;
}

export default function SuggestionsHeader({ stats }: SuggestionsHeaderProps) {
  return (
    <div className="text-center mb-12">
      {/* 제목과 설명 */}
      <div className="mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <HeartIcon className="w-12 h-12 text-light-accent dark:text-dark-accent" />
          <h1 className="text-5xl sm:text-6xl font-bold font-display gradient-text">
            노래 추천소
          </h1>
        </div>
        <p className="text-xl text-light-text/70 dark:text-dark-text/70 mb-4">
          시청자들이 함께 만들어가는 특별한 노래 공간
        </p>
        <p className="text-base text-light-text/60 dark:text-dark-text/60">
          원하는 노래를 추천하고, 함께 곡 정보를 완성해보세요
        </p>
      </div>
      
      {/* 통계 정보 */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8"
        >
          <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-4 border border-light-primary/20 dark:border-dark-primary/20">
            <div className="flex items-center justify-center gap-2 mb-2">
              <MusicalNoteIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
              <span className="text-sm text-light-text/70 dark:text-dark-text/70">총 곡 수</span>
            </div>
            <div className="text-2xl font-bold gradient-text">
              {stats.totalRequests.toLocaleString()}
            </div>
          </div>

          <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-4 border border-light-primary/20 dark:border-dark-primary/20">
            <div className="flex items-center justify-center gap-2 mb-2">
              <PlusIcon className="w-5 h-5 text-light-secondary dark:text-dark-secondary" />
              <span className="text-sm text-light-text/70 dark:text-dark-text/70">이번 주</span>
            </div>
            <div className="text-2xl font-bold text-light-secondary dark:text-dark-secondary">
              {stats.weeklyNewRequests}
            </div>
          </div>

          <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-4 border border-light-primary/20 dark:border-dark-primary/20">
            <div className="flex items-center justify-center gap-2 mb-2">
              <HeartIcon className="w-5 h-5 text-red-500" />
              <span className="text-sm text-light-text/70 dark:text-dark-text/70">총 추천</span>
            </div>
            <div className="text-2xl font-bold text-red-500">
              {stats.totalRecommendations.toLocaleString()}
            </div>
          </div>

          <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-4 border border-light-primary/20 dark:border-dark-primary/20">
            <div className="flex items-center justify-center gap-2 mb-2">
              <EyeIcon className="w-5 h-5 text-light-purple dark:text-dark-purple" />
              <span className="text-sm text-light-text/70 dark:text-dark-text/70">승격 대기</span>
            </div>
            <div className="text-2xl font-bold text-light-purple dark:text-dark-purple">
              {stats.pendingPromotions}
            </div>
          </div>

          <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-4 border border-light-primary/20 dark:border-dark-primary/20">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-5 h-5 bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple rounded-full" />
              <span className="text-sm text-light-text/70 dark:text-dark-text/70">기여자</span>
            </div>
            <div className="text-2xl font-bold gradient-text">
              {stats.activeContributors}
            </div>
          </div>
        </motion.div>
      )}

      {/* 로딩 상태 */}
      {!stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-4 border border-light-primary/20 dark:border-dark-primary/20">
              <div className="animate-pulse">
                <div className="h-4 bg-light-primary/20 dark:bg-dark-primary/20 rounded mb-2" />
                <div className="h-8 bg-light-primary/20 dark:bg-dark-primary/20 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 안내 메시지 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="bg-gradient-to-r from-light-accent/10 to-light-purple/10 dark:from-dark-accent/10 dark:to-dark-purple/10 
                   border border-light-accent/20 dark:border-dark-accent/20 rounded-xl p-4 text-sm text-light-text/80 dark:text-dark-text/80"
      >
        <p>
          💡 <strong>팁:</strong> 모든 사용자가 곡 정보를 편집할 수 있어요! 
          함께 완성도 높은 노래 데이터를 만들어보세요. 
          관리자가 승인하면 노래책으로 편입됩니다.
        </p>
      </motion.div>
    </div>
  );
}