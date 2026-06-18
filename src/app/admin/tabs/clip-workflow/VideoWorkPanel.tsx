"use client";

/**
 * 한 영상의 클립 만들기 작업 패널 (치지직/유튜브 공통).
 * 댓글 확인 → 파싱 → 곡 매칭(자동/수동) → 시간 미세조정 → 클립 생성.
 * 항목 변경은 ParsedTimeline(DB)에 바로 반영(레거시 타임라인 파싱 탭과 일관).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchSongs } from "@/shared/utils/song-match";
import ItemEditor from "./ItemEditor";
import CreatedClipsReview from "./CreatedClipsReview";
import { fmt, assignOptimistic } from "./itemUtils";
import type { Platform, WorkflowVideo, WorkflowItem, WorkflowSong, WorkflowComment } from "./types";

interface Props {
  platform: Platform;
  video: WorkflowVideo;
  songs: WorkflowSong[];
  songsById: Map<string, WorkflowSong>;
  onStatusRefresh: () => void;
}

export default function VideoWorkPanel({ platform, video, songs, songsById, onStatusRefresh }: Props) {
  const [comments, setComments] = useState<WorkflowComment[]>([]);
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [existingClips, setExistingClips] = useState<{ songId: string; startTime: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const autoMatchedRef = useRef<Set<string>>(new Set()); // 영상별 자동매칭 1회 가드

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clip-workflow/video?platform=${platform}&videoId=${encodeURIComponent(video.videoId)}`).then((r) => r.json());
      if (res.success) {
        setComments(res.data.comments);
        setItems(res.data.items);
        setExistingClips(res.data.existingClips || []);
        setSelectedId(res.data.items[0]?.id ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [platform, video.videoId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  // 항목 단건 PATCH + 로컬 반영
  const patchItem = useCallback(async (id: string, body: Record<string, unknown>, optimistic?: Partial<WorkflowItem>) => {
    if (optimistic) setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...optimistic } : it)));
    await fetch(`/api/admin/clip-workflow/item/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, []);

  const assignSong = useCallback((id: string, songId: string | null) => {
    const item = items.find((it) => it.id === id);
    if (!item) return;
    const song = songId ? songsById.get(songId) ?? null : null;
    patchItem(id, { matchedSongId: songId }, assignOptimistic(item, song));
  }, [patchItem, songsById, items]);

  // ── 자동 매칭 (영상 로드 후 1회, 고신뢰도만) ──
  useEffect(() => {
    if (loading || items.length === 0 || songs.length === 0) return;
    if (autoMatchedRef.current.has(video.videoId)) return;
    autoMatchedRef.current.add(video.videoId);

    const toAssign: { id: string; songId: string }[] = [];
    for (const it of items) {
      if (it.matchedSongId || it.isExcluded || !it.isRelevant) continue;
      const best = matchSongs(it.artist, it.songTitle, songs, { minConfidence: 0.85, limit: 1 })[0];
      if (best) toAssign.push({ id: it.id, songId: best.songId });
    }
    if (toAssign.length === 0) return;
    // 로컬 즉시 반영 + 서버 반영
    for (const a of toAssign) assignSong(a.id, a.songId);
    setResult(`자동 매칭 ${toAssign.length}곡`);
  }, [loading, items, songs, video.videoId, assignSong]);

  const selected = items.find((it) => it.id === selectedId) || null;

  const parse = async () => {
    setParsing(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/clip-workflow/parse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, videoId: video.videoId }),
      }).then((r) => r.json());
      if (res.success) {
        autoMatchedRef.current.delete(video.videoId); // 재파싱 후 자동매칭 다시 허용
        await loadDetail();
        onStatusRefresh();
        setResult(`파싱: 새 항목 ${res.data.createdItems}개 (중복 ${res.data.skippedExisting})`);
      } else setResult(res.error?.message || "파싱 실패");
    } finally {
      setParsing(false);
    }
  };


  // 항목별 클립 생성 여부: 같은 곡 + 시작시각 ±30초(bulk 중복 기준) 클립이 있으면 생성됨
  const clippedItemIds = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (!it.matchedSongId) continue;
      const has = existingClips.some(
        (c) => c.songId === it.matchedSongId && Math.abs(c.startTime - it.startTimeSeconds) <= 30,
      );
      if (has) set.add(it.id);
    }
    return set;
  }, [items, existingClips]);

  // 원본 댓글에서 시작시각 → 그 줄(이모지 마커 포함) 매핑 — 제외 곡 검증용
  const originalLineByTime = useMemo(() => {
    const toSec = (t: string) => { const p = t.split(":").map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; };
    const map = new Map<number, string>();
    for (const c of comments) {
      for (const line of c.content.split("\n")) {
        const m = line.match(/^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s/);
        if (!m) continue;
        const sec = toSec(m[1]);
        if (!map.has(sec)) map.set(sec, line.trim());
      }
    }
    return map;
  }, [comments]);

  const originalLine = (start: number): string | null => {
    if (originalLineByTime.has(start)) return originalLineByTime.get(start)!;
    for (let d = 1; d <= 2; d++) {
      if (originalLineByTime.has(start - d)) return originalLineByTime.get(start - d)!;
      if (originalLineByTime.has(start + d)) return originalLineByTime.get(start + d)!;
    }
    return null;
  };

  const stats = useMemo(() => {
    const relevant = items.filter((i) => i.isRelevant && !i.isExcluded).length;
    const matched = items.filter((i) => i.matchedSongId).length;
    const verified = items.filter((i) => i.isTimeVerified).length;
    const generatable = items.filter((i) => i.matchedSongId && !i.isExcluded).length;
    return { relevant, matched, verified, generatable };
  }, [items]);

  const createClips = async () => {
    const targets = items.filter((i) => i.matchedSongId && !i.isExcluded);
    if (targets.length === 0) { setResult("생성할 클립이 없습니다."); return; }
    const clips = targets.map((it) => ({
      songId: it.matchedSongId!,
      videoUrl: it.videoUrl,
      sungDate: video.date,
      startTime: Math.round(it.startTimeSeconds),
      endTime: it.endTimeSeconds != null ? Math.round(it.endTimeSeconds) : undefined,
      description: it.customDescription || `${it.commentAuthor}님의 댓글로부터 생성되었습니다`,
    }));
    setCreating(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/clips/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clips }),
      }).then((r) => r.json());
      const r = res.results || {};
      setResult(`생성 성공 ${r.success ?? 0} · 중복 ${r.duplicates ?? 0} · 실패 ${r.failed ?? 0}`);
      onStatusRefresh();
    } catch {
      setResult("생성 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 + 통계 + 파싱 */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-light-text dark:text-dark-text">{video.title}</h2>
          <p className="text-xs text-light-text/60 dark:text-dark-text/60">
            {video.date} · {platform === "chzzk" ? `치지직 ${video.videoId}` : `유튜브 ${video.videoId}`} · 댓글 {video.timelineCommentCount}
          </p>
          <p className="text-xs text-light-text/70 dark:text-dark-text/70 mt-1">
            파싱 {items.length} · 관련 {stats.relevant} · 매칭 {stats.matched} · 검증 {stats.verified} · 생성가능 {stats.generatable} · 기존클립 {video.clipCount}
          </p>
        </div>
        <button
          onClick={parse}
          disabled={parsing}
          className="text-sm px-3 py-1.5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 text-light-text/70 dark:text-dark-text/70 hover:border-light-accent/40 disabled:opacity-50"
        >
          {parsing ? "파싱 중..." : items.length ? "다시 파싱" : "댓글 파싱"}
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-light-text/50">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-sm text-light-text/50">파싱된 타임라인이 없습니다. &lsquo;댓글 파싱&rsquo;을 눌러주세요.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[19rem_1fr] gap-4">
          {/* 우(시각): 플레이어 + 시간편집 + 선택 매칭 (공용 ItemEditor) */}
          <div className="lg:order-2">
            {selected ? (
              <ItemEditor
                item={selected}
                songs={songs}
                songsById={songsById}
                originalLine={originalLine(selected.startTimeSeconds)}
                onPatch={patchItem}
              />
            ) : (
              <p className="text-sm text-light-text/50 p-8 text-center">항목을 선택하세요.</p>
            )}
          </div>

          {/* 좌(목록): 타임라인 — 좁게 */}
          <div className="border border-light-primary/20 dark:border-dark-primary/20 rounded-lg overflow-hidden flex flex-col lg:order-1 max-h-[78vh]">
            <div className="overflow-y-auto">
              {items.map((it) => {
                const isSel = it.id === selectedId;
                const m = it.matchedSongId ? songsById.get(it.matchedSongId) : undefined;
                const clipped = clippedItemIds.has(it.id);
                return (
                  <div key={it.id} onClick={() => setSelectedId(it.id)} className={`px-2.5 py-1.5 text-sm cursor-pointer border-b border-light-primary/10 dark:border-dark-primary/10 ${isSel ? "bg-light-accent/10 dark:bg-dark-accent/10" : "hover:bg-light-primary/5 dark:hover:bg-dark-primary/5"} ${it.isExcluded ? "opacity-40" : ""}`}>
                    {/* 1줄: 시간 + 상태 뱃지/토글 */}
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-light-text/55 dark:text-dark-text/55 shrink-0">{fmt(it.startTimeSeconds)}~{fmt(it.endTimeSeconds)}</span>
                      {clipped && <span className="text-[10px] px-1 rounded bg-green-500/15 text-green-600 dark:text-green-400 shrink-0" title="이 타임라인으로 생성된 클립이 있음">클립됨</span>}
                      <span className="flex-1" />
                      {m ? <span className="text-[11px] text-green-600 dark:text-green-400 shrink-0" title={`${m.artist} - ${m.title}`}>✓곡</span>
                        : it.isRelevant ? <span className="text-[11px] text-amber-600 dark:text-amber-400 shrink-0">미매칭</span>
                        : <span className="text-[11px] text-light-text/30 shrink-0">비곡</span>}
                      <button onClick={(e) => { e.stopPropagation(); patchItem(it.id, { isTimeVerified: !it.isTimeVerified }, { isTimeVerified: !it.isTimeVerified }); }} className={`text-[11px] shrink-0 ${it.isTimeVerified ? "text-blue-500" : "text-light-text/30 hover:text-blue-500"}`} title="시간 검증 토글">✔</button>
                      <button onClick={(e) => { e.stopPropagation(); patchItem(it.id, { isExcluded: !it.isExcluded }, { isExcluded: !it.isExcluded }); }} className="text-[11px] text-light-text/40 hover:text-red-500 shrink-0" title={it.isExcluded ? "포함" : "제외"}>{it.isExcluded ? "↩" : "✕"}</button>
                    </div>
                    {/* 2줄: 가수 - 곡명 */}
                    <div className="truncate text-light-text dark:text-dark-text leading-snug">{it.artist} - {it.songTitle}</div>
                    {isSel && (
                      <div className="flex gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                        <input defaultValue={it.artist} onBlur={(e) => { const v = e.target.value.trim(); if (v !== it.artist) patchItem(it.id, { artist: v }, { artist: v }); }} className="flex-1 min-w-0 text-xs rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 px-1.5 py-0.5" placeholder="가수" />
                        <input defaultValue={it.songTitle} onBlur={(e) => { const v = e.target.value.trim(); if (v !== it.songTitle) patchItem(it.id, { songTitle: v }, { songTitle: v }); }} className="flex-1 min-w-0 text-xs rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 px-1.5 py-0.5" placeholder="곡명" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 생성 */}
      <div className="flex items-center gap-3">
        <button onClick={createClips} disabled={creating || stats.generatable === 0} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple text-white font-medium hover:shadow-lg disabled:opacity-50 transition-all">
          {creating ? "생성 중..." : `클립 생성 (${stats.generatable}곡)`}
        </button>
        {video.clipCount > 0 && (
          <button onClick={() => setShowReview(true)} className="px-3 py-2 text-sm rounded-lg border border-light-primary/20 dark:border-dark-primary/20 text-light-text/70 dark:text-dark-text/70 hover:border-light-accent/40">
            생성된 클립 보기 ({video.clipCount})
          </button>
        )}
        {result && <span className="text-sm text-light-text/70 dark:text-dark-text/70">{result}</span>}
      </div>

      {showReview && (
        <CreatedClipsReview
          query={`videoId=${encodeURIComponent(video.videoId)}`}
          title={`${video.title} — 생성된 클립`}
          onClose={() => setShowReview(false)}
          onChanged={onStatusRefresh}
        />
      )}

      {/* 원본 타임라인 댓글 (맨 아래, 기본 닫힘) */}
      <div className="rounded-lg border border-light-primary/20 dark:border-dark-primary/20 bg-white/40 dark:bg-gray-900/40">
        <button onClick={() => setShowComments((v) => !v)} className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-light-text dark:text-dark-text">
          <span>원본 타임라인 댓글 ({comments.length})</span>
          <span className="text-light-text/50">{showComments ? "▲" : "▼"}</span>
        </button>
        {showComments && (
          <div className="px-3 pb-3 space-y-3 max-h-72 overflow-y-auto">
            {comments.length === 0 && <p className="text-xs text-light-text/50">댓글이 없습니다.</p>}
            {comments.map((c, i) => (
              <div key={i}>
                <div className="text-xs text-light-text/60 dark:text-dark-text/60 mb-1">{c.author} · {c.publishedAt ? new Date(c.publishedAt).toLocaleString("ko-KR") : ""}</div>
                <pre className="text-xs text-light-text/80 dark:text-dark-text/80 whitespace-pre-wrap font-sans leading-relaxed">{c.content}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
