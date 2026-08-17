'use client';

import { useSession } from 'next-auth/react';
import { HeartIcon as HeartOutline } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { useClipLike } from '@/hooks/useClipLikes';
import { useToast } from '@/components/Toast';

interface ClipLikeButtonProps {
  clipId: string;
  initialCount?: number;
  /** 'sm'(목록 행) | 'lg'(공유 페이지) */
  size?: 'sm' | 'lg';
  className?: string;
}

/** 클립 좋아요 토글 버튼 (하트 + 카운트). 비로그인 시 안내 토스트. */
export default function ClipLikeButton({
  clipId,
  initialCount = 0,
  size = 'sm',
  className = '',
}: ClipLikeButtonProps) {
  const { data: session } = useSession();
  const { liked, likeCount, isLoading, toggle } = useClipLike(clipId, initialCount);
  const { showInfo } = useToast();

  const lg = size === 'lg';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!session) {
          showInfo('로그인이 필요해요', '좋아요는 로그인 후 이용할 수 있어요.');
          return;
        }
        void toggle();
      }}
      disabled={isLoading}
      aria-pressed={liked}
      aria-label={liked ? '좋아요 취소' : '좋아요'}
      className={`inline-flex items-center gap-1 rounded-full transition-all duration-200 disabled:opacity-60 ${
        lg
          ? 'border border-light-primary/30 bg-white/60 px-4 py-2 text-base font-semibold hover:-translate-y-0.5 hover:border-light-accent/50 dark:border-dark-primary/30 dark:bg-gray-800/60 dark:hover:border-dark-accent/50'
          : 'px-1.5 py-0.5 text-xs'
      } ${liked ? 'text-rose-500' : 'text-light-text/55 hover:text-rose-500 dark:text-dark-text/55'} ${className}`}
    >
      {liked ? (
        <HeartSolid className={lg ? 'h-5 w-5' : 'h-4 w-4'} />
      ) : (
        <HeartOutline className={lg ? 'h-5 w-5' : 'h-4 w-4'} />
      )}
      {likeCount > 0 && <span className="tabular-nums">{likeCount.toLocaleString()}</span>}
    </button>
  );
}
