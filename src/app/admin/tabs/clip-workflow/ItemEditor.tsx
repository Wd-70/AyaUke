"use client";

/**
 * 단일 타임라인 항목 편집 알맹이 (영상 단위·곡 단위 패널 공유).
 * 전체 영상 플레이어 + ClipTimeEditor(시간 미세조정) + 곡 매칭/검색 + 메모 + 원본 줄.
 * 변경은 onPatch(id, body, optimistic)로 상위에 위임(ParsedTimeline에 반영).
 */

import { useEffect, useMemo, useState } from "react";
import type { EditPlayerAdapter } from "@/app/admin/tabs/live-clips/clip-types";
import ClipTimeEditor from "@/app/admin/tabs/live-clips/ClipTimeEditor";
import EditPlayer from "./EditPlayer";
import { fmt, assignOptimistic, songSuggestions } from "./itemUtils";
import type { WorkflowItem, WorkflowSong } from "./types";

interface Props {
  item: WorkflowItem;
  songs: WorkflowSong[];
  songsById: Map<string, WorkflowSong>;
  originalLine?: string | null;
  onPatch: (id: string, body: Record<string, unknown>, optimistic?: Partial<WorkflowItem>) => void;
}

export default function ItemEditor({ item, songs, songsById, originalLine, onPatch }: Props) {
  const [adapter, setAdapter] = useState<EditPlayerAdapter | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [songQuery, setSongQuery] = useState("");

  // 항목이 바뀌면 검색어 초기화 + 그 시작점으로 시킹
  useEffect(() => { setSongQuery(""); }, [item.id]);
  // adapter도 의존: 다른 영상으로 바뀌면 EditPlayer가 remount돼 어댑터가 새로 생기는데,
  // 그때 정확한 시작시각으로 seek한다. (옛 어댑터 호출은 EditPlayer가 안전하게 무시)
  useEffect(() => {
    if (adapter) adapter.seekTo(item.startTimeSeconds);
  }, [item.id, adapter]); // eslint-disable-line react-hooks/exhaustive-deps

  const matchedSong = item.matchedSongId ? songsById.get(item.matchedSongId) : undefined;

  const assign = (songId: string | null) => {
    const song = songId ? songsById.get(songId) ?? null : null;
    onPatch(item.id, { matchedSongId: songId }, assignOptimistic(item, song));
  };

  const suggestions = useMemo(
    () => songSuggestions(item.artist, item.songTitle, songQuery, songs),
    [item.artist, item.songTitle, songQuery, songs],
  );

  return (
    <div className="space-y-3">
      <EditPlayer
        key={`${item.platform}-${item.videoId}`}
        platform={item.platform}
        videoId={item.videoId}
        videoUrl={item.videoUrl}
        startTime={item.startTimeSeconds}
        onAdapter={setAdapter}
        onTimeUpdate={setCurrentTime}
        onPlayStateChange={setIsPlaying}
        className="max-w-2xl"
      />

      <div className="text-sm text-light-text dark:text-dark-text">
        선택: <span className="font-mono">{fmt(item.startTimeSeconds)}</span>{" "}
        <span className="font-medium">{item.artist} - {item.songTitle}</span>
        {item.isExcluded && <span className="ml-2 text-xs text-red-500">제외됨</span>}
      </div>
      {originalLine && (
        <div className="text-xs text-light-text/60 dark:text-dark-text/60 rounded bg-light-primary/5 dark:bg-dark-primary/10 px-2 py-1 break-words">
          원본 줄: <span className="text-light-text/80 dark:text-dark-text/80">{originalLine}</span>
        </div>
      )}

      <ClipTimeEditor
        startTime={item.startTimeSeconds}
        endTime={item.endTimeSeconds}
        adapter={adapter}
        currentTime={currentTime}
        isPlaying={isPlaying}
        songClipDuration={matchedSong?.clipDuration ?? null}
        onChange={(patch) => {
          const start = patch.startTime ?? item.startTimeSeconds;
          const end = patch.endTime !== undefined ? patch.endTime : item.endTimeSeconds ?? null;
          onPatch(item.id, { startTimeSeconds: start, endTimeSeconds: end }, { startTimeSeconds: start, endTimeSeconds: end });
        }}
      />

      {/* 곡 매칭 + 메모 */}
      <div className="rounded-lg border border-light-primary/20 dark:border-dark-primary/20 p-3">
        {matchedSong ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400">✓ {matchedSong.artist} - {matchedSong.title}</span>
            <button onClick={() => assign(null)} className="text-xs text-light-text/50 hover:underline">매칭 해제</button>
          </div>
        ) : (
          <>
            <input value={songQuery} onChange={(e) => setSongQuery(e.target.value)} placeholder="곡 검색 (제목/가수/태그, 비우면 자동 추천)" className="w-full text-sm rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text px-2 py-1 mb-1.5" />
            <div className="flex flex-wrap gap-1.5">
              {suggestions.length === 0 && <span className="text-xs text-light-text/50">후보 없음</span>}
              {suggestions.map((s) => (
                <button key={s.songId} onClick={() => assign(s.songId)} className="text-xs px-2 py-1 rounded border border-light-primary/20 dark:border-dark-primary/20 hover:border-light-accent text-light-text/80 dark:text-dark-text/80" title={s.confidence ? `신뢰도 ${(s.confidence * 100).toFixed(0)}%` : undefined}>
                  {s.artist} - {s.title}
                </button>
              ))}
            </div>
          </>
        )}
        <input
          key={`memo-${item.id}`}
          defaultValue={item.customDescription || ""}
          onBlur={(e) => { const v = e.target.value.trim(); onPatch(item.id, { customDescription: v }, { customDescription: v || undefined }); }}
          placeholder={`${item.commentAuthor}님의 댓글로부터 생성되었습니다 (메모 직접 입력 가능)`}
          className="w-full mt-2 text-xs rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text px-2 py-1"
        />
      </div>
    </div>
  );
}
