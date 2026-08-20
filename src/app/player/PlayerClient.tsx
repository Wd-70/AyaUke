'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PlayIcon, MusicalNoteIcon } from '@heroicons/react/24/solid';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { useGlobalClipPlaylists, type PlaylistWithClips } from '@/hooks/useGlobalClipPlaylists';
import { useClipPlayer } from '@/components/clip/player/ClipPlayerProvider';
import { toPlayerClip, type PlayerClip } from '@/components/clip/player/types';
import { useToast } from '@/components/Toast';

/** 플레이리스트의 populate된 클립을 재생 큐(PlayerClip[])로 변환 (순서대로, 재생불가 제외). */
function buildQueue(playlist: PlaylistWithClips): PlayerClip[] {
  return [...playlist.clips]
    .sort((a, b) => a.order - b.order)
    .map((entry) => toPlayerClip(entry.clipId))
    .filter((c): c is PlayerClip => !!c);
}

/** 커버 이미지 → 없으면 순서상 첫 클립(썸네일 있는)의 썸네일 → 없으면 null. */
function playlistCover(playlist: PlaylistWithClips): string | null {
  if (playlist.coverImage) return playlist.coverImage;
  const first = buildQueue(playlist).find((c) => !!c.thumbnailUrl);
  return first?.thumbnailUrl ?? null;
}

export default function PlayerClient() {
  const { data: session, status } = useSession();
  const { playlists, isLoading } = useGlobalClipPlaylists();
  const { playQueue, setExpanded, current } = useClipPlayer();
  const { showInfo } = useToast();

  const totalClips = useMemo(
    () => playlists.reduce((sum, p) => sum + (p.clips?.length ?? 0), 0),
    [playlists],
  );

  const play = (playlist: PlaylistWithClips, startIndex = 0) => {
    const queue = buildQueue(playlist);
    if (queue.length === 0) {
      showInfo('재생할 클립이 없어요', '이 플레이리스트에 재생 가능한 클립이 없습니다.');
      return;
    }
    playQueue(queue, startIndex, {
      sourceId: playlist._id,
      sourceShareId: playlist.shareId,
      sourceOwned: true, // 플레이어 페이지 목록은 내 소유 플레이리스트
    });
    setExpanded(true);
  };

  return (
    <div className="min-h-screen bg-light-background text-light-text dark:bg-dark-background dark:text-dark-text">
      <Navigation />
      <main className={`mx-auto max-w-4xl px-4 pt-24 ${current ? 'pb-32' : 'pb-12'}`}>
        <header className="mb-8">
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
            <span className="bg-gradient-to-r from-light-accent to-light-purple bg-clip-text text-transparent dark:from-dark-accent dark:to-dark-secondary">
              플레이어
            </span>
          </h1>
          <p className="mt-2 text-sm text-light-text/60 dark:text-dark-text/60">
            내 클립 플레이리스트를 앱처럼 이어서 감상하세요. 홈 화면에 설치하면 음악 앱처럼 쓸 수 있어요.
          </p>
        </header>

        {status !== 'loading' && !session ? (
          <div className="rounded-xl border border-light-primary/15 p-10 text-center dark:border-dark-primary/15">
            <MusicalNoteIcon className="mx-auto mb-3 h-10 w-10 text-light-accent/40 dark:text-dark-accent/40" />
            <p className="text-light-text/70 dark:text-dark-text/70">로그인하면 내 클립 플레이리스트를 재생할 수 있어요.</p>
            <Link
              href="/songbook"
              className="mt-4 inline-block rounded-lg bg-gradient-to-r from-light-cta-accent to-light-cta-purple px-5 py-2 font-medium text-white dark:from-dark-accent dark:to-dark-purple"
            >
              노래책으로
            </Link>
          </div>
        ) : status === 'loading' || isLoading ? (
          <div className="py-20 text-center text-light-text/50 dark:text-dark-text/50">불러오는 중...</div>
        ) : playlists.length === 0 ? (
          <div className="rounded-xl border border-light-primary/15 p-10 text-center dark:border-dark-primary/15">
            <MusicalNoteIcon className="mx-auto mb-3 h-10 w-10 text-light-accent/40 dark:text-dark-accent/40" />
            <p className="text-light-text/70 dark:text-dark-text/70">아직 클립 플레이리스트가 없어요.</p>
            <Link
              href="/clips"
              className="mt-4 inline-block rounded-lg border border-light-primary/20 px-5 py-2 font-medium text-light-accent hover:border-light-accent/40 dark:border-dark-primary/20 dark:text-dark-accent"
            >
              라이브 클립 둘러보기
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-light-text/45 dark:text-dark-text/45">
              플레이리스트 {playlists.length}개 · 클립 {totalClips}개
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {playlists.map((playlist) => {
                const count = playlist.clips?.length ?? 0;
                const cover = playlistCover(playlist);
                return (
                  <div
                    key={playlist._id}
                    className="group flex items-center gap-3 rounded-2xl border border-light-primary/15 bg-white/60 p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-light-accent/40 hover:shadow-purple-glow dark:border-dark-primary/15 dark:bg-gray-800/50 dark:hover:border-dark-accent/40 dark:hover:shadow-pink-glow"
                  >
                    <div className="flex aspect-square h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-light-accent/25 to-light-purple/20 dark:from-dark-accent/25 dark:to-dark-purple/20">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <MusicalNoteIcon className="h-6 w-6 text-light-accent/50 dark:text-dark-accent/50" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{playlist.name}</div>
                      <div className="text-xs text-light-text/55 dark:text-dark-text/55">{count}개 클립</div>
                    </div>
                    {playlist.shareId && (
                      <Link
                        href={`/clip-playlist/${playlist.shareId}`}
                        aria-label={`${playlist.name} 관리`}
                        title="순서 변경·제거·공유 관리"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-light-primary/25 text-light-text/60 transition-colors hover:border-light-accent/40 hover:text-light-accent dark:border-dark-primary/25 dark:text-dark-text/60 dark:hover:text-dark-accent"
                      >
                        <Cog6ToothIcon className="h-5 w-5" />
                      </Link>
                    )}
                    <button
                      onClick={() => play(playlist)}
                      disabled={count === 0}
                      aria-label={`${playlist.name} 재생`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-light-accent to-light-purple text-white shadow-md transition-transform hover:scale-105 disabled:opacity-40 dark:from-dark-accent dark:to-dark-purple"
                    >
                      <PlayIcon className="h-5 w-5 translate-x-0.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
