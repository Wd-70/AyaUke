'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import ClipPlayer, { type ClipPlayerHandle } from '@/components/clip/ClipPlayer';
import type { VideoPlatform } from '@/shared/utils/video-url';
import { loadMv } from './registry';
import type { MvLyricLine, MvRenderer, MvWork } from './types';

export interface MvStageProps {
  clip: {
    id: string;
    shareId: string;
    songId: string;
    platform: VideoPlatform;
    videoId: string;
    startTime: number;
    endTime: number | null;
    title: string;
    artist: string;
    sungDateLabel: string | null;
    uploaderName: string;
    thumbnailUrl: string | null;
  };
  /** 가사 타이밍 덮어쓰기 — 로컬 타이밍 편집기의 실시간 미리보기 */
  lyrics?: MvLyricLine[];
  /** 효과 타이밍 덮어쓰기 — 같은 용도 */
  cues?: Record<string, number>;
}

/** 타이밍 편집기용 제어 핸들. 시각은 모두 MV 기준(클립 시작 = 0) */
export interface MvStageHandle {
  getTime(): number | null;
  seek(t: number): void;
  play(): void;
  pause(): void;
  isPlaying(): boolean;
}

const MAX_CANVAS_WIDTH = 1920;

/**
 * MV 무대: 원본 클립(ClipPlayer)이 소리를 내고, 캔버스는 그 재생 시각에 맞춰 그린다.
 * 클립 시작 시각이 MV의 t=0이다(클립 범위가 곡에 정확히 맞춰져 있다는 전제).
 * 디버그용 쿼리: ?t=40 (그 시각 정지 화면) / ?preview=38 (소리 없이 그 시각부터 재생) / ?debug=1
 */
const MvStage = forwardRef<MvStageHandle, MvStageProps>(function MvStage({ clip, lyrics, cues }, ref) {
  const params = useSearchParams();
  const freezeT = params.get('t');
  const previewT = params.get('preview');
  const debug = params.get('debug') === '1';

  const [work, setWork] = useState<MvWork | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerBoxRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<ClipPlayerHandle>(null);
  const rendererRef = useRef<MvRenderer | null>(null);
  const startedRef = useRef(false);
  const debugRef = useRef<HTMLDivElement>(null);

  // 작품 코드 + 캔버스 폰트 로드
  useEffect(() => {
    let cancelled = false;
    const pending = loadMv(clip);
    if (!pending) return;
    pending
      .then(async (w) => {
        await Promise.all(
          w.fonts.map((f) => document.fonts.load(`40px ${f.family}`, f.text).catch(() => [])),
        );
        if (cancelled) return;
        rendererRef.current = w.createRenderer({ sungDateLabel: clip.sungDateLabel });
        setWork(w);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
    // 클립 정체성(곡·범위)이 바뀔 때만 다시 로드
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.shareId, clip.songId, clip.startTime, clip.endTime, clip.sungDateLabel]);

  // 편집기에서 바뀐 타이밍을 즉시 반영
  useEffect(() => {
    if (ready && lyrics) rendererRef.current?.setLyrics?.(lyrics);
  }, [ready, lyrics]);

  useEffect(() => {
    if (ready && cues) rendererRef.current?.setCues?.(cues);
  }, [ready, cues]);

  useImperativeHandle(ref, () => ({
    getTime: () => {
      const abs = playerRef.current?.getCurrentTime?.();
      return typeof abs === 'number' && Number.isFinite(abs) ? abs - clip.startTime : null;
    },
    seek: (t) => {
      startedRef.current = true;
      playerRef.current?.seekTo?.(clip.startTime + Math.max(0, t));
    },
    play: () => playerRef.current?.play(),
    pause: () => playerRef.current?.pause(),
    isPlaying: () => playerRef.current?.isPlaying() ?? false,
  }), [clip.startTime]);

  // 캔버스 해상도 = 표시 크기 × DPR (상한 1920px)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const cssW = canvas.clientWidth;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.min(MAX_CANVAS_WIDTH, Math.round(cssW * dpr));
      const h = Math.round((w * 9) / 16);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // 렌더 루프
  useEffect(() => {
    if (!ready || !work) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let fixed = freezeT !== null ? Number(freezeT) : null;
    const previewFrom = previewT !== null ? Number(previewT) : null;
    const perf0 = performance.now();
    let raf = 0;
    // 정지 화면 모드에서는 검수 도구(scripts/mv/sheet.mjs)가 새로고침 없이 시각을 바꿀 수 있다
    const hook = window as unknown as { __mvSeek?: (t: number) => void; __mvDuration?: number };
    if (fixed !== null) {
      hook.__mvSeek = (t) => (fixed = t);
      hook.__mvDuration = work.duration;
    }

    const frame = () => {
      let t: number | null = null;
      if (fixed !== null && Number.isFinite(fixed)) t = fixed;
      else if (previewFrom !== null && Number.isFinite(previewFrom)) {
        t = previewFrom + (performance.now() - perf0) / 1000;
        if (t > work.duration) t = null;
      } else if (startedRef.current) {
        const abs = playerRef.current?.getCurrentTime?.();
        if (typeof abs === 'number' && Number.isFinite(abs)) t = abs - clip.startTime;
      }
      const footage = playerBoxRef.current?.querySelector('video') ?? null;
      rendererRef.current?.render(ctx, { t, footage });
      if (debugRef.current) {
        const now = t;
        debugRef.current.textContent =
          now === null ? 'poster' : `t=${now.toFixed(2)}  ${work.cues?.filter((c) => c.t <= now).at(-1)?.id ?? 'start'}`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      delete hook.__mvSeek;
      delete hook.__mvDuration;
    };
  }, [ready, work, freezeT, previewT, clip.startTime]);

  const onPlayingChange = useCallback((playing: boolean) => {
    if (playing) startedRef.current = true;
  }, []);

  const goFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div
        ref={stageRef}
        className="group relative w-full overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10 [&:fullscreen]:rounded-none"
      >
        <canvas ref={canvasRef} className="block aspect-video w-full" />
        {!ready && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
            MV 불러오는 중…
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
            MV를 불러오지 못했습니다. 새로고침해 주세요.
          </div>
        )}
        <button
          type="button"
          onClick={goFullscreen}
          aria-label="전체 화면"
          className="absolute right-3 top-3 rounded-lg bg-black/50 p-2 text-white/80 opacity-0 transition-opacity hover:text-white focus:opacity-100 group-hover:opacity-100"
        >
          <ArrowsPointingOutIcon className="h-5 w-5" />
        </button>
        {debug && (
          <div
            ref={debugRef}
            className="pointer-events-none absolute left-3 top-3 rounded bg-black/70 px-2 py-1 font-mono text-xs text-lime-300"
          />
        )}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,26rem)_1fr] md:items-start">
        <div ref={playerBoxRef} className="overflow-hidden rounded-lg bg-black">
          {work && (
            <ClipPlayer
              ref={playerRef}
              platform={clip.platform}
              videoId={clip.videoId}
              startTime={clip.startTime}
              endTime={clip.endTime}
              posterDate={clip.sungDateLabel ?? undefined}
              posterAddedBy={clip.uploaderName}
              posterThumbnail={clip.thumbnailUrl ?? undefined}
              trackPlayClipId={clip.id}
              onPlayingChange={onPlayingChange}
              className="aspect-video w-full"
            />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-light-accent dark:text-dark-primary">
            Clip MV
          </p>
          <h1 className="text-xl font-bold">{work?.title ?? clip.title}</h1>
          <p className="text-sm opacity-70">{work?.subtitle ?? clip.artist}</p>
          <p className="pt-2 text-sm opacity-60">
            소리는 원본 방송 클립에서 나오고, 화면은 재생 시각에 맞춰 실시간으로 그려집니다.
            {clip.sungDateLabel && ` · ${clip.sungDateLabel} 노래방송`}
          </p>
        </div>
      </div>
    </div>
  );
});

export default MvStage;
