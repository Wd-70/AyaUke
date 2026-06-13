"use client";

/**
 * 곡별 보기 — 클립이 있는 곡들을 카드로 탐색 (서버 페이지네이션).
 * 곡 선택 시 SongClipPanel로 전환.
 */

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import Image from "next/image";
import { MagnifyingGlassIcon, ClockIcon, MusicalNoteIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useDebounce } from "@/hooks/useDebounce";
import SongClipPanel from "./SongClipPanel";
import PaginationControl from "./PaginationControl";
import { type SongWithClips, type Pagination, formatTime } from "./clip-types";

export default function SongClipBrowser() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"recent" | "clipCount" | "title">("recent");
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-clips", "songs", page, debouncedSearch, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        view: "songs",
        page: String(page),
        limit: "24",
        sortBy,
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      const res = await fetch(`/api/admin/clips?${params}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error?.message || "곡 목록을 불러오지 못했습니다.");
      return result.data as { songs: SongWithClips[]; pagination: Pagination };
    },
    placeholderData: keepPreviousData,
  });

  if (selectedSongId) {
    return <SongClipPanel songId={selectedSongId} onClose={() => setSelectedSongId(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* 검색 + 정렬 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text/40 dark:text-dark-text/40" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="곡 제목, 아티스트 검색..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-light-primary/20 dark:border-dark-primary/20 bg-white/60 dark:bg-gray-900/60 text-light-text dark:text-dark-text placeholder-light-text/40 dark:placeholder-dark-text/40 focus:ring-2 focus:ring-light-accent/40 dark:focus:ring-dark-accent/40 focus:border-transparent"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value as typeof sortBy);
            setPage(1);
          }}
          className="px-3 py-2 text-sm rounded-lg border border-light-primary/20 dark:border-dark-primary/20 bg-white/60 dark:bg-gray-900/60 text-light-text dark:text-dark-text"
        >
          <option value="recent">최근 부른 순</option>
          <option value="clipCount">클립 많은 순</option>
          <option value="title">제목 순</option>
        </select>
      </div>

      {/* 곡 카드 그리드 */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="w-7 h-7 border-2 border-light-accent/30 dark:border-dark-accent/30 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
        </div>
      ) : !data || data.songs.length === 0 ? (
        <div className="text-center p-12 text-light-text/50 dark:text-dark-text/50">
          <MusicalNoteIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{debouncedSearch ? "검색 결과가 없습니다." : "클립이 있는 곡이 없습니다."}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
            {data.songs.map((song) => (
              <button
                key={song.songId}
                onClick={() => setSelectedSongId(song.songId)}
                className="group flex gap-3 p-3 rounded-xl border border-light-primary/15 dark:border-dark-primary/15 bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm hover:border-light-accent/40 dark:hover:border-dark-accent/40 hover:shadow-md transition-all text-left"
              >
                <div className="relative w-24 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                  <Image
                    src={song.thumbnailUrl || "/honeyz_pink.png"}
                    alt=""
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-light-text dark:text-dark-text truncate">
                    {song.titleAlias || song.title}
                  </div>
                  <div className="text-xs text-light-text/50 dark:text-dark-text/50 truncate">
                    {song.artistAlias || song.artist}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded text-[11px] bg-light-primary/10 dark:bg-dark-primary/20 text-light-text/60 dark:text-dark-text/60">
                      클립 {song.clipCount}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] ${
                        song.verifiedCount === song.clipCount
                          ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      검증 {song.verifiedCount}/{song.clipCount}
                    </span>
                    {song.platforms.includes("chzzk") && (
                      <span className="px-1.5 py-0.5 rounded text-[11px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                        치지직
                      </span>
                    )}
                    {song.clipDuration ? (
                      <span
                        className="px-1.5 py-0.5 rounded text-[11px] bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 inline-flex items-center gap-0.5"
                        title="기본 클립 길이"
                      >
                        <ClockIcon className="w-3 h-3" />
                        {formatTime(song.clipDuration)}
                      </span>
                    ) : null}
                    {song.hasOverlap && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[11px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 inline-flex items-center gap-0.5"
                        title="같은 영상 내 시간이 겹치는 클립이 있습니다 — 곡을 열어 확인하세요"
                      >
                        <ExclamationTriangleIcon className="w-3 h-3" />
                        겹침
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <PaginationControl pagination={data.pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
