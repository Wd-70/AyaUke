'use client';

import Link from 'next/link';
import {
  PlayIcon,
  CheckBadgeIcon,
  MusicalNoteIcon,
} from '@heroicons/react/24/solid';
import { PlayCircleIcon } from '@heroicons/react/24/outline';
import type { PublicClipSummary } from '@/domains/archive/clip.service';
import AddClipToPlaylistButton from './AddClipToPlaylistButton';
import ClipLikeButton from './ClipLikeButton';

const GRADIENTS = [
  'from-light-accent/25 to-light-purple/20 dark:from-dark-accent/25 dark:to-dark-purple/20',
  'from-light-purple/25 to-light-secondary/20 dark:from-dark-purple/25 dark:to-dark-secondary/20',
  'from-light-secondary/25 to-light-accent/20 dark:from-dark-secondary/25 dark:to-dark-accent/20',
  'from-light-primary/25 to-light-accent/20 dark:from-dark-primary/30 dark:to-dark-accent/20',
];
function gradientFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

/**
 * 클립 갤러리 카드.
 * 카드 전체 이동은 "링크 오버레이" 패턴으로 처리한다 — Link가 카드 콘텐츠를 감싸지 않고
 * absolute 오버레이(z-10)로 깔린다. 좋아요/플레이리스트 버튼은 링크의 형제(z-20)라
 * 클릭이 링크로 전파되지 않아 상세 페이지로 튀지 않는다. (중첩 앵커 HTML 무효도 해소)
 */
export default function ClipGalleryCard({ clip }: { clip: PublicClipSummary }) {
  const isChzzk = clip.platform === 'chzzk';
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-light-primary/15 bg-white/60 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-light-accent/40 hover:shadow-purple-glow dark:border-dark-primary/15 dark:bg-gray-800/50 dark:hover:border-dark-accent/40 dark:hover:shadow-pink-glow">
      {/* 카드 전체 이동 링크 (오버레이) */}
      <Link
        href={`/clip/${clip.shareId || clip.id}`}
        aria-label={`${clip.title} - ${clip.artist}`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-light-accent dark:focus-visible:ring-dark-accent"
      />

      <div className="relative aspect-video overflow-hidden bg-light-primary/10 dark:bg-dark-primary/10">
        {clip.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(clip.id)}`}>
            <MusicalNoteIcon className="h-10 w-10 text-light-accent/40 dark:text-dark-accent/40" />
          </div>
        )}

        {/* 플랫폼 배지 */}
        <span
          className={`absolute left-2 top-2 z-20 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${
            isChzzk ? 'bg-[#00FFA3]/20 text-[#0bbf7d]' : 'bg-red-500/20 text-red-500'
          }`}
        >
          {isChzzk ? '치지직' : 'YouTube'}
        </span>
        {clip.isVerified && (
          <CheckBadgeIcon className="absolute right-2 top-2 z-20 h-5 w-5 text-emerald-400 drop-shadow" />
        )}

        {/* 호버 재생 오버레이 — 장식용(클릭 통과) */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-light-accent to-light-purple text-white shadow-lg dark:from-dark-primary dark:to-dark-secondary">
            <PlayIcon className="h-6 w-6 translate-x-0.5" />
          </span>
        </div>

        {/* 클립 플레이리스트 추가 — 링크 형제(z-20), 상시 노출(모바일 대응) */}
        <div className="absolute bottom-2 right-2 z-20">
          <AddClipToPlaylistButton
            clipId={clip.id}
            className="!px-1.5 !py-1.5 rounded-full bg-black/45 !text-white hover:!text-white hover:bg-black/65 backdrop-blur-sm"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="truncate text-sm font-bold text-light-text transition-colors group-hover:text-light-accent dark:text-dark-text dark:group-hover:text-dark-accent">
          {clip.title}
        </div>
        <div className="truncate text-xs text-light-text/55 dark:text-dark-text/55">{clip.artist}</div>

        <div className="mt-2 flex items-center gap-3 text-[11px] text-light-text/45 dark:text-dark-text/45">
          {clip.sungDateLabel && <span>{clip.sungDateLabel}</span>}
          {/* 좋아요 — 링크 형제(z-20)라 카드 이동 없이 토글 */}
          <span className="relative z-20 ml-auto">
            <ClipLikeButton clipId={clip.id} initialCount={clip.likeCount} size="sm" />
          </span>
          <span className="inline-flex items-center gap-0.5">
            <PlayCircleIcon className="h-3.5 w-3.5" />
            {clip.playCount.toLocaleString()}
          </span>
        </div>
      </div>
    </article>
  );
}
