import React from 'react';
import Image from 'next/image';
import { CheckCircleIcon, XCircleIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';

interface TopVideoCardProps {
  rank: number;
  videoNo: number;
  videoTitle: string;
  timelineComments: number;
  totalComments: number;
  publishDate: string;
  thumbnailImageUrl: string;
  hasYoutubeUrl: boolean;
  hasTimeOffset: boolean;
  onClick: () => void;
}

export default function TopVideoCard({
  rank,
  videoTitle,
  timelineComments,
  totalComments,
  publishDate,
  thumbnailImageUrl,
  hasYoutubeUrl,
  hasTimeOffset,
  onClick
}: TopVideoCardProps) {
  const isFullyConverted = hasYoutubeUrl && hasTimeOffset;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-lg border border-light-primary/20 dark:border-dark-primary/20 hover:bg-white/50 dark:hover:bg-gray-800/50 transition-all group"
    >
      {/* Rank Badge */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center">
        <span className="text-lg font-bold text-light-accent dark:text-dark-accent">
          {rank}
        </span>
      </div>

      {/* Thumbnail */}
      <div className="relative w-32 h-18 flex-shrink-0 rounded-lg overflow-hidden">
        <Image
          src={thumbnailImageUrl}
          alt={videoTitle}
          fill
          className="object-cover"
        />
      </div>

      {/* Video Info */}
      <div className="flex-1 min-w-0 text-left">
        <h4 className="text-sm font-semibold text-light-text dark:text-dark-text mb-1 line-clamp-2 group-hover:text-light-accent dark:group-hover:text-dark-accent transition-colors">
          {videoTitle}
        </h4>
        <div className="flex items-center gap-3 text-xs text-light-text/60 dark:text-dark-text/60">
          <span>{new Date(publishDate).toLocaleDateString('ko-KR')}</span>
          <span className="flex items-center gap-1">
            <ChatBubbleLeftIcon className="w-3.5 h-3.5" />
            {totalComments} 댓글
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 text-right">
        <div className="text-2xl font-bold text-light-accent dark:text-dark-accent mb-1">
          {timelineComments}
        </div>
        <div className="text-xs text-light-text/60 dark:text-dark-text/60 mb-2">
          타임라인
        </div>
        <div className="flex items-center gap-1 justify-end">
          {isFullyConverted ? (
            <CheckCircleIcon className="w-5 h-5 text-green-500" />
          ) : (
            <XCircleIcon className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>
    </button>
  );
}
