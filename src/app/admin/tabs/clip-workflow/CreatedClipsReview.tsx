"use client";

/**
 * 생성된 클립 확인·재생·즉시 편집 다이얼로그 (클립 만들기/yt-clip-builder 공용).
 * 좌측 생성 클립 목록, 우측은 선택 클립을 항상 편집 모드로(EditPlayer+ClipTimeEditor)
 * 시간 미세조정·설명 편집 후 저장(PATCH updateClip). 검증/삭제도 같은 화면에서.
 * react-query/토스트 의존 없이 plain fetch + 로컬 상태로 동작.
 */

import { useCallback, useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import ClipTimeEditor from "@/app/admin/tabs/live-clips/ClipTimeEditor";
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
  onChanged?: () => void;
}

export default function CreatedClipsReview({ query, title = "생성된 클립", onClose, onChanged }: Props) {
  const [clips, setClips] = useState<ClipData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ startTime: number; endTime: number | null; description: string }>({ startTime: 0, endTime: null, description: "" });
  const [saving, setSaving] = useState(false);
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

  useEffect(() => { load(); }, [load]);

  // 다이얼로그가 열린 동안 뒤 화면의 플레이어(yt-clip-builder CalibrationPlayer 등이
  // window 전역 keydown으로 Space/←→/숫자키를 처리함)로 키가 새지 않도록 캡처 단계에서
  // 가로챈다. Space는 이 다이얼로그의 플레이어를 재생/정지.
  useEffect(() => {
    const blocked = new Set([" ", "ArrowLeft", "ArrowRight", "Enter", "1", "2", "3", "4", "5", "6"]);
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!blocked.has(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === " ") (isPlaying ? adapter?.pause() : adapter?.play());
    };
    window.addEventListener("keydown", onKey, true); // 캡처 단계 → 뒤 화면 window 리스너보다 먼저
    return () => window.removeEventListener("keydown", onKey, true);
  }, [adapter, isPlaying]);

  const selected = clips.find((c) => c._id === selectedId) || null;

  // 클립 선택이 바뀌면 편집값을 그 클립으로 초기화하고, 플레이어를 그 시작시각으로 이동.
  // (같은 영상의 클립을 오갈 때 플레이어는 remount되지 않으므로 adapter로 직접 seek)
  useEffect(() => {
    const c = clips.find((x) => x._id === selectedId);
    if (!c) return;
    setEditData({ startTime: c.startTime ?? 0, endTime: c.endTime ?? null, description: c.description ?? "" });
    adapter?.seekTo(c.startTime ?? 0);
  }, [selectedId, adapter]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/clips", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId: selected._id, action: "updateClip", data: { startTime: editData.startTime, endTime: editData.endTime ?? undefined, description: editData.description } }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "저장 실패");
      // 로컬 즉시 반영 + 목록 갱신
      setClips((prev) => prev.map((c) => (c._id === selected._id ? { ...c, startTime: editData.startTime, endTime: editData.endTime ?? undefined, description: editData.description } : c)));
      setMsg("저장됨");
      onChanged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const verify = async (v: boolean) => {
    if (!selected) return;
    await fetch("/api/admin/clips", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipId: selected._id, action: v ? "verify" : "unverify" }),
    }).catch(() => {});
    setClips((prev) => prev.map((c) => (c._id === selected._id ? { ...c, isVerified: v } : c)));
    onChanged?.();
  };

  const remove = async () => {
    if (!selected || !confirm("이 클립을 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/clips?clipId=${selected._id}`, { method: "DELETE" }).catch(() => {});
    setClips((prev) => prev.filter((c) => c._id !== selected._id));
    setSelectedId(null);
    onChanged?.();
  };

  const platform = (selected?.platform || "youtube") as Platform;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[88vh] flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-light-primary/20 dark:border-dark-primary/20 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-light-primary/15 dark:border-dark-primary/15">
          <h3 className="font-bold text-light-text dark:text-dark-text">{title} ({clips.length})</h3>
          <div className="flex items-center gap-2">
            {msg && <span className="text-xs text-light-text/60 dark:text-dark-text/60">{msg}</span>}
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-light-primary/10 dark:hover:bg-dark-primary/20" title="닫기">
              <XMarkIcon className="w-5 h-5 text-light-text/60 dark:text-dark-text/60" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-0 min-h-0 flex-1">
          {/* 좌: 클립 목록 */}
          <div className="border-r border-light-primary/15 dark:border-dark-primary/15 overflow-y-auto max-h-[78vh]">
            {loading ? (
              <p className="p-4 text-center text-xs text-light-text/50">불러오는 중...</p>
            ) : clips.length === 0 ? (
              <p className="p-4 text-center text-xs text-light-text/50">생성된 클립이 없습니다.</p>
            ) : clips.map((c) => {
              const sel = c._id === selectedId;
              return (
                <button key={c._id} onClick={() => setSelectedId(c._id)} className={`w-full text-left px-3 py-2 border-b border-light-primary/10 dark:border-dark-primary/10 ${sel ? "bg-light-accent/10 dark:bg-dark-accent/10" : "hover:bg-light-primary/5"}`}>
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
          <div className="p-4 overflow-y-auto max-h-[78vh]">
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
                  startTime={editData.startTime}
                  endTime={editData.endTime}
                  adapter={adapter}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  songClipDuration={selected.songDetail?.clipDuration ?? null}
                  onChange={(patch) => setEditData((p) => ({ ...p, startTime: patch.startTime ?? p.startTime, endTime: patch.endTime !== undefined ? patch.endTime : p.endTime }))}
                />
                <input
                  value={editData.description}
                  onChange={(e) => setEditData((p) => ({ ...p, description: e.target.value }))}
                  placeholder="설명"
                  className="w-full text-sm rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text px-2 py-1"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={save} disabled={saving} className="px-4 py-1.5 text-sm rounded-lg bg-light-accent dark:bg-dark-accent text-white disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button>
                  <button onClick={() => verify(!selected.isVerified)} className="px-3 py-1.5 text-sm rounded-lg border border-light-primary/20 dark:border-dark-primary/20 text-light-text/70 dark:text-dark-text/70">
                    {selected.isVerified ? "검증 해제" : "검증 완료"}
                  </button>
                  <button onClick={remove} className="px-3 py-1.5 text-sm rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 ml-auto">삭제</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
