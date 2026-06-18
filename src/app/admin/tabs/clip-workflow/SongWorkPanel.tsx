"use client";

/**
 * 곡 단위 작업 패널.
 * 한 곡의 매칭 출현(여러 방송) + 역매칭 후보(이름은 같은데 미매칭)를 모아,
 * 시간 조정/매칭/클립 생성까지 한 화면에서. 편집 알맹이는 ItemEditor 공유.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import ItemEditor from "./ItemEditor";
import CreatedClipsReview from "./CreatedClipsReview";
import { fmt } from "./itemUtils";
import type { WorkflowItem, WorkflowSong } from "./types";

interface Props {
  song: WorkflowSong;
  songs: WorkflowSong[];
  songsById: Map<string, WorkflowSong>;
  onStatusRefresh: () => void;
}

export default function SongWorkPanel({ song, songs, songsById, onStatusRefresh }: Props) {
  const [occurrences, setOccurrences] = useState<WorkflowItem[]>([]);
  const [clips, setClips] = useState<{ videoId: string; startTime: number }[]>([]);
  const [candidates, setCandidates] = useState<WorkflowItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchingCand, setSearchingCand] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);

  const loadWork = useCallback(async (withCandidates: boolean) => {
    if (withCandidates) setSearchingCand(true); else setLoading(true);
    try {
      const res = await fetch(`/api/admin/clip-workflow/song-work?songId=${song.id}&candidates=${withCandidates}`).then((r) => r.json());
      if (res.success) {
        setOccurrences(res.data.occurrences);
        setClips(res.data.clips || []);
        if (withCandidates) setCandidates(res.data.candidates || []);
        setSelectedId((prev) => prev ?? res.data.occurrences[0]?.id ?? null);
      }
    } finally {
      setLoading(false); setSearchingCand(false);
    }
  }, [song.id]);

  useEffect(() => { setCandidates(null); setSelectedId(null); setResult(null); loadWork(false); }, [loadWork]);

  // 항목 PATCH. matchedSongId가 바뀌면(매칭/해제/등록) 목록 구성이 달라지므로 재로드
  const patchItem = useCallback(async (id: string, body: Record<string, unknown>, optimistic?: Partial<WorkflowItem>) => {
    const reload = "matchedSongId" in body;
    if (optimistic && !reload) {
      setOccurrences((prev) => prev.map((it) => (it.id === id ? { ...it, ...optimistic } : it)));
      setCandidates((prev) => prev && prev.map((it) => (it.id === id ? { ...it, ...optimistic } : it)));
    }
    await fetch(`/api/admin/clip-workflow/item/${encodeURIComponent(id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => {});
    if (reload) { await loadWork(candidates !== null); onStatusRefresh(); }
  }, [loadWork, candidates, onStatusRefresh]);

  const registerAll = async () => {
    if (!candidates || candidates.length === 0) return;
    for (const c of candidates) {
      await fetch(`/api/admin/clip-workflow/item/${encodeURIComponent(c.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchedSongId: song.id }),
      }).catch(() => {});
    }
    await loadWork(true); onStatusRefresh();
    setResult(`${candidates.length}건 등록`);
  };

  const clipped = (occ: WorkflowItem) =>
    clips.some((c) => c.videoId === occ.videoId && Math.abs(c.startTime - occ.startTimeSeconds) <= 30);

  const generatable = useMemo(() => occurrences.filter((o) => !o.isExcluded && !clipped(o)), [occurrences, clips]);

  const createClips = async () => {
    if (generatable.length === 0) { setResult("생성할 클립이 없습니다."); return; }
    const payload = generatable.map((it) => ({
      songId: song.id,
      videoUrl: it.videoUrl,
      sungDate: it.date || "",
      startTime: Math.round(it.startTimeSeconds),
      endTime: it.endTimeSeconds != null ? Math.round(it.endTimeSeconds) : undefined,
      description: it.customDescription || `${it.commentAuthor}님의 댓글로부터 생성되었습니다`,
    }));
    setCreating(true); setResult(null);
    try {
      const res = await fetch("/api/admin/clips/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clips: payload }),
      }).then((r) => r.json());
      const r = res.results || {};
      setResult(`생성 성공 ${r.success ?? 0} · 중복 ${r.duplicates ?? 0} · 실패 ${r.failed ?? 0}`);
      await loadWork(candidates !== null); onStatusRefresh();
    } catch { setResult("생성 중 오류"); }
    finally { setCreating(false); }
  };

  const selected = [...occurrences, ...(candidates || [])].find((it) => it.id === selectedId) || null;

  const renderRow = (it: WorkflowItem, isCandidate: boolean) => {
    const isSel = it.id === selectedId;
    const done = clipped(it);
    return (
      <div key={it.id} onClick={() => setSelectedId(it.id)} className={`px-2.5 py-1.5 text-sm cursor-pointer border-b border-light-primary/10 dark:border-dark-primary/10 ${isSel ? "bg-light-accent/10 dark:bg-dark-accent/10" : "hover:bg-light-primary/5 dark:hover:bg-dark-primary/5"} ${it.isExcluded ? "opacity-40" : ""}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-light-text/60 dark:text-dark-text/60 shrink-0">{it.date?.slice(2) || "?"}</span>
          <span className={`text-[10px] px-1 rounded shrink-0 ${it.platform === "chzzk" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300"}`}>{it.platform === "chzzk" ? "CH" : "YT"}</span>
          <span className="font-mono text-[11px] text-light-text/55 dark:text-dark-text/55 shrink-0">{fmt(it.startTimeSeconds)}</span>
          <span className="flex-1 min-w-0 truncate text-light-text/70 dark:text-dark-text/70">{it.videoTitle || it.videoId}</span>
          {done && <span className="text-[10px] px-1 rounded bg-green-500/15 text-green-600 dark:text-green-400 shrink-0">클립됨</span>}
          {isCandidate && (
            <button onClick={(e) => { e.stopPropagation(); patchItem(it.id, { matchedSongId: song.id }); }} className="text-[10px] px-1.5 py-0.5 rounded bg-light-accent dark:bg-dark-accent text-white shrink-0">이 곡으로 등록</button>
          )}
        </div>
        <div className="text-[11px] text-light-text/50 dark:text-dark-text/50 truncate">파싱: {it.artist} - {it.songTitle}</div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-light-text dark:text-dark-text">{song.titleAlias || song.title}</h2>
          <p className="text-xs text-light-text/60 dark:text-dark-text/60">{song.artistAlias || song.artist} · 출현 {occurrences.length} · 미생성 {generatable.length}</p>
        </div>
        <button onClick={() => loadWork(true)} disabled={searchingCand} className="text-sm px-3 py-1.5 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 text-light-text/70 dark:text-dark-text/70 hover:border-light-accent/40 disabled:opacity-50">
          {searchingCand ? "찾는 중..." : "미등록 출현 찾기"}
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-light-text/50">불러오는 중...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-4">
          {/* 좌: 출현 + 후보 목록 */}
          <div className="border border-light-primary/20 dark:border-dark-primary/20 rounded-lg overflow-hidden flex flex-col lg:order-1 max-h-[78vh]">
            <div className="overflow-y-auto">
              <div className="px-3 py-1.5 text-xs font-medium text-light-text/60 dark:text-dark-text/60 bg-light-primary/5 dark:bg-dark-primary/10">매칭된 출현 ({occurrences.length})</div>
              {occurrences.length === 0 && <p className="px-3 py-2 text-xs text-light-text/40">아직 매칭된 출현이 없습니다.</p>}
              {occurrences.map((it) => renderRow(it, false))}

              {candidates !== null && (
                <>
                  <div className="px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 flex items-center justify-between">
                    <span>미등록 후보 ({candidates.length})</span>
                    {candidates.length > 0 && <button onClick={registerAll} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600 text-white">전체 등록</button>}
                  </div>
                  {candidates.length === 0 && <p className="px-3 py-2 text-xs text-light-text/40">이름이 일치하는 미매칭 타임라인이 없습니다.</p>}
                  {candidates.map((it) => renderRow(it, true))}
                </>
              )}
            </div>
          </div>

          {/* 우: 편집 알맹이 (공용) */}
          <div className="lg:order-2">
            {selected ? (
              <ItemEditor item={selected} songs={songs} songsById={songsById} onPatch={patchItem} />
            ) : (
              <p className="text-sm text-light-text/50 p-8 text-center">출현을 선택하세요.</p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={createClips} disabled={creating || generatable.length === 0} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple text-white font-medium hover:shadow-lg disabled:opacity-50 transition-all">
          {creating ? "생성 중..." : `클립 생성 (${generatable.length})`}
        </button>
        {clips.length > 0 && (
          <button onClick={() => setShowReview(true)} className="px-3 py-2 text-sm rounded-lg border border-light-primary/20 dark:border-dark-primary/20 text-light-text/70 dark:text-dark-text/70 hover:border-light-accent/40">
            생성된 클립 보기 ({clips.length})
          </button>
        )}
        {result && <span className="text-sm text-light-text/70 dark:text-dark-text/70">{result}</span>}
      </div>

      {showReview && (
        <CreatedClipsReview
          query={`songId=${encodeURIComponent(song.id)}`}
          title={`${song.titleAlias || song.title} — 생성된 클립`}
          onClose={() => setShowReview(false)}
          onChanged={() => { loadWork(candidates !== null); onStatusRefresh(); }}
        />
      )}
    </div>
  );
}
