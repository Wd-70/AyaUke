"use client";

/**
 * 선택한 곡의 클립 관리 패널.
 * 기본 클립 길이 표시/직접 수정, 기존 클립 일괄 적용(임계초), 클립 목록.
 */

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import {
  XMarkIcon,
  ClockIcon,
  BoltIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import ClipDetailPanel from "./ClipDetailPanel";
import {
  type ClipData,
  formatTime,
  parseTimeInput,
  clipsOverlap,
  platformBadgeClass,
  platformLabel,
  thumbnailSrc,
} from "./clip-types";

interface SongClipPanelProps {
  songId: string;
  onClose: () => void;
}

// 겹침 그룹별 색상 (같은 색 = 서로 겹치는 클립들)
const OVERLAP_COLORS = [
  "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
  "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300",
  "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
  "bg-lime-100 dark:bg-lime-900/40 text-lime-700 dark:text-lime-300",
];

interface SongInfo {
  _id: string;
  title: string;
  artist: string;
  titleAlias?: string;
  artistAlias?: string;
  clipDuration?: number;
}

export default function SongClipPanel({ songId, onClose }: SongClipPanelProps) {
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [selectedClip, setSelectedClip] = useState<ClipData | null>(null);
  const [durationInput, setDurationInput] = useState("");
  const [editingDuration, setEditingDuration] = useState(false);
  const [threshold, setThreshold] = useState("5");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-clips", "song-clips", songId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/clips?view=song-clips&songId=${encodeURIComponent(songId)}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error?.message || "클립을 불러오지 못했습니다.");
      return result.data as { clips: ClipData[]; song: SongInfo | null };
    },
  });

  const clips = data?.clips ?? [];
  const song = data?.song;
  const clipDuration = song?.clipDuration;

  // 겹침 감지 (이 곡 클립들만 — 소량이라 클라이언트 연산으로 충분).
  // 서로 겹치는 클립들을 그룹으로 묶어, 어떤 클립끼리 겹치는지 한눈에 보이게 한다.
  const { groupOf, partnersOf } = useMemo(() => {
    // union-find로 겹침 연결요소(그룹) 계산
    const parent = new Map<string, string>();
    clips.forEach((c) => parent.set(c._id, c._id));
    const find = (x: string): string => {
      let r = x;
      while (parent.get(r) !== r) r = parent.get(r)!;
      while (parent.get(x) !== r) {
        const next = parent.get(x)!;
        parent.set(x, r);
        x = next;
      }
      return r;
    };
    const partners = new Map<string, ClipData[]>();
    const addPartner = (id: string, other: ClipData) => {
      const list = partners.get(id) ?? [];
      list.push(other);
      partners.set(id, list);
    };
    for (let i = 0; i < clips.length; i++) {
      for (let j = i + 1; j < clips.length; j++) {
        if (clipsOverlap(clips[i], clips[j])) {
          parent.set(find(clips[i]._id), find(clips[j]._id));
          addPartner(clips[i]._id, clips[j]);
          addPartner(clips[j]._id, clips[i]);
        }
      }
    }
    // 겹침이 있는 클립에만 1부터 그룹 번호 부여 (등장 순서대로)
    const rootToNum = new Map<string, number>();
    const groupOf = new Map<string, number>();
    let n = 0;
    for (const c of clips) {
      if (!partners.has(c._id)) continue;
      const root = find(c._id);
      if (!rootToNum.has(root)) rootToNum.set(root, ++n);
      groupOf.set(c._id, rootToNum.get(root)!);
    }
    return { groupOf, partnersOf: partners };
  }, [clips]);

  const overlappingIds = groupOf;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-clips"] });
  };

  const saveDurationMutation = useMutation({
    mutationFn: async (duration: number | null) => {
      const res = await fetch(`/api/songdetails/${songId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipDuration: duration }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error?.message || "저장 실패");
      return duration;
    },
    onSuccess: (duration) => {
      showSuccess(
        "기본 길이 저장",
        duration != null ? `기본 클립 길이가 ${formatTime(duration)}로 설정되었습니다.` : "기본 클립 길이가 해제되었습니다.",
      );
      setEditingDuration(false);
      invalidate();
    },
    onError: (e) => showError("저장 실패", e.message),
  });

  const applyMutation = useMutation({
    mutationFn: async (thresholdSeconds: number) => {
      const res = await fetch("/api/admin/clips/apply-duration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, thresholdSeconds }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error?.message || "일괄 적용 실패");
      return result.data as { updated: number; skipped: number; total: number };
    },
    onSuccess: (r) => {
      showSuccess("일괄 적용 완료", `${r.updated}개 클립 갱신, ${r.skipped}개 보존 (총 ${r.total}개)`);
      invalidate();
    },
    onError: (e) => showError("일괄 적용 실패", e.message),
  });

  const handleSaveDuration = () => {
    if (durationInput.trim() === "") {
      saveDurationMutation.mutate(null);
      return;
    }
    const parsed = parseTimeInput(durationInput);
    if (parsed == null || parsed <= 0) {
      showError("입력 오류", '시간 형식이 올바르지 않습니다. 예: "3:45" 또는 "225"');
      return;
    }
    saveDurationMutation.mutate(parsed);
  };

  const handleApply = async () => {
    const t = parseFloat(threshold);
    if (isNaN(t) || t < 0) {
      showError("입력 오류", "임계값(초)을 올바르게 입력하세요.");
      return;
    }
    if (!clipDuration) {
      showError("기본 길이 없음", "먼저 이 곡의 기본 클립 길이를 설정하세요.");
      return;
    }
    const ok = await confirm.confirm({
      title: "기존 클립에 기본 길이 적용",
      message:
        `기본 길이(${formatTime(clipDuration)})와 ${t}초보다 크게 차이나는 클립들의 종료시간을\n` +
        `'시작 + ${formatTime(clipDuration)}'로 다시 설정합니다.\n\n` +
        `${t}초 이내로 맞춰진 클립과 검증 완료된 클립은 건드리지 않습니다.`,
      confirmText: "적용",
      cancelText: "취소",
      type: "warning",
    });
    if (ok) applyMutation.mutate(t);
  };

  return (
    <div className="space-y-4">
      {/* 곡 헤더 + 기본 길이 관리 */}
      <div className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm rounded-xl border border-light-primary/20 dark:border-dark-primary/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-light-text dark:text-dark-text truncate">
              {song ? (song.titleAlias || song.title) : "..."}
              <span className="ml-2 font-normal text-light-text/60 dark:text-dark-text/60">
                {song ? (song.artistAlias || song.artist) : ""}
              </span>
            </h3>
            <p className="text-xs text-light-text/50 dark:text-dark-text/50 mt-0.5">
              클립 {clips.length}개 · 검증 {clips.filter((c) => c.isVerified).length}개
              {overlappingIds.size > 0 && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">⚠ 시간 겹침 {overlappingIds.size}개</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-light-primary/10 dark:hover:bg-dark-primary/20 text-light-text/60 dark:text-dark-text/60 transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* 기본 클립 길이 */}
        <div className="mt-3 flex items-center gap-3 flex-wrap rounded-lg bg-light-primary/5 dark:bg-dark-primary/10 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-sm text-light-text/70 dark:text-dark-text/70">
            <ClockIcon className="w-4 h-4" />
            기본 클립 길이:
            {!editingDuration ? (
              <button
                onClick={() => {
                  setDurationInput(clipDuration ? formatTime(clipDuration) : "");
                  setEditingDuration(true);
                }}
                className="font-mono font-semibold text-light-text dark:text-dark-text underline decoration-dotted underline-offset-4 hover:text-light-accent dark:hover:text-dark-accent transition-colors"
                title="클릭해서 직접 수정 (M:SS 또는 초). 클립 편집 화면의 '이 길이를 곡 기본값으로' 버튼으로도 설정할 수 있습니다."
              >
                {clipDuration ? formatTime(clipDuration) : "미설정"}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <input
                  autoFocus
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveDuration();
                    if (e.key === "Escape") setEditingDuration(false);
                  }}
                  placeholder="3:45 (비우면 해제)"
                  className="w-28 px-2 py-1 text-sm font-mono rounded border border-light-primary/30 dark:border-dark-primary/30 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text"
                />
                <button onClick={handleSaveDuration} disabled={saveDurationMutation.isPending} className="px-2 py-1 text-xs rounded bg-light-accent dark:bg-dark-accent text-white disabled:opacity-50">
                  저장
                </button>
                <button onClick={() => setEditingDuration(false)} className="px-2 py-1 text-xs rounded border border-light-primary/30 dark:border-dark-primary/30 text-light-text/60 dark:text-dark-text/60">
                  취소
                </button>
              </span>
            )}
          </div>

          <div className="flex-1" />

          {/* 일괄 적용 */}
          <div className="flex items-center gap-2 text-sm">
            <label className="text-xs text-light-text/50 dark:text-dark-text/50" title="현재 길이가 기본 길이와 이 값(초) 이내로 차이나면 수동 조정으로 보고 보존합니다">
              허용 오차
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-16 px-2 py-1 text-sm rounded border border-light-primary/30 dark:border-dark-primary/30 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text font-mono"
            />
            <span className="text-xs text-light-text/50 dark:text-dark-text/50">초</span>
            <button
              onClick={handleApply}
              disabled={applyMutation.isPending || !clipDuration}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 transition-colors"
              title={
                clipDuration
                  ? `기본 길이와 ${threshold}초보다 크게 차이나는 클립만 '시작+기본길이'로 갱신합니다`
                  : "먼저 기본 클립 길이를 설정하세요"
              }
            >
              <BoltIcon className="w-3.5 h-3.5" />
              {applyMutation.isPending ? "적용 중..." : "기존 클립에 일괄 적용"}
            </button>
          </div>
        </div>
      </div>

      {/* 클립 상세 (선택 시) */}
      {selectedClip && (
        <ClipDetailPanel
          clip={selectedClip}
          songClipDuration={clipDuration}
          onClose={() => setSelectedClip(null)}
          onChanged={() => refetch()}
        />
      )}

      {/* 클립 목록 */}
      <div className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm rounded-xl border border-light-primary/20 dark:border-dark-primary/20 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-10">
            <div className="w-6 h-6 border-2 border-light-accent/30 dark:border-dark-accent/30 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
          </div>
        ) : clips.length === 0 ? (
          <p className="p-6 text-sm text-light-text/50 dark:text-dark-text/50 text-center">이 곡에 등록된 클립이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-light-primary/10 dark:divide-dark-primary/10">
            {clips.map((clip) => {
              const duration = clip.endTime != null ? clip.endTime - (clip.startTime || 0) : null;
              const deviates =
                clipDuration && duration != null && Math.abs(duration - clipDuration) > parseFloat(threshold || "5");
              return (
                <li key={clip._id}>
                  <button
                    onClick={() => setSelectedClip(clip)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-light-primary/5 dark:hover:bg-dark-primary/10 transition-colors ${
                      selectedClip?._id === clip._id ? "bg-light-accent/10 dark:bg-dark-accent/10" : ""
                    }`}
                  >
                    <div className="relative w-20 h-12 flex-shrink-0 rounded overflow-hidden bg-gray-200 dark:bg-gray-700">
                      <Image src={thumbnailSrc(clip)} alt="" fill className="object-cover" unoptimized />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm text-light-text dark:text-dark-text font-mono">
                          {formatTime(clip.startTime || 0)}
                          {clip.endTime != null && ` ~ ${formatTime(clip.endTime)}`}
                        </span>
                        {duration != null && (
                          <span className={`text-xs font-mono ${deviates ? "text-amber-600 dark:text-amber-400" : "text-light-text/50 dark:text-dark-text/50"}`}>
                            ({formatTime(duration)})
                          </span>
                        )}
                        {clip.endTime == null && (
                          <span className="text-xs text-orange-500 dark:text-orange-400">종료 미설정</span>
                        )}
                      </div>
                      <div className="text-xs text-light-text/50 dark:text-dark-text/50 mt-0.5">
                        {clip.sungDate?.slice(0, 10)} · {clip.addedByName}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {groupOf.has(clip._id) && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-medium inline-flex items-center gap-0.5 ${OVERLAP_COLORS[(groupOf.get(clip._id)! - 1) % OVERLAP_COLORS.length]}`}
                          title={`시간 겹침 (그룹 ${groupOf.get(clip._id)}) — 같은 색끼리 겹침\n겹치는 클립: ${(partnersOf.get(clip._id) ?? [])
                            .map((p) => `${formatTime(p.startTime || 0)}${p.endTime != null ? `~${formatTime(p.endTime)}` : "~?"}`)
                            .join(", ")}`}
                        >
                          <ExclamationTriangleIcon className="w-3 h-3" />
                          겹침 {groupOf.get(clip._id)}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[11px] ${platformBadgeClass(clip.platform)}`}>
                        {platformLabel(clip.platform)}
                      </span>
                      {clip.isVerified && <CheckCircleSolid className="w-4 h-4 text-blue-500" />}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
