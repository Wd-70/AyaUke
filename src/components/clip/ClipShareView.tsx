'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  CalendarDaysIcon,
  UserIcon,
  PlayIcon,
  CheckBadgeIcon,
  ArrowRightIcon,
  MusicalNoteIcon,
} from '@heroicons/react/24/outline';
import ClipPlayer from './ClipPlayer';
import ClipLikeButton from './ClipLikeButton';
import ClipShareButton from './ClipShareButton';
import ClipReportButton from './ClipReportButton';
import { useReveal } from '@/components/landing/useReveal';
import type { PublicClipDTO, PublicClipSummary } from '@/domains/archive/clip.service';

const GRADIENTS = [
  'from-light-accent/25 to-light-purple/20 dark:from-dark-accent/25 dark:to-dark-purple/20',
  'from-light-purple/25 to-light-secondary/20 dark:from-dark-purple/25 dark:to-dark-secondary/20',
  'from-light-secondary/25 to-light-accent/20 dark:from-dark-secondary/25 dark:to-dark-accent/20',
];
function gradientFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

function Chip({ icon: Icon, children }: { icon: typeof CalendarDaysIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-light-primary/25 bg-white/50 px-3 py-1 text-sm text-light-text/70 backdrop-blur-sm dark:border-dark-primary/25 dark:bg-gray-800/50 dark:text-dark-text/70">
      <Icon className="h-4 w-4" />
      {children}
    </span>
  );
}

export default function ClipShareView({
  clip,
  related,
}: {
  clip: PublicClipDTO;
  related: PublicClipSummary[];
}) {
  const { reveal } = useReveal();
  const isChzzk = clip.platform === 'chzzk';

  return (
    <main className="relative min-h-[calc(100vh-3rem)] overflow-hidden px-4 pb-24 pt-24 sm:px-6">
      {/* 앰비언트 배경 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-light-primary/8 via-transparent to-transparent dark:from-dark-primary/10" />
        <div className="absolute -top-24 left-[15%] h-[28rem] w-[28rem] rounded-full bg-light-accent/8 blur-3xl dark:bg-dark-accent/8" />
        <div className="absolute bottom-0 right-[10%] h-[26rem] w-[26rem] rounded-full bg-light-purple/8 blur-3xl dark:bg-dark-secondary/8" />
      </div>

      <div className="mx-auto max-w-4xl">
        {/* 브레드크럼 */}
        <motion.div {...reveal({ y: 12, duration: 0.4 })} className="mb-5 flex items-center justify-center gap-1.5 text-sm text-light-text/50 dark:text-dark-text/50">
          <MusicalNoteIcon className="h-4 w-4" />
          <Link href="/songbook" className="transition-colors hover:text-light-accent dark:hover:text-dark-accent">
            아야 노래책
          </Link>
          <span>·</span>
          <span>라이브 클립</span>
        </motion.div>

        {/* 플레이어 */}
        <motion.div {...reveal({ y: 20, duration: 0.5 })} className="relative">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-light-accent/30 to-light-purple/30 opacity-60 blur-xl dark:from-dark-accent/30 dark:to-dark-secondary/30" />
          <div className="relative overflow-hidden rounded-2xl border border-light-primary/20 shadow-2xl dark:border-dark-primary/20">
            <ClipPlayer
              platform={clip.platform}
              videoId={clip.videoId}
              startTime={clip.startTime}
              endTime={clip.endTime}
              posterDate={clip.sungDateLabel ?? undefined}
              posterAddedBy={clip.uploaderName}
              posterThumbnail={clip.thumbnailUrl ?? undefined}
              posterDescription={clip.description ?? undefined}
              trackPlayClipId={clip.id}
              className="w-full"
            />
          </div>
        </motion.div>

        {/* 정보 */}
        <motion.div {...reveal({ y: 18, delay: 0.05 })} className="mt-7 text-center">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${
                isChzzk
                  ? 'bg-[#00FFA3]/15 text-[#0bbf7d] dark:text-[#00FFA3]'
                  : 'bg-red-500/15 text-red-500'
              }`}
            >
              {isChzzk ? '치지직 다시보기' : 'YouTube'}
            </span>
            {clip.isVerified && (
              <Chip icon={CheckBadgeIcon}>검증된 클립</Chip>
            )}
            {clip.sungDateLabel && <Chip icon={CalendarDaysIcon}>{clip.sungDateLabel}</Chip>}
            <Chip icon={UserIcon}>{clip.uploaderName}</Chip>
            {clip.playCount > 0 && <Chip icon={PlayIcon}>{clip.playCount.toLocaleString()}회</Chip>}
          </div>

          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            <span className="bg-gradient-to-r from-light-accent to-light-purple bg-clip-text text-transparent dark:from-dark-accent dark:to-dark-secondary">
              {clip.title}
            </span>
          </h1>
          <p className="mt-2 text-lg text-light-text/60 dark:text-dark-text/60">{clip.artist}</p>

          {clip.description && (
            <p className="mx-auto mt-4 max-w-xl whitespace-pre-line text-sm leading-relaxed text-light-text/55 dark:text-dark-text/55">
              {clip.description}
            </p>
          )}

          {/* 액션 */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <ClipLikeButton clipId={clip.id} initialCount={clip.likeCount} size="lg" />
            <ClipShareButton clipId={clip.id} title={clip.title} size="lg" />
            <ClipReportButton clipId={clip.id} size="lg" />
            <Link
              href="/songbook"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-light-accent to-light-purple px-5 py-2 text-base font-bold text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-purple-glow dark:from-dark-primary dark:to-dark-secondary dark:hover:shadow-pink-glow"
            >
              노래책에서 보기
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>

        {/* 같은 곡 다른 클립 */}
        {related.length > 0 && (
          <motion.section {...reveal({ y: 18, delay: 0.1 })} className="mt-16">
            <h2 className="mb-5 text-center text-lg font-bold text-light-text/80 dark:text-dark-text/80">
              이 곡의 다른 클립
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-3 [scrollbar-width:thin] sm:flex-wrap sm:justify-center sm:overflow-visible">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/clip/${r.id}`}
                  className="group/card w-40 shrink-0 overflow-hidden rounded-2xl border border-light-primary/15 bg-white/60 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-light-accent/40 hover:shadow-purple-glow dark:border-dark-primary/15 dark:bg-gray-800/50 dark:hover:border-dark-accent/40 dark:hover:shadow-pink-glow"
                >
                  <div className="relative aspect-video overflow-hidden">
                    {r.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105" />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(r.id)}`}>
                        <MusicalNoteIcon className="h-8 w-8 text-light-accent/40 dark:text-dark-accent/40" />
                      </div>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100">
                      <PlayIcon className="h-8 w-8 text-white" />
                    </span>
                  </div>
                  <div className="p-2.5 text-left">
                    <div className="truncate text-xs font-medium text-light-text/70 dark:text-dark-text/70">
                      {r.sungDate ? new Date(r.sungDate).toLocaleDateString('ko-KR') : r.title}
                    </div>
                    {r.likeCount > 0 && (
                      <div className="mt-0.5 text-[11px] text-light-text/45 dark:text-dark-text/45">♥ {r.likeCount}</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </motion.section>
        )}
      </div>
    </main>
  );
}
