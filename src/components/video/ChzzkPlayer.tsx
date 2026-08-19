"use client";

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import Hls from "hls.js";
import { formatSeconds } from "@/lib/timeUtils";
import { resolveVodRenditions, type Mp4Rendition } from "@/shared/utils/chzzk-vod";
import { loadStoredVolume, saveStoredVolume } from "@/components/clip/volume-storage";

/** 화질 선택 옵션 (HLS 레벨 또는 MP4 렌디션 공통). value=-1은 HLS 자동(ABR). */
interface QualityOption {
  value: number;
  label: string;
}

// 화질 선호를 localStorage에 전역 저장 (영상이 달라도 유지). 인덱스는 영상마다 달라지므로
// height(선호 화질)로 저장하고, 각 영상에서 가장 가까운 레벨/렌디션에 매핑한다.
const QUALITY_KEY = "chzzkPlayer.quality"; // 'auto' | height(number 문자열)
function loadQualityPref(): "auto" | number {
  try {
    const v = localStorage.getItem(QUALITY_KEY);
    return v && v !== "auto" ? Number(v) : "auto";
  } catch {
    return "auto";
  }
}
function saveQualityPref(v: "auto" | number) {
  try {
    localStorage.setItem(QUALITY_KEY, v === "auto" ? "auto" : String(v));
  } catch {
    /* 무시 */
  }
}
/** heights 배열에서 target(선호 height)에 가장 가까운 인덱스 (heights는 원본 순서). */
function nearestIndexByHeight(heights: number[], target: number): number {
  let best = 0;
  let bestDiff = Infinity;
  heights.forEach((h, i) => {
    const d = Math.abs(h - target);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  });
  return best;
}

interface ChzzkPlayerProps {
  videoUrl: string;
  videoNo: number;
  isDeleted?: boolean;
  /** 로드 완료 후 이 시간(초)으로 시킹 */
  startTime?: number;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
  className?: string;
}

export interface ChzzkPlayerHandle {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  play: () => void;
  pause: () => void;
}

const ChzzkPlayer = forwardRef<ChzzkPlayerHandle, ChzzkPlayerProps>(function ChzzkPlayer({
  videoUrl,
  videoNo,
  isDeleted = false,
  startTime,
  onTimeUpdate,
  onDurationChange,
  onPlayStateChange,
  className = "",
}, ref) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const [streamType, setStreamType] = useState<'hls' | 'mp4'>('hls');
  // 화질 선택: HLS는 레벨 인덱스(-1=자동), MP4는 렌디션 인덱스. 옵션이 2개 이상일 때만 노출.
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([]);
  const [quality, setQuality] = useState<number>(-1);
  const mp4RenditionsRef = useRef<Mp4Rendition[]>([]);
  // 저장된 화질 선호(height). 마운트 후 로드 (하이드레이션 불일치 방지).
  const qualityPrefRef = useRef<"auto" | number>("auto");
  // startTime을 소스 재로딩 없이 시킹에만 쓰기 위한 최신값 참조
  const startTimeRef = useRef(startTime);
  startTimeRef.current = startTime;

  useEffect(() => {
    qualityPrefRef.current = loadQualityPref();
  }, []);

  // Fetch HLS URL from Chzzk API
  useEffect(() => {
    if (isDeleted) {
      setError("이 영상은 치지직에서 삭제되었습니다.");
      setLoading(false);
      return;
    }

    const fetchHlsUrl = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/clips/chzzk-hls?videoNo=${videoNo}`);
        // 에러여도 본문을 읽어 실제 메시지(만료/삭제 안내 등)를 사용
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success || !result.data) {
          throw new Error(result?.error?.message || "재생 가능한 스트림이 없습니다.");
        }

        const data = result.data;
        setDuration(data.duration || 0);

        if (data.streamType === 'vod') {
          // 영구 보존 VOD: vodplay 토큰이 호출 IP에 묶이므로 브라우저가 직접 MP4 URL(화질별)을 받는다.
          const renditions = await resolveVodRenditions(data.vodVideoId, data.vodInKey);
          if (renditions.length === 0) throw new Error("재생할 수 있는 영상이 아닙니다.");
          mp4RenditionsRef.current = renditions;
          setQualityOptions(renditions.map((r, i) => ({ value: i, label: `${r.height}p` })));
          // 저장된 선호 화질로 초기 로드 (없으면 최고화질). 인덱스는 height로 매핑.
          const pref = qualityPrefRef.current;
          const idx = pref === "auto" ? 0 : nearestIndexByHeight(renditions.map((r) => r.height), pref);
          setQuality(idx);
          setHlsUrl(renditions[idx].url);
          setStreamType('mp4');
        } else {
          if (!data.streamUrl) {
            throw new Error(result?.error?.message || "재생 가능한 스트림이 없습니다.");
          }
          setHlsUrl(data.streamUrl);
          setStreamType(data.streamType || 'hls');
        }
      } catch (err: any) {
        // 만료/삭제된 원본은 예상된 상태 — 오버레이 띄우지 않도록 warn으로 처리
        console.warn("[ChzzkPlayer] 영상 로드 실패:", err?.message || err);
        setError(err.message || "영상을 로드할 수 없습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchHlsUrl();
  }, [videoNo, isDeleted]);

  // Initialize player (HLS 또는 progressive MP4)
  useEffect(() => {
    if (!hlsUrl || !videoRef.current) return;

    const video = videoRef.current;

    // 영구 보존 VOD: progressive MP4 — 네이티브 재생 (Range 시킹 지원)
    if (streamType === 'mp4') {
      video.src = hlsUrl;
      // once: 초기 로드에만 시킹. 화질 교체(changeQuality)의 src 재설정과 충돌하지 않도록.
      const onLoadedMeta = () => {
        setIsReady(true);
        setError(null);
        const s = startTimeRef.current;
        if (s && s > 0) video.currentTime = s;
      };
      video.addEventListener("loadedmetadata", onLoadedMeta, { once: true });
      return () => {
        video.removeEventListener("loadedmetadata", onLoadedMeta);
        video.removeAttribute("src");
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        // 플레이어 실제 픽셀 크기(DPR 반영)에 맞춰 auto 화질 상한을 캡 —
        // 작은 편집 플레이어에 불필요한 고화질을 받지 않아 대역폭/디코드 절약.
        capLevelToPlayerSize: true,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsReady(true);
        setError(null);
        // 화질 레벨 목록 구성 (높이 내림차순) + '자동'(ABR). 레벨이 여러 개일 때만 노출.
        const levels = hls.levels
          .map((l, i) => ({ value: i, label: l.height ? `${l.height}p` : `${Math.round((l.bitrate || 0) / 1000)}k` }))
          .sort((a, b) => (hls.levels[b.value].height || 0) - (hls.levels[a.value].height || 0));
        setQualityOptions(levels.length > 1 ? [{ value: -1, label: '자동' }, ...levels] : []);
        // 저장된 선호 화질 적용 (없으면 자동/ABR). height로 가장 가까운 레벨 선택.
        const pref = qualityPrefRef.current;
        const sel = pref === "auto" ? -1 : nearestIndexByHeight(hls.levels.map((l) => l.height || 0), pref);
        hls.currentLevel = sel;
        setQuality(sel);
        const s = startTimeRef.current;
        if (s && s > 0) video.currentTime = s;
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error("Network error, trying to recover...");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error("Media error, trying to recover...");
              hls.recoverMediaError();
              break;
            default:
              console.error("Fatal error, cannot recover:", data);
              setError("재생 중 오류가 발생했습니다.");
              break;
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS support
      video.src = hlsUrl;
      video.addEventListener(
        "loadedmetadata",
        () => {
          setIsReady(true);
          setError(null);
          const s = startTimeRef.current;
          if (s && s > 0) video.currentTime = s;
        },
        { once: true },
      );
    } else {
      setError("이 브라우저는 HLS를 지원하지 않습니다.");
    }
    // startTime은 deps에서 제외 — 타임라인 이동은 아래 시킹 effect가 소스 재로딩 없이 처리
    // (재로딩하면 MP4가 다시 최고화질로 리셋됨). 초기 시킹은 startTimeRef로 반영.
  }, [hlsUrl, streamType]);

  // 타임라인 이동: 소스 재로딩 없이 위치만 이동 → 선택 화질 유지
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isReady) return;
    if (typeof startTime === "number" && startTime > 0 && Math.abs(video.currentTime - startTime) > 0.5) {
      video.currentTime = startTime;
    }
  }, [startTime, isReady]);

  // 외부 제어 핸들 (시간 편집 화면의 '현재 시간 가져오기', 시킹 등)
  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      if (videoRef.current) videoRef.current.currentTime = seconds;
    },
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    getDuration: () => videoRef.current?.duration ?? 0,
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
  }), []);

  // Track video time
  useEffect(() => {
    if (!videoRef.current || !isReady) return;

    const video = videoRef.current;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      if (onTimeUpdate) {
        onTimeUpdate(time);
      }
    };

    const handleDurationChange = () => {
      setDuration(video.duration);
      onDurationChange?.(video.duration);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      onPlayStateChange?.(true);
    };
    const handlePause = () => {
      setIsPlaying(false);
      onPlayStateChange?.(false);
    };
    // 네이티브 컨트롤로 음량 조절 시 저장 (ClipPlayer와 공유)
    const handleVolumeChange = () => {
      saveStoredVolume({ volume: video.volume, muted: video.muted });
    };

    // 저장된 음량 설정 적용 (영상/화면 전환 시에도 유지)
    const stored = loadStoredVolume();
    video.volume = stored.volume;
    video.muted = stored.muted;

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("volumechange", handleVolumeChange);

    // Initial duration update
    if (video.duration) {
      setDuration(video.duration);
      onDurationChange?.(video.duration);
    }

    console.log("[ChzzkPlayer] Time tracking initialized");

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("volumechange", handleVolumeChange);
    };
  }, [isReady, onTimeUpdate, onDurationChange, onPlayStateChange]);

  // 화질 변경. HLS는 currentLevel(-1=자동), MP4는 화질별 URL로 src 교체(위치·재생상태 유지).
  const changeQuality = (value: number) => {
    setQuality(value);
    // 선호를 height로 저장 (영상이 달라도 유지). -1(HLS 자동) → 'auto'.
    if (value === -1) {
      qualityPrefRef.current = "auto";
      saveQualityPref("auto");
    } else {
      const h =
        streamType === "hls"
          ? hlsRef.current?.levels[value]?.height ?? 0
          : mp4RenditionsRef.current[value]?.height ?? 0;
      if (h > 0) {
        qualityPrefRef.current = h;
        saveQualityPref(h);
      }
    }
    if (streamType === 'hls') {
      if (hlsRef.current) hlsRef.current.currentLevel = value;
      return;
    }
    const video = videoRef.current;
    const rend = mp4RenditionsRef.current[value];
    if (!video || !rend) return;
    const t = video.currentTime;
    const wasPlaying = !video.paused;
    const onMeta = () => {
      video.currentTime = t;
      if (wasPlaying) video.play().catch(() => {});
      video.removeEventListener("loadedmetadata", onMeta);
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.src = rend.url;
    video.load();
  };

  const QualitySelect = qualityOptions.length > 1 ? (
    <label className="flex items-center gap-1 text-xs text-light-text/60 dark:text-dark-text/60">
      <span>화질</span>
      <select
        value={quality}
        onChange={(e) => changeQuality(Number(e.target.value))}
        className="rounded border border-light-primary/25 bg-white px-1.5 py-0.5 text-xs text-light-text dark:border-dark-primary/25 dark:bg-gray-800 dark:text-dark-text"
      >
        {qualityOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  ) : null;

  if (isDeleted || error) {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="relative aspect-video bg-gray-900/50 rounded-lg overflow-hidden flex items-center justify-center border-2 border-dashed border-light-primary/20 dark:border-dark-primary/20">
          <div className="text-center p-6">
            <div className="mb-4">
              <svg
                className="w-16 h-16 mx-auto text-light-text/30 dark:text-dark-text/30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="text-light-text/60 dark:text-dark-text/60 font-medium">
              치지직 영상 사용 불가
            </p>
            <p className="text-sm text-light-text/40 dark:text-dark-text/40 mt-2">
              {error || "이 영상은 치지직에서 삭제되었습니다."}
            </p>
            <p className="text-xs text-light-text/30 dark:text-dark-text/30 mt-4">
              유튜브 영상으로 타임라인을 확인할 수 있습니다.
            </p>
          </div>
        </div>
        <div className="mt-3 px-2">
          <div className="text-sm font-mono text-light-text/40 dark:text-dark-text/40">
            --:-- / --:--
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="relative aspect-video bg-gray-900/50 rounded-lg overflow-hidden flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-light-accent dark:border-dark-accent mx-auto mb-3"></div>
            <p className="text-sm text-light-text/60 dark:text-dark-text/60">
              영상 로딩 중...
            </p>
          </div>
        </div>
        <div className="mt-3 px-2">
          <div className="text-sm font-mono text-light-text/40 dark:text-dark-text/40">
            --:-- / --:--
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Video Player */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          playsInline
        />
      </div>

      {/* Time Display + 화질 선택 */}
      <div className="mt-3 px-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-mono text-light-text dark:text-dark-text">
            {formatSeconds(currentTime)} / {formatSeconds(duration)}
          </div>
          {QualitySelect}
        </div>
        <p className="text-xs text-light-text/60 dark:text-dark-text/60 mt-1 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          HLS 스트림으로 재생 중 (자동 시간 추적)
        </p>
      </div>
    </div>
  );
});

export default ChzzkPlayer;
