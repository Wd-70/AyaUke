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
import { useEffect, useState } from "react";
import RangeControls from '@/components/clip/range/RangeControls';


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
  /** 클립 작업 화면에서만 사용하는 모바일 조작 배치 */
  mobileControls?: boolean;
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
  mobileControls = false,
}: ClipTimeEditorProps) {
  const [seekStep, setSeekStep] = useState(1);
  const [previewEnd, setPreviewEnd] = useState<number | null>(null);
  useEffect(() => {
    if (previewEnd !== null && currentTime >= previewEnd) { adapter?.pause(); setPreviewEnd(null); }
  }, [currentTime, previewEnd, adapter]);
  const duration = endTime != null && endTime > startTime ? endTime - startTime : null;

  const seekRelative = (delta: number) => {
    setPreviewEnd(null);
    if (!adapter) return;
    adapter.seekTo(Math.max(0, adapter.getCurrentTime() + delta));
  };

  const seekButton =
    "px-2 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1 transition-colors " +
    "bg-light-primary/5 hover:bg-light-primary/15 border border-light-primary/20 text-light-text/70 " +
    "dark:bg-dark-primary/10 dark:hover:bg-dark-primary/20 dark:border-dark-primary/20 dark:text-dark-text/70 " +
    "disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className={`space-y-3 ${mobileControls ? '[&_button]:min-h-11 [&_input]:min-h-11 [&_select]:min-h-11' : ''}`}>
      <RangeControls value={{ startTime, endTime: endTime ?? null }} onChange={onChange}
        capture={adapter ? () => captureTime(adapter.getCurrentTime()) : undefined}
        preview={adapter ? edge => {
          const from = edge === 'start' ? startTime : Math.max(startTime, (endTime ?? startTime) - 10);
          setPreviewEnd(Math.min(endTime ?? from + 10, from + 10)); adapter.seekTo(from); adapter.play();
        } : undefined} />
      {/* 현재 시간 + 재생 컨트롤 */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div className="shrink-0 whitespace-nowrap text-sm text-center sm:text-left text-light-text/60 dark:text-dark-text/60">
          현재 위치{" "}
          <span className="inline-block w-[11ch] text-right font-mono tabular-nums text-base font-semibold text-light-text dark:text-dark-text">
            {formatTime(currentTime, true)}
          </span>
        </div>
        {/* 모바일: 뒤로 그룹 / 재생 / 앞으로 그룹을 3줄로(대칭). 데스크톱: 한 줄. */}
        {mobileControls && <div className="w-full space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <button type="button" className={seekButton} disabled={!adapter} onClick={() => seekRelative(-seekStep)} aria-label={`${seekStep}초 뒤로`}>− {seekStep}초</button>
            <button type="button" disabled={!adapter} onClick={() => isPlaying ? adapter?.pause() : adapter?.play()} className="rounded-lg bg-light-accent dark:bg-dark-accent text-white disabled:opacity-40" aria-label={isPlaying ? '일시정지' : '재생'}>{isPlaying ? '일시정지' : '재생'}</button>
            <button type="button" className={seekButton} disabled={!adapter} onClick={() => seekRelative(seekStep)} aria-label={`${seekStep}초 앞으로`}>+ {seekStep}초</button>
          </div>
          <label className="flex items-center justify-between gap-2 text-sm text-light-text dark:text-dark-text">이동 간격
            <select value={seekStep} onChange={(event) => setSeekStep(Number(event.target.value))} className="rounded-lg border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 px-3">
              <option value={0.1}>0.1초</option><option value={1}>1초</option><option value={10}>10초</option><option value={60}>1분</option>
            </select>
          </label>
        </div>}
        <div className={mobileControls ? 'hidden' : "flex min-w-0 flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-1.5"}>
          <div className="flex items-center justify-center gap-1.5">
            <button type="button" onClick={() => seekRelative(-60)} disabled={!adapter} className={seekButton} title="1분 뒤로">
              <ChevronDoubleLeftIcon className="w-3.5 h-3.5" />1m
            </button>
            <button type="button" onClick={() => seekRelative(-10)} disabled={!adapter} className={seekButton} title="10초 뒤로">
              <ChevronLeftIcon className="w-3.5 h-3.5" />10s
            </button>
            <button type="button" onClick={() => seekRelative(-1)} disabled={!adapter} className={seekButton} title="1초 뒤로">
              <BackwardIcon className="w-3.5 h-3.5" />1s
            </button>
            <button type="button" onClick={() => seekRelative(-0.1)} disabled={!adapter} className={seekButton} title="0.1초 뒤로">
              <BackwardIcon className="w-3.5 h-3.5" />0.1s
            </button>
          </div>
          <button
            type="button"
            onClick={() => (isPlaying ? adapter?.pause() : adapter?.play())}
            disabled={!adapter}
            className="p-2 rounded-full bg-light-accent dark:bg-dark-accent text-white hover:shadow-md disabled:opacity-40 transition-all"
            title={isPlaying ? "일시정지" : "재생"}
          >
            {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
          </button>
          <div className="flex items-center justify-center gap-1.5">
            <button type="button" onClick={() => seekRelative(0.1)} disabled={!adapter} className={seekButton} title="0.1초 앞으로">
              <ForwardIcon className="w-3.5 h-3.5" />0.1s
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
      </div>

      {songClipDuration != null && songClipDuration > 0 && <button type="button" className={seekButton}
        onClick={() => onChange({ endTime: Math.round((startTime + songClipDuration) * 10) / 10 })}>곡 기본길이 적용</button>}

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
