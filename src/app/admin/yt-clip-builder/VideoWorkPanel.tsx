"use client";

/**
 * 한 치지직 영상에 대한 작업 패널: 유튜브 매핑 → 앵커 보정 → 곡 매칭 → 클립 생성.
 * 모든 편집은 상위로 onChange 콜백을 통해 progress(로컬 파일)에 반영된다.
 */

import { useMemo, useRef, useState } from "react";
import CalibrationPlayer, { type CalibrationPlayerHandle } from "./CalibrationPlayer";
import CreatedClipsReview from "@/app/admin/tabs/clip-workflow/CreatedClipsReview";
import { toYtTime, upsertAnchor, removeAnchor, isAnchored, type Anchor } from "@/shared/utils/clip-anchors";
import { matchSongs } from "@/shared/utils/song-match";
import type { WorksetVideo, WorksetTimeline, WorksetSong, WorksetYoutube, VideoProgress } from "./types";

function fmt(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, "0");
  if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${sec}`;
  return `${m}:${sec}`;
}

interface Props {
  video: WorksetVideo;
  timelines: WorksetTimeline[]; // 이 영상 것, chzzkTime 오름차순
  songs: WorksetSong[];
  songsById: Map<string, WorksetSong>;
  youtubeCandidates: WorksetYoutube[];
  comments: { author: string; publishedAt: string; content: string }[];
  progress: VideoProgress;
  onChange: (partial: VideoProgress) => void;
  onGenerate: () => Promise<void>;
  generating: boolean;
  result: string | null;
}

export default function VideoWorkPanel({
  video, timelines, songs, songsById, youtubeCandidates, comments, progress, onChange, onGenerate, generating, result,
}: Props) {
  const playerRef = useRef<CalibrationPlayerHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(timelines[0]?.id ?? null);
  const [songQuery, setSongQuery] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const anchors: Anchor[] = progress.anchors ?? [];
  const matches = progress.matches ?? {};
  const excluded = new Set(progress.excluded ?? []);
  const youtubeVideoId = progress.youtubeVideoId;

  // 날짜 어긋남 보정: 제목날짜가 방송일 또는 방송일−1일인 유튜브 후보
  const candidates = useMemo(() => {
    const prevDay = (() => { const d = new Date(`${video.chzzkDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
    const wanted = new Set([video.chzzkDate, prevDay]);
    return youtubeCandidates
      .filter((y) => y.titleDate && wanted.has(y.titleDate))
      .sort((a, b) => (a.titleDate || "").localeCompare(b.titleDate || ""));
  }, [youtubeCandidates, video.chzzkDate]);

  const selected = timelines.find((t) => t.id === selectedId) || null;
  const effMatch = (t: WorksetTimeline) => matches[t.id] ?? t.matchedSongId;

  const setYoutube = (id: string | undefined) => onChange({ youtubeVideoId: id });
  const setAnchorAt = (chzzkTime: number, ytTime: number) =>
    onChange({ anchors: upsertAnchor(anchors, chzzkTime, ytTime) });
  const clearAnchorAt = (chzzkTime: number) =>
    onChange({ anchors: removeAnchor(anchors, chzzkTime) });
  const assignSong = (timelineId: string, songId: string) =>
    onChange({ matches: { ...matches, [timelineId]: songId } });
  const toggleExcluded = (id: string) => {
    const next = new Set(excluded);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange({ excluded: [...next] });
  };

  const selectTimeline = (t: WorksetTimeline) => {
    setSelectedId(t.id);
    setSongQuery("");
    // 앵커로 예측된 유튜브 시각이 있으면 그곳으로, 없으면(앵커 미설정) 원본 치지직 시각으로
    // 이동해 거기서부터 맞춰갈 수 있게 한다.
    const yt = toYtTime(t.chzzkTime, anchors);
    playerRef.current?.seekTo(yt != null ? yt : t.chzzkTime);
  };

  // 선택 타임라인의 곡 매칭 후보 (자동 + 검색)
  const suggestions = useMemo(() => {
    if (!selected) return [];
    const q = songQuery.trim();
    if (q) {
      const lower = q.toLowerCase();
      return songs
        .filter((s) => `${s.artist} ${s.title} ${s.artistAlias || ""} ${s.titleAlias || ""} ${(s.searchTags || []).join(" ")}`.toLowerCase().includes(lower))
        .slice(0, 8)
        .map((s) => ({ songId: s.id, title: s.title, artist: s.artist, confidence: 0 }));
    }
    return matchSongs(selected.artist, selected.songTitle, songs, { minConfidence: 0.5, limit: 6 });
  }, [selected, songQuery, songs]);

  // 클립화 가능 수: 매칭됨 ∧ 미제외 ∧ ytTime 계산됨
  const generatable = timelines.filter(
    (t) => effMatch(t) && !excluded.has(t.id) && toYtTime(t.chzzkTime, anchors) != null,
  ).length;

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div>
        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">
          {video.videoTitle}
        </h2>
        <p className="text-xs text-light-text/60 dark:text-dark-text/60">
          방송일 {video.chzzkDate} · 치지직 영상 {video.videoNo} · 타임라인 {timelines.length}개
        </p>
      </div>

      {/* 유튜브 매핑 */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 bg-white/40 dark:bg-gray-900/40">
        <span className="text-sm font-medium text-light-text dark:text-dark-text">유튜브 영상</span>
        <select
          value={youtubeVideoId || ""}
          onChange={(e) => setYoutube(e.target.value || undefined)}
          className="flex-1 min-w-[16rem] text-sm rounded-lg border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text px-2 py-1.5"
        >
          <option value="">— 선택 (자동 후보 {candidates.length}개) —</option>
          {candidates.map((c) => (
            <option key={c.videoId} value={c.videoId}>
              [{c.titleDate}] {c.title.slice(0, 50)}
            </option>
          ))}
          {/* 직접 입력한 ID가 후보에 없을 때도 유지 */}
          {youtubeVideoId && !candidates.some((c) => c.videoId === youtubeVideoId) && (
            <option value={youtubeVideoId}>{youtubeVideoId} (직접 입력)</option>
          )}
        </select>
        <input
          type="text"
          placeholder="또는 유튜브 URL/ID 붙여넣기"
          className="text-sm rounded-lg border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text px-2 py-1.5 w-56"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const v = (e.target as HTMLInputElement).value.trim();
            const m = v.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/) || v.match(/^([\w-]{11})$/);
            if (m) { setYoutube(m[1]); (e.target as HTMLInputElement).value = ""; }
          }}
        />
        <button
          onClick={() => onChange({ skipped: !progress.skipped })}
          className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
            progress.skipped
              ? "border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
              : "border-light-primary/20 dark:border-dark-primary/20 text-light-text/70 dark:text-dark-text/70"
          }`}
        >
          {progress.skipped ? "건너뜀" : "VOD 없음/건너뛰기"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[19rem_1fr] gap-4">
        {/* 좌(목록): 타임라인 — 좁게 */}
        <div className="border border-light-primary/20 dark:border-dark-primary/20 rounded-lg overflow-hidden flex flex-col lg:order-1 max-h-[78vh]">
          <div className="px-3 py-2 text-[11px] text-light-text/55 dark:text-dark-text/55 border-b border-light-primary/15 dark:border-dark-primary/15">
            행 클릭 = 선택 + 예측 위치로 이동 · 클립화 가능 {generatable}곡
          </div>
          <div className="overflow-y-auto">
            {timelines.map((t) => {
              const yt = toYtTime(t.chzzkTime, anchors);
              const match = effMatch(t);
              const isSel = t.id === selectedId;
              const isExcl = excluded.has(t.id);
              return (
                <div
                  key={t.id}
                  onClick={() => selectTimeline(t)}
                  className={`px-2.5 py-1.5 text-sm cursor-pointer border-b border-light-primary/10 dark:border-dark-primary/10 ${
                    isSel ? "bg-light-accent/10 dark:bg-dark-accent/10" : "hover:bg-light-primary/5 dark:hover:bg-dark-primary/5"
                  } ${isExcl ? "opacity-40" : ""}`}
                >
                  {/* 1줄: 치지직시각 ⚓ → 예측유튜브시각 + 상태/토글 */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-light-text/55 dark:text-dark-text/55 shrink-0">{fmt(t.chzzkTime)}</span>
                    {isAnchored(t.chzzkTime, anchors) && <span className="text-[10px] text-light-accent dark:text-dark-accent shrink-0" title="앵커">⚓</span>}
                    <span className="text-[10px] text-light-text/30 dark:text-dark-text/30 shrink-0">→</span>
                    <span className="font-mono text-[11px] text-light-accent/80 dark:text-dark-accent/80 shrink-0">{fmt(yt)}</span>
                    <span className="flex-1" />
                    {match ? (
                      <span className="text-[11px] text-green-600 dark:text-green-400 shrink-0" title={`${songsById.get(match)?.artist} - ${songsById.get(match)?.title}`}>✓곡</span>
                    ) : t.isRelevant ? (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 shrink-0">미매칭</span>
                    ) : (
                      <span className="text-[11px] text-light-text/30 dark:text-dark-text/30 shrink-0">비곡</span>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); toggleExcluded(t.id); }} className="text-[11px] text-light-text/40 dark:text-dark-text/40 hover:text-red-500 shrink-0" title={isExcl ? "포함" : "제외"}>{isExcl ? "↩" : "✕"}</button>
                    {isAnchored(t.chzzkTime, anchors) && (
                      <button onClick={(e) => { e.stopPropagation(); clearAnchorAt(t.chzzkTime); }} className="text-[11px] text-light-text/40 dark:text-dark-text/40 hover:text-amber-500 shrink-0" title="앵커 해제">⚓✕</button>
                    )}
                  </div>
                  {/* 2줄: 가수 - 곡명 */}
                  <div className="truncate text-light-text dark:text-dark-text leading-snug">{t.artist} - {t.songTitle}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 우(상세): 보정 플레이어 + 선택 타임라인 매칭 */}
        <div className="space-y-3 lg:order-2">
          {youtubeVideoId ? (
            <CalibrationPlayer
              ref={playerRef}
              videoId={youtubeVideoId}
              onSetAnchorAtCurrent={(ytTime) => { if (selected) setAnchorAt(selected.chzzkTime, ytTime); }}
            />
          ) : (
            <div className="aspect-video rounded-lg border border-dashed border-light-primary/30 dark:border-dark-primary/30 flex items-center justify-center text-sm text-light-text/50 dark:text-dark-text/50 text-center px-4">
              유튜브 영상을 매핑하면 보정 플레이어가 표시됩니다.<br />매핑 전에도 댓글·타임라인 확인과 곡 매칭은 가능합니다.
            </div>
          )}

          {selected && (
            <div className="p-3 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 bg-white/40 dark:bg-gray-900/40">
              <div className="text-sm text-light-text dark:text-dark-text">
                선택: <span className="font-mono">{fmt(selected.chzzkTime)}</span>{" "}
                <span className="font-medium">{selected.artist} - {selected.songTitle}</span>
              </div>
              <div className="text-xs text-light-text/60 dark:text-dark-text/60 mb-2">
                예측 유튜브 시각 {fmt(toYtTime(selected.chzzkTime, anchors))}
                {isAnchored(selected.chzzkTime, anchors) && <span className="ml-1 text-light-accent dark:text-dark-accent">· 앵커 설정됨</span>}
              </div>

              {/* 곡 매칭 */}
              {effMatch(selected) ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400">
                    ✓ {songsById.get(effMatch(selected)!)?.artist} - {songsById.get(effMatch(selected)!)?.title}
                  </span>
                  <button onClick={() => assignSong(selected.id, "")} className="text-xs text-light-text/50 dark:text-dark-text/50 hover:underline">변경</button>
                </div>
              ) : (
                <div>
                  <input
                    value={songQuery}
                    onChange={(e) => setSongQuery(e.target.value)}
                    placeholder="곡 검색 (비우면 자동 추천)"
                    className="w-full text-sm rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text px-2 py-1 mb-1.5"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.length === 0 && <span className="text-xs text-light-text/50 dark:text-dark-text/50">후보 없음</span>}
                    {suggestions.map((s) => (
                      <button
                        key={s.songId}
                        onClick={() => assignSong(selected.id, s.songId)}
                        className="text-xs px-2 py-1 rounded border border-light-primary/20 dark:border-dark-primary/20 hover:border-light-accent dark:hover:border-dark-accent text-light-text/80 dark:text-dark-text/80"
                        title={s.confidence ? `신뢰도 ${(s.confidence * 100).toFixed(0)}%` : undefined}
                      >
                        {s.artist} - {s.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 생성 */}
      <div className="flex items-center gap-3">
        <button
          onClick={onGenerate}
          disabled={generating || generatable === 0 || !youtubeVideoId}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple text-white font-medium hover:shadow-lg disabled:opacity-50 transition-all"
        >
          {generating ? "생성 중..." : `클립 생성 (${generatable}곡)`}
        </button>
        {youtubeVideoId && (progress.done || result) && (
          <button onClick={() => setShowReview(true)} className="px-3 py-2 text-sm rounded-lg border border-light-primary/20 dark:border-dark-primary/20 text-light-text/70 dark:text-dark-text/70 hover:border-light-accent/40">
            생성된 클립 보기
          </button>
        )}
        {progress.done && <span className="text-sm text-green-600 dark:text-green-400">완료됨</span>}
        {result && <span className="text-sm text-light-text/70 dark:text-dark-text/70">{result}</span>}
      </div>

      {/* 원본 타임라인 댓글 (맨 아래, 기본 닫힘) */}
      <div className="rounded-lg border border-light-primary/20 dark:border-dark-primary/20 bg-white/40 dark:bg-gray-900/40">
        <button
          onClick={() => setShowComments((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-light-text dark:text-dark-text"
        >
          <span>원본 타임라인 댓글 ({comments.length})</span>
          <span className="text-light-text/50 dark:text-dark-text/50">{showComments ? "▲" : "▼"}</span>
        </button>
        {showComments && (
          <div className="px-3 pb-3 space-y-3 max-h-72 overflow-y-auto">
            {comments.length === 0 && (
              <p className="text-xs text-light-text/50 dark:text-dark-text/50">댓글이 없습니다.</p>
            )}
            {comments.map((c, i) => (
              <div key={i}>
                <div className="text-xs text-light-text/60 dark:text-dark-text/60 mb-1">
                  {c.author} · {c.publishedAt ? new Date(c.publishedAt).toLocaleString("ko-KR") : ""}
                </div>
                <pre className="text-xs text-light-text/80 dark:text-dark-text/80 whitespace-pre-wrap font-sans leading-relaxed">{c.content}</pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {showReview && youtubeVideoId && (
        <CreatedClipsReview
          query={`videoId=${encodeURIComponent(youtubeVideoId)}`}
          title={`${video.videoTitle} — 생성된 클립`}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  );
}
