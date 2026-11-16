'use client';

import { HeartIcon as HeartOutline } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';

/**
 * 좋아요 하트 — 안 누른 상태는 외곽선(비활성처럼 보이지 않게), 누른 상태는 채움.
 * popKey가 바뀌면(사용자가 방금 눌러 좋아요가 됐을 때) 한 번 튀어오른다(globals.css .like-pop).
 * 서버에서 좋아요 상태를 불러올 때는 튀지 않도록, 부모가 클릭 시에만 popKey를 올린다.
 */
export default function LikeHeart({
  liked,
  popKey = 0,
  className = '',
}: {
  liked: boolean;
  popKey?: number;
  className?: string;
}) {
  const Icon = liked ? HeartSolid : HeartOutline;
  return <Icon key={popKey} aria-hidden className={`${className} ${liked && popKey > 0 ? 'like-pop' : ''}`} />;
}
