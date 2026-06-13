"use client";

/**
 * 클립 상세 패널 — 곡별 보기/전체 목록 공용.
 * 시청 모드: ClipPlayer(구간 전용). 편집 모드: 전체 영상 플레이어 + 시간 편집기.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";
import ClipPlayer, { loadYouTubeApi } from "@/components/clip/ClipPlayer";
import ChzzkPlayer, { type ChzzkPlayerHandle } from "@/components/video/ChzzkPlayer";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import ClipTimeEditor from "./ClipTimeEditor";
import {
  type ClipData,
  type EditPlayerAdapter,
  formatTime,
  platformBadgeClass,
  platformLabel,
} from "./clip-types";

interface ClipDetailPanelProps {
  clip: ClipData;
  /** 곡의 기본 클립 길이 (있으면 편집기에 표시) */
  songClipDuration?: number | null;
  onClose: () => void;
  /** 데이터 변경 후 목록 갱신용 */
  onChanged: () => void;
}

interface EditData {
  videoUrl: string;
  sungDate: string;
  startTime: number;
  endTime: number | null;
  description: string;
}

export default function ClipDetailPanel({ clip, songClipDuration, onClose, onChanged }: ClipDetailPanelProps) {
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<EditData>(() => ({
    videoUrl: clip.videoUrl,
    sungDate: clip.sungDate?.slice(0, 10) || "",
    startTime: clip.startTime || 0,
    endTime: clip.endTime ?? null,
    description: clip.description || "",
  }));

  // 편집용 플레이어 어댑터
  const [adapter, setAdapter] = useState<EditPlayerAdapter | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const ytMountRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<{ destroy?: () => void } | null>(null);

  const isChzzk = (clip.platform || "youtube") === "chzzk";

  // 클립 변경 시 편집 상태 초기화
  useEffect(() => {
    setEditing(false);
    setAdapter(null);
    setEditData({
      videoUrl: clip.videoUrl,
      sungDate: clip.sungDate?.slice(0, 10) || "",
      startTime: clip.startTime || 0,
      endTime: clip.endTime ?? null,
      description: clip.description || "",
    });
  }, [clip._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 편집 모드(유튜브): 전체 영상 접근 가능한 YT 플레이어 생성
  useEffect(() => {
    if (!editing || isChzzk) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    loadYouTubeApi().then(() => {
      if (cancelled || !ytMountRef.current) return;
      const player = new window.YT.Player(ytMountRef.current, {
        videoId: clip.videoId,
        playerVars: {
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          start: Math.floor(clip.startTime || 0),
        },
        events: {
          onReady: (e: { target: Record<string, (...args: never[]) => unknown> }) => {
            if (cancelled) return;
            ytPlayerRef.current = e.target as { destroy?: () => void };
            setAdapter({
              getCurrentTime: () => (e.target.getCurrentTime as () => number)?.() ?? 0,
              seekTo: (s) => (e.target.seekTo as (s: number, b: boolean) => void)(s, true),
              play: () => (e.target.playVideo as () => void)(),
              pause: () => (e.target.pauseVideo as () => void)(),
            });
            interval = setInterval(() => {
              const t = (e.target.getCurrentTime as () => number)?.() ?? 0;
              setCurrentTime(t);
              setIsPlaying((e.target.getPlayerState as () => number)?.() === 1);
            }, 200);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      try {
        ytPlayerRef.current?.destroy?.();
      } catch {
        /* iframe 이미 제거됨 */
      }
      ytPlayerRef.current = null;
      setAdapter(null);
    };
  }, [editing, isChzzk, clip.videoId, clip.startTime]);

  // 편집 모드(치지직): ChzzkPlayer 핸들을 어댑터로
  const chzzkRef = useCallback((handle: ChzzkPlayerHandle | null) => {
    if (handle) {
      setAdapter({
        getCurrentTime: handle.getCurrentTime,
        seekTo: handle.seekTo,
        play: handle.play,
        pause: handle.pause,
      });
    } else {
      setAdapter(null);
    }
  }, []);

  // ── 뮤테이션 ────────────────────────────────────────────────────

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-clips"] });
    onChanged();
  };

  const verifyMutation = useMutation({
    mutationFn: async (verify: boolean) => {
      const res = await fetch("/api/admin/clips", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId: clip._id, action: verify ? "verify" : "unverify" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "검증 상태 변경 실패");
    },
    onSuccess: (_d, verify) => {
      showSuccess(verify ? "검증 완료" : "검증 해제", `클립이 ${verify ? "검증" : "미검증"} 상태가 되었습니다.`);
      invalidate();
    },
    onError: (e) => showError("실패", e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/clips", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId: clip._id,
          action: "updateClip",
          data: {
            ...(editData.videoUrl !== clip.videoUrl && { videoUrl: editData.videoUrl }),
            startTime: editData.startTime,
            endTime: editData.endTime ?? undefined,
            description: editData.description,
          },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "저장 실패");

      // 날짜 변경은 별도 라우트(PATCH admin/clips는 sungDate 미지원)
      if (editData.sungDate && editData.sungDate !== clip.sungDate?.slice(0, 10)) {
        const dateRes = await fetch(`/api/videos/${clip._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sungDate: editData.sungDate }),
        });
        if (!dateRes.ok) throw new Error("날짜 저장 실패");
      }
    },
    onSuccess: () => {
      showSuccess("저장 완료", "클립 정보가 수정되었습니다.");
      setEditing(false);
      invalidate();
    },
    onError: (e) => showError("저장 실패", e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/clips?clipId=${clip._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "삭제 실패");
    },
    onSuccess: () => {
      showSuccess("삭제 완료", "클립이 삭제되었습니다.");
      invalidate();
      onClose();
    },
    onError: (e) => showError("삭제 실패", e.message),
  });

  const defaultDurationMutation = useMutation({
    mutationFn: async (duration: number) => {
      const res = await fetch(`/api/songdetails/${clip.songId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipDuration: duration }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error?.message || "기본 길이 저장 실패");
      return duration;
    },
    onSuccess: (duration) => {
      showSuccess("기본 길이 등록", `"${clip.title}"의 기본 클립 길이가 ${formatTime(duration)}로 저장되었습니다.`);
      invalidate();
    },
    onError: (e) => showError("저장 실패", e.message),
  });

  const handleDelete = async () => {
    const ok = await confirm.confirm({
      title: "클립 삭제",
      message: `"${clip.title} - ${clip.artist}" 클립을 삭제하시겠습니까?\n되돌릴 수 없습니다.`,
      confirmText: "삭제",
      cancelText: "취소",
      type: "danger",
    });
    if (ok) deleteMutation.mutate();
  };

  return (
    <div className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm rounded-xl border border-light-primary/20 dark:border-dark-primary/20 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-light-primary/15 dark:border-dark-primary/15">
        <div className="min-w-0 flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs flex-shrink-0 ${platformBadgeClass(clip.platform)}`}>
            {platformLabel(clip.platform)}
          </span>
          {clip.isVerified && (
            <span className="px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center gap-1 flex-shrink-0">
              <CheckCircleSolid className="w-3 h-3" />
              검증됨
            </span>
          )}
          <h4 className="font-semibold text-light-text dark:text-dark-text truncate">
            {clip.title} <span className="font-normal text-light-text/60 dark:text-dark-text/60">— {clip.artist}</span>
          </h4>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-light-primary/10 dark:hover:bg-dark-primary/20 text-light-text/60 dark:text-dark-text/60 transition-colors flex-shrink-0">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* 플레이어 */}
        {!editing ? (
          <ClipPlayer
            // 편집 저장으로 시간이 바뀌면 key가 달라져 새 구간으로 재마운트된다
            key={`view-${clip._id}-${clip.startTime ?? 0}-${clip.endTime ?? "end"}`}
            platform={clip.platform || "youtube"}
            videoId={clip.videoId}
            startTime={clip.startTime || 0}
            endTime={clip.endTime}
            extendedControls
            className="max-w-2xl mx-auto"
          />
        ) : isChzzk ? (
          <ChzzkPlayer
            key={`edit-chzzk-${clip._id}`}
            ref={chzzkRef}
            videoUrl={clip.videoUrl}
            videoNo={parseInt(clip.videoId, 10)}
            startTime={editData.startTime}
            onTimeUpdate={setCurrentTime}
            onPlayStateChange={setIsPlaying}
            className="max-w-2xl mx-auto"
          />
        ) : (
          <div className="max-w-2xl mx-auto aspect-video bg-black rounded-xl overflow-hidden [&>div]:w-full [&>div]:h-full [&_iframe]:w-full [&_iframe]:h-full">
            <div ref={ytMountRef} />
          </div>
        )}

        {!editing ? (
          /* ── 정보 + 액션 ── */
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="text-sm text-light-text/70 dark:text-dark-text/70 space-y-1">
              <div>
                구간 <span className="font-mono text-light-text dark:text-dark-text">{formatTime(clip.startTime || 0)}</span>
                {clip.endTime != null && (
                  <>
                    {" ~ "}
                    <span className="font-mono text-light-text dark:text-dark-text">{formatTime(clip.endTime)}</span>
                    <span className="ml-2 text-xs">(길이 {formatTime(clip.endTime - (clip.startTime || 0))})</span>
                  </>
                )}
              </div>
              <div className="text-xs">
                {clip.sungDate?.slice(0, 10)} · 등록자 {clip.addedByName}
                {clip.description && <span className="ml-2 italic">&ldquo;{clip.description}&rdquo;</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => verifyMutation.mutate(!clip.isVerified)}
                disabled={verifyMutation.isPending}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50 ${
                  clip.isVerified
                    ? "border border-light-primary/30 dark:border-dark-primary/30 text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10 dark:hover:bg-dark-primary/20"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
                title={clip.isVerified ? "검증 상태를 해제합니다" : "확인 완료된 클립으로 표시합니다"}
              >
                {clip.isVerified ? <CheckIcon className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
                {clip.isVerified ? "검증 해제" : "검증 완료"}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-light-accent dark:bg-dark-accent text-white hover:shadow-md transition-all"
              >
                <PencilIcon className="w-4 h-4" />
                편집
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
                삭제
              </button>
            </div>
          </div>
        ) : (
          /* ── 편집 폼 ── */
          <div className="space-y-4 max-w-2xl mx-auto">
            <ClipTimeEditor
              startTime={editData.startTime}
              endTime={editData.endTime}
              onChange={(patch) => setEditData((prev) => ({ ...prev, ...patch }))}
              adapter={adapter}
              currentTime={currentTime}
              isPlaying={isPlaying}
              songClipDuration={songClipDuration ?? clip.songDetail?.clipDuration}
              onSetDefaultDuration={(d) => defaultDurationMutation.mutate(d)}
              savingDefault={defaultDurationMutation.isPending}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-light-text/60 dark:text-dark-text/60 mb-1">부른 날짜</label>
                <input
                  type="date"
                  value={editData.sungDate}
                  onChange={(e) => setEditData((prev) => ({ ...prev, sungDate: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-light-text/60 dark:text-dark-text/60 mb-1">영상 URL</label>
                <input
                  type="url"
                  value={editData.videoUrl}
                  onChange={(e) => setEditData((prev) => ({ ...prev, videoUrl: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text"
                  placeholder="유튜브 또는 치지직 다시보기 URL"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-light-text/60 dark:text-dark-text/60 mb-1">설명</label>
              <input
                type="text"
                value={editData.description}
                onChange={(e) => setEditData((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm rounded border border-light-primary/20 dark:border-dark-primary/20 bg-white dark:bg-gray-800 text-light-text dark:text-dark-text"
                maxLength={500}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm rounded-lg border border-light-primary/30 dark:border-dark-primary/30 text-light-text/70 dark:text-dark-text/70 hover:bg-light-primary/10 dark:hover:bg-dark-primary/20 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="px-4 py-2 text-sm rounded-lg bg-light-accent dark:bg-dark-accent text-white hover:shadow-md disabled:opacity-50 transition-all"
              >
                {saveMutation.isPending ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
