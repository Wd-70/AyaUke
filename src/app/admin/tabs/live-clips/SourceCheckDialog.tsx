"use client";

/**
 * 클립 소스 점검 관리 다이얼로그.
 * 플랫폼(치지직/유튜브/같이) 선택 → 영상 단위로 청크 점검(SSE 없이 POST 반복,
 * 실시간 진행률·로그) → 완료 후 재생불가 현황을 확인하고 선택해서 숨김 처리.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { SourceTarget, SourceCheckRow } from "./clip-types";

type Phase = "idle" | "running" | "done";
type Plat = "all" | "chzzk" | "youtube";

const CHUNK = 10;
const keyOf = (r: { platform: string; videoId: string }) => `${r.platform}:${r.videoId}`;

interface Props {
  onClose: () => void;
  onApplied: () => void;
}

export default function SourceCheckDialog({ onClose, onApplied }: Props) {
  const [platform, setPlatform] = useState<Plat>("all");
  const [phase, setPhase] = useState<Phase>("idle");
  const [total, setTotal] = useState(0);
  const [checked, setChecked] = useState(0);
  const [current, setCurrent] = useState<string>("");
  const [rows, setRows] = useState<SourceCheckRow[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const addLog = useCallback((line: string) => setLog((p) => [line, ...p].slice(0, 200)), []);

  const start = async () => {
    setPhase("running");
    setRows([]); setLog([]); setChecked(0); setSelected(new Set()); setApplyMsg(null);
    cancelRef.current = false;
    try {
      const tRes = await fetch(`/api/admin/clips/check-sources?platform=${platform}`).then((r) => r.json());
      if (!tRes.success) { addLog(`대상 조회 실패: ${tRes.error?.message || ""}`); setPhase("idle"); return; }
      const targets: SourceTarget[] = tRes.data.targets;
      setTotal(targets.length);
      addLog(`점검 대상 ${targets.length}개 영상`);

      const dead: SourceCheckRow[] = [];
      for (let i = 0; i < targets.length; i += CHUNK) {
        if (cancelRef.current) { addLog("사용자 중단"); break; }
        const chunk = targets.slice(i, i + CHUNK);
        setCurrent(`${chunk[0].platform} ${chunk[0].videoId} 외 ${chunk.length - 1}개`);
        const res = await fetch("/api/admin/clips/check-sources", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targets: chunk }),
        }).then((r) => r.json());
        if (res.success) {
          const batch: SourceCheckRow[] = res.data.rows;
          setRows((p) => [...p, ...batch]);
          for (const r of batch) {
            if (r.status === "dead") { dead.push(r); addLog(`✖ ${r.platform} ${r.videoId} — ${r.reason} (클립 ${r.clips})`); }
            else if (r.status === "unknown") addLog(`? ${r.platform} ${r.videoId} — ${r.reason}`);
          }
        } else {
          addLog(`배치 실패: ${res.error?.message || ""}`);
        }
        setChecked(Math.min(i + CHUNK, targets.length));
      }
      // 재생불가는 기본 전체 선택
      setSelected(new Set(dead.map(keyOf)));
      setPhase("done");
      setCurrent("");
    } catch (e) {
      addLog(`오류: ${e instanceof Error ? e.message : ""}`);
      setPhase("done");
    }
  };

  const deadRows = useMemo(() => rows.filter((r) => r.status === "dead"), [rows]);
  const summary = useMemo(() => ({
    available: rows.filter((r) => r.status === "available").length,
    dead: rows.filter((r) => r.status === "dead").length,
    unknown: rows.filter((r) => r.status === "unknown").length,
  }), [rows]);

  const toggle = (k: string) => setSelected((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const allSelected = deadRows.length > 0 && deadRows.every((r) => selected.has(keyOf(r)));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(deadRows.map(keyOf)));

  const selectedClips = deadRows.filter((r) => selected.has(keyOf(r))).reduce((s, r) => s + r.clips, 0);

  const apply = async () => {
    const videos = deadRows.filter((r) => selected.has(keyOf(r))).map((r) => ({ platform: r.platform, videoId: r.videoId }));
    if (videos.length === 0) return;
    setApplying(true); setApplyMsg(null);
    try {
      const res = await fetch("/api/admin/clips/check-sources", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videos, unavailable: true }),
      }).then((r) => r.json());
      if (res.success) {
        setApplyMsg(`${videos.length}개 영상 · ${res.data.modified}개 클립 숨김 처리`);
        // 적용한 영상은 목록에서 제거 → 다시 눌려 중복 처리/깜빡임 방지, 수렴
        const appliedKeys = new Set(videos.map((v) => `${v.platform}:${v.videoId}`));
        setRows((prev) => prev.filter((r) => !appliedKeys.has(keyOf(r))));
        setSelected(new Set());
        onApplied();
      } else setApplyMsg(res.error?.message || "처리 실패");
    } catch { setApplyMsg("처리 중 오류"); }
    finally { setApplying(false); }
  };

  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={phase === "running" ? undefined : onClose} />
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-light-primary/20 dark:border-dark-primary/20 shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-light-primary/15 dark:border-dark-primary/15">
          <h3 className="font-bold text-light-text dark:text-dark-text">클립 소스 점검</h3>
          <button onClick={onClose} disabled={phase === "running"} className="p-1.5 rounded-full hover:bg-light-primary/10 dark:hover:bg-dark-primary/20 disabled:opacity-40" title="닫기">
            <XMarkIcon className="w-5 h-5 text-light-text/60 dark:text-dark-text/60" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {/* 플랫폼 선택 + 시작 */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-lg border border-light-primary/20 dark:border-dark-primary/20 overflow-hidden">
              {([["all", "같이"], ["chzzk", "치지직만"], ["youtube", "유튜브만"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setPlatform(k)} disabled={phase === "running"}
                  className={`px-3 py-1.5 text-sm transition-colors ${platform === k ? "bg-light-accent dark:bg-dark-accent text-white" : "text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10"}`}>
                  {label}
                </button>
              ))}
            </div>
            {phase === "running" ? (
              <button onClick={() => { cancelRef.current = true; }} className="px-3 py-1.5 text-sm rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400">중단</button>
            ) : (
              <button onClick={start} className="px-4 py-1.5 text-sm rounded-lg bg-light-accent dark:bg-dark-accent text-white font-medium hover:shadow-lg">
                {phase === "done" ? "다시 점검" : "점검 시작"}
              </button>
            )}
          </div>

          {/* 진행률 */}
          {(phase === "running" || phase === "done") && (
            <div>
              <div className="flex items-center justify-between text-xs text-light-text/60 dark:text-dark-text/60 mb-1">
                <span>{phase === "running" ? `확인 중: ${current}` : "점검 완료"}</span>
                <span>{checked}/{total} ({pct}%) · 불가 {summary.dead} · 미확인 {summary.unknown}</span>
              </div>
              <div className="h-2 rounded-full bg-light-primary/10 dark:bg-dark-primary/20 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {/* 실시간 로그 */}
          {log.length > 0 && (
            <div className="rounded-lg border border-light-primary/15 dark:border-dark-primary/15 bg-light-primary/5 dark:bg-dark-primary/10 p-2 max-h-32 overflow-y-auto text-[11px] font-mono text-light-text/70 dark:text-dark-text/70 space-y-0.5">
              {log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}

          {/* 완료: 재생불가 현황 + 선택 처리 */}
          {phase === "done" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-light-text dark:text-dark-text">재생불가 {deadRows.length}개 영상 (클립 {deadRows.reduce((s, r) => s + r.clips, 0)}개)</span>
                {deadRows.length > 0 && (
                  <label className="text-xs text-light-text/60 dark:text-dark-text/60 inline-flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} /> 전체 선택
                  </label>
                )}
              </div>
              {deadRows.length === 0 ? (
                <p className="text-sm text-light-text/50 dark:text-dark-text/50">재생 불가한 소스가 없습니다.</p>
              ) : (
                <div className="rounded-lg border border-light-primary/15 dark:border-dark-primary/15 overflow-hidden max-h-60 overflow-y-auto">
                  {deadRows.map((r) => {
                    const k = keyOf(r);
                    return (
                      <label key={k} className="flex items-center gap-2 px-3 py-1.5 text-sm border-b border-light-primary/10 dark:border-dark-primary/10 cursor-pointer hover:bg-light-primary/5">
                        <input type="checkbox" checked={selected.has(k)} onChange={() => toggle(k)} />
                        <span className={`text-[10px] px-1 rounded ${r.platform === "chzzk" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300"}`}>{r.platform === "chzzk" ? "CH" : "YT"}</span>
                        <span className="font-mono text-xs text-light-text/70 dark:text-dark-text/70 shrink-0">{r.videoId}</span>
                        <span className="flex-1 min-w-0 truncate text-light-text/80 dark:text-dark-text/80">{r.title || ""} <span className="text-light-text/40">· {r.reason}</span></span>
                        <span className="text-xs text-light-text/50 shrink-0">클립 {r.clips}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {summary.unknown > 0 && (
                <p className="mt-2 text-xs text-light-text/50 dark:text-dark-text/50">※ 미확인 {summary.unknown}개는 일시 오류로 판정 못함 — 변경하지 않습니다(다시 점검 권장).</p>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        {phase === "done" && deadRows.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-light-primary/15 dark:border-dark-primary/15">
            <span className="text-sm text-light-text/60 dark:text-dark-text/60">{applyMsg}</span>
            <button onClick={apply} disabled={applying || selectedClips === 0} className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium disabled:opacity-50">
              {applying ? "처리 중..." : `선택 숨기기 (영상 ${deadRows.filter((r) => selected.has(keyOf(r))).length} · 클립 ${selectedClips})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
