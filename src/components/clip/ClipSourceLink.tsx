'use client';

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { buildSourceUrl, type VideoPlatform } from '@/shared/utils/video-url';

interface ClipSourceLinkProps {
  platform: VideoPlatform;
  videoId: string;
  startTime?: number;
  className?: string;
}

/** 원본 영상(클립 시작 시각으로 딥링크)으로 이동하는 고스트 아이콘 링크. */
export default function ClipSourceLink({
  platform,
  videoId,
  startTime = 0,
  className = '',
}: ClipSourceLinkProps) {
  const url = buildSourceUrl(platform, videoId, startTime);
  const isChzzk = platform === 'chzzk';
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label="원본 영상 보기"
      title={isChzzk ? '치지직에서 원본 다시보기 열기' : 'YouTube에서 원본 영상 열기'}
      className={`inline-flex items-center px-1.5 py-0.5 text-light-text/45 transition-colors hover:text-light-accent dark:text-dark-text/45 dark:hover:text-dark-accent ${className}`}
    >
      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
    </a>
  );
}
