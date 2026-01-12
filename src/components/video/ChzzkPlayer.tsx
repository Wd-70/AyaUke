"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { formatSeconds } from "@/lib/timeUtils";

interface ChzzkPlayerProps {
  videoUrl: string;
  videoNo: number;
  isDeleted?: boolean;
  onTimeUpdate?: (currentTime: number) => void;
  className?: string;
}

export default function ChzzkPlayer({
  videoUrl,
  videoNo,
  isDeleted = false,
  onTimeUpdate,
  className = "",
}: ChzzkPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);

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

        const response = await fetch(
          `/api/chzzk-sync?action=get-hls-url&videoNo=${videoNo}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch video info");
        }

        const result = await response.json();

        if (!result.success || !result.data?.hlsUrl) {
          throw new Error(result.error || "HLS stream not found");
        }

        setHlsUrl(result.data.hlsUrl);
        setDuration(result.data.duration || 0);
      } catch (err: any) {
        console.error("Error fetching HLS URL:", err);
        setError(err.message || "영상을 로드할 수 없습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchHlsUrl();
  }, [videoNo, isDeleted]);

  // Initialize HLS player
  useEffect(() => {
    if (!hlsUrl || !videoRef.current) return;

    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsReady(true);
        setError(null);
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
      video.addEventListener("loadedmetadata", () => {
        setIsReady(true);
        setError(null);
      });
    } else {
      setError("이 브라우저는 HLS를 지원하지 않습니다.");
    }
  }, [hlsUrl]);

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
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    // Initial duration update
    if (video.duration) {
      setDuration(video.duration);
    }

    console.log("[ChzzkPlayer] Time tracking initialized");

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [isReady, onTimeUpdate]);

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

      {/* Time Display */}
      <div className="mt-3 px-2">
        <div className="text-sm font-mono text-light-text dark:text-dark-text">
          {formatSeconds(currentTime)} / {formatSeconds(duration)}
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
}
