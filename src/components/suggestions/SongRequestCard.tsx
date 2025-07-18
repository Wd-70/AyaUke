'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { SongRequest } from '@/types';
import { 
  HeartIcon, 
  EyeIcon, 
  MusicalNoteIcon, 
  ClockIcon,
  PlayIcon,
  PencilIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

interface SongRequestCardProps {
  request: SongRequest;
  onRecommendToggle: (requestId: string) => void;
  onViewIncrement: (requestId: string) => void;
  currentUserId?: string;
}

export default function SongRequestCard({
  request,
  onRecommendToggle,
  onViewIncrement,
  currentUserId
}: SongRequestCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const handleCardClick = () => {
    setIsExpanded(!isExpanded);
    onViewIncrement(request.id);
  };

  const handleRecommendClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRecommendToggle(request.id);
  };

  const getStatusBadge = () => {
    switch (request.status) {
      case 'pending_approval':
        return (
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full text-xs">
            <ExclamationTriangleIcon className="w-3 h-3" />
            승격 대기
          </div>
        );
      case 'approved':
        return (
          <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-xs">
            <CheckBadgeIcon className="w-3 h-3" />
            승격 완료
          </div>
        );
      default:
        return null;
    }
  };

  const isRecommended = request.isRecommendedByUser;

  return (
    <motion.div
      className={`bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border border-light-primary/20 dark:border-dark-primary/20 
                  rounded-xl p-4 cursor-pointer hover:bg-white/70 dark:hover:bg-gray-900/70 transition-all duration-200
                  ${isExpanded ? 'shadow-lg' : 'hover:shadow-md'}`}
      onClick={handleCardClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-1 line-clamp-1">
            {request.title}
          </h3>
          <p className="text-light-text/70 dark:text-dark-text/70 text-sm mb-2">
            {request.artist}
          </p>
          
          {/* 장르 및 언어 */}
          <div className="flex flex-wrap gap-1 mb-2">
            {request.genre && (
              <span className="px-2 py-1 bg-light-primary/20 dark:bg-dark-primary/20 text-xs rounded-full text-light-text dark:text-dark-text">
                {request.genre}
              </span>
            )}
            {request.language && (
              <span className="px-2 py-1 bg-light-secondary/20 dark:bg-dark-secondary/20 text-xs rounded-full text-light-text dark:text-dark-text">
                {request.language}
              </span>
            )}
          </div>
        </div>
        
        {/* 상태 배지 */}
        {getStatusBadge()}
      </div>

      {/* 추천 설명 */}
      {request.description && (
        <p className={`text-light-text/80 dark:text-dark-text/80 text-sm mb-3 ${
          isExpanded ? '' : 'line-clamp-2'
        }`}>
          {request.description}
        </p>
      )}

      {/* 확장된 정보 */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          {/* 태그 */}
          {request.searchTags && request.searchTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {request.searchTags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-light-accent/20 dark:bg-dark-accent/20 text-xs rounded-full text-light-text dark:text-dark-text"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* MR 링크 */}
          {request.mrLinks && request.mrLinks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-light-text dark:text-dark-text">MR 링크</h4>
              {request.mrLinks.map((link, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <PlayIcon className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                  <a 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-light-accent dark:text-dark-accent hover:underline flex-1 truncate"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {link.label || `MR ${index + 1}`}
                  </a>
                  {link.skipSeconds && (
                    <span className="text-light-text/60 dark:text-dark-text/60 text-xs">
                      +{link.skipSeconds}초
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 원곡 링크 */}
          {request.originalTrackUrl && (
            <div className="flex items-center gap-2 text-sm">
              <MusicalNoteIcon className="w-4 h-4 text-light-secondary dark:text-dark-secondary" />
              <a 
                href={request.originalTrackUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-light-secondary dark:text-dark-secondary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                원곡 듣기
              </a>
            </div>
          )}

          {/* 편집 이력 */}
          {request.editHistory && request.editHistory.length > 0 && (
            <div className="text-xs text-light-text/50 dark:text-dark-text/50">
              <PencilIcon className="w-3 h-3 inline mr-1" />
              {request.editHistory.length}명이 편집함
            </div>
          )}
        </motion.div>
      )}

      {/* 하단 액션 바 */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-light-primary/10 dark:border-dark-primary/10">
        <div className="flex items-center gap-4 text-sm text-light-text/60 dark:text-dark-text/60">
          <div className="flex items-center gap-1">
            <EyeIcon className="w-4 h-4" />
            {request.viewCount}
          </div>
          <div className="flex items-center gap-1">
            <ClockIcon className="w-4 h-4" />
            {new Date(request.submittedAt).toLocaleDateString()}
          </div>
        </div>

        {/* 추천 버튼 */}
        <button
          onClick={handleRecommendClick}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
            isRecommended
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-light-primary/20 dark:bg-dark-primary/20 text-light-text dark:text-dark-text hover:bg-light-primary/30 dark:hover:bg-dark-primary/30'
          }`}
        >
          {isRecommended ? (
            <HeartIconSolid className="w-4 h-4" />
          ) : (
            <HeartIcon className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">
            {request.recommendationCount}
          </span>
        </button>
      </div>
    </motion.div>
  );
}