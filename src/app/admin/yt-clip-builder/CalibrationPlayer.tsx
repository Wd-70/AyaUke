"use client";

/**
 * 보정용 전체 유튜브 플레이어.
 * 클립 구간이 아니라 영상 전체를 재생하며, 키보드로 정밀 탐색해
 * "아는 곡이 시작하는 지점"을 찾아 앵커로 잡는 데 쓴다.
 *
 * 키보드:
 *   ← / →   현재 스텝만큼 뒤로/앞으로 탐색
 *   1~6     탐색 스텝 변경 (0.1 / 1 / 5 / 10 / 30 / 60초)
 *   Space   재생 / 일시정지
 *   Enter   현재 지점을 선택된 타임라인의 앵커로 설정
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { loadYouTubeApi } from "@/components/clip/ClipPlayer";

const STEPS = [0.1, 1, 5, 10, 30, 60]; // 키 1~6

export interface CalibrationPlayerHandle {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
}

interface CalibrationPlayerProps {
  videoId: string;
  /** Enter 또는 버튼으로 현재 재생 위치를 앵커로 설정 */
  onSetAnchorAtCurrent: (ytTime: number) => void;
  className?: string;
}

function fmt(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, "0")}:${sec.padStart(4, "0")}`;
  }
  return `${m}:${sec}`;
}

const CalibrationPlayer = forwardRef<CalibrationPlayerHandle, CalibrationPlayerProps>(
  function CalibrationPlayer({ videoId, onSetAnchorAtCurrent, className = "" }, ref) {
    const mountRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const rafRef = useRef<number>(0);
    const [ready, setReady] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [stepIdx, setStepIdx] = useState(1); // 기본 1초
    const stepIdxRef = useRef(stepIdx);
    stepIdxRef.current = stepIdx;

    const onAnchorRef = useRef(onSetAnchorAtCurrent);
    onAnchorRef.current = onSetAnchorAtCurrent;

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        playerRef.current?.seekTo?.(Math.max(0, seconds), true);
        setCurrentTime(Math.max(0, seconds));
      },
      getCurrentTime: () => playerRef.current?.getCurrentTime?.() ?? 0,
    }));

    // ── 플레이어 초기화 (videoId 변경 시 재마운트) ──
    useEffect(() => {
      let cancelled = false;
      let host: HTMLDivElement | null = null;
      setReady(false);
      setCurrentTime(0);
      setPlaying(false);

      loadYouTubeApi().then(() => {
        if (cancelled || !mountRef.current) return;
        // React 가상DOM 밖의 host 노드에 iframe을 붙여 언마운트 충돌 방지 (ClipPlayer와 동일 패턴)
        host = document.createElement("div");
        host.style.width = "100%";
        host.style.height = "100%";
        mountRef.current.appendChild(host);

        playerRef.current = new window.YT.Player(host, {
          videoId,
          playerVars: { controls: 1, rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: (e: any) => {
              if (cancelled) return;
              setDuration(e.target.getDuration?.() ?? 0);
              setReady(true);
            },
            onStateChange: (e: any) => {
              if (cancelled) return;
              const YT = window.YT;
              if (e.data === YT.PlayerState.PLAYING) setPlaying(true);
              else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) setPlaying(false);
            },
          },
        });
      });

      return () => {
        cancelled = true;
        try { playerRef.current?.destroy?.(); } catch { /* 이미 제거됨 */ }
        playerRef.current = null;
        try { host?.remove(); } catch { /* 이미 제거됨 */ }
      };
    }, [videoId]);

    // ── 현재 시각 추적 (rAF) ──
    useEffect(() => {
      if (!ready) return;
      const tick = () => {
        const t = playerRef.current?.getCurrentTime?.();
        if (typeof t === "number") setCurrentTime(t);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    }, [ready]);

    // ── 키보드 ──
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
        const player = playerRef.current;
        if (!player) return;

        if (e.key >= "1" && e.key <= "6") {
          setStepIdx(parseInt(e.key, 10) - 1);
          e.preventDefault();
          return;
        }
        const step = STEPS[stepIdxRef.current];
        if (e.key === "ArrowLeft") {
          const t = Math.max(0, (player.getCurrentTime?.() ?? 0) - step);
          player.seekTo(t, true);
          setCurrentTime(t);
          e.preventDefault();
        } else if (e.key === "ArrowRight") {
          const t = (player.getCurrentTime?.() ?? 0) + step;
          player.seekTo(t, true);
          setCurrentTime(t);
          e.preventDefault();
        } else if (e.key === " ") {
          if (playing) player.pauseVideo?.(); else player.playVideo?.();
          e.preventDefault();
        } else if (e.key === "Enter") {
          onAnchorRef.current(player.getCurrentTime?.() ?? 0);
          e.preventDefault();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [playing]);

    // 직접 이동/재생 (마우스용 — 키보드 ←→·스텝과 별개로 즉시 이동)
    const seekBy = (delta: number) => {
      const p = playerRef.current;
      if (!p) return;
      const t = Math.max(0, (p.getCurrentTime?.() ?? 0) + delta);
      p.seekTo(t, true);
      setCurrentTime(t);
    };
    const togglePlay = () => {
      const p = playerRef.current;
      if (!p) return;
      if (playing) p.pauseVideo?.(); else p.playVideo?.();
    };
    const moveBtn =
      "px-1.5 py-1 rounded text-xs font-mono bg-light-primary/10 dark:bg-dark-primary/10 " +
      "text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/20 dark:hover:bg-dark-primary/20";

    return (
      <div className={className}>
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <div ref={mountRef} className="absolute inset-0 [&>div]:w-full [&>div]:h-full [&>iframe]:w-full [&>iframe]:h-full" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
              <div className="w-8 h-8 border-2 border-white/20 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* HUD */}
        <div className="mt-2 space-y-1.5">
          {/* 현재 시각 + 직접 이동(0.1초 포함) + 앵커 */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono tabular-nums px-2 py-1 rounded bg-light-primary/10 dark:bg-dark-primary/10 text-light-text dark:text-dark-text">
              {fmt(currentTime)} <span className="text-light-text/40 dark:text-dark-text/40">/ {fmt(duration)}</span>
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => seekBy(-10)} className={moveBtn} title="10초 뒤로">-10s</button>
              <button onClick={() => seekBy(-1)} className={moveBtn} title="1초 뒤로">-1s</button>
              <button onClick={() => seekBy(-0.1)} className={moveBtn} title="0.1초 뒤로">-0.1s</button>
              <button onClick={togglePlay} className="px-2 py-1 rounded bg-light-accent dark:bg-dark-accent text-white text-xs" title="재생/정지 (Space)">{playing ? "⏸" : "▶"}</button>
              <button onClick={() => seekBy(0.1)} className={moveBtn} title="0.1초 앞으로">+0.1s</button>
              <button onClick={() => seekBy(1)} className={moveBtn} title="1초 앞으로">+1s</button>
              <button onClick={() => seekBy(10)} className={moveBtn} title="10초 앞으로">+10s</button>
            </div>
            <button
              onClick={() => onSetAnchorAtCurrent(playerRef.current?.getCurrentTime?.() ?? 0)}
              className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-light-accent dark:bg-dark-accent text-white text-sm font-medium hover:shadow-lg transition-all"
              title="현재 재생 위치를 선택된 타임라인의 시작 지점으로 설정 (Enter)"
            >
              이 지점을 시작으로 (Enter)
            </button>
          </div>
          {/* 키보드 ←→ 스텝 (선택) */}
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-light-text/40 dark:text-dark-text/40">←→ 스텝:</span>
            {STEPS.map((s, i) => (
              <button
                key={s}
                onClick={() => setStepIdx(i)}
                className={`px-1.5 py-0.5 rounded font-mono transition-colors ${
                  i === stepIdx
                    ? "bg-light-accent dark:bg-dark-accent text-white"
                    : "bg-light-primary/10 dark:bg-dark-primary/10 text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/20 dark:hover:bg-dark-primary/20"
                }`}
                title={`스텝 ${s}초 (키 ${i + 1})`}
              >
                {s}s
              </button>
            ))}
            <span className="text-light-text/40 dark:text-dark-text/40 ml-1">· Space 재생 · Enter 앵커</span>
          </div>
        </div>
      </div>
    );
  },
);

export default CalibrationPlayer;
