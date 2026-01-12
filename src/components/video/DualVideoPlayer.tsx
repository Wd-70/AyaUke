"use client";

import { useState } from "react";
import YouTubePlayer from "./YouTubePlayer";
import ChzzkPlayer from "./ChzzkPlayer";
import { formatOffset } from "@/lib/timeUtils";
import { ClockIcon } from "@heroicons/react/24/outline";

interface DualVideoPlayerProps {
  chzzkVideoUrl: string;
  chzzkVideoNo: number;
  chzzkIsDeleted?: boolean;
  youtubeUrl: string;
  currentOffset?: number | null;
  onSetSyncPoint: (chzzkTime: number, youtubeTime: number, offset: number) => void;
  className?: string;
}

export default function DualVideoPlayer({
  chzzkVideoUrl,
  chzzkVideoNo,
  chzzkIsDeleted = false,
  youtubeUrl,
  currentOffset = null,
  onSetSyncPoint,
  className = "",
}: DualVideoPlayerProps) {
  const [chzzkCurrentTime, setChzzkCurrentTime] = useState(0);
  const [youtubeCurrentTime, setYoutubeCurrentTime] = useState(0);
  const [calculatedOffset, setCalculatedOffset] = useState<number | null>(null);

  const handleSetSyncPoint = () => {
    const offset = youtubeCurrentTime - chzzkCurrentTime;
    setCalculatedOffset(offset);
    onSetSyncPoint(chzzkCurrentTime, youtubeCurrentTime, offset);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Video Players */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chzzk Player */}
        <div className="flex flex-col">
          <h5 className="text-sm font-semibold text-light-text dark:text-dark-text mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-light-accent dark:bg-dark-accent"></span>
            치지직
          </h5>
          <ChzzkPlayer
            videoUrl={chzzkVideoUrl}
            videoNo={chzzkVideoNo}
            isDeleted={chzzkIsDeleted}
            onTimeUpdate={setChzzkCurrentTime}
          />
        </div>

        {/* YouTube Player */}
        <div className="flex flex-col">
          <h5 className="text-sm font-semibold text-light-text dark:text-dark-text mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            유튜브
          </h5>
          <YouTubePlayer
            videoUrl={youtubeUrl}
            onTimeUpdate={setYoutubeCurrentTime}
          />
        </div>
      </div>

      {/* Sync Point Control */}
      <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h5 className="text-sm font-semibold text-light-text dark:text-dark-text mb-2 flex items-center gap-2">
              <ClockIcon className="w-5 h-5" />
              싱크 포인트 설정
            </h5>
            <p className="text-xs text-light-text/60 dark:text-dark-text/60">
              두 영상의 동일한 지점에서 버튼을 눌러 시간차를 설정하세요.
            </p>

            {/* Current Time Display */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-light-primary/5 dark:bg-dark-primary/5 rounded-lg">
                <span className="text-xs text-light-text/60 dark:text-dark-text/60">치지직:</span>
                <span className="text-sm font-mono font-semibold text-light-text dark:text-dark-text">
                  {formatOffset(chzzkCurrentTime)}
                </span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/5 rounded-lg">
                <span className="text-xs text-light-text/60 dark:text-dark-text/60">유튜브:</span>
                <span className="text-sm font-mono font-semibold text-light-text dark:text-dark-text">
                  {formatOffset(youtubeCurrentTime)}
                </span>
              </div>
            </div>

            {currentOffset !== null && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-light-accent/10 dark:bg-dark-accent/10 rounded-lg">
                <span className="text-xs text-light-text/60 dark:text-dark-text/60">현재 오프셋:</span>
                <span className="text-sm font-mono font-semibold text-light-accent dark:text-dark-accent">
                  {formatOffset(currentOffset)}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleSetSyncPoint}
            className="px-6 py-3 bg-light-accent dark:bg-dark-accent text-white rounded-lg hover:opacity-90 transition-opacity font-medium shadow-sm"
            aria-label="싱크 포인트 설정"
          >
            싱크 포인트 설정
          </button>
        </div>

        {/* Calculated Offset Preview */}
        {calculatedOffset !== null && calculatedOffset !== currentOffset && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              새로운 오프셋: {formatOffset(calculatedOffset)} (저장 중...)
            </p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-light-accent/5 dark:bg-dark-accent/5 rounded-lg p-4 border border-light-accent/10 dark:border-dark-accent/10">
        <h6 className="text-sm font-semibold text-light-text dark:text-dark-text mb-2">
          사용 방법
        </h6>
        <ol className="text-sm text-light-text/70 dark:text-dark-text/70 space-y-1 list-decimal list-inside">
          <li>두 영상을 재생하여 동일한 장면을 찾습니다.</li>
          <li>동일한 지점에서 "싱크 포인트 설정" 버튼을 클릭합니다.</li>
          <li>시간차가 자동으로 계산되어 저장됩니다.</li>
          <li>아래 댓글 섹션에서 변환된 타임라인을 확인할 수 있습니다.</li>
        </ol>
      </div>
    </div>
  );
}
