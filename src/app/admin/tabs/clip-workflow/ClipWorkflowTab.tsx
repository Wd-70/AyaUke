"use client";

/**
 * 클립 만들기 — 통합 탭 (치지직/유튜브 토글).
 * 수집(POST)·생성(bulk)은 기존 엔드포인트를 호출하고, 영상목록/파싱/매칭은
 * clip-workflow 서비스를 사용한다. 화면은 좌측 영상목록 + 우측 작업패널.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import VideoWorkPanel from "./VideoWorkPanel";
import SongWorkPanel from "./SongWorkPanel";
import type { Platform, WorkflowVideo, WorkflowSong } from "./types";

type Mode = "video" | "song";

export default function ClipWorkflowTab() {
  const [mode, setMode] = useState<Mode>("video");
  const [platform, setPlatform] = useState<Platform>("chzzk");
  const [videos, setVideos] = useState<WorkflowVideo[]>([]);
  const [songs, setSongs] = useState<WorkflowSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [collectMsg, setCollectMsg] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"todo" | "done">("todo");

  // 곡 단위
  const [songStatuses, setSongStatuses] = useState<Map<string, { occurrences: number; clips: number }>>(new Map());
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [songSearch, setSongSearch] = useState("");

  const loadSongStatuses = useCallback(async () => {
    const res = await fetch("/api/admin/clip-workflow/song-statuses").then((r) => r.json());
    if (res.success) setSongStatuses(new Map(res.data.statuses.map((s: { songId: string; occurrences: number; clips: number }) => [s.songId, { occurrences: s.occurrences, clips: s.clips }])));
  }, []);
  useEffect(() => { if (mode === "song") loadSongStatuses(); }, [mode, loadSongStatuses]);

  const loadVideos = useCallback(async (p: Platform) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clip-workflow/videos?platform=${p}`).then((r) => r.json());
      if (res.success) setVideos(res.data.videos);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/clip-workflow/songs").then((r) => r.json()).then((res) => {
      if (res.success) setSongs(res.data.songs);
    });
  }, []);

  useEffect(() => { setSelectedVideoId(null); loadVideos(platform); }, [platform, loadVideos]);

  const songsById = useMemo(() => {
    const m = new Map<string, WorkflowSong>();
    for (const s of songs) m.set(s.id, s);
    return m;
  }, [songs]);

  // 수집: 치지직=chzzk-sync(POST, SSE 아님) / 유튜브=youtube-comments
  const collect = async () => {
    if (!confirm("채널의 영상과 댓글을 수집합니다. 시간이 걸릴 수 있습니다. 진행할까요?")) return;
    setCollecting(true);
    setCollectMsg("수집 중... (수십 초~수 분)");
    try {
      const endpoint = platform === "chzzk" ? "/api/chzzk-sync" : "/api/youtube-comments";
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-channel" }),
      }).then((r) => r.json());
      if (res.success) {
        setCollectMsg("수집 완료");
        await loadVideos(platform);
      } else {
        setCollectMsg(res.error?.message || res.error || "수집 실패");
      }
    } catch {
      setCollectMsg("수집 중 오류");
    } finally {
      setCollecting(false);
    }
  };

  // 완료 = 매칭된 곡이 모두 클립으로 생성됨. 작업 대상 = 댓글 있고 아직 완료 아님(상호배타)
  const isDone = (v: WorkflowVideo) => v.matchedCount > 0 && v.clipCount >= v.matchedCount;
  const counts = useMemo(() => {
    let todo = 0, done = 0;
    for (const v of videos) {
      if (isDone(v)) done++;
      else if (v.timelineCommentCount > 0) todo++;
    }
    return { todo, done };
  }, [videos]);

  const visibleVideos = useMemo(() => {
    return videos.filter((v) => (filterTab === "done" ? isDone(v) : v.timelineCommentCount > 0 && !isDone(v)));
  }, [videos, filterTab]);

  const selectedVideo = videos.find((v) => v.videoId === selectedVideoId) || null;
  const refreshStatus = useCallback(() => loadVideos(platform), [platform, loadVideos]);

  const selectedSong = songs.find((s) => s.id === selectedSongId) || null;
  const songList = useMemo(() => {
    const q = songSearch.trim().toLowerCase();
    let list = songs.map((s) => ({ song: s, st: songStatuses.get(s.id) }));
    if (q) {
      list = list.filter(({ song: s }) => `${s.artist} ${s.title} ${s.artistAlias || ""} ${s.titleAlias || ""} ${(s.searchTags || []).join(" ")}`.toLowerCase().includes(q));
    } else {
      list = list.filter(({ st }) => st && (st.occurrences > 0 || st.clips > 0));
      list.sort((a, b) => (b.st?.occurrences ?? 0) - (a.st?.occurrences ?? 0));
    }
    return list.slice(0, 300);
  }, [songs, songStatuses, songSearch]);

  return (
    <div className="space-y-4">
      {/* 상단: 보기 모드 + (영상모드) 플랫폼 토글 / 수집 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-light-primary/20 dark:border-dark-primary/20 overflow-hidden">
            {([["video", "영상 단위"], ["song", "곡 단위"]] as const).map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)} className={`px-4 py-1.5 text-sm font-medium transition-colors ${mode === m ? "bg-light-accent dark:bg-dark-accent text-white" : "text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10"}`}>
                {label}
              </button>
            ))}
          </div>
          {mode === "video" && (
            <div className="inline-flex rounded-lg border border-light-primary/20 dark:border-dark-primary/20 overflow-hidden">
              {(["chzzk", "youtube"] as const).map((p) => (
                <button key={p} onClick={() => setPlatform(p)} className={`px-4 py-1.5 text-sm font-medium transition-colors ${platform === p ? "bg-light-accent dark:bg-dark-accent text-white" : "text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10"}`}>
                  {p === "chzzk" ? "치지직" : "유튜브"}
                </button>
              ))}
            </div>
          )}
        </div>
        {mode === "video" && (
          <div className="flex items-center gap-2">
            {collectMsg && <span className="text-xs text-light-text/60 dark:text-dark-text/60">{collectMsg}</span>}
            <button onClick={collect} disabled={collecting} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border-2 border-light-accent/50 dark:border-dark-accent/50 text-light-accent dark:text-dark-accent hover:bg-light-accent/10 disabled:opacity-50 transition-colors">
              {collecting && <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />}
              {collecting ? "수집 중..." : "영상·댓글 수집"}
            </button>
          </div>
        )}
      </div>

      {mode === "video" && (
      <div className="grid grid-cols-1 lg:grid-cols-[22rem_1fr] gap-4">
        {/* 좌: 영상 목록 */}
        <div className="border border-light-primary/20 dark:border-dark-primary/20 rounded-lg overflow-hidden flex flex-col max-h-[80vh]">
          <div className="flex border-b border-light-primary/15 dark:border-dark-primary/15 text-sm">
            {([["todo", "작업 대상", counts.todo], ["done", "완료", counts.done]] as const).map(([k, label, n]) => (
              <button key={k} onClick={() => setFilterTab(k)} className={`flex-1 px-2 py-2 transition-colors ${filterTab === k ? "text-light-accent dark:text-dark-accent border-b-2 border-light-accent dark:border-dark-accent font-medium" : "text-light-text/60 dark:text-dark-text/60"}`} title={k === "todo" ? "댓글이 있고 아직 모든 매칭 곡이 클립으로 생성되지 않은 영상" : "매칭된 곡이 모두 클립으로 생성된 영상"}>
                {label} <span className="text-xs">({n})</span>
              </button>
            ))}
          </div>
          <div className="overflow-y-auto">
            {loading ? (
              <p className="p-4 text-center text-xs text-light-text/50">불러오는 중...</p>
            ) : visibleVideos.length === 0 ? (
              <p className="p-4 text-center text-xs text-light-text/50">항목이 없습니다.</p>
            ) : visibleVideos.map((v) => {
              const sel = v.videoId === selectedVideoId;
              return (
                <button key={v.videoId} onClick={() => setSelectedVideoId(v.videoId)} className={`w-full text-left px-3 py-2 border-b border-light-primary/10 dark:border-dark-primary/10 ${sel ? "bg-light-accent/10 dark:bg-dark-accent/10" : "hover:bg-light-primary/5"}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono text-light-text/60 shrink-0">{v.date.slice(5)}</span>
                    <span className="flex-1 min-w-0 truncate text-sm text-light-text dark:text-dark-text">{v.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-light-text/50 dark:text-dark-text/50 mt-0.5">
                    <span>댓글 {v.timelineCommentCount}</span>
                    <span>파싱 {v.parsedCount}</span>
                    <span>매칭 {v.matchedCount}</span>
                    {v.clipCount > 0 && <span className="text-green-600 dark:text-green-400">클립 {v.clipCount}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 우: 작업 패널 */}
        <div className="border border-light-primary/20 dark:border-dark-primary/20 rounded-lg p-4 min-h-[40vh]">
          {selectedVideo ? (
            <VideoWorkPanel
              key={`${platform}-${selectedVideo.videoId}`}
              platform={platform}
              video={selectedVideo}
              songs={songs}
              songsById={songsById}
              onStatusRefresh={refreshStatus}
            />
          ) : (
            <p className="text-sm text-light-text/60 dark:text-dark-text/60 p-8 text-center">왼쪽에서 영상을 선택하세요. 새 영상이 없으면 &lsquo;영상·댓글 수집&rsquo;을 먼저 실행하세요.</p>
          )}
        </div>
      </div>
      )}

      {mode === "song" && (
      <div className="grid grid-cols-1 lg:grid-cols-[22rem_1fr] gap-4">
        {/* 좌: 곡 목록 (검색 + 활동곡) */}
        <div className="border border-light-primary/20 dark:border-dark-primary/20 rounded-lg overflow-hidden flex flex-col max-h-[80vh]">
          <div className="p-2 border-b border-light-primary/15 dark:border-dark-primary/15">
            <input
              value={songSearch}
              onChange={(e) => setSongSearch(e.target.value)}
              placeholder="곡 검색 (비우면 출현·클립 있는 곡)"
              className="w-full text-sm rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text px-2 py-1"
            />
          </div>
          <div className="overflow-y-auto">
            {songList.length === 0 ? (
              <p className="p-4 text-center text-xs text-light-text/50">{songSearch ? "검색 결과 없음" : "활동 있는 곡이 없습니다. 검색해서 곡을 선택하세요."}</p>
            ) : songList.map(({ song: s, st }) => {
              const sel = s.id === selectedSongId;
              return (
                <button key={s.id} onClick={() => setSelectedSongId(s.id)} className={`w-full text-left px-3 py-2 border-b border-light-primary/10 dark:border-dark-primary/10 ${sel ? "bg-light-accent/10 dark:bg-dark-accent/10" : "hover:bg-light-primary/5"}`}>
                  <div className="truncate text-sm text-light-text dark:text-dark-text">{s.titleAlias || s.title}</div>
                  <div className="flex items-center gap-2 text-[10px] text-light-text/50 dark:text-dark-text/50 mt-0.5">
                    <span className="truncate">{s.artistAlias || s.artist}</span>
                    <span className="shrink-0">출현 {st?.occurrences ?? 0}</span>
                    {(st?.clips ?? 0) > 0 && <span className="text-green-600 dark:text-green-400 shrink-0">클립 {st?.clips}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 우: 곡 작업 패널 */}
        <div className="border border-light-primary/20 dark:border-dark-primary/20 rounded-lg p-4 min-h-[40vh]">
          {selectedSong ? (
            <SongWorkPanel
              key={selectedSong.id}
              song={selectedSong}
              songs={songs}
              songsById={songsById}
              onStatusRefresh={loadSongStatuses}
            />
          ) : (
            <p className="text-sm text-light-text/60 dark:text-dark-text/60 p-8 text-center">왼쪽에서 곡을 선택하세요. 새로 추가한 곡은 검색으로 찾아 &lsquo;미등록 출현 찾기&rsquo;로 일괄 등록할 수 있습니다.</p>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
