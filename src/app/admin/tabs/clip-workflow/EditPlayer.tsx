"use client";

/**
 * 클립 시간 편집용 전체 영상 플레이어 (플랫폼별). ClipDetailPanel의 편집 플레이어
 * 와이어링을 그대로 차용해 EditPlayerAdapter·현재시각·재생상태를 상위로 보고한다.
 */

import { useCallback, useEffect, useRef } from "react";
import { loadYouTubeApi } from "@/components/clip/ClipPlayer";
import ChzzkPlayer, { type ChzzkPlayerHandle } from "@/components/video/ChzzkPlayer";
import type { EditPlayerAdapter } from "@/app/admin/tabs/live-clips/clip-types";
import type { Platform } from "./types";

interface EditPlayerProps {
  platform: Platform;
  videoId: string;
  videoUrl: string;
  startTime: number;
  onAdapter: (a: EditPlayerAdapter | null) => void;
  onTimeUpdate: (t: number) => void;
  onPlayStateChange: (p: boolean) => void;
  className?: string;
}

export default function EditPlayer({
  platform, videoId, videoUrl, startTime, onAdapter, onTimeUpdate, onPlayStateChange, className = "",
}: EditPlayerProps) {
  const ytMountRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<{ destroy?: () => void } | null>(null);
  // 콜백 최신값 참조 (effect 재생성 방지)
  const cbRef = useRef({ onAdapter, onTimeUpdate, onPlayStateChange });
  cbRef.current = { onAdapter, onTimeUpdate, onPlayStateChange };
  // 영상 변경에도 초기 시각만 반영(아이템 전환 seek는 상위가 어댑터로 처리)
  const startRef = useRef(startTime);

  // ── 유튜브: 전체 영상 YT 플레이어 ──
  useEffect(() => {
    if (platform !== "youtube") return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    loadYouTubeApi().then(() => {
      if (cancelled || !ytMountRef.current) return;
      new window.YT.Player(ytMountRef.current, {
        videoId,
        playerVars: { controls: 1, rel: 0, modestbranding: 1, playsinline: 1, start: Math.floor(startRef.current || 0) },
        events: {
          onReady: (e: { target: Record<string, (...args: never[]) => unknown> }) => {
            if (cancelled) return;
            ytPlayerRef.current = e.target as { destroy?: () => void };
            cbRef.current.onAdapter({
              getCurrentTime: () => (e.target.getCurrentTime as () => number)?.() ?? 0,
              seekTo: (s) => (e.target.seekTo as (s: number, b: boolean) => void)(s, true),
              play: () => (e.target.playVideo as () => void)(),
              pause: () => (e.target.pauseVideo as () => void)(),
            });
            interval = setInterval(() => {
              cbRef.current.onTimeUpdate((e.target.getCurrentTime as () => number)?.() ?? 0);
              cbRef.current.onPlayStateChange((e.target.getPlayerState as () => number)?.() === 1);
            }, 200);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      try { ytPlayerRef.current?.destroy?.(); } catch { /* 이미 제거됨 */ }
      ytPlayerRef.current = null;
      cbRef.current.onAdapter(null);
    };
  }, [platform, videoId]);

  // ── 치지직: ChzzkPlayer 핸들을 어댑터로 ──
  const chzzkRef = useCallback((handle: ChzzkPlayerHandle | null) => {
    cbRef.current.onAdapter(
      handle ? { getCurrentTime: handle.getCurrentTime, seekTo: handle.seekTo, play: handle.play, pause: handle.pause } : null,
    );
  }, []);

  if (platform === "chzzk") {
    return (
      <ChzzkPlayer
        ref={chzzkRef}
        videoUrl={videoUrl}
        videoNo={parseInt(videoId, 10)}
        startTime={startTime}
        onTimeUpdate={onTimeUpdate}
        onPlayStateChange={onPlayStateChange}
        className={className}
      />
    );
  }

  return (
    <div className={`aspect-video bg-black rounded-xl overflow-hidden [&>div]:w-full [&>div]:h-full [&_iframe]:w-full [&_iframe]:h-full ${className}`}>
      <div ref={ytMountRef} />
    </div>
  );
}
