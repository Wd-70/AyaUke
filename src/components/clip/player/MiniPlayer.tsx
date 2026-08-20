'use client';

import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import {
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon,
  MusicalNoteIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/solid';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useClipPlayer } from './ClipPlayerProvider';
import { clipArtwork, clipDurationSec } from './types';
import { prefetchChzzkStream } from '../chzzk-stream-cache';
import { formatClipTime } from '@/shared/utils/clip-time';
import { useGlobalClipPlaylists } from '@/hooks/useGlobalClipPlaylists';

// ClipPlayer(및 hls.js)는 무겁다. 레이아웃 상주 컴포넌트라 모든 페이지 공용 번들에
// 들어가지 않도록, 실제 재생이 시작될 때만 지연 로드한다.
const ClipPlayer = lazy(() => import('../ClipPlayer'));

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('ko-KR') : '');

/** 특정 출처로 미리 커넥션을 열어 다음 재생 지연을 줄인다 (중복 방지). */
function preconnect(href: string) {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
  const l = document.createElement('link');
  l.rel = 'preconnect';
  l.href = href;
  l.crossOrigin = '';
  document.head.appendChild(l);
}

/** 셔플 아이콘 (heroicons에 없어 인라인) */
function ShuffleIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </svg>
  );
}

/** 반복 아이콘 (전곡). one이면 가운데 1 배지 */
function RepeatIcon({ className = '', one = false }: { className?: string; one?: boolean }) {
  return (
    <span className="relative inline-flex">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M17 2l4 4-4 4" />
        <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
        <path d="M7 22l-4-4 4-4" />
        <path d="M21 13v1a4 4 0 0 1-4 4H3" />
      </svg>
      {one && (
        <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-current text-[9px] font-bold leading-none">
          <span className="text-light-background dark:text-dark-background">1</span>
        </span>
      )}
    </span>
  );
}

/**
 * 영속 미니플레이어. 루트 레이아웃에 상주하여 페이지 전환에도 재생을 유지한다.
 * - 플레이어 스테이지(ClipPlayer)는 단 하나만 마운트하고, 접힘/펼침은 위치·크기 클래스만 바꾼다
 *   (리마운트 없음 → 확장해도 재생이 안 끊김). 곡/재생 nonce가 바뀔 때만 key로 새로 마운트한다.
 * - 접힘: 하단 바 + 좌측 소형 영상. 펼침: 블러 아트워크 배경 + 대형 영상 + 컨트롤 + 큐.
 */
export default function MiniPlayer() {
  const {
    queue,
    currentIndex,
    current,
    upcomingClips,
    isExpanded,
    playing,
    hasInteracted,
    shuffle,
    repeat,
    hasNext,
    hasPrev,
    playNonce,
    next,
    prev,
    playAt,
    handleEnded,
    toggle,
    toggleShuffle,
    cycleRepeat,
    close,
    setExpanded,
    currentSourceId,
    playerRef,
    reportPlaying,
  } = useClipPlayer();

  const router = useRouter();
  const { playlists } = useGlobalClipPlaylists();
  // 현재 재생 중인 플레이리스트의 관리 페이지(shareId) — 있으면 상단에 관리 버튼 노출
  const manageShareId = currentSourceId
    ? playlists.find((p) => p._id === currentSourceId)?.shareId
    : undefined;
  const goManage = () => {
    if (!manageShareId) return;
    setExpanded(false); // 아래로 최소화 (재생은 루트 레이아웃 상주라 안 끊김)
    router.push(`/clip-playlist/${manageShareId}`);
  };

  const stageRef = useRef<HTMLDivElement>(null);
  // 이미 워밍한 클립 id 집합 (중복 프리로드 방지 — 캐시 TTL 안에서만 의미)
  const warmedRef = useRef<Set<string>>(new Set());
  // 펼침 영상 크기(뷰포트 기준 16:9) + 컴팩트(영상 높이 절반) 토글
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [videoCompact, setVideoCompact] = useState(false);

  // 컴팩트 선호 로드/저장 (셔플·반복과 동일한 로컬 저장 패턴)
  useEffect(() => {
    try {
      if (localStorage.getItem('clipPlayer.videoCompact') === '1') setVideoCompact(true);
    } catch { /* 무시 */ }
  }, []);
  const toggleCompact = () => {
    setVideoCompact((v) => {
      const next = !v;
      try { localStorage.setItem('clipPlayer.videoCompact', next ? '1' : '0'); } catch { /* 무시 */ }
      return next;
    });
  };

  // 곡이 바뀌면 프리로드 워밍 집합을 리셋 (다음 곡군을 다시 워밍)
  useEffect(() => {
    warmedRef.current = new Set();
  }, [currentIndex]);

  // 펼침 영상 크기를 뷰포트 폭·높이 모두로 산정(16:9). 높이 예산을 두어 아래 재생목록이
  // 항상 자리를 갖도록 하고, 컴팩트면 높이 예산을 절반으로 줄인다.
  useEffect(() => {
    if (!isExpanded) return;
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxW = Math.min(vw * 0.94, 760);
      const heightBudget = vh * (videoCompact ? 0.24 : 0.46);
      const w = Math.min(maxW, (heightBudget * 16) / 9);
      setStage({ w: Math.round(w), h: Math.round((w * 9) / 16) });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isExpanded, videoCompact]);

  // 펼침 중 배경 페이지 스크롤 잠금 — 오버레이 위 스크롤이 뒤 페이지로 전파되어
  // 접었을 때 엉뚱한 위치로 이동하는 문제 방지. 실제 스크롤러는 html(documentElement)이라
  // body만 잠그면 소용없어 둘 다 잠근다. 스크롤바 폭만큼 패딩 보정으로 레이아웃 흔들림 억제.
  useEffect(() => {
    if (!isExpanded) return;
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPadRight: body.style.paddingRight,
    };
    const sbw = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (sbw > 0) body.style.paddingRight = `${sbw}px`;
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.paddingRight = prev.bodyPadRight;
    };
  }, [isExpanded]);

  const mediaMeta = useMemo(
    () =>
      current
        ? { title: current.title, artist: current.artist, artwork: clipArtwork(current) }
        : null,
    [current],
  );

  if (!current || !mediaMeta) return null;

  const bgSupported = current.platform === 'chzzk';
  const bgArtwork = clipArtwork(current);

  // 종료 임박 시 곧 나올 클립(최대 2개) 리소스를 미리 워밍 (프리커넥트 + 썸네일 + 치지직 스트림 해석).
  // 프리로드하는 건 "가벼운 메타데이터"(스트림/MP4 URL·inKey)일 뿐 영상 바이트가 아니다.
  // 치지직 스트림 URL은 IP에 묶이고 수명이 짧아(캐시 TTL 90초) 리스트 전체를 미리 받아둬도
  // 도달 전에 만료되어 낭비 → 재생 직전(종료 임박)에 근접 윈도우만 워밍한다.
  const warmUpcoming = () => {
    for (const clip of upcomingClips) {
      if (!clip || warmedRef.current.has(clip.clipId)) continue;
      warmedRef.current.add(clip.clipId);
      try {
        const thumb =
          clip.thumbnailUrl ||
          (clip.platform === 'youtube' ? `https://i.ytimg.com/vi/${clip.videoId}/hqdefault.jpg` : undefined);
        if (thumb) {
          const img = new Image();
          img.src = thumb;
        }
        if (clip.platform === 'youtube') {
          preconnect('https://www.youtube.com');
          preconnect('https://i.ytimg.com');
          preconnect('https://googlevideo.com');
        } else {
          // 치지직: 스트림 정보(+vod면 MP4 URL)를 미리 받아 캐시에 넣어둔다.
          // 실제 플레이어 마운트 시 이 캐시를 재사용해 조회 라운드트립을 건너뛴다.
          prefetchChzzkStream(clip.videoId);
        }
      } catch {
        /* 무시 */
      }
    }
  };

  const stageClass = isExpanded
    ? 'fixed z-[70] top-12 left-1/2 -translate-x-1/2'
    : 'fixed z-[70] bottom-[7px] left-2 w-[88px]';

  const ctrlBtn =
    'flex items-center justify-center rounded-full transition-colors disabled:opacity-30';

  return (
    <>
      {/* 펼침 오버레이 (블러 아트워크 배경 + 컨트롤 + 큐) — 스테이지(z-70)보다 아래.
          루트는 스크롤하지 않고(flex 컬럼), 큐 영역만 스크롤 → 고정된 영상 위로 큐가 겹치지 않음 */}
      {isExpanded && (
        <div className="fixed inset-0 z-[55] flex flex-col" role="dialog" aria-label="플레이어">
          {/* 불투명 배경 (아래 페이지가 비치지 않도록 솔리드) + 은은한 블러 아트워크 틴트 */}
          <div className="pointer-events-none fixed inset-0 -z-10 bg-light-background dark:bg-dark-background">
            {bgArtwork && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bgArtwork} alt="" className="h-full w-full scale-125 object-cover opacity-25 blur-2xl" />
            )}
            <div className="absolute inset-0 bg-light-background/55 dark:bg-dark-background/65" />
          </div>

          {/* 상단 바: (좌) 접기 · 영상크기  —  (우) 닫기.
              영상 크기 토글은 '보기' 조작이라 접기와 묶고, 닫기와는 떨어뜨려 혼동을 줄인다. */}
          <div className="flex h-12 shrink-0 items-center justify-between px-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded(false)}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-light-text/70 hover:bg-light-primary/10 dark:text-dark-text/70 dark:hover:bg-dark-primary/10"
                aria-label="플레이어 접기"
              >
                <ChevronDownIcon className="h-5 w-5" /> 접기
              </button>
              <button
                onClick={toggleCompact}
                aria-pressed={videoCompact}
                title={videoCompact ? '영상 크게' : '영상 작게(재생목록 넓게)'}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-light-text/60 hover:bg-light-primary/10 dark:text-dark-text/60 dark:hover:bg-dark-primary/10"
              >
                {videoCompact ? <ArrowsPointingOutIcon className="h-4 w-4" /> : <ArrowsPointingInIcon className="h-4 w-4" />}
                <span className="hidden sm:inline">{videoCompact ? '영상 크게' : '영상 작게'}</span>
              </button>
            </div>
            <div className="flex items-center gap-1">
              {manageShareId && (
                <button
                  onClick={goManage}
                  title="이 재생목록 관리"
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-light-text/60 hover:bg-light-primary/10 dark:text-dark-text/60 dark:hover:bg-dark-primary/10"
                >
                  <Cog6ToothIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">관리</span>
                </button>
              )}
              <button
                onClick={close}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-light-text/70 hover:bg-light-primary/10 dark:text-dark-text/70 dark:hover:bg-dark-primary/10"
                aria-label="플레이어 닫기"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* 대형 영상 자리 확보용 스페이서 (실제 영상은 스테이지가 그림) */}
          <div className="mx-auto shrink-0" style={{ width: stage.w, height: stage.h }} />

          {/* 현재 곡 정보 — 제목 · 아티스트 · 날짜를 한 줄로 통합 (작고 세련되게) */}
          <div className="mx-auto mt-3 w-[min(94vw,760px)] shrink-0 px-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <h2 className="min-w-0 truncate text-[15px] font-bold text-light-text dark:text-dark-text">
                {current.title}
              </h2>
              {current.artist && (
                <>
                  <span className="shrink-0 text-light-text/25 dark:text-dark-text/25">·</span>
                  <span className="min-w-0 truncate text-[13px] text-light-text/55 dark:text-dark-text/55">
                    {current.artist}
                  </span>
                </>
              )}
              {current.sungDate && (
                <span className="shrink-0 text-[11px] tabular-nums text-light-text/35 dark:text-dark-text/35">
                  {fmtDate(current.sungDate)}
                </span>
              )}
            </div>
            {!bgSupported && (
              <p className="mt-1.5 inline-block rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                유튜브 클립은 화면을 끄면 재생이 멈춰요
              </p>
            )}
          </div>

          {/* 컨트롤 로우: 셔플 · 이전 · 재생/정지 · 다음 · 반복 */}
          <div className="mx-auto mt-4 flex w-[min(94vw,760px)] shrink-0 items-center justify-center gap-4 px-1 sm:gap-6">
            <button
              onClick={toggleShuffle}
              aria-label="셔플"
              aria-pressed={shuffle}
              className={`${ctrlBtn} h-10 w-10 ${
                shuffle
                  ? 'text-light-accent dark:text-dark-accent'
                  : 'text-light-text/50 hover:text-light-text dark:text-dark-text/50 dark:hover:text-dark-text'
              }`}
            >
              <ShuffleIcon className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={prev}
              disabled={!hasPrev}
              aria-label="이전 곡"
              className={`${ctrlBtn} h-11 w-11 text-light-text/80 hover:text-light-text dark:text-dark-text/80 dark:hover:text-dark-text`}
            >
              <BackwardIcon className="h-6 w-6" />
            </button>
            <button
              onClick={toggle}
              aria-label={playing ? '일시정지' : '재생'}
              className={`${ctrlBtn} h-14 w-14 bg-gradient-to-br from-light-accent to-light-purple text-white shadow-lg shadow-light-accent/30 hover:scale-105 dark:from-dark-accent dark:to-dark-purple dark:shadow-dark-accent/30`}
            >
              {playing ? <PauseIcon className="h-7 w-7" /> : <PlayIcon className="h-7 w-7 translate-x-0.5" />}
            </button>
            <button
              onClick={next}
              disabled={!hasNext}
              aria-label="다음 곡"
              className={`${ctrlBtn} h-11 w-11 text-light-text/80 hover:text-light-text dark:text-dark-text/80 dark:hover:text-dark-text`}
            >
              <ForwardIcon className="h-6 w-6" />
            </button>
            <button
              onClick={cycleRepeat}
              aria-label={repeat === 'one' ? '한 곡 반복' : repeat === 'all' ? '전곡 반복' : '반복 없음'}
              aria-pressed={repeat !== 'off'}
              className={`${ctrlBtn} h-10 w-10 ${
                repeat !== 'off'
                  ? 'text-light-accent dark:text-dark-accent'
                  : 'text-light-text/50 hover:text-light-text dark:text-dark-text/50 dark:hover:text-dark-text'
              }`}
            >
              <RepeatIcon className="h-[18px] w-[18px]" one={repeat === 'one'} />
            </button>
          </div>

          {/* 큐 — 이 영역만 스크롤 (overscroll-contain: 끝에서 배경으로 스크롤 체이닝 방지) */}
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-[min(94vw,760px)] space-y-1 px-1 pb-10">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-light-text/45 dark:text-dark-text/45">재생목록</span>
              <span className="text-xs text-light-text/40 dark:text-dark-text/40">
                {queue.findIndex((c) => c.clipId === current.clipId) + 1} / {queue.length}
              </span>
            </div>
            {queue.map((clip, i) => {
              const active = i === currentIndex;
              const dur = clipDurationSec(clip);
              return (
                <button
                  key={clip.clipId}
                  onClick={() => playAt(i)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors ${
                    active
                      ? 'border-light-accent/50 bg-light-accent/10 dark:border-dark-accent/50 dark:bg-dark-accent/10'
                      : 'border-transparent hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'
                  }`}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center text-xs text-light-text/50 dark:text-dark-text/50">
                    {active ? <PlayIcon className="h-4 w-4 text-light-accent dark:text-dark-accent" /> : i + 1}
                  </div>
                  <div className="relative aspect-video w-16 shrink-0 overflow-hidden rounded bg-light-primary/10 dark:bg-dark-primary/10">
                    {clip.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={clip.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <MusicalNoteIcon className="h-4 w-4 text-light-accent/40 dark:text-dark-accent/40" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-light-text dark:text-dark-text">{clip.title}</div>
                    <div className="truncate text-xs text-light-text/55 dark:text-dark-text/55">{clip.artist}</div>
                  </div>
                  {dur != null && (
                    <span className="shrink-0 text-[11px] tabular-nums text-light-text/45 dark:text-dark-text/45">
                      {formatClipTime(dur)}
                    </span>
                  )}
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      clip.platform === 'chzzk'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'
                    }`}
                  >
                    {clip.platform === 'chzzk' ? '치지직' : '유튜브'}
                  </span>
                </button>
              );
            })}
            </div>
          </div>
        </div>
      )}

      {/* 영속 플레이어 스테이지 — 한 번만 마운트, 위치/크기만 토글. 곡/재생 nonce 변경 시에만 remount */}
      <div ref={stageRef} className={stageClass} style={isExpanded ? { width: stage.w } : undefined}>
        <Suspense fallback={<div className="aspect-video w-full rounded-xl bg-black/80" />}>
          <ClipPlayer
            ref={(h) => {
              playerRef.current = h;
            }}
            key={`${current.clipId}:${playNonce}`}
            platform={current.platform}
            videoId={current.videoId}
            startTime={current.startTime}
            endTime={current.endTime}
            autoplay={hasInteracted}
            onEnded={handleEnded}
            onPlayingChange={reportPlaying}
            onNearEnd={warmUpcoming}
            onNext={hasNext ? next : undefined}
            onPrev={hasPrev ? prev : undefined}
            mediaMeta={mediaMeta}
            posterThumbnail={current.thumbnailUrl ?? undefined}
            posterDate={fmtDate(current.sungDate)}
            posterDescription={current.description ?? undefined}
            trackPlayClipId={current.clipId}
            hideChrome={!isExpanded}
            className="w-full shadow-lg"
          />
        </Suspense>
      </div>

      {/* 접힘 바 chrome — 좌측 소형 영상(위 스테이지) 공간 확보 후 정보/컨트롤 */}
      {!isExpanded && (
        <div className="fixed inset-x-0 bottom-0 z-[60] flex h-[64px] items-center gap-1.5 border-t border-light-primary/20 bg-white/95 pl-[104px] pr-2 backdrop-blur dark:border-dark-primary/20 dark:bg-gray-900/95">
          <button onClick={() => setExpanded(true)} className="min-w-0 flex-1 text-left" aria-label="플레이어 펼치기">
            <div className="truncate text-sm font-semibold text-light-text dark:text-dark-text">{current.title}</div>
            <div className="truncate text-xs text-light-text/55 dark:text-dark-text/55">{current.artist}</div>
          </button>
          <button
            onClick={prev}
            disabled={!hasPrev}
            aria-label="이전 곡"
            className="p-1.5 text-light-text/70 disabled:opacity-30 dark:text-dark-text/70"
          >
            <BackwardIcon className="h-5 w-5" />
          </button>
          <button
            onClick={toggle}
            aria-label={playing ? '일시정지' : '재생'}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-light-accent to-light-purple text-white dark:from-dark-accent dark:to-dark-purple"
          >
            {playing ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5 translate-x-0.5" />}
          </button>
          <button
            onClick={next}
            disabled={!hasNext}
            aria-label="다음 곡"
            className="p-1.5 text-light-text/70 disabled:opacity-30 dark:text-dark-text/70"
          >
            <ForwardIcon className="h-5 w-5" />
          </button>
          <button onClick={() => setExpanded(true)} aria-label="펼치기" className="p-1.5 text-light-text/60 dark:text-dark-text/60">
            <ChevronUpIcon className="h-5 w-5" />
          </button>
          <button onClick={close} aria-label="닫기" className="p-1.5 text-light-text/60 dark:text-dark-text/60">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      )}
    </>
  );
}
