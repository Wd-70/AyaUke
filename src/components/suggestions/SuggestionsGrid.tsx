'use client';

import { SongRequest } from '@/types';
import SongRequestCard from './SongRequestCard';
import { motion } from 'framer-motion';

interface SuggestionsGridProps {
  requests: SongRequest[];
  onRecommendToggle: (requestId: string) => void;
  onViewIncrement: (requestId: string) => void;
  currentUserId?: string;
}

export default function SuggestionsGrid({
  requests,
  onRecommendToggle,
  onViewIncrement,
  currentUserId
}: SuggestionsGridProps) {
  if (requests.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🎵</div>
        <h3 className="text-2xl font-bold text-light-text dark:text-dark-text mb-2">
          아직 추천된 곡이 없어요
        </h3>
        <p className="text-light-text/70 dark:text-dark-text/70 mb-8">
          첫 번째 곡을 추천해보세요!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {requests.map((request, index) => (
        <motion.div
          key={request.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
        >
          <SongRequestCard
            request={request}
            onRecommendToggle={onRecommendToggle}
            onViewIncrement={onViewIncrement}
            currentUserId={currentUserId}
          />
        </motion.div>
      ))}
    </div>
  );
}