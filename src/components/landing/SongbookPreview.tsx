'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { MagnifyingGlassIcon, MusicalNoteIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { useLandingSongs, type LandingSong } from '@/hooks/useLandingSongs';
import { useReveal } from './useReveal';

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

function SongMiniCard({ song, tabIndex }: { song: LandingSong; tabIndex?: -1 }) {
  return (
    <Link
      href="/songbook"
      tabIndex={tabIndex}
      className="group/card relative block w-44 shrink-0 overflow-hidden rounded-2xl border border-light-primary/15 bg-white/60 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-light-accent/40 hover:shadow-purple-glow dark:border-dark-primary/15 dark:bg-gray-800/50 dark:hover:border-dark-accent/40 dark:hover:shadow-pink-glow"
    >
      <div className="relative aspect-square overflow-hidden">
        {song.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={song.imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-110"
            loading="lazy"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(song.id)}`}>
            <MusicalNoteIcon className="h-12 w-12 text-light-accent/40 dark:text-dark-accent/40" />
          </div>
        )}
        {song.sungCount > 0 && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            <MicrophoneIcon className="h-3 w-3" />
            {song.sungCount}
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="truncate text-sm font-bold text-light-text dark:text-dark-text">{song.title}</div>
        <div className="truncate text-xs text-light-text/65 dark:text-dark-text/65">{song.artist}</div>
      </div>
    </Link>
  );
}

export default function SongbookPreview() {
  const { data: songs } = useLandingSongs();
  const { reveal } = useReveal();
  const list = songs && songs.length > 0 ? songs : [];
  // 마퀴 이음새 없이: 원본 목록과 접근성 트리에서 제외한 복제 목록을 나란히 둔다.

  return (
    <section className="overflow-hidden py-24 lg:py-32">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
        <motion.p {...reveal()} className="mb-3 text-xs font-semibold tracking-[0.2em] text-light-accent-deep dark:text-dark-accent">SONGBOOK</motion.p>
        <motion.h2
          {...reveal()}
          className="font-display break-keep text-4xl font-bold tracking-tight sm:text-5xl"
        >
          <span className="bg-gradient-to-r from-light-accent-deep to-light-purple-deep bg-clip-text text-transparent dark:from-dark-accent dark:to-dark-secondary">
            아야의 노래책
          </span>
        </motion.h2>
        <motion.p
          {...reveal({ y: 16, delay: 0.1 })}
          className="mx-auto mt-4 max-w-2xl break-keep text-lg text-light-text/65 dark:text-dark-text/60"
        >
          부른 노래마다 라이브 클립까지. 제목·가수·초성으로 바로 찾아보세요.
        </motion.p>

        {/* 검색 유도 (클릭 시 노래책으로) */}
        <motion.div
          {...reveal({ y: 16, delay: 0.2 })}
          className="mx-auto mt-8 max-w-xl"
        >
          <Link
            href="/songbook"
            className="flex items-center gap-3 rounded-2xl border border-light-primary/25 bg-white/60 px-5 py-4 text-left shadow-sm transition-all duration-300 hover:border-light-accent/50 hover:shadow-purple-glow dark:border-dark-primary/25 dark:bg-gray-800/50 dark:hover:border-dark-accent/50 dark:hover:shadow-pink-glow"
          >
            <MagnifyingGlassIcon className="h-5 w-5 text-light-text/40 dark:text-dark-text/40" />
            <span className="text-light-text/70 dark:text-dark-text/70">
              노래 제목, 가수, 초성으로 검색...
            </span>
          </Link>
        </motion.div>
      </div>

      {/* 가로 마퀴 카드 */}
      {list.length > 0 && (
        <div className="marquee-group relative mt-14">
          {/* 좌우 페이드 */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-light-background to-light-background/0 dark:from-dark-background dark:to-dark-background/0 sm:w-28" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-light-background to-light-background/0 dark:from-dark-background dark:to-dark-background/0 sm:w-28" />
          <div className="animate-marquee flex gap-4">
            <div className="flex gap-4">
              {list.map((song) => (
                <SongMiniCard key={song.id} song={song} />
              ))}
            </div>
            <div aria-hidden="true" className="flex gap-4">
              {list.map((song) => (
                <SongMiniCard key={song.id} song={song} tabIndex={-1} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-14 px-4 text-center sm:px-6">
        <Link
          href="/songbook"
          className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-light-cta-accent to-light-cta-purple px-8 py-4 text-lg font-bold text-white shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-purple-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-accent-deep dark:from-dark-primary dark:to-dark-secondary dark:hover:shadow-pink-glow dark:focus-visible:outline-dark-accent"
        >
          노래책 전체 보기
          <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
