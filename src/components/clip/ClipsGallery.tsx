'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MagnifyingGlassIcon, FilmIcon, ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ClipGalleryCard from './ClipGalleryCard';
import { usePublicClips, useAllClips, type ClipsFilters } from '@/hooks/usePublicClips';
import { useBulkClipLikes } from '@/hooks/useClipLikes';
import { useReveal } from '@/components/landing/useReveal';
import { isTextMatch } from '@/lib/searchUtils';

const SORTS: { key: ClipsFilters['sort']; label: string }[] = [
  { key: 'popular', label: '인기순' },
  { key: 'mostPlayed', label: '많이 본' },
  { key: 'recent', label: '최신순' },
];
const PLATFORMS: { key: ClipsFilters['platform']; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'chzzk', label: '치지직' },
  { key: 'youtube', label: '유튜브' },
];

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center rounded-xl bg-light-primary/10 p-1 text-sm dark:bg-dark-primary/10">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
            value === o.key
              ? 'bg-white text-light-accent shadow-sm dark:bg-gray-700 dark:text-dark-accent'
              : 'text-light-text/55 hover:text-light-accent dark:text-dark-text/55 dark:hover:text-dark-accent'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function ClipsGallery() {
  const { reveal } = useReveal();
  const [sort, setSort] = useState<ClipsFilters['sort']>('popular');
  const [platform, setPlatform] = useState<ClipsFilters['platform']>('all');
  const [verified, setVerified] = useState(false);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  // 검색 디바운스 (짧게 — 클라이언트 필터라 즉시성 좋음)
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 150);
    return () => clearTimeout(t);
  }, [search]);

  const searching = q.length > 0;

  // 둘러보기: 서버 페이지네이션 무한스크롤
  const browse = usePublicClips({ sort, platform, verified, q: '' });
  // 검색: 전체를 받아 노래책처럼 isTextMatch(초성·한영·띄어쓰기 무시)로 즉시 필터
  const { allClips, isLoading: allLoading, isError: allError } = useAllClips({ sort, platform, verified }, searching);

  const searchResults = useMemo(() => {
    if (!searching) return [];
    return allClips.filter((c) => isTextMatch(q, c.title) || isTextMatch(q, c.artist));
  }, [searching, allClips, q]);

  // 검색 결과 클라이언트 페이지네이션
  const [visibleCount, setVisibleCount] = useState(24);
  useEffect(() => {
    setVisibleCount(24);
  }, [q, sort, platform, verified]);

  // 표시 데이터 통합
  const displayClips = searching ? searchResults.slice(0, visibleCount) : browse.clips;

  // 표시 중인 클립들의 좋아요 여부를 한 번에 로딩 (카드 하트 초기상태 → 취소 동작 정상화).
  // loadClipLikes는 아직 안 불러온 id만 요청하므로 반복 호출해도 저렴하다.
  const { loadClipLikes } = useBulkClipLikes();
  const displayIdsKey = displayClips.map((c) => c.id).join(',');
  useEffect(() => {
    if (displayClips.length) void loadClipLikes(displayClips.map((c) => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayIdsKey, loadClipLikes]);
  const total = searching ? searchResults.length : browse.total;
  const isLoading = searching ? allLoading : browse.isLoading;
  const isError = searching ? allError : browse.isError;
  const hasMore = searching ? visibleCount < searchResults.length : browse.hasNextPage;
  const isLoadingMore = searching ? false : browse.isFetchingNextPage;
  const refetch = searching ? () => {} : browse.refetch;

  const loadMore = () => {
    if (searching) setVisibleCount((c) => c + 24);
    else if (browse.hasNextPage && !browse.isFetchingNextPage) void browse.fetchNextPage();
  };

  // 무한 스크롤 sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) loadMore();
      },
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, searching, browse.isFetchingNextPage, searchResults.length, visibleCount]);

  return (
    <main className="relative min-h-[calc(100vh-3rem)] overflow-hidden px-4 pb-24 pt-24 sm:px-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-light-primary/8 via-transparent to-transparent dark:from-dark-primary/10" />
      </div>

      <div className="mx-auto max-w-6xl">
        {/* 헤더 */}
        <motion.div {...reveal({ y: 16 })} className="mb-8 text-center">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">
            <span className="bg-gradient-to-r from-light-accent to-light-purple bg-clip-text text-transparent dark:from-dark-accent dark:to-dark-secondary">
              라이브 클립
            </span>
          </h1>
          <p className="mt-3 text-lg text-light-text/60 dark:text-dark-text/60">
            아야가 부른 순간들을 모아봤어요{total > 0 ? ` · 총 ${total.toLocaleString()}개` : ''}
          </p>
        </motion.div>

        {/* 컨트롤 */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="relative w-full max-w-md">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-light-accent/60 dark:text-dark-accent/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="곡 제목 · 가수 · 초성으로 검색"
              className="w-full rounded-2xl border border-light-primary/25 bg-white/60 py-3 pl-11 pr-11 text-light-text placeholder:text-light-text/40 backdrop-blur-sm transition-colors focus:border-light-accent/50 focus:outline-none dark:border-dark-primary/25 dark:bg-gray-800/50 dark:text-dark-text dark:placeholder:text-dark-text/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="검색어 지우기"
                className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-light-text/40 transition-colors hover:bg-light-primary/15 hover:text-light-text/70 dark:text-dark-text/40 dark:hover:bg-dark-primary/15 dark:hover:text-dark-text/70"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Segmented value={sort} options={SORTS} onChange={setSort} />
            <Segmented value={platform} options={PLATFORMS} onChange={setPlatform} />
            <button
              onClick={() => setVerified((v) => !v)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                verified
                  ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-light-primary/25 text-light-text/55 hover:text-light-accent dark:border-dark-primary/25 dark:text-dark-text/55'
              }`}
            >
              검증된 클립만
            </button>
          </div>
        </div>

        {/* 결과 */}
        {isError ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-light-primary/20 bg-white/50 px-6 py-20 text-center dark:border-dark-primary/20 dark:bg-gray-800/40">
            <FilmIcon className="mb-4 h-12 w-12 text-light-accent/50 dark:text-dark-accent/50" />
            <p className="text-lg font-bold text-light-text dark:text-dark-text">클립을 불러오지 못했어요</p>
            <button
              onClick={() => refetch()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-light-primary/30 bg-white/60 px-5 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 dark:border-dark-primary/30 dark:bg-gray-800/60"
            >
              <ArrowPathIcon className="h-4 w-4" />
              다시 시도
            </button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-light-primary/15 dark:border-dark-primary/15">
                <div className="aspect-video animate-pulse bg-light-primary/10 dark:bg-dark-primary/15" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-light-primary/10 dark:bg-dark-primary/15" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-light-primary/10 dark:bg-dark-primary/15" />
                </div>
              </div>
            ))}
          </div>
        ) : displayClips.length === 0 ? (
          <div className="py-20 text-center text-light-text/50 dark:text-dark-text/50">
            <FilmIcon className="mx-auto mb-4 h-12 w-12 opacity-40" />
            <p>{q ? `'${q}' 검색 결과가 없어요` : '표시할 클립이 없어요'}</p>
          </div>
        ) : (
          <>
            {searching && (
              <p className="mb-4 text-center text-sm text-light-text/50 dark:text-dark-text/50">
                &lsquo;{q}&rsquo; 검색 결과 {total.toLocaleString()}개
              </p>
            )}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {displayClips.map((clip) => (
                <ClipGalleryCard key={clip.id} clip={clip} />
              ))}
            </div>
            {/* 무한 스크롤 sentinel + 로딩 */}
            <div ref={sentinelRef} className="h-10" />
            {isLoadingMore && (
              <div className="mt-4 flex justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-light-accent/30 border-t-light-accent dark:border-dark-accent/30 dark:border-t-dark-accent" />
              </div>
            )}
            {!hasMore && displayClips.length > 12 && (
              <p className="mt-8 text-center text-sm text-light-text/40 dark:text-dark-text/40">
                {searching ? '검색 결과를 모두 봤어요' : '마지막 클립까지 모두 봤어요'}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
