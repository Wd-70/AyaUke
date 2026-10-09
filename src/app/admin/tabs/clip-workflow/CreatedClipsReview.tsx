"use client";

/**
 * 생성된 클립 확인·재생·즉시 편집 다이얼로그 (클립 만들기/yt-clip-builder 공용).
 * 좌측 생성 클립 목록, 우측은 선택 클립을 항상 편집 모드로(EditPlayer+ClipTimeEditor)
 * 시간 미세조정·설명 편집 후 저장(PATCH updateClip). 검증/삭제도 같은 화면에서.
 * react-query/토스트 의존 없이 plain fetch + 로컬 상태로 동작.
 */

import { useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from 'react-dom';
import { useMobileViewport, usePortalHost, useWorkflowMobile, useWorkflowOverlay } from './WorkflowWorkspace';
import { SongDurationContext } from './SongDurationContext';
import { workflowRequest } from './workflow-client';
import { XMarkIcon } from "@heroicons/react/24/outline";
import ClipTimeEditor from "@/app/admin/tabs/live-clips/ClipTimeEditor";
import ClipVerifyButton from "@/app/admin/tabs/live-clips/ClipVerifyButton";
import type { EditPlayerAdapter, ClipData } from "@/app/admin/tabs/live-clips/clip-types";
import { formatTime } from "@/app/admin/tabs/live-clips/clip-types";
import EditPlayer from "./EditPlayer";
import type { Platform } from "./types";

interface Props {
  /** /api/admin/clips 쿼리스트링 (예: "videoId=abc" 또는 "songId=xyz") */
  query: string;
  title?: string;
  onClose: () => void;
  /** 변경(편집/삭제) 발생 시 상위 갱신용 */
  onChanged?: () => void | Promise<void>;
}

export default function CreatedClipsReview({ query, title = "생성된 클립", onClose, onChanged }: Props) {
  const mobile = useWorkflowMobile();
  const host = usePortalHost();
  const dialog = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const titleId = useId();
  const [editing, setEditing] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [deleting, setDeleting] = useState(false);
  const viewportHeight = useMobileViewport();
  const [footer, setFooter] = useState<HTMLDivElement | null>(null);
  const onSongDurationSaved = useContext(SongDurationContext);
  const [clips, setClips] = useState<ClipData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ startTime: number; endTime: number | null; description: string }>({ startTime: 0, endTime: null, description: "" });
  const [saving, setSaving] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 편집 플레이어 상태
  const [adapter, setAdapter] = useState<EditPlayerAdapter | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clips?view=clips&limit=100&sortBy=sungDate&${query}`).then((r) => r.json());
      if (res.success) {
        setClips(res.data.clips);
        setSelectedId((prev) => prev ?? res.data.clips[0]?._id ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { void load().catch((error) => setMsg(error.message)); }, [load]);

  // 다이얼로그가 열린 동안 뒤 화면의 플레이어(yt-clip-builder CalibrationPlayer 등이
  // window 전역 keydown으로 Space/←→/숫자키를 처리함)로 키가 새지 않도록 캡처 단계에서
  // 가로챈다. Space는 이 다이얼로그의 플레이어를 재생/정지.
  useEffect(() => {
    const blocked = new Set([" ", "ArrowLeft", "ArrowRight", "Enter", "1", "2", "3", "4", "5", "6"]);
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('button, a, input, textarea, select, summary') || t.isContentEditable)) return;
      if (!blocked.has(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === " ") (isPlaying ? adapter?.pause() : adapter?.play());
    };
    window.addEventListener("keydown", onKey, true); // 캡처 단계 → 뒤 화면 window 리스너보다 먼저
    return () => window.removeEventListener("keydown", onKey, true);
  }, [adapter, isPlaying]);

  const selected = clips.find((c) => c._id === selectedId) || null;
  const busy = saving || savingDefault || verifying || deleting;
  const dirty = !!selected && (editData.startTime !== (selected.startTime ?? 0) || editData.endTime !== (selected.endTime ?? null) || editData.description !== (selected.description ?? ''));
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const requestNavigation = (action: () => void) => {
    if (busy) return;
    (document.activeElement as HTMLElement | null)?.blur();
    requestAnimationFrame(() => {
      if (dirtyRef.current) setPendingNavigation(() => action);
      else action();
    });
  };
  useWorkflowOverlay(true, host, dialog, () => requestNavigation(onClose));
  useEffect(() => { if (mobile && !editing) adapter?.pause(); }, [mobile, editing, adapter]);
  const index = clips.findIndex((clip) => clip._id === selectedId);
  const selectClip = (id: string) => requestNavigation(() => {
    if (mobile && !editing) listScroll.current = body.current?.scrollTop ?? 0;
    setSelectedId(id);
    setEditing(true);
    requestAnimationFrame(() => body.current?.scrollTo({ top: 0 }));
  });
  const backToList = () => requestNavigation(() => {
    setEditing(false);
    requestAnimationFrame(() => body.current?.scrollTo({ top: listScroll.current }));
  });

  // 클립 선택이 바뀌면 편집값을 그 클립으로 초기화하고, 플레이어를 그 시작시각으로 이동.
  // (같은 영상의 클립을 오갈 때 플레이어는 remount되지 않으므로 adapter로 직접 seek)
  useEffect(() => {
    const c = clips.find((x) => x._id === selectedId);
    if (!c) return;
    setEditData({ startTime: c.startTime ?? 0, endTime: c.endTime ?? null, description: c.description ?? "" });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selected) adapter?.seekTo(selected.startTime ?? 0); }, [selectedId, adapter]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!selected) return false;
    setSaving(true);
    setMsg(null);
    try {
      const result = await workflowRequest<{ clip: ClipData }>("/api/admin/clips", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId: selected._id, action: "updateClip", data: { startTime: editData.startTime, endTime: editData.endTime, description: editData.description } }),
      });
      // 로컬 즉시 반영 + 목록 갱신
      setClips((prev) => prev.map((c) => (c._id === selected._id ? { ...c, ...result.clip } : c)));
      setMsg("저장됨");
      try { await onChanged?.(); } catch { setMsg('저장됨 · 목록 갱신 실패'); }
      return true;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "저장 실패");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const verify = async (v: boolean) => {
    if (!selected) return;
    setVerifying(true);
    try {
      await workflowRequest("/api/admin/clips", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId: selected._id, action: v ? "verify" : "unverify" }),
      });
      // 로컬 즉시 반영 (list row · 배지 · 버튼이 공유) → refetch 복제지연에도 안 되돌아감
      setClips((prev) => prev.map((c) => (c._id === selected._id ? { ...c, isVerified: v } : c)));
      await onChanged?.();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : '검증 상태 저장 실패');
    } finally {
      setVerifying(false);
    }
  };

  // #1 이 길이를 곡 기본값으로 — SongDetail.clipDuration 저장. 같은 곡의 모든 클립
  // songDetail을 로컬 갱신해 '기본길이 적용' 버튼·기본값 표시가 즉시 반영되게 한다.
  const setDefaultDuration = async (duration: number) => {
    if (!selected?.songId) return;
    setSavingDefault(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/songdetails/${selected.songId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipDuration: duration }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) throw new Error(result?.error?.message || "기본 길이 저장 실패");
      onSongDurationSaved(selected.songId, duration);
      setClips((prev) => prev.map((c) =>
        c.songId === selected.songId && c.songDetail
          ? { ...c, songDetail: { ...c.songDetail, clipDuration: duration } }
          : c,
      ));
      setMsg(`곡 기본 길이 ${formatTime(duration)} 저장됨`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "기본 길이 저장 실패");
    } finally {
      setSavingDefault(false);
    }
  };

  const remove = async () => {
    if (!selected || busy || !confirm("이 클립을 삭제하시겠습니까?")) return;
    setDeleting(true);
    try {
      await workflowRequest(`/api/admin/clips?clipId=${selected._id}`, { method: "DELETE" });
      setClips((prev) => prev.filter((c) => c._id !== selected._id));
      const remaining = clips.filter((clip) => clip._id !== selected._id);
      setSelectedId(remaining[Math.min(index, remaining.length - 1)]?._id ?? null);
      if (!remaining.length) setEditing(false);
      await onChanged?.();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : '클립 삭제 실패');
    } finally {
      setDeleting(false);
    }
  };

  const platform = (selected?.platform || "youtube") as Platform;

  if (!host) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center lg:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => requestNavigation(onClose)} />
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} style={mobile && viewportHeight ? { height: viewportHeight } : undefined} className="relative w-full lg:max-w-5xl h-screen supports-[height:100dvh]:h-[100dvh] lg:h-auto lg:max-h-[88vh] flex flex-col bg-white dark:bg-gray-900 lg:rounded-xl border border-light-primary/20 dark:border-dark-primary/20 shadow-2xl outline-none pt-[env(safe-area-inset-top)] lg:pt-0">
        <div className="flex items-center justify-between px-5 py-3 border-b border-light-primary/15 dark:border-dark-primary/15">
          <h3 id={titleId} className="min-w-0 break-words font-bold text-light-text dark:text-dark-text">{title} ({clips.length})</h3>
          <div className="flex items-center gap-2">
            {msg && <span role="status" className="text-xs text-light-text/60 dark:text-dark-text/60">{msg}</span>}
            <button onClick={() => requestNavigation(onClose)} disabled={busy} className="min-h-11 min-w-11 p-1.5 rounded-full hover:bg-light-primary/10 dark:hover:bg-dark-primary/20" title="닫기" aria-label="생성된 클립 확인 닫기">
              <XMarkIcon className="w-5 h-5 text-light-text/60 dark:text-dark-text/60" />
            </button>
          </div>
        </div>

        <div ref={body} className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-0 min-h-0 flex-1 overflow-y-auto lg:overflow-visible overscroll-contain pb-[env(safe-area-inset-bottom)] lg:pb-0">
          {/* 좌: 클립 목록 */}
          <div className={`${mobile && editing ? 'hidden' : ''} border-r border-light-primary/15 dark:border-dark-primary/15 lg:overflow-y-auto lg:max-h-[78vh]`}>
            {loading ? (
              <p className="p-4 text-center text-xs text-light-text/50">불러오는 중...</p>
            ) : clips.length === 0 ? (
              <p className="p-4 text-center text-xs text-light-text/50">생성된 클립이 없습니다.</p>
            ) : clips.map((c) => {
              const sel = c._id === selectedId;
              return (
                <button key={c._id} disabled={busy} onClick={() => selectClip(c._id)} className={`min-h-11 w-full text-left px-3 py-2 border-b border-light-primary/10 dark:border-dark-primary/10 ${sel ? "bg-light-accent/10 dark:bg-dark-accent/10" : "hover:bg-light-primary/5"}`}>
                  <div className="truncate text-sm text-light-text dark:text-dark-text">{c.songDetail?.titleAlias || c.title}</div>
                  <div className="flex items-center gap-2 text-[10px] text-light-text/50 dark:text-dark-text/50 mt-0.5">
                    <span className="truncate">{c.songDetail?.artistAlias || c.artist}</span>
                    <span className="shrink-0 font-mono">{formatTime(c.startTime ?? 0)}~{formatTime(c.endTime ?? null)}</span>
                    {c.isVerified && <span className="text-blue-500 shrink-0">검증</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 우: 재생 / 편집 */}
          <div className={`${mobile && !editing ? 'hidden' : ''} min-w-0 p-4 lg:overflow-y-auto lg:max-h-[78vh]`}>
            {mobile && <div className="flex justify-between items-center gap-2 pb-3 text-sm text-light-text dark:text-dark-text">
              <button type="button" className="min-h-11" disabled={busy} onClick={backToList}>← 클립 목록</button>
              <span>{index + 1} / {clips.length}</span>
            </div>}
            {!selected ? (
              <p className="text-sm text-light-text/50 p-8 text-center">클립을 선택하세요.</p>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-light-text dark:text-dark-text">
                  <span className="font-medium">{selected.songDetail?.titleAlias || selected.title}</span> · {selected.songDetail?.artistAlias || selected.artist}
                  {selected.isVerified && <span className="ml-2 text-xs text-blue-500">검증됨</span>}
                </div>
                <div className="text-xs text-light-text/60 dark:text-dark-text/60">
                  {selected.sungDate?.slice(0, 10)} · {platform === "chzzk" ? "치지직" : "유튜브"} {selected.videoId}
                </div>
                <EditPlayer
                  key={`${platform}-${selected.videoId}`}
                  platform={platform}
                  videoId={selected.videoId}
                  videoUrl={selected.videoUrl}
                  startTime={selected.startTime ?? 0}
                  onAdapter={setAdapter}
                  onTimeUpdate={setCurrentTime}
                  onPlayStateChange={setIsPlaying}
                  className="max-w-2xl mx-auto"
                />
                <ClipTimeEditor
                  mobileControls={mobile}
                  startTime={editData.startTime}
                  endTime={editData.endTime}
                  adapter={adapter}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  songClipDuration={selected.songDetail?.clipDuration ?? null}
                  onSetDefaultDuration={setDefaultDuration}
                  savingDefault={savingDefault}
                  onChange={(patch) => setEditData((p) => ({ ...p, startTime: patch.startTime ?? p.startTime, endTime: patch.endTime !== undefined ? patch.endTime : p.endTime }))}
                />
                <input
                  value={editData.description}
                  onChange={(e) => setEditData((p) => ({ ...p, description: e.target.value }))}
                  placeholder="설명"
                  className="min-h-11 w-full text-base lg:text-sm rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text px-2 py-1"
                />
                <div className="flex items-center gap-2 flex-wrap [&_button]:min-h-11">
                  <button onClick={() => { void save(); }} disabled={busy} className="px-4 py-1.5 text-sm rounded-lg bg-light-accent dark:bg-dark-accent text-white disabled:opacity-50">{saving ? "저장 중..." : dirty ? "변경 저장" : "저장"}</button>
                  <ClipVerifyButton verified={selected.isVerified} onToggle={() => verify(!selected.isVerified)} isPending={busy} />
                  <button onClick={remove} disabled={busy} className="px-3 py-1.5 text-sm rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 ml-auto">{deleting ? '삭제 중...' : '삭제'}</button>
                </div>
                {mobile && editing && footer && createPortal(<nav aria-label="클립 이동" className="flex justify-between gap-3 text-sm text-light-text dark:text-dark-text">
                  <button type="button" className="min-h-11 px-3" disabled={busy || index <= 0} onClick={() => selectClip(clips[index - 1]._id)}>← 이전 클립</button>
                  <button type="button" className="min-h-11 px-3" disabled={busy || index >= clips.length - 1} onClick={() => selectClip(clips[index + 1]._id)}>다음 클립 →</button>
                </nav>, footer)}
              </div>
            )}
          </div>
        </div>
        {mobile && <div ref={setFooter} className="shrink-0 border-t border-light-primary/20 dark:border-dark-primary/20 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] empty:hidden" />}
      </div>
      {pendingNavigation && <UnsavedChangesDialog busy={saving} message={msg} onCancel={() => setPendingNavigation(null)} onDiscard={() => {
        if (selected) setEditData({ startTime: selected.startTime ?? 0, endTime: selected.endTime ?? null, description: selected.description ?? '' });
        pendingNavigation(); setPendingNavigation(null);
      }} onSave={async () => { if (await save()) { pendingNavigation(); setPendingNavigation(null); } }} />}
    </div>, host
  );
}

function UnsavedChangesDialog({ busy, message, onCancel, onDiscard, onSave }: { busy: boolean; message: string | null; onCancel: () => void; onDiscard: () => void; onSave: () => Promise<void> }) {
  const host = usePortalHost();
  const dialog = useRef<HTMLDivElement>(null);
  const id = useId();
  useWorkflowOverlay(true, host, dialog, () => { if (!busy) onCancel(); });
  if (!host) return null;
  return createPortal(<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
    <div ref={dialog} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby={id} className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-900 p-5 text-light-text dark:text-dark-text outline-none">
      <h3 id={id} className="font-semibold">저장하지 않은 변경이 있습니다</h3>
      <p className="py-3 text-sm">이동하기 전에 변경을 저장할까요?</p>
      {message && <p role="status" className="pb-3 text-sm">{message}</p>}
      <div className="flex flex-col gap-2">
        <button type="button" className="min-h-11 rounded-lg bg-light-accent dark:bg-dark-accent text-white" disabled={busy} onClick={() => { void onSave(); }}>{busy ? '저장 중...' : '저장하고 이동'}</button>
        <button type="button" className="min-h-11" disabled={busy} onClick={onDiscard}>변경 버리고 이동</button>
        <button type="button" className="min-h-11" disabled={busy} onClick={onCancel}>계속 편집</button>
      </div>
    </div>
  </div>, host);
}
