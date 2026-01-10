'use client';

import { motion } from 'framer-motion';

/**
 * Skeleton Loader Component Library
 * Provides reusable skeleton loaders with shimmer animation
 */

// Base shimmer animation variants
const shimmerVariants = {
  initial: { backgroundPosition: '-200% 0' },
  animate: {
    backgroundPosition: '200% 0',
    transition: { duration: 2, repeat: Infinity, ease: 'linear' }
  }
};

interface SkeletonBoxProps {
  width?: string;
  height?: string;
  className?: string;
}

export function SkeletonBox({ width = 'w-full', height = 'h-4', className = '' }: SkeletonBoxProps) {
  return (
    <motion.div
      variants={shimmerVariants}
      initial="initial"
      animate="animate"
      className={`${width} ${height} ${className} bg-gradient-to-r from-light-primary/10 via-light-primary/20 to-light-primary/10 dark:from-dark-primary/10 dark:via-dark-primary/20 dark:to-dark-primary/10 rounded-lg bg-[length:200%_100%]`}
      style={{ backgroundSize: '200% 100%' }}
    />
  );
}

/**
 * Skeleton for video list items
 */
export function VideoCardSkeleton() {
  return (
    <div className="p-4 flex items-start gap-4">
      {/* Thumbnail skeleton */}
      <SkeletonBox width="w-32" height="h-18" className="flex-shrink-0 rounded-xl" />

      {/* Content skeleton */}
      <div className="flex-1 min-w-0 space-y-3">
        <SkeletonBox width="w-3/4" height="h-5" />
        <div className="flex items-center gap-2">
          <SkeletonBox width="w-20" height="h-4" />
          <SkeletonBox width="w-16" height="h-4" />
        </div>
        <div className="flex items-center gap-4">
          <SkeletonBox width="w-24" height="h-4" />
          <SkeletonBox width="w-24" height="h-4" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for video details panel
 */
export function VideoDetailsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Title */}
      <div className="space-y-2">
        <SkeletonBox width="w-full" height="h-6" />
        <SkeletonBox width="w-2/3" height="h-6" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6">
        <SkeletonBox width="w-32" height="h-5" />
        <SkeletonBox width="w-32" height="h-5" />
        <SkeletonBox width="w-32" height="h-5" />
      </div>

      {/* YouTube URL input */}
      <div className="space-y-2">
        <SkeletonBox width="w-32" height="h-5" />
        <SkeletonBox width="w-full" height="h-10" className="rounded-xl" />
      </div>

      {/* Time offset section */}
      <div className="space-y-2">
        <SkeletonBox width="w-40" height="h-5" />
        <SkeletonBox width="w-full" height="h-10" className="rounded-xl" />
      </div>

      {/* Comments header */}
      <div className="space-y-4">
        <SkeletonBox width="w-48" height="h-6" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CommentSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for individual comment
 */
export function CommentSkeleton() {
  return (
    <div className="p-3 bg-white/20 dark:bg-gray-900/20 rounded-lg space-y-2">
      <div className="flex items-center gap-2">
        <SkeletonBox width="w-6" height="h-6" className="rounded-full" />
        <SkeletonBox width="w-24" height="h-4" />
        <SkeletonBox width="w-16" height="h-4" />
      </div>
      <SkeletonBox width="w-full" height="h-4" />
      <SkeletonBox width="w-5/6" height="h-4" />
    </div>
  );
}

/**
 * Skeleton for comments section
 */
export function CommentsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <CommentSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Generic skeleton for cards
 */
export function CardSkeleton() {
  return (
    <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 space-y-4">
      <SkeletonBox width="w-1/2" height="h-6" />
      <SkeletonBox width="w-full" height="h-4" />
      <SkeletonBox width="w-3/4" height="h-4" />
      <div className="flex gap-2">
        <SkeletonBox width="w-24" height="h-8" className="rounded-lg" />
        <SkeletonBox width="w-24" height="h-8" className="rounded-lg" />
      </div>
    </div>
  );
}
