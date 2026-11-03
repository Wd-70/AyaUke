"use client";

/**
 * 단일 타임라인 항목 편집 알맹이 (영상 단위·곡 단위 패널 공유).
 * 전체 영상 플레이어 + ClipTimeEditor(시간 미세조정) + 곡 매칭/검색 + 메모 + 원본 줄.
 * 변경은 onPatch(id, body, optimistic)로 상위에 위임(ParsedTimeline에 반영).
 */

import { forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useWorkspace } from './WorkflowWorkspace';
import { SongDurationContext } from './SongDurationContext';
import { workflowRequest } from './workflow-client';
import type { EditPlayerAdapter } from "@/app/admin/tabs/live-clips/clip-types";
import ClipTimeEditor from "@/app/admin/tabs/live-clips/ClipTimeEditor";
import ClipVerifyButton from "@/app/admin/tabs/live-clips/ClipVerifyButton";
import EditPlayer from "./EditPlayer";
import AiTimingBadge from './AiTimingBadge';
import { fmt, assignOptimistic, songSuggestions } from "./itemUtils";
import type { WorkflowItem, WorkflowSong } from "./types";

interface Props {
  item: WorkflowItem;
  songs: WorkflowSong[];
  songsById: Map<string, WorkflowSong>;
  originalLine?: string | null;
  onPatch: (id: string, body: Record<string, unknown>, optimistic?: Partial<WorkflowItem>) => void | Promise<void>;
  active?: boolean;
}

export interface ItemEditorHandle { prepareToLeave: () => Promise<boolean>; }

const ItemEditor = forwardRef<ItemEditorHandle, Props>(function ItemEditor({ item, songs, songsById, originalLine, onPatch, active = true }, ref) {
  const mobile = useWorkspace()?.mobile ?? false;
  const [adapter, setAdapter] = useState<EditPlayerAdapter | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [songQuery, setSongQuery] = useState("");
  const [savingDefault, setSavingDefault] = useState(false);
  const onSongDurationSaved = useContext(SongDurationContext);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState('저장됨');
  const pending = useRef(new Set<Promise<void>>());
  const failed = useRef(new Map<string, () => void | Promise<void>>());
  const saveVersions = useRef(new Map<string, symbol>());
  const trackSave = (key: string, operation: () => void | Promise<void>) => {
    const version = Symbol(key);
    saveVersions.current.set(key, version);
    setSaveStatus('저장 중');
    setSaveError(null);
    failed.current.delete(key);
    const task = Promise.resolve().then(operation).then(() => {
      if (saveVersions.current.get(key) === version) failed.current.delete(key);
    }).catch((error) => {
      if (saveVersions.current.get(key) !== version) return;
      failed.current.set(key, operation);
      setSaveError(error instanceof Error ? error.message : '저장 실패');
    }).finally(() => {
      pending.current.delete(task);
      setSaveStatus(failed.current.size ? '저장 실패' : pending.current.size ? '저장 중' : '저장됨');
    });
    pending.current.add(task);
  };
  const savePatch = (body: Record<string, unknown>, optimistic?: Partial<WorkflowItem>) => {
    trackSave(`${item.id}:${Object.keys(body).sort().join(',')}`, () => onPatch(item.id, body, optimistic));
  };
  useImperativeHandle(ref, () => ({ prepareToLeave: async () => {
    await Promise.resolve();
    while (pending.current.size) await Promise.all([...pending.current]);
    return failed.current.size === 0;
  } }));
  useEffect(() => { if (!active) adapter?.pause(); }, [active, adapter]);
  useEffect(() => { setSaveError(null); setSaveStatus('저장됨'); }, [item.id]);

  // 항목이 바뀌면 검색어 초기화 + 그 시작점으로 시킹
  useEffect(() => { setSongQuery(""); }, [item.id]);
  // adapter도 의존: 다른 영상으로 바뀌면 EditPlayer가 remount돼 어댑터가 새로 생기는데,
  // 그때 정확한 시작시각으로 seek한다. (옛 어댑터 호출은 EditPlayer가 안전하게 무시)
  useEffect(() => {
    if (adapter) adapter.seekTo(item.startTimeSeconds);
  }, [item.id, adapter]); // eslint-disable-line react-hooks/exhaustive-deps

  const matchedSong = item.matchedSongId ? songsById.get(item.matchedSongId) : undefined;
  const effectiveClipDuration = matchedSong?.clipDuration ?? null;

  const assign = (songId: string | null) => {
    const song = songId ? songsById.get(songId) ?? null : null;
    savePatch({ matchedSongId: songId }, assignOptimistic(item, song));
  };

  // #1 이 길이를 곡 기본값으로 — 매칭된 곡(SongDetail)의 clipDuration 저장.
  const setDefaultDuration = async (duration: number) => {
    if (!matchedSong) return;
    setSavingDefault(true);
    try {
      await workflowRequest(`/api/songdetails/${matchedSong.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipDuration: duration }),
      });
      onSongDurationSaved(matchedSong.id, duration);
    } finally {
      setSavingDefault(false);
    }
  };

  const suggestions = useMemo(
    () => songSuggestions(item.artist, item.songTitle, songQuery, songs),
    [item.artist, item.songTitle, songQuery, songs],
  );

  return (
    <div className="space-y-3">
      <div role="status" aria-live="polite" className="text-sm text-light-text dark:text-dark-text">{saveStatus}</div>
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
      {originalLine && !mobile && (
        <div className="text-xs text-light-text/60 dark:text-dark-text/60 rounded bg-light-primary/5 dark:bg-dark-primary/10 px-2 py-1 break-words">
          원본 줄: <span className="text-light-text/80 dark:text-dark-text/80">{originalLine}</span>
        </div>
      )}

      {/* 검증: 항목을 검증 상태로 두면 클립 생성 시 검증된 클립으로 만들어짐 */}
      <div className="flex items-center gap-2 flex-wrap">
        <AiTimingBadge item={item} detail />
        <ClipVerifyButton
          verified={item.isTimeVerified}
          onToggle={() => savePatch({ isTimeVerified: !item.isTimeVerified }, { isTimeVerified: !item.isTimeVerified })}
          size="sm"
          className="min-h-11 lg:min-h-0"
        />
        <span className="text-xs text-light-text/50 dark:text-dark-text/50">
          검증 상태로 두면 클립 생성 시 검증된 클립으로 만들어집니다.
        </span>
      </div>

      <ClipTimeEditor
        mobileControls={mobile}
        startTime={item.startTimeSeconds}
        endTime={item.endTimeSeconds}
        adapter={adapter}
        currentTime={currentTime}
        isPlaying={isPlaying}
        songClipDuration={effectiveClipDuration}
        onSetDefaultDuration={matchedSong ? (duration) => trackSave(`${item.id}:default`, () => setDefaultDuration(duration)) : undefined}
        savingDefault={savingDefault}
        onChange={(patch) => {
          const start = patch.startTime ?? item.startTimeSeconds;
          const end = patch.endTime !== undefined ? patch.endTime : item.endTimeSeconds ?? null;
          savePatch({ startTimeSeconds: start, endTimeSeconds: end }, { startTimeSeconds: start, endTimeSeconds: end });
        }}
      />

      {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
      {saveError && <button type="button" onClick={() => { for (const [key, operation] of [...failed.current]) trackSave(key, operation); }} className="min-h-11 px-3 text-sm text-light-text dark:text-dark-text">저장 다시 시도</button>}
      {/* 곡 매칭 + 메모 */}
      <details open={!mobile || !matchedSong}>
      <summary className="lg:hidden min-h-11 cursor-pointer text-sm text-light-text dark:text-dark-text">곡 매칭 · 메모 · 원본 내용</summary>
      {mobile && originalLine && <p className="py-2 text-sm break-words text-light-text dark:text-dark-text">원본 줄: {originalLine}</p>}
      <div className="rounded-lg border border-light-primary/20 dark:border-dark-primary/20 p-3">
        {matchedSong ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 max-w-full break-words px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400">✓ {matchedSong.artist} - {matchedSong.title}</span>
            <button onClick={() => assign(null)} className="min-h-11 lg:min-h-0 text-xs text-light-text/50 hover:underline">매칭 해제</button>
          </div>
        ) : (
          <>
            <input value={songQuery} onChange={(e) => setSongQuery(e.target.value)} placeholder="곡 검색 (제목/가수/태그, 비우면 자동 추천)" className="min-h-11 lg:min-h-0 w-full text-base lg:text-sm rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text px-2 py-1 mb-1.5" />
            <div className="flex flex-wrap gap-1.5">
              {suggestions.length === 0 && <span className="text-xs text-light-text/50">후보 없음</span>}
              {suggestions.map((s) => (
                <button key={s.songId} onClick={() => assign(s.songId)} className="min-h-11 lg:min-h-0 text-xs px-2 py-1 rounded border border-light-primary/20 dark:border-dark-primary/20 hover:border-light-accent text-light-text/80 dark:text-dark-text/80" title={s.confidence ? `신뢰도 ${(s.confidence * 100).toFixed(0)}%` : undefined}>
                  {s.artist} - {s.title}
                </button>
              ))}
            </div>
          </>
        )}
        <input
          key={`memo-${item.id}`}
          defaultValue={item.customDescription || ""}
          onBlur={(e) => { const v = e.target.value.trim(); if (v !== (item.customDescription || '')) savePatch({ customDescription: v }, { customDescription: v || undefined }); }}
          placeholder={`${item.commentAuthor}님의 댓글로부터 생성되었습니다 (메모 직접 입력 가능)`}
          className="min-h-11 lg:min-h-0 w-full mt-2 text-base lg:text-xs rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text px-2 py-1"
        />
        {mobile && <div className="mt-3 space-y-2">
          <label className="block text-sm text-light-text dark:text-dark-text">파싱된 가수
            <input key={`artist-${item.id}`} defaultValue={item.artist} onBlur={(event) => { const value = event.target.value.trim(); if (value !== item.artist) savePatch({ artist: value }, { artist: value }); }} className="min-h-11 mt-1 w-full rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 px-2 text-base" />
          </label>
          <label className="block text-sm text-light-text dark:text-dark-text">파싱된 곡명
            <input key={`title-${item.id}`} defaultValue={item.songTitle} onBlur={(event) => { const value = event.target.value.trim(); if (value !== item.songTitle) savePatch({ songTitle: value }, { songTitle: value }); }} className="min-h-11 mt-1 w-full rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 px-2 text-base" />
          </label>
          <button type="button" className="min-h-11 text-sm text-light-text dark:text-dark-text" onClick={() => savePatch({ isExcluded: !item.isExcluded }, { isExcluded: !item.isExcluded })}>{item.isExcluded ? '클립 생성에 포함' : '클립 생성에서 제외'}</button>
        </div>}
      </div>
      </details>
    </div>
  );
});

export default ItemEditor;
