"use client";

/**
 * 클립 만들기 — 통합 탭 (치지직/유튜브 토글).
 * 수집(POST)·생성(bulk)은 기존 엔드포인트를 호출하고, 영상목록/파싱/매칭은
 * clip-workflow 서비스를 사용한다. 화면은 좌측 영상목록 + 우측 작업패널.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VideoWorkPanel from "./VideoWorkPanel";
import SongWorkPanel from "./SongWorkPanel";
import UnmatchedSearchPanel from "./UnmatchedSearchPanel";
import { SongDurationContext } from "./SongDurationContext";
import WorkflowWorkspace from './WorkflowWorkspace';
import type { Platform, WorkflowVideo, WorkflowSong } from "./types";
import { AdminPageHeader, adminButton, adminMuted, adminPrimaryButton } from "@/components/admin/AdminPrimitives";

/** 작은 전환 버튼(세그먼트) — 다른 관리 탭과 같은 모양 */
const segmentClass = (active: boolean) =>
  `inline-flex items-center rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-white text-light-text shadow-sm dark:bg-gray-800 dark:text-dark-text" : "text-light-text/60 hover:text-light-text dark:text-dark-text/60 dark:hover:text-dark-text"
  }`;

type Mode = "video" | "song";
const HIDE_UNMATCHED_VIDEOS_KEY = "clipWorkflowHideUnmatchedVideos";

export default function ClipWorkflowTab() {
  const [mode, setMode] = useState<Mode>("video");
  const [platform, setPlatform] = useState<Platform>("chzzk");
  const [videos, setVideos] = useState<WorkflowVideo[]>([]);
  const [songs, setSongs] = useState<WorkflowSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState<null | "new" | "full">(null);
  const [collectMsg, setCollectMsg] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"todo" | "done">("todo");
  const [hideUnmatchedVideos, setHideUnmatchedVideos] = useState(false);
  useEffect(() => {
    try { setHideUnmatchedVideos(localStorage.getItem(HIDE_UNMATCHED_VIDEOS_KEY) === "1"); } catch { /* optional preference */ }
  }, []);

  const toggleHideUnmatchedVideos = () => {
    const next = !hideUnmatchedVideos;
    setHideUnmatchedVideos(next);
    try { localStorage.setItem(HIDE_UNMATCHED_VIDEOS_KEY, next ? "1" : "0"); } catch { /* optional preference */ }
  };

  // 곡 단위
  const [songStatuses, setSongStatuses] = useState<Map<string, { occurrences: number; clips: number }>>(new Map());
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [songSearch, setSongSearch] = useState("");
  // 미등록 곡 발견: 좌측 가상 항목 선택 시 그 검색어를 고정해 우측 패널로 전달(입력 중 변동 방지)
  const [unmatchedQuery, setUnmatchedQuery] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [mode, platform]);
  const videoRequest = useRef(0);
  const statusRequest = useRef(0);
  const activePlatform = useRef(platform);

  const loadSongStatuses = useCallback(async () => {
    const request = ++statusRequest.current;
    const res = await fetch("/api/admin/clip-workflow/song-statuses").then((r) => r.json());
    if (res.success && request === statusRequest.current) setSongStatuses(new Map(res.data.statuses.map((s: { songId: string; occurrences: number; clips: number }) => [s.songId, { occurrences: s.occurrences, clips: s.clips }])));
  }, []);
  useEffect(() => { if (mode === "song") loadSongStatuses(); }, [mode, loadSongStatuses]);

  const loadVideos = useCallback(async (p: Platform) => {
    // 이전 플랫폼의 저장이 늦게 끝나도 현재 목록을 덮어쓰지 않는다.
    if (p !== activePlatform.current) return;
    const request = ++videoRequest.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clip-workflow/videos?platform=${p}`).then((r) => r.json());
      if (res.success && request === videoRequest.current && p === activePlatform.current) setVideos(res.data.videos);
    } finally {
      if (request === videoRequest.current) setLoading(false);
    }
  }, []);

  // 곡 목록 로드. 다른 탭(관리자 곡 화면)에서 곡을 추가한 뒤 이 탭으로 돌아오면
  // 창 포커스/가시성 복귀 시 자동 재로드해 검색·추천에 즉시 반영한다.
  const lastSongsLoadRef = useRef(0);
  const songRevision = useRef(0);
  const onSongDurationSaved = useCallback((songId: string, duration: number) => {
    songRevision.current += 1;
    setSongs((prev) => prev.map((song) => song.id === songId ? { ...song, clipDuration: duration } : song));
  }, []);
  const loadSongs = useCallback(async () => {
    const revision = songRevision.current;
    lastSongsLoadRef.current = Date.now();
    const res = await fetch("/api/admin/clip-workflow/songs").then((r) => r.json());
    if (res.success && revision === songRevision.current) setSongs(res.data.songs);
  }, []);

  useEffect(() => { loadSongs(); }, [loadSongs]);

  // 창으로 돌아올 때 자동 갱신 — 곡 목록(+song 모드면 활동 통계)을 되살린다.
  // 2초 가드는 복귀 시 focus/visibilitychange가 거의 동시에 두 번 터지는 것만 합치는 용도
  // (더 길면 곡을 추가하고 곧바로 돌아왔을 때 그 방문의 갱신이 통째로 스킵된다).
  useEffect(() => {
    const refreshOnReturn = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastSongsLoadRef.current < 2_000) return;
      loadSongs();
      if (mode === "song") loadSongStatuses();
    };
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [loadSongs, loadSongStatuses, mode]);

  useEffect(() => { activePlatform.current = platform; setSelectedVideoId(null); loadVideos(platform); }, [platform, loadVideos]);

  const songsById = useMemo(() => {
    const m = new Map<string, WorkflowSong>();
    for (const s of songs) m.set(s.id, s);
    return m;
  }, [songs]);

  // 수집: 치지직=chzzk-sync(POST, SSE 아님) / 유튜브=youtube-comments
  // newVideosOnly=true → 새 영상만 빠르게 수집 / false → 전체 순회(기존 영상 새 댓글까지)
  const collect = async (newVideosOnly: boolean) => {
    if (!confirm(newVideosOnly
      ? "DB에 없는 새 영상만 수집합니다. 진행할까요?"
      : "전체 영상을 순회하며 기존 영상의 새 댓글까지 수집합니다. 시간이 걸릴 수 있습니다. 진행할까요?")) return;
    setCollecting(newVideosOnly ? "new" : "full");
    setCollectMsg(newVideosOnly ? "새 영상 수집 중..." : "전체 수집 중... (수십 초~수 분)");
    try {
      const endpoint = platform === "chzzk" ? "/api/chzzk-sync" : "/api/youtube-comments";
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-channel", newVideosOnly }),
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
      setCollecting(null);
    }
  };

  // 완료 = 매칭된 곡이 모두 클립으로 생성됨. 작업 대상 = 댓글 있고 아직 완료 아님(상호배타)
  const { videoGroups, hiddenVideoCount } = useMemo(() => {
    const groups = { todo: [] as WorkflowVideo[], done: [] as WorkflowVideo[] };
    let hidden = 0;
    for (const v of videos) {
      if (v.matchedCount > 0 && v.clipCount >= v.matchedCount) groups.done.push(v);
      else if (v.timelineCommentCount > 0) {
        if (hideUnmatchedVideos && v.matchedCount === 0) hidden++;
        else groups.todo.push(v);
      }
    }
    return { videoGroups: groups, hiddenVideoCount: hidden };
  }, [videos, hideUnmatchedVideos]);
  const visibleVideos = videoGroups[filterTab];

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
    <SongDurationContext.Provider value={onSongDurationSaved}>
    <div className="space-y-5 text-light-text dark:text-dark-text [&_button]:min-h-11 lg:[&_button]:min-h-0 [&_input]:min-h-11 lg:[&_input]:min-h-0">
      <AdminPageHeader
        eyebrow="WORKSPACE / CLIP WORKFLOW"
        title="클립 만들기"
        description="다시보기 댓글에 적힌 타임라인을 곡과 맞춰 라이브 클립으로 만듭니다."
        actions={
          mode === "video" ? (
            <>
              <button onClick={() => collect(true)} disabled={collecting !== null} title="아직 받아 오지 않은 새 다시보기와 그 댓글만 빠르게 가져옵니다." className={`${adminPrimaryButton} !min-h-11`}>
                {collecting === "new" && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
                {collecting === "new" ? "가져오는 중…" : "새 영상 수집"}
              </button>
              <button onClick={() => collect(false)} disabled={collecting !== null} title="모든 다시보기를 다시 훑어 기존 영상에 새로 달린 댓글까지 가져옵니다(느림)." className={`${adminButton} !min-h-11`}>
                {collecting === "full" && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
                {collecting === "full" ? "훑는 중…" : "전체 갱신(새 댓글)"}
              </button>
            </>
          ) : undefined
        }
      />

      {/* 작업 단위 · 플랫폼 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-light-primary/10 p-1 dark:bg-dark-primary/20" role="group" aria-label="작업 단위">
          {([["video", "영상 단위"], ["song", "곡 단위"]] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={segmentClass(mode === m)}>
              {label}
            </button>
          ))}
        </div>
        {mode === "video" && (
          <div className="flex rounded-xl bg-light-primary/10 p-1 dark:bg-dark-primary/20" role="group" aria-label="플랫폼">
            {(["chzzk", "youtube"] as const).map((p) => (
              <button key={p} onClick={() => setPlatform(p)} aria-pressed={platform === p} className={segmentClass(platform === p)}>
                {p === "chzzk" ? "치지직" : "유튜브"}
              </button>
            ))}
          </div>
        )}
        {mode === "video" && collectMsg && <span className={`${adminMuted} text-xs`} role="status">{collectMsg}</span>}
      </div>

      {mode === "video" && (
      <div className="grid grid-cols-1 lg:grid-cols-[22rem_minmax(0,1fr)] gap-4">
        {/* 좌: 영상 목록 */}
        <div className="rounded-2xl border border-light-primary/20 bg-white/80 shadow-sm dark:border-dark-primary/20 dark:bg-gray-900/70 overflow-hidden flex flex-col lg:max-h-[80vh]">
          <div className="flex border-b border-light-primary/15 dark:border-dark-primary/15 text-sm">
            {([["todo", "작업 대상"], ["done", "완료"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setFilterTab(k)} className={`flex-1 px-2 py-2 transition-colors ${filterTab === k ? "text-light-accent dark:text-dark-accent border-b-2 border-light-accent dark:border-dark-accent font-medium" : "text-light-text/60 dark:text-dark-text/60"}`} title={k === "todo" ? "댓글이 있고 아직 모든 매칭 곡이 클립으로 생성되지 않은 영상" : "매칭된 곡이 모두 클립으로 생성된 영상"}>
                {label} <span className="text-xs">({videoGroups[k].length})</span>
              </button>
            ))}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 border-b border-light-primary/15 px-2.5 py-1 text-xs dark:border-dark-primary/15">
            <button
              type="button"
              role="switch"
              aria-checked={hideUnmatchedVideos}
              onClick={toggleHideUnmatchedVideos}
              title="매칭 수가 0인 영상을 작업 대상 목록에서 숨깁니다."
              className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-light-text/75 hover:text-light-text dark:text-dark-text/75 dark:hover:text-dark-text"
            >
              <span aria-hidden className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${hideUnmatchedVideos ? "bg-light-accent dark:bg-dark-accent" : "bg-light-text/20 dark:bg-dark-text/25"}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${hideUnmatchedVideos ? "translate-x-3.5" : "translate-x-0.5"}`} />
              </span>
              매칭 없는 영상 숨기기
            </button>
            {!loading && filterTab === "todo" && hiddenVideoCount > 0 && (
              <span role="status" className="text-light-text/60 dark:text-dark-text/60 tabular-nums">{hiddenVideoCount}개 숨김</span>
            )}
          </div>
          <div className="lg:overflow-y-auto">
            {loading ? (
              <p className="p-4 text-center text-xs text-light-text/50">불러오는 중...</p>
            ) : visibleVideos.length === 0 ? (
              <p className="p-4 text-center text-xs text-light-text/60 dark:text-dark-text/60">
                {filterTab === "todo" && hiddenVideoCount > 0 ? "매칭된 작업 대상 영상이 없습니다. 숨기기를 끄면 모든 작업 대상을 볼 수 있습니다." : "항목이 없습니다."}
              </p>
            ) : visibleVideos.map((v) => {
              const sel = v.videoId === selectedVideoId;
              return (
                <button id={`workflow-video-${platform}-${v.videoId}`} key={v.videoId} onClick={() => { setSelectedVideoId(v.videoId); setMobileOpen(true); }} className={`min-h-11 w-full text-left px-3 py-2 border-b border-light-primary/10 dark:border-dark-primary/10 ${sel ? "bg-light-accent/10 dark:bg-dark-accent/10" : "hover:bg-light-primary/5"}`}>
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
        <div className="hidden lg:block min-w-0 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg p-4 min-h-[40vh]">
          <WorkflowWorkspace open={mobileOpen && !!selectedVideo} onClose={() => setMobileOpen(false)} title={selectedVideo?.title || '영상 작업'} backLabel="영상 목록">
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
            <p className="text-sm text-light-text/60 dark:text-dark-text/60 p-8 text-center">왼쪽에서 영상을 선택하세요. 목록에 없는 새 다시보기는 오른쪽 위 &lsquo;새 영상 수집&rsquo;으로 가져와요.</p>
          )}
          </WorkflowWorkspace>
        </div>
      </div>
      )}

      {mode === "song" && (
      <div className="grid grid-cols-1 lg:grid-cols-[22rem_minmax(0,1fr)] gap-4">
        {/* 좌: 곡 목록 (검색 + 활동곡) */}
        <div className="rounded-2xl border border-light-primary/20 bg-white/80 shadow-sm dark:border-dark-primary/20 dark:bg-gray-900/70 overflow-hidden flex flex-col lg:max-h-[80vh]">
          <div className="p-2 border-b border-light-primary/15 dark:border-dark-primary/15">
            <input
              value={songSearch}
              onChange={(e) => setSongSearch(e.target.value)}
              placeholder="곡 검색 (비우면 출현·클립 있는 곡)"
              className="w-full text-base lg:text-sm rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text px-2 py-1"
            />
          </div>
          <div className="lg:overflow-y-auto">
            {songList.length === 0 ? (
              <p className="p-4 text-center text-xs text-light-text/50">{songSearch ? "검색 결과 없음" : "활동 있는 곡이 없습니다. 검색해서 곡을 선택하세요."}</p>
            ) : songList.map(({ song: s, st }) => {
              const sel = s.id === selectedSongId && unmatchedQuery === null;
              return (
                <button id={`workflow-song-${s.id}`} key={s.id} onClick={() => { setUnmatchedQuery(null); setSelectedSongId(s.id); setMobileOpen(true); }} className={`min-h-11 w-full text-left px-3 py-2 border-b border-light-primary/10 dark:border-dark-primary/10 ${sel ? "bg-light-accent/10 dark:bg-dark-accent/10" : "hover:bg-light-primary/5"}`}>
                  <div className="truncate text-sm text-light-text dark:text-dark-text">{s.titleAlias || s.title}</div>
                  <div className="flex items-center gap-2 text-[10px] text-light-text/50 dark:text-dark-text/50 mt-0.5">
                    <span className="truncate">{s.artistAlias || s.artist}</span>
                    <span className="shrink-0">출현 {st?.occurrences ?? 0}</span>
                    {(st?.clips ?? 0) > 0 && <span className="text-green-600 dark:text-green-400 shrink-0">클립 {st?.clips}</span>}
                  </div>
                </button>
              );
            })}
            {/* 미등록 곡 발견: 검색어가 있으면 등록곡 결과와 별개로 미매칭 타임라인 검색 진입점 제공 */}
            {songSearch.trim() && (
              <button
                id="workflow-unmatched-search"
                onClick={() => { setSelectedSongId(null); setUnmatchedQuery(songSearch.trim()); setMobileOpen(true); }}
                className={`w-full text-left px-3 py-2 border-b border-light-primary/10 dark:border-dark-primary/10 ${unmatchedQuery !== null ? "bg-light-accent/10 dark:bg-dark-accent/10" : "hover:bg-light-primary/5"}`}
              >
                <div className="truncate text-sm text-light-accent dark:text-dark-accent">🔍 &ldquo;{songSearch.trim()}&rdquo; 미등록 타임라인 검색</div>
                <div className="text-[10px] text-light-text/50 dark:text-dark-text/50 mt-0.5">등록곡이 아니어도 파싱된 이름으로 미매칭 출현 찾기</div>
              </button>
            )}
          </div>
        </div>

        {/* 우: 곡 작업 패널 / 미등록 검색 패널 */}
        <div className="hidden lg:block min-w-0 border border-light-primary/20 dark:border-dark-primary/20 rounded-lg p-4 min-h-[40vh]">
          <WorkflowWorkspace open={mobileOpen && (!!selectedSong || unmatchedQuery !== null)} onClose={() => setMobileOpen(false)} title={unmatchedQuery !== null ? `미등록 검색: ${unmatchedQuery}` : selectedSong?.titleAlias || selectedSong?.title || '곡 작업'} backLabel="곡 목록">
          {unmatchedQuery !== null ? (
            <UnmatchedSearchPanel
              key={`unmatched-${unmatchedQuery}`}
              query={unmatchedQuery}
              songs={songs}
              songsById={songsById}
              onStatusRefresh={loadSongStatuses}
            />
          ) : selectedSong ? (
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
          </WorkflowWorkspace>
        </div>
      </div>
      )}
    </div>
    </SongDurationContext.Provider>
  );
}
