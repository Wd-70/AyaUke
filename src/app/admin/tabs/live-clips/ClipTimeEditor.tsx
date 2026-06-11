"use client";

/**
 * 클립 시작/종료 시간 편집 컨트롤 (소수점 지원).
 * 플레이어 어댑터를 통해 현재 시간 캡처(IN/OUT)·미세 시크를 제공하고,
 * 맞춘 길이를 곡 기본값으로 등록하는 버튼을 포함한다.
 */

import {
  PlayIcon,
  PauseIcon,
  ClockIcon,
  BackwardIcon,
  ForwardIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  BookmarkIcon,
} from "@heroicons/react/24/outline";
import { type EditPlayerAdapter, formatTime, captureTime } from "./clip-types";

interface ClipTimeEditorProps {
  startTime: number;
  endTime?: number | null;
  onChange: (patch: { startTime?: number; endTime?: number | null }) => void;
  adapter: EditPlayerAdapter | null;
  currentTime: number;
  isPlaying: boolean;
  /** 곡의 현재 기본 클립 길이 (표시용) */
  songClipDuration?: number | null;
  /** "이 길이를 곡 기본값으로" 클릭 시 (관리자) */
  onSetDefaultDuration?: (duration: number) => void;
  savingDefault?: boolean;
}

export default function ClipTimeEditor({
  startTime,
  endTime,
  onChange,
  adapter,
  currentTime,
  isPlaying,
  songClipDuration,
  onSetDefaultDuration,
  savingDefault = false,
}: ClipTimeEditorProps) {
  const duration = endTime != null && endTime > startTime ? endTime - startTime : null;

  const seekRelative = (delta: number) => {
    if (!adapter) return;
    adapter.seekTo(Math.max(0, adapter.getCurrentTime() + delta));
  };

  const seekButton =
    "px-2 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1 transition-colors " +
    "bg-light-primary/5 hover:bg-light-primary/15 border border-light-primary/20 text-light-text/70 " +
    "dark:bg-dark-primary/10 dark:hover:bg-dark-primary/20 dark:border-dark-primary/20 dark:text-dark-text/70 " +
    "disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="space-y-3">
      {/* 현재 시간 + 재생 컨트롤 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-light-text/60 dark:text-dark-text/60">
          현재 위치{" "}
          <span className="font-mono text-base font-semibold text-light-text dark:text-dark-text">
            {formatTime(currentTime)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => seekRelative(-60)} disabled={!adapter} className={seekButton} title="1분 뒤로">
            <ChevronDoubleLeftIcon className="w-3.5 h-3.5" />1m
          </button>
          <button type="button" onClick={() => seekRelative(-10)} disabled={!adapter} className={seekButton} title="10초 뒤로">
            <ChevronLeftIcon className="w-3.5 h-3.5" />10s
          </button>
          <button type="button" onClick={() => seekRelative(-1)} disabled={!adapter} className={seekButton} title="1초 뒤로">
            <BackwardIcon className="w-3.5 h-3.5" />1s
          </button>
          <button
            type="button"
            onClick={() => (isPlaying ? adapter?.pause() : adapter?.play())}
            disabled={!adapter}
            className="p-2 rounded-full bg-light-accent dark:bg-dark-accent text-white hover:shadow-md disabled:opacity-40 transition-all"
            title={isPlaying ? "일시정지" : "재생"}
          >
            {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
          </button>
          <button type="button" onClick={() => seekRelative(1)} disabled={!adapter} className={seekButton} title="1초 앞으로">
            <ForwardIcon className="w-3.5 h-3.5" />1s
          </button>
          <button type="button" onClick={() => seekRelative(10)} disabled={!adapter} className={seekButton} title="10초 앞으로">
            <ChevronRightIcon className="w-3.5 h-3.5" />10s
          </button>
          <button type="button" onClick={() => seekRelative(60)} disabled={!adapter} className={seekButton} title="1분 앞으로">
            <ChevronDoubleRightIcon className="w-3.5 h-3.5" />1m
          </button>
        </div>
      </div>

      {/* 시작/종료 시간 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              시작 시간 <span className="font-mono">({formatTime(startTime)})</span>
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => adapter && onChange({ startTime: captureTime(adapter.getCurrentTime()) })}
                disabled={!adapter}
                className="px-2 py-0.5 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 transition-colors"
                title="플레이어의 현재 위치를 시작 시간으로 캡처"
              >
                IN
              </button>
              <button
                type="button"
                onClick={() => adapter?.seekTo(startTime)}
                disabled={!adapter}
                className="px-2 py-0.5 text-xs rounded border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-40 transition-colors"
                title="시작 시간 위치로 이동"
              >
                이동
              </button>
            </div>
          </div>
          <input
            type="number"
            step="0.1"
            min="0"
            value={startTime}
            onChange={(e) => onChange({ startTime: parseFloat(e.target.value) || 0 })}
            className="w-full px-2 py-1.5 text-sm rounded border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text font-mono"
            placeholder="초 (소수점 가능)"
          />
        </div>

        <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-900/20 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-purple-700 dark:text-purple-300">
              종료 시간 {endTime != null && <span className="font-mono">({formatTime(endTime)})</span>}
            </label>
            <div className="flex gap-1">
              {songClipDuration != null && songClipDuration > 0 && (
                <button
                  type="button"
                  onClick={() => onChange({ endTime: Math.round((startTime + songClipDuration) * 10) / 10 })}
                  className="px-2 py-0.5 text-xs rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-700 hover:bg-violet-200 dark:hover:bg-violet-900/60 transition-colors"
                  title={`종료 시간을 '시작 + 곡 기본 길이(${formatTime(songClipDuration)})'로 설정합니다`}
                >
                  기본길이 적용
                </button>
              )}
              <button
                type="button"
                onClick={() => adapter && onChange({ endTime: captureTime(adapter.getCurrentTime()) })}
                disabled={!adapter}
                className="px-2 py-0.5 text-xs rounded bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 transition-colors"
                title="플레이어의 현재 위치를 종료 시간으로 캡처"
              >
                OUT
              </button>
              <button
                type="button"
                onClick={() => endTime != null && adapter?.seekTo(Math.max(0, endTime - 3))}
                disabled={!adapter || endTime == null}
                className="px-2 py-0.5 text-xs rounded border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 disabled:opacity-40 transition-colors"
                title="종료 3초 전으로 이동 (끝부분 확인)"
              >
                끝-3s
              </button>
            </div>
          </div>
          <input
            type="number"
            step="0.1"
            min="0"
            value={endTime ?? ""}
            onChange={(e) =>
              onChange({ endTime: e.target.value === "" ? null : parseFloat(e.target.value) || 0 })
            }
            className="w-full px-2 py-1.5 text-sm rounded border border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text font-mono"
            placeholder="비우면 영상 끝까지"
          />
        </div>
      </div>

      {/* 클립 길이 + 곡 기본값 등록 */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg bg-light-primary/5 dark:bg-dark-primary/10 px-3 py-2">
        <div className="text-sm text-light-text/70 dark:text-dark-text/70">
          클립 길이:{" "}
          <span className="font-mono font-semibold text-light-text dark:text-dark-text">
            {duration != null ? formatTime(duration) : "—"}
          </span>
          {songClipDuration != null && songClipDuration > 0 && (
            <span className="ml-3 text-xs text-light-text/50 dark:text-dark-text/50">
              곡 기본값: <span className="font-mono">{formatTime(songClipDuration)}</span>
            </span>
          )}
        </div>
        {onSetDefaultDuration && (
          <button
            type="button"
            onClick={() => duration != null && onSetDefaultDuration(Math.round(duration * 10) / 10)}
            disabled={duration == null || savingDefault}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple text-white hover:shadow-md disabled:opacity-40 transition-all"
            title="현재 시작~종료 길이를 이 곡의 기본 클립 길이로 저장합니다. 이후 곡 매칭 시 종료시간이 자동 설정됩니다."
          >
            <BookmarkIcon className="w-3.5 h-3.5" />
            {savingDefault ? "저장 중..." : "이 길이를 곡 기본값으로"}
          </button>
        )}
      </div>
    </div>
  );
}
