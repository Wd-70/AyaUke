"use client";

import { useEffect, useRef, useState } from "react";
import { PlayIcon, PauseIcon } from "@heroicons/react/24/solid";
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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract video ID from URL or use videoNo
  const getChzzkEmbedUrl = (url: string): string => {
    // Chzzk embed URL format: https://chzzk.naver.com/embed/video/{videoNo}
    return `https://chzzk.naver.com/embed/video/${videoNo}`;
  };

  const embedUrl = getChzzkEmbedUrl(videoUrl);

  useEffect(() => {
    if (isDeleted) {
      setError("이 영상은 치지직에서 삭제되었습니다.");
      return;
    }

    // Check if video is accessible
    const checkVideo = async () => {
      try {
        setIsReady(true);
        setError(null);
      } catch (err) {
        setError("영상을 로드할 수 없습니다.");
        setIsReady(false);
      }
    };

    checkVideo();
  }, [videoUrl, videoNo, isDeleted]);

  // Note: Chzzk iframe may not provide direct time tracking API
  // This is a limitation - we'll need to rely on manual sync points
  useEffect(() => {
    if (!isReady) return;

    // Simulate time tracking (actual implementation depends on Chzzk API)
    // For now, this is a placeholder that would need Chzzk's player API
    const interval = setInterval(() => {
      // In a real implementation, this would query the Chzzk player's current time
      // For now, we rely on manual sync point setting
      if (onTimeUpdate) {
        onTimeUpdate(currentTime);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isReady, currentTime, onTimeUpdate]);

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

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Video Player */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <iframe
          ref={iframeRef}
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Chzzk Video Player"
        />
      </div>

      {/* Time Display */}
      <div className="mt-3 px-2">
        <div className="text-sm font-mono text-light-text dark:text-dark-text">
          {formatSeconds(currentTime)} / {formatSeconds(duration)}
        </div>
        <p className="text-xs text-light-text/40 dark:text-dark-text/40 mt-1">
          * 치지직 플레이어는 자동 시간 추적을 지원하지 않습니다. 싱크 포인트를 수동으로 설정해주세요.
        </p>
      </div>
    </div>
  );
}
