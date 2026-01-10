"use client";

import { useEffect, useRef, useState } from "react";
import YouTube, { YouTubeProps, YouTubePlayer as YouTubePlayerType } from "react-youtube";
import { PlayIcon, PauseIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from "@heroicons/react/24/solid";
import { formatSeconds } from "@/lib/timeUtils";

interface YouTubePlayerProps {
  videoUrl: string;
  onTimeUpdate?: (currentTime: number) => void;
  className?: string;
}

export default function YouTubePlayerComponent({ videoUrl, onTimeUpdate, className = "" }: YouTubePlayerProps) {
  const playerRef = useRef<YouTubePlayerType | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract video ID from URL
  const getVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const videoId = getVideoId(videoUrl);

  const onReady: YouTubeProps["onReady"] = (event) => {
    playerRef.current = event.target;
    setDuration(event.target.getDuration());
    setIsReady(true);
    setError(null);
  };

  const onError: YouTubeProps["onError"] = (event) => {
    setError("동영상을 로드할 수 없습니다.");
    setIsReady(false);
  };

  const onStateChange: YouTubeProps["onStateChange"] = (event) => {
    // 0: ended, 1: playing, 2: paused, 3: buffering, 5: cued
    setIsPlaying(event.data === 1);
  };

  // Update current time periodically
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    const interval = setInterval(async () => {
      if (playerRef.current) {
        const time = await playerRef.current.getCurrentTime();
        setCurrentTime(time);
        if (onTimeUpdate) {
          onTimeUpdate(time);
        }
      }
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [isReady, onTimeUpdate]);

  const handlePlayPause = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const handleMuteToggle = () => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
    } else {
      playerRef.current.mute();
    }
    setIsMuted(!isMuted);
  };

  if (!videoId) {
    return (
      <div className={`bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20 ${className}`}>
        <p className="text-light-text/60 dark:text-dark-text/60 text-center">
          유효한 YouTube URL이 아닙니다.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20 ${className}`}>
        <p className="text-red-600 dark:text-red-400 text-center">{error}</p>
      </div>
    );
  }

  const opts: YouTubeProps["opts"] = {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 0,
      controls: 1,
      modestbranding: 1,
      rel: 0,
    },
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Video Player */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <YouTube
          videoId={videoId}
          opts={opts}
          onReady={onReady}
          onError={onError}
          onStateChange={onStateChange}
          className="w-full h-full"
        />
      </div>

      {/* Time Display */}
      <div className="mt-3 flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            disabled={!isReady}
            className="p-2 rounded-lg bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors disabled:opacity-50"
            aria-label={isPlaying ? "일시정지" : "재생"}
          >
            {isPlaying ? (
              <PauseIcon className="w-4 h-4" />
            ) : (
              <PlayIcon className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleMuteToggle}
            disabled={!isReady}
            className="p-2 rounded-lg bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors disabled:opacity-50"
            aria-label={isMuted ? "음소거 해제" : "음소거"}
          >
            {isMuted ? (
              <SpeakerXMarkIcon className="w-4 h-4" />
            ) : (
              <SpeakerWaveIcon className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="text-sm font-mono text-light-text dark:text-dark-text">
          {formatSeconds(currentTime)} / {formatSeconds(duration)}
        </div>
      </div>
    </div>
  );
}
