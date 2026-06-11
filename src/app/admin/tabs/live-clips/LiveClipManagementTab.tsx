"use client";

/**
 * 라이브 클립 관리 탭 (전면 개편판).
 * - 곡별 보기: 곡 단위로 클립을 묶어 탐색·관리 (기본 클립 길이 관리 포함)
 * - 전체 목록: 서버 페이지네이션 + 필터
 * 모든 데이터는 TanStack Query로 필요한 만큼만 로드한다.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MusicalNoteIcon,
  ListBulletIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlayCircleIcon,
} from "@heroicons/react/24/outline";
import SongClipBrowser from "./SongClipBrowser";
import ClipListView from "./ClipListView";
import type { ClipStats } from "./clip-types";

type ViewMode = "songs" | "list";

export default function LiveClipManagementTab() {
  const [mode, setMode] = useState<ViewMode>("songs");

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

  const statChip = (icon: React.ReactNode, label: string, value: number | string, tone: string) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${tone}`}>
      {icon}
      <span className="text-xs">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* 헤더: 통계 + 모드 전환 */}
      <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-4 border border-light-primary/20 dark:border-dark-primary/20">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-light-text dark:text-dark-text">라이브 클립 관리</h2>
            <p className="text-sm text-light-text/60 dark:text-dark-text/60 mt-0.5">
              클립 검증·시간 편집과 곡별 기본 클립 길이를 관리합니다.
            </p>
          </div>

          {/* 모드 전환 */}
          <div className="flex bg-light-primary/10 dark:bg-dark-primary/20 rounded-lg p-1">
            <button
              onClick={() => setMode("songs")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                mode === "songs"
                  ? "bg-white dark:bg-gray-800 text-light-text dark:text-dark-text shadow-sm"
                  : "text-light-text/60 dark:text-dark-text/60 hover:text-light-text dark:hover:text-dark-text"
              }`}
            >
              <MusicalNoteIcon className="w-4 h-4" />
              곡별 보기
            </button>
            <button
              onClick={() => setMode("list")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                mode === "list"
                  ? "bg-white dark:bg-gray-800 text-light-text dark:text-dark-text shadow-sm"
                  : "text-light-text/60 dark:text-dark-text/60 hover:text-light-text dark:hover:text-dark-text"
              }`}
            >
              <ListBulletIcon className="w-4 h-4" />
              전체 목록
            </button>
          </div>
        </div>

        {/* 통계 칩 */}
        {stats && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {statChip(
              <PlayCircleIcon className="w-4 h-4" />,
              "전체",
              stats.total.toLocaleString(),
              "bg-light-primary/10 dark:bg-dark-primary/20 text-light-text/80 dark:text-dark-text/80",
            )}
            {statChip(
              <CheckCircleIcon className="w-4 h-4" />,
              "검증됨",
              stats.verified.toLocaleString(),
              "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
            )}
            {statChip(
              <ExclamationCircleIcon className="w-4 h-4" />,
              "미검증",
              stats.unverified.toLocaleString(),
              "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
            )}
            {statChip(
              <span className="text-[11px] font-bold">YT</span>,
              "유튜브",
              stats.platforms.youtube.toLocaleString(),
              "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300",
            )}
            {statChip(
              <span className="text-[11px] font-bold">CH</span>,
              "치지직",
              stats.platforms.chzzk.toLocaleString(),
              "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
            )}
          </div>
        )}
      </div>

      {/* 본문 */}
      {mode === "songs" ? <SongClipBrowser /> : <ClipListView />}
    </div>
  );
}
