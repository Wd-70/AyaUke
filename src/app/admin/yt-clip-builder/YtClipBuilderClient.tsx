"use client";

/**
 * 치지직 댓글 → 유튜브 클립 생성 도구 (일회성, 로컬 파일 작업).
 * workset.json(원본)·progress.json(진행상태)을 서버 API로 읽고/쓰며,
 * DB 반영은 마지막 "클립 생성"(기존 bulk 라우트)뿐.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VideoWorkPanel from "./VideoWorkPanel";
import { toYtTime } from "@/shared/utils/clip-anchors";
import type { Workset, ProgressFile, VideoProgress, WorksetTimeline, WorksetSong } from "./types";

export default function YtClipBuilderClient() {
  const [workset, setWorkset] = useState<Workset | null>(null);
  const [progress, setProgress] = useState<ProgressFile>({});
  const [isLocal, setIsLocal] = useState(true);
  const [needsExport, setNeedsExport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedVideoNo, setSelectedVideoNo] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 로드 ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wsRes, pgRes] = await Promise.all([
        fetch("/api/admin/yt-clip-builder/workset").then((r) => r.json()),
        fetch("/api/admin/yt-clip-builder/progress").then((r) => r.json()),
      ]);
      if (wsRes.success) {
        setIsLocal(wsRes.data.isLocal);
        setNeedsExport(wsRes.data.needsExport);
        setWorkset(wsRes.data.workset);
      }
      if (pgRes.success) setProgress(pgRes.data.progress || {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const [exportError, setExportError] = useState<string | null>(null);
  const doExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/admin/yt-clip-builder/export", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        await load();
      } else {
        setExportError(json?.error?.message || json?.error || `추출 실패 (HTTP ${res.status})`);
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "추출 요청 중 오류");
    } finally {
      setExporting(false);
    }
  };

  // ── 진행상태 저장 (디바운스) ──
  const persist = useCallback((next: ProgressFile) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/admin/yt-clip-builder/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: next }),
      }).catch(() => {});
    }, 700);
  }, []);

  const updateVideo = useCallback((videoNo: number, partial: VideoProgress) => {
    setProgress((prev) => {
      const next = { ...prev, [videoNo]: { ...prev[videoNo], ...partial } };
      persist(next);
      return next;
    });
  }, [persist]);

  // ── 파생 데이터 ──
  const timelinesByVideo = useMemo(() => {
    const map = new Map<number, WorksetTimeline[]>();
    for (const t of workset?.timelines ?? []) {
      const arr = map.get(t.videoNo) ?? [];
      arr.push(t);
      map.set(t.videoNo, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.chzzkTime - b.chzzkTime);
    return map;
  }, [workset]);

  const songsById = useMemo(() => {
    const m = new Map<string, WorksetSong>();
    for (const s of workset?.songs ?? []) m.set(s.id, s);
    return m;
  }, [workset]);

  const commentsByVideo = useMemo(() => {
    const m = new Map<number, { author: string; publishedAt: string; content: string }[]>();
    for (const c of workset?.comments ?? []) {
      const arr = m.get(c.videoNo) ?? [];
      arr.push(c);
      m.set(c.videoNo, arr);
    }
    return m;
  }, [workset]);

  const selectedVideo = workset?.videos.find((v) => v.videoNo === selectedVideoNo) || null;
  const doneCount = workset?.videos.filter((v) => progress[v.videoNo]?.done).length ?? 0;

  // ── 목록 필터 (탭 + 빈 항목 숨김) ──
  const [filterTab, setFilterTab] = useState<"active" | "skipped" | "done">("active");
  const [hideEmpty, setHideEmpty] = useState(true);

  const candidateDates = useMemo(
    () => new Set((workset?.youtubeCandidates ?? []).map((c) => c.titleDate).filter(Boolean) as string[]),
    [workset],
  );
  const prevDay = (d: string) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };

  /** 영상별 분류: 유튜브 후보 유무 / 곡 유무 / 완료 / 건너뜀 */
  const videoMeta = useMemo(() => {
    const m = new Map<number, { hasVideo: boolean; hasSong: boolean; done: boolean; skipped: boolean }>();
    for (const v of workset?.videos ?? []) {
      const vp = progress[v.videoNo] || {};
      const tls = timelinesByVideo.get(v.videoNo) ?? [];
      const hasVideo = !!vp.youtubeVideoId || candidateDates.has(v.chzzkDate) || candidateDates.has(prevDay(v.chzzkDate));
      const hasSong = tls.some((t) => t.isRelevant || (vp.matches?.[t.id] ?? t.matchedSongId));
      m.set(v.videoNo, { hasVideo, hasSong, done: !!vp.done, skipped: !!vp.skipped });
    }
    return m;
  }, [workset, progress, timelinesByVideo, candidateDates]);

  const counts = useMemo(() => {
    let active = 0, skipped = 0, done = 0;
    for (const v of workset?.videos ?? []) {
      const meta = videoMeta.get(v.videoNo)!;
      if (meta.done) done++;
      else if (meta.skipped) skipped++;
      else active++;
    }
    return { active, skipped, done };
  }, [workset, videoMeta]);

  const visibleVideos = useMemo(() => {
    return (workset?.videos ?? []).filter((v) => {
      const meta = videoMeta.get(v.videoNo)!;
      if (filterTab === "done") return meta.done;
      if (filterTab === "skipped") return meta.skipped && !meta.done;
      if (meta.done || meta.skipped) return false; // active 탭
      if (hideEmpty && (!meta.hasVideo || !meta.hasSong)) return false;
      return true;
    });
  }, [workset, videoMeta, filterTab, hideEmpty]);

  // ── 클립 생성 ──
  const generate = async () => {
    if (!selectedVideo) return;
    const vp = progress[selectedVideo.videoNo] || {};
    const ytId = vp.youtubeVideoId;
    if (!ytId) return;
    const anchors = vp.anchors ?? [];
    const matches = vp.matches ?? {};
    const excluded = new Set(vp.excluded ?? []);
    const tls = timelinesByVideo.get(selectedVideo.videoNo) ?? [];
    const candidate = workset?.youtubeCandidates.find((c) => c.videoId === ytId);
    const sungDate = candidate?.titleDate || selectedVideo.chzzkDate;
    const videoUrl = `https://www.youtube.com/watch?v=${ytId}`;

    const clips: Array<{ songId: string; videoUrl: string; sungDate: string; startTime: number; endTime?: number; description: string }> = [];
    for (let i = 0; i < tls.length; i++) {
      const t = tls[i];
      const songId = matches[t.id] ?? t.matchedSongId;
      if (!songId || excluded.has(t.id)) continue;
      const yt = toYtTime(t.chzzkTime, anchors);
      if (yt == null) continue;
      const startTime = Math.round(yt);
      // 종료시각: 다음 타임라인의 예측 유튜브 시각, 없으면 곡 기본 길이
      let endTime: number | undefined;
      const nextYt = i + 1 < tls.length ? toYtTime(tls[i + 1].chzzkTime, anchors) : null;
      if (nextYt != null && nextYt > startTime) endTime = Math.round(nextYt);
      else {
        const dur = songsById.get(songId)?.clipDuration;
        if (dur && dur > 0) endTime = startTime + Math.round(dur);
      }
      const description = t.commentAuthor ? `${t.commentAuthor}님의 댓글로부터 생성되었습니다` : "댓글 타임라인 기반 생성";
      clips.push({ songId, videoUrl, sungDate, startTime, endTime, description });
    }

    if (clips.length === 0) { setResult("생성할 클립이 없습니다."); return; }

    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/clips/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clips }),
      }).then((r) => r.json());
      if (res.success === false || res.error) {
        setResult(res.error?.message || res.error || "생성 실패");
      } else {
        const r = res.results || res.data?.results || res;
        const msg = `성공 ${r.success ?? 0} · 중복 ${r.duplicates ?? 0} · 실패 ${r.failed ?? 0}`;
        setResult(msg);
        updateVideo(selectedVideo.videoNo, { done: true });
      }
    } catch {
      setResult("생성 중 오류가 발생했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  // ── 렌더 ──
  if (loading) {
    return <div className="max-w-7xl mx-auto px-8 pb-8 pt-24 text-center text-light-text/60 dark:text-dark-text/60">불러오는 중...</div>;
  }

  if (!isLocal) {
    return <div className="max-w-3xl mx-auto px-8 pb-8 pt-24 text-light-text dark:text-dark-text">이 도구는 로컬 서버에서만 동작합니다.</div>;
  }

  return (
    <div className="max-w-[1700px] mx-auto px-4 md:px-6 pb-12 pt-20 sm:pt-24">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-light-text dark:text-dark-text">치지직 → 유튜브 클립 생성 도구</h1>
          {workset && (
            <p className="text-xs text-light-text/60 dark:text-dark-text/60">
              영상 {workset.videos.length}개 · 완료 {doneCount} · 추출 {new Date(workset.generatedAt).toLocaleString("ko-KR")}
            </p>
          )}
        </div>
        <button
          onClick={doExport}
          disabled={exporting}
          className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border-2 border-light-accent/50 dark:border-dark-accent/50 text-light-accent dark:text-dark-accent hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 disabled:opacity-50 transition-colors"
          title="DB에서 작업 데이터를 다시 추출합니다 (댓글 등 새 필드 반영)"
        >
          <span className={exporting ? "animate-spin" : ""}>↻</span>
          {exporting ? "추출 중..." : needsExport ? "DB에서 데이터 추출" : "데이터 다시 추출"}
        </button>
      </div>
      {exportError && (
        <p className="mb-3 text-sm text-red-500 break-words">추출 실패: {exportError}</p>
      )}

      {needsExport || !workset ? (
        <div className="p-8 text-center">
          <p className="text-light-text/60 dark:text-dark-text/60 mb-4">
            아직 작업 데이터가 없습니다. 아래 버튼으로 DB에서 데이터를 추출해 시작하세요.
          </p>
          <button
            onClick={doExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple text-white font-medium hover:shadow-lg disabled:opacity-60 transition-all"
          >
            {exporting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {exporting ? "추출 중... (수 초 소요)" : "DB에서 데이터 추출"}
          </button>
          {exportError && (
            <p className="mt-4 text-sm text-red-500 break-words max-w-xl mx-auto">추출 실패: {exportError}</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-4">
          {/* 좌: 영상 목록 */}
          <div className="border border-light-primary/20 dark:border-dark-primary/20 rounded-lg overflow-hidden flex flex-col max-h-[80vh]">
            {/* 탭 */}
            <div className="flex border-b border-light-primary/15 dark:border-dark-primary/15 text-sm">
              {([
                ["active", "작업 대상", counts.active],
                ["skipped", "건너뜀", counts.skipped],
                ["done", "완료", counts.done],
              ] as const).map(([key, label, n]) => (
                <button
                  key={key}
                  onClick={() => setFilterTab(key)}
                  className={`flex-1 px-2 py-2 transition-colors ${
                    filterTab === key
                      ? "text-light-accent dark:text-dark-accent border-b-2 border-light-accent dark:border-dark-accent font-medium"
                      : "text-light-text/60 dark:text-dark-text/60 hover:text-light-text dark:hover:text-dark-text"
                  }`}
                >
                  {label} <span className="text-xs">({n})</span>
                </button>
              ))}
            </div>
            {filterTab === "active" && (
              <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-light-text/60 dark:text-dark-text/60 border-b border-light-primary/10 dark:border-dark-primary/10 cursor-pointer">
                <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
                영상 또는 곡 없는 항목 숨기기
              </label>
            )}
            <div className="overflow-y-auto">
              {visibleVideos.length === 0 && (
                <p className="p-4 text-center text-xs text-light-text/50 dark:text-dark-text/50">항목이 없습니다.</p>
              )}
              {visibleVideos.map((v) => {
                const vp = progress[v.videoNo] || {};
                const tls = timelinesByVideo.get(v.videoNo) ?? [];
                const matched = tls.filter((t) => (vp.matches?.[t.id] ?? t.matchedSongId)).length;
                const meta = videoMeta.get(v.videoNo)!;
                const sel = v.videoNo === selectedVideoNo;
                return (
                  <button
                    key={v.videoNo}
                    onClick={() => { setSelectedVideoNo(v.videoNo); setResult(null); }}
                    className={`w-full text-left px-3 py-2 border-b border-light-primary/10 dark:border-dark-primary/10 ${
                      sel ? "bg-light-accent/10 dark:bg-dark-accent/10" : "hover:bg-light-primary/5 dark:hover:bg-dark-primary/5"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-light-text/60 dark:text-dark-text/60">{v.chzzkDate.slice(5)}</span>
                      <span className="flex-1 min-w-0 truncate text-sm text-light-text dark:text-dark-text">{v.videoTitle}</span>
                      {vp.done && <span className="text-[10px] text-green-600 dark:text-green-400 shrink-0">완료</span>}
                      {vp.skipped && <span className="text-[10px] text-amber-600 dark:text-amber-400 shrink-0">건너뜀</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-light-text/50 dark:text-dark-text/50 mt-0.5">
                      <span>{vp.youtubeVideoId ? "🔗유튜브" : "·매핑안됨"}</span>
                      <span>앵커 {vp.anchors?.length ?? 0}</span>
                      <span>매칭 {matched}/{tls.length}</span>
                      {!meta.hasVideo && <span className="text-red-400">영상없음</span>}
                      {!meta.hasSong && <span className="text-red-400">곡없음</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 우: 작업 패널 */}
          <div className="border border-light-primary/20 dark:border-dark-primary/20 rounded-lg p-4">
            {selectedVideo ? (
              <VideoWorkPanel
                key={selectedVideo.videoNo}
                video={selectedVideo}
                timelines={timelinesByVideo.get(selectedVideo.videoNo) ?? []}
                songs={workset.songs}
                songsById={songsById}
                youtubeCandidates={workset.youtubeCandidates}
                comments={commentsByVideo.get(selectedVideo.videoNo) ?? []}
                progress={progress[selectedVideo.videoNo] || {}}
                onChange={(partial) => updateVideo(selectedVideo.videoNo, partial)}
                onGenerate={generate}
                generating={generating}
                result={result}
              />
            ) : (
              <p className="text-sm text-light-text/60 dark:text-dark-text/60 p-8 text-center">왼쪽에서 영상을 선택하세요.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
