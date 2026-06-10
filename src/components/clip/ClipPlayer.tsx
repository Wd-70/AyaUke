"use client";

/**
 * 구간 전용 클립 플레이어.
 * 영상의 startTime~endTime 구간이 "전체 영상"인 것처럼 보이게 한다:
 * 진행바는 0 ~ (end−start), 시킹은 구간 내로 클램프, end 도달 시 정지.
 * 유튜브(IFrame API)와 치지직(HLS)을 동일한 컨트롤 UI로 재생한다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from "@heroicons/react/24/solid";
import type { VideoPlatform } from "@/shared/utils/video-url";
import { loadStoredVolume, saveStoredVolume } from "./volume-storage";

interface ClipPlayerProps {
  platform: VideoPlatform;
  /** youtube: 11자 비디오 ID / chzzk: String(videoNo) */
  videoId: string;
  startTime: number;
  /** 없으면 영상 끝까지 */
  endTime?: number | null;
  autoplay?: boolean;
  /** 구간 재생이 끝났을 때 (연속 재생 등에 사용) */
  onEnded?: () => void;
  className?: string;
}

/** 내부 플레이어 추상화: 두 플랫폼을 같은 인터페이스로 다룬다 */
interface PlayerAdapter {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setVolume: (v: number) => void; // 0~1
  setMuted: (muted: boolean) => void;
}

// window.YT / onYouTubeIframeAPIReady 전역 선언은 LiveClipEditor.tsx에 이미 존재

function loadYouTubeApi(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve();

    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    // 이미 로드 완료된 경우 폴링으로 보강
    const poll = setInterval(() => {
      if (window.YT?.Player) {
        clearInterval(poll);
        resolve();
      }
    }, 100);
  });
}

const formatClipTime = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
};

export default function ClipPlayer({
  platform,
  videoId,
  startTime,
  endTime,
  autoplay = false,
  onEnded,
  className = "",
}: ClipPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ytMountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const adapterRef = useRef<PlayerAdapter | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const rafRef = useRef<number>(0);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(() => loadStoredVolume().muted);
  const [volume, setVolume] = useState(() => loadStoredVolume().volume);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clipPosition, setClipPosition] = useState(0); // 구간 상대 시간
  const [clipDuration, setClipDuration] = useState(
    endTime != null ? Math.max(0, endTime - startTime) : 0,
  );
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // rAF 콜백에서 최신 상태를 읽기 위한 ref들
  const playingRef = useRef(false);
  const endedRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  playingRef.current = playing;
  onEndedRef.current = onEnded;
  // 플레이어 초기화 시 저장된 음량을 적용하기 위한 최신 값 참조
  const volumeRef = useRef({ volume, muted });
  volumeRef.current = { volume, muted };

  const clipEnd = useCallback(
    () => (endTime != null ? endTime : startTime + clipDuration || Infinity),
    [endTime, startTime, clipDuration],
  );

  // ── 플레이어 초기화 ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    setEnded(false);
    setClipPosition(0);

    if (platform === "youtube") {
      let player: any = null;
      loadYouTubeApi().then(() => {
        if (cancelled || !ytMountRef.current) return;

        player = new window.YT.Player(ytMountRef.current, {
          videoId,
          playerVars: {
            controls: 0, // 네이티브 컨트롤 숨김 — 커스텀 컨트롤만 사용
            disablekb: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            start: Math.floor(startTime),
            ...(endTime != null ? { end: Math.ceil(endTime) } : {}),
            autoplay: autoplay ? 1 : 0,
          },
          events: {
            onReady: (e: any) => {
              if (cancelled) return;
              adapterRef.current = {
                play: () => e.target.playVideo(),
                pause: () => e.target.pauseVideo(),
                seekTo: (s) => e.target.seekTo(s, true),
                getCurrentTime: () => e.target.getCurrentTime?.() ?? 0,
                getDuration: () => e.target.getDuration?.() ?? 0,
                setVolume: (v) => e.target.setVolume(v * 100),
                setMuted: (m) => (m ? e.target.mute() : e.target.unMute()),
              };
              if (endTime == null) {
                const total = e.target.getDuration?.() ?? 0;
                if (total > 0) setClipDuration(Math.max(0, total - startTime));
              }
              // 저장된 음량 설정 적용 (영상 전환 시에도 유지)
              adapterRef.current.setVolume(volumeRef.current.volume);
              adapterRef.current.setMuted(volumeRef.current.muted);
              setReady(true);
            },
            onStateChange: (e: any) => {
              if (cancelled) return;
              const YT = window.YT;
              if (e.data === YT.PlayerState.PLAYING) {
                setPlaying(true);
                setEnded(false);
              } else if (e.data === YT.PlayerState.PAUSED) {
                setPlaying(false);
              } else if (e.data === YT.PlayerState.ENDED) {
                setPlaying(false);
                setEnded(true);
                if (!endedRef.current) {
                  endedRef.current = true;
                  onEndedRef.current?.();
                }
              }
            },
            onError: () => {
              if (!cancelled) setError("영상을 재생할 수 없습니다.");
            },
          },
        });
      });

      return () => {
        cancelled = true;
        adapterRef.current = null;
        try {
          player?.destroy?.();
        } catch {
          /* iframe 이미 제거된 경우 무시 */
        }
      };
    }

    // ── chzzk: HLS ──
    const videoNo = videoId;
    const video = videoRef.current;
    if (!video) return;

    const setupAdapter = () => {
      adapterRef.current = {
        play: () => void video.play(),
        pause: () => video.pause(),
        seekTo: (s) => {
          video.currentTime = s;
        },
        getCurrentTime: () => video.currentTime,
        getDuration: () => video.duration || 0,
        setVolume: (v) => {
          video.volume = v;
        },
        setMuted: (m) => {
          video.muted = m;
        },
      };
    };

    const onLoaded = () => {
      if (cancelled) return;
      setupAdapter();
      video.currentTime = startTime;
      if (endTime == null && video.duration) {
        setClipDuration(Math.max(0, video.duration - startTime));
      }
      // 저장된 음량 설정 적용 (영상 전환 시에도 유지)
      video.volume = volumeRef.current.volume;
      video.muted = volumeRef.current.muted;
      setReady(true);
      if (autoplay) void video.play();
    };

    fetch(`/api/clips/chzzk-hls?videoNo=${videoNo}`)
      .then(async (res) => {
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.error?.message || "영상 정보를 불러올 수 없습니다.");
        }
        return result.data as { streamUrl: string; streamType: 'hls' | 'mp4' };
      })
      .then(({ streamUrl, streamType }) => {
        if (cancelled) return;

        // 영구 보존 VOD: progressive MP4 — 네이티브 재생 (Range 시킹 지원)
        if (streamType === 'mp4') {
          video.src = streamUrl;
          video.addEventListener("loadedmetadata", onLoaded, { once: true });
          return;
        }

        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, onLoaded);
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
            else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            else setError("재생 중 오류가 발생했습니다.");
          });
          hlsRef.current = hls;
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = streamUrl;
          video.addEventListener("loadedmetadata", onLoaded, { once: true });
        } else {
          setError("이 브라우저는 HLS 재생을 지원하지 않습니다.");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "영상을 로드할 수 없습니다.");
      });

    const onPlay = () => {
      setPlaying(true);
      setEnded(false);
    };
    const onPause = () => setPlaying(false);
    const onVideoEnded = () => {
      setPlaying(false);
      setEnded(true);
      if (!endedRef.current) {
        endedRef.current = true;
        onEndedRef.current?.();
      }
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onVideoEnded);

    return () => {
      cancelled = true;
      adapterRef.current = null;
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onVideoEnded);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, videoId, startTime, endTime]);

  // ── 구간 경계 강제 + 진행 추적 (rAF) ────────────────────────────
  useEffect(() => {
    if (!ready) return;

    const tick = () => {
      const adapter = adapterRef.current;
      if (adapter) {
        const abs = adapter.getCurrentTime();
        const end = clipEnd();

        // 경계 강제는 재생 중에만 — 일시정지/대기(cued) 상태에서 seekTo하면
        // YouTube가 의도치 않게 재생을 시작할 수 있다
        if (playingRef.current) {
          if (abs < startTime - 1) {
            // 구간 앞으로 벗어남 (외부 시킹 등) → 시작점 복귀
            adapter.seekTo(startTime);
          } else if (end !== Infinity && abs >= end) {
            adapter.pause();
            adapter.seekTo(end);
            setClipPosition(Math.max(0, end - startTime));
            setEnded(true);
            if (!endedRef.current) {
              endedRef.current = true;
              onEndedRef.current?.();
            }
          } else {
            endedRef.current = false;
            setClipPosition(Math.max(0, abs - startTime));
          }
        } else if (abs >= startTime) {
          setClipPosition(Math.max(0, Math.min(abs, end) - startTime));
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ready, startTime, clipEnd]);

  // ── 전체화면 상태 추적 ──────────────────────────────────────────
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // ── 컨트롤 자동 숨김 ────────────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2500);
  }, []);

  useEffect(() => {
    showControls();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [showControls]);

  // ── 사용자 조작 ──────────────────────────────────────────────────
  const togglePlay = () => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    if (ended) {
      adapter.seekTo(startTime);
      setEnded(false);
      endedRef.current = false;
      adapter.play();
    } else if (playing) {
      adapter.pause();
    } else {
      adapter.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    const rel = Math.min(Math.max(0, Number(e.target.value)), clipDuration);
    adapter.seekTo(startTime + rel);
    setClipPosition(rel);
    setEnded(false);
    endedRef.current = false;
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    adapterRef.current?.setMuted(next);
    saveStoredVolume({ volume, muted: next });
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    adapterRef.current?.setVolume(v);
    let nextMuted = muted;
    if (v > 0 && muted) {
      nextMuted = false;
      setMuted(false);
      adapterRef.current?.setMuted(false);
    }
    saveStoredVolume({ volume: v, muted: nextMuted });
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current.requestFullscreen();
    }
  };

  // ── 렌더 ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={`relative aspect-video bg-gray-900/60 rounded-xl overflow-hidden flex items-center justify-center border border-light-primary/20 dark:border-dark-primary/20 ${className}`}>
        <div className="text-center px-6">
          <p className="text-white/70 font-medium">클립을 재생할 수 없습니다</p>
          <p className="text-white/40 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const progressPercent = clipDuration > 0 ? (clipPosition / clipDuration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`relative aspect-video bg-black rounded-xl overflow-hidden group ${className}`}
      onMouseMove={showControls}
      onTouchStart={showControls}
    >
      {/* 영상 영역 — 네이티브 UI 없이 렌더 */}
      {platform === "youtube" ? (
        <div className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full">
          <div ref={ytMountRef} className="w-full h-full" />
        </div>
      ) : (
        <video ref={videoRef} className="absolute inset-0 w-full h-full" playsInline />
      )}

      {/* 클릭으로 재생/일시정지 (컨트롤 바 제외 영역) */}
      <button
        type="button"
        aria-label={playing ? "일시정지" : "재생"}
        onClick={togglePlay}
        className="absolute inset-0 w-full h-full cursor-pointer"
      />

      {/* 로딩 오버레이 */}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
          <div className="w-10 h-10 border-2 border-white/20 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
        </div>
      )}

      {/* 중앙 재생/다시보기 버튼 (정지 상태) */}
      {ready && (!playing || ended) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple flex items-center justify-center shadow-lg shadow-black/40">
            {ended ? (
              <ArrowPathIcon className="w-8 h-8 text-white" />
            ) : (
              <PlayIcon className="w-8 h-8 text-white translate-x-0.5" />
            )}
          </div>
        </div>
      )}

      {/* 커스텀 컨트롤 바 */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-3 pb-2 pt-8 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${
          controlsVisible || !playing ? "opacity-100" : "opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 구간 상대 진행바 */}
        <div className="relative h-4 flex items-center mb-1 group/bar">
          <div className="absolute inset-x-0 h-1 rounded-full bg-white/25 group-hover/bar:h-1.5 transition-all" />
          <div
            className="absolute h-1 rounded-full bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple group-hover/bar:h-1.5 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={clipDuration || 0}
            step={0.1}
            value={clipPosition}
            onChange={handleSeek}
            aria-label="재생 위치"
            className="absolute inset-x-0 w-full h-4 opacity-0 cursor-pointer"
            disabled={!ready || clipDuration === 0}
          />
        </div>

        <div className="flex items-center gap-3 text-white">
          <button type="button" onClick={togglePlay} aria-label={playing ? "일시정지" : "재생"} className="hover:text-light-accent dark:hover:text-dark-accent transition-colors">
            {ended ? (
              <ArrowPathIcon className="w-5 h-5" />
            ) : playing ? (
              <PauseIcon className="w-5 h-5" />
            ) : (
              <PlayIcon className="w-5 h-5" />
            )}
          </button>

          {/* 구간 상대 시간: 클립이 전체 영상인 것처럼 표시 */}
          <span className="text-xs font-mono tabular-nums">
            {formatClipTime(clipPosition)} / {formatClipTime(clipDuration)}
          </span>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5">
            <button type="button" onClick={toggleMute} aria-label={muted ? "음소거 해제" : "음소거"} className="hover:text-light-accent dark:hover:text-dark-accent transition-colors">
              {muted || volume === 0 ? (
                <SpeakerXMarkIcon className="w-5 h-5" />
              ) : (
                <SpeakerWaveIcon className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={handleVolume}
              aria-label="음량"
              className="w-16 h-1 accent-light-accent dark:accent-dark-accent cursor-pointer hidden sm:block"
            />
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "전체화면 종료" : "전체화면"}
            className="hover:text-light-accent dark:hover:text-dark-accent transition-colors"
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="w-5 h-5" />
            ) : (
              <ArrowsPointingOutIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
