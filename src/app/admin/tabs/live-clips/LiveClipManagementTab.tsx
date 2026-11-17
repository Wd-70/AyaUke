"use client";

/**
 * 라이브 클립 관리 탭.
 * - 곡별 보기: 곡 단위로 클립을 묶어 탐색·관리 (기본 클립 길이 관리 포함)
 * - 전체 목록: 서버 페이지네이션 + 필터
 * 위쪽 숫자 카드는 바로가기 — 누르면 그 조건으로 거른 전체 목록이 열린다.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MusicalNoteIcon, ListBulletIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import SongClipBrowser from "./SongClipBrowser";
import ClipListView, { type ClipListFilter } from "./ClipListView";
import SourceCheckDialog from "./SourceCheckDialog";
import type { ClipStats } from "./clip-types";
import { AdminPageHeader, adminButton, adminMuted } from "@/components/admin/AdminPrimitives";

type ViewMode = "songs" | "list";

export default function LiveClipManagementTab() {
  const [mode, setMode] = useState<ViewMode>("songs");
  // 숫자 카드로 들어온 조건 — 바뀔 때마다 목록을 그 조건으로 새로 연다
  const [preset, setPreset] = useState<{ filter: ClipListFilter; seq: number }>({ filter: {}, seq: 0 });
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["admin-clips", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/clips?view=stats");
      const result = await res.json();
      if (!result.success) throw new Error("통계 로드 실패");
      return result.data as ClipStats;
    },
    staleTime: 60_000,
  });

  const openList = (filter: ClipListFilter) => {
    setPreset((p) => ({ filter, seq: p.seq + 1 }));
    setMode("list");
  };

  const cards: { label: string; value: number | undefined; hint: string; filter: ClipListFilter; tone?: string }[] = [
    { label: "검증 안 됨", value: stats?.unverified, hint: "시간 확인이 필요한 클립", filter: { filterBy: "unverified" }, tone: "text-amber-700 dark:text-amber-300" },
    { label: "검증됨", value: stats?.verified, hint: "시간이 확인된 클립", filter: { filterBy: "verified" } },
    { label: "재생 불가", value: stats?.unavailable, hint: "원본이 사라져 숨겨진 클립", filter: { filterBy: "unavailable" }, tone: stats?.unavailable ? "text-rose-700 dark:text-rose-300" : undefined },
    { label: "치지직", value: stats?.platforms.chzzk, hint: "치지직 다시보기 클립", filter: { platform: "chzzk" } },
    { label: "유튜브", value: stats?.platforms.youtube, hint: "유튜브 다시보기 클립", filter: { platform: "youtube" } },
  ];

  const segment = (value: ViewMode, label: string, Icon: typeof MusicalNoteIcon) => (
    <button
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${
        mode === value
          ? "bg-white text-light-text shadow-sm dark:bg-gray-800 dark:text-dark-text"
          : "text-light-text/60 hover:text-light-text dark:text-dark-text/60 dark:hover:text-dark-text"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <div className="space-y-6 text-light-text dark:text-dark-text">
      <AdminPageHeader
        eyebrow="WORKSPACE / LIVE CLIPS"
        title="라이브 클립"
        count={stats?.total}
        description="클립 시간을 검증·편집하고, 곡별 기본 클립 길이를 관리합니다."
        actions={
          <>
            <button
              onClick={() => setDialogOpen(true)}
              className={adminButton}
              title="플랫폼별로 원본 다시보기가 아직 살아 있는지 확인하고, 사라진 원본의 클립을 노래책에서 숨깁니다."
            >
              <ShieldCheckIcon className="h-4 w-4" />
              원본 점검
            </button>
            <div className="flex rounded-xl bg-light-primary/10 p-1 dark:bg-dark-primary/20" role="group" aria-label="보기 방식">
              {segment("songs", "곡별 보기", MusicalNoteIcon)}
              {segment("list", "전체 목록", ListBulletIcon)}
            </div>
          </>
        }
      />

      {/* 숫자 카드 = 바로가기 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => openList(c.filter)}
            title={`${c.hint} — 눌러서 목록 보기`}
            className="group rounded-2xl border border-light-primary/20 bg-white/80 p-4 text-left shadow-sm transition hover:border-purple-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-dark-primary/20 dark:bg-gray-900/70 dark:hover:border-purple-700"
          >
            <span className={`${adminMuted} block text-xs`}>{c.label}</span>
            <span className={`mt-1 block text-2xl font-semibold tabular-nums tracking-tight ${c.tone ?? ""}`}>
              {c.value != null ? c.value.toLocaleString() : "—"}
            </span>
            <span className={`${adminMuted} mt-1 block text-xs group-hover:text-purple-700 dark:group-hover:text-purple-300`}>목록 보기 →</span>
          </button>
        ))}
      </div>

      {/* 본문 */}
      {mode === "songs" ? <SongClipBrowser /> : <ClipListView key={preset.seq} initialFilter={preset.filter} />}

      {dialogOpen && (
        <SourceCheckDialog
          onClose={() => setDialogOpen(false)}
          onApplied={() => queryClient.invalidateQueries({ queryKey: ["admin-clips"] })}
        />
      )}
    </div>
  );
}
