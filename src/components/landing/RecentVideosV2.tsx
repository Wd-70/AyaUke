'use client';

import { motion } from 'framer-motion';
import { PlayIcon } from '@heroicons/react/24/solid';
import {
  EyeIcon,
  ClockIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  VideoCameraSlashIcon,
  FilmIcon,
} from '@heroicons/react/24/outline';
import { useRecentVideos, type RecentVideo } from '@/hooks/useRecentVideos';
import { useReveal } from './useReveal';

const CHZZK_VIDEOS = 'https://chzzk.naver.com/abe8aa82baf3d3ef54ad8468ee73e7fc/videos';
const YT_ARCHIVE = 'https://www.youtube.com/@AyaUke_Archive/videos';

function VideoCard({ video, i }: { video: RecentVideo; i: number }) {
  const { reveal } = useReveal();
  return (
    <motion.a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      {...reveal({ y: 28, delay: i * 0.1, margin: '-60px' })}
      className="group overflow-hidden rounded-2xl border border-light-primary/15 bg-white/60 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-light-accent/40 hover:shadow-purple-glow dark:border-dark-primary/15 dark:bg-gray-800/50 dark:hover:border-dark-accent/40 dark:hover:shadow-pink-glow"
    >
      <div className="relative aspect-video overflow-hidden bg-light-primary/10 dark:bg-dark-primary/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.thumbnail}
          alt={video.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-light-accent to-light-purple text-white shadow-lg dark:from-dark-primary dark:to-dark-secondary">
            <PlayIcon className="h-7 w-7 translate-x-0.5" />
          </span>
        </div>
        {video.duration && (
          <span className="absolute bottom-2 right-2 rounded bg-black/75 px-2 py-1 text-xs font-medium text-white">
            {video.duration}
          </span>
        )}
      </div>
      <div className="p-5">
        <h3 className="mb-2 line-clamp-2 text-base font-bold text-light-text transition-colors group-hover:text-light-accent-deep dark:text-dark-text dark:group-hover:text-dark-accent">
          {video.title}
        </h3>
        <div className="flex items-center gap-4 text-sm text-light-text/65 dark:text-dark-text/65">
          {video.viewCount && (
            <span className="inline-flex items-center gap-1">
              <EyeIcon className="h-4 w-4" />
              {video.viewCount}
            </span>
          )}
          {video.publishDate && (
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="h-4 w-4" />
              {video.publishDate}
            </span>
          )}
        </div>
      </div>
    </motion.a>
  );
}

/** 에러/빈 상태를 위한 단정한 폴백 패널 — 텅 빈 공백 대신 안내 + (선택) 재시도 */
function FallbackPanel({
  icon: Icon,
  title,
  desc,
  onRetry,
  retrying,
}: {
  icon: typeof FilmIcon;
  title: string;
  desc: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { reveal } = useReveal();
  return (
    <motion.div
      {...reveal({ y: 16, duration: 0.4, margin: '0px' })}
      className="flex flex-col items-center justify-center rounded-3xl border border-light-primary/20 bg-white/50 px-6 py-16 text-center backdrop-blur-sm dark:border-dark-primary/20 dark:bg-gray-800/40"
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-light-primary/15 text-light-accent dark:bg-dark-primary/20 dark:text-dark-accent">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-lg font-bold text-light-text dark:text-dark-text">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-light-text/65 dark:text-dark-text/55">
        {desc}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-light-primary/30 bg-white/60 px-5 py-2.5 text-sm font-semibold text-light-text transition-all duration-300 hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-primary/30 dark:bg-gray-800/60 dark:text-dark-text dark:hover:bg-gray-800"
        >
          <ArrowPathIcon className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? '불러오는 중…' : '다시 시도'}
        </button>
      )}
    </motion.div>
  );
}

export default function RecentVideosV2() {
  const { data, isLoading, isError, isFetching, refetch } = useRecentVideos();
  const { reveal } = useReveal();
  const videos = (data ?? []).slice(0, 3);

  return (
    <section className="bg-light-primary/[0.05] px-4 py-20 dark:bg-dark-primary/[0.04] sm:px-6 lg:py-28">
      <div className="mx-auto max-w-5xl">
        <motion.div {...reveal()} className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-light-accent-deep dark:text-dark-accent">REPLAY</p>
          <h2 className="font-display break-keep text-4xl font-bold tracking-tight text-light-text dark:text-dark-text sm:text-5xl">
            <span>
              최근 다시보기
            </span>
          </h2>
          <p className="mt-4 break-keep text-lg text-light-text/65 dark:text-dark-text/60">
            놓친 방송이 있나요? 최근 방송을 다시 시청해보세요.
          </p>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-light-primary/15 dark:border-dark-primary/15">
                <div className="aspect-video animate-pulse bg-light-primary/10 dark:bg-dark-primary/15" />
                <div className="space-y-2 p-5">
                  <div className="h-5 w-3/4 animate-pulse rounded bg-light-primary/10 dark:bg-dark-primary/15" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-light-primary/10 dark:bg-dark-primary/15" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <FallbackPanel
            icon={VideoCameraSlashIcon}
            title="최근 다시보기를 불러오지 못했어요"
            desc="잠시 후 다시 시도하거나, 아래 채널에서 지난 방송을 바로 확인할 수 있어요."
            onRetry={() => refetch()}
            retrying={isFetching}
          />
        ) : videos.length === 0 ? (
          <FallbackPanel
            icon={FilmIcon}
            title="표시할 다시보기가 아직 없어요"
            desc="아래 채널에서 아야의 지난 방송을 만나보세요."
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {videos.map((v, i) => (
              <VideoCard key={v.id} video={v} i={i} />
            ))}
          </div>
        )}

        <div className="mt-14 flex flex-col justify-center gap-4 sm:flex-row">
          <a
            href={CHZZK_VIDEOS}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-light-cta-accent to-light-cta-purple px-7 py-3.5 font-bold text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-purple-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-accent-deep dark:from-dark-primary dark:to-dark-secondary dark:hover:shadow-pink-glow dark:focus-visible:outline-dark-accent"
          >
            치지직 다시보기
            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
          <a
            href={YT_ARCHIVE}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-light-primary/30 bg-white/40 px-7 py-3.5 font-semibold text-light-text backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-accent-deep dark:border-dark-primary/30 dark:bg-gray-800/40 dark:text-dark-text dark:hover:bg-gray-800/60 dark:focus-visible:outline-dark-accent"
          >
            다시보기 채널
            <ArrowRightIcon className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
