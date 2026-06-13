"use client";

/**
 * 전체 클립 목록 — 서버 페이지네이션 + 필터(검증/플랫폼/검색/등록자/정렬).
 */

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import Image from "next/image";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";
import { useDebounce } from "@/hooks/useDebounce";
import ClipDetailPanel from "./ClipDetailPanel";
import PaginationControl from "./PaginationControl";
import {
  type ClipData,
  type Pagination,
  formatTime,
  platformBadgeClass,
  platformLabel,
  thumbnailSrc,
} from "./clip-types";

const selectClass =
  "px-3 py-2 text-sm rounded-lg border border-light-primary/20 dark:border-dark-primary/20 bg-white/60 dark:bg-gray-900/60 text-light-text dark:text-dark-text";

export default function ClipListView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterBy, setFilterBy] = useState<"all" | "verified" | "unverified">("all");
  const [platform, setPlatform] = useState<"all" | "youtube" | "chzzk">("all");
  const [sortBy, setSortBy] = useState<"recent" | "sungDate" | "songTitle" | "addedBy" | "verified">("recent");
  // 선택 클립은 id만 보관하고 실제 데이터는 쿼리 결과에서 파생한다.
  // (객체를 복사해 두면 편집 저장 후 목록만 refetch되어 선택 클립이 옛 값으로 남음)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-clips", "list", page, debouncedSearch, filterBy, platform, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        view: "clips",
        page: String(page),
        limit: "20",
        sortBy,
        filterBy,
        platform,
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      const res = await fetch(`/api/admin/clips?${params}`, { cache: "no-store" });
      const result = await res.json();
      if (!result.success) throw new Error(result.error?.message || "클립을 불러오지 못했습니다.");
      return result.data as { clips: ClipData[]; pagination: Pagination };
    },
    placeholderData: keepPreviousData,
  });

  const resetPage = () => setPage(1);

  // 현재 페이지 데이터에서 선택 클립을 파생 → 저장 후 refetch되면 자동으로 새 값 반영
  const selectedClip = data?.clips.find((c) => c._id === selectedClipId) ?? null;

  return (
    <div className="space-y-4">
      {/* 필터 바 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text/40 dark:text-dark-text/40" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            placeholder="곡명, 아티스트, 등록자 검색..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-light-primary/20 dark:border-dark-primary/20 bg-white/60 dark:bg-gray-900/60 text-light-text dark:text-dark-text placeholder-light-text/40 dark:placeholder-dark-text/40 focus:ring-2 focus:ring-light-accent/40 dark:focus:ring-dark-accent/40 focus:border-transparent"
          />
        </div>
        <select value={filterBy} onChange={(e) => { setFilterBy(e.target.value as typeof filterBy); resetPage(); }} className={selectClass}>
          <option value="all">전체 상태</option>
          <option value="verified">검증됨</option>
          <option value="unverified">미검증</option>
        </select>
        <select value={platform} onChange={(e) => { setPlatform(e.target.value as typeof platform); resetPage(); }} className={selectClass}>
          <option value="all">모든 플랫폼</option>
          <option value="youtube">유튜브</option>
          <option value="chzzk">치지직</option>
        </select>
        <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as typeof sortBy); resetPage(); }} className={selectClass}>
          <option value="recent">등록 최신순</option>
          <option value="sungDate">부른 날짜순</option>
          <option value="songTitle">곡명순</option>
          <option value="addedBy">등록자순</option>
          <option value="verified">검증 우선</option>
        </select>
      </div>

      {/* 클립 상세 (선택 시) */}
      {selectedClip && (
        <ClipDetailPanel
          clip={selectedClip}
          songClipDuration={selectedClip.songDetail?.clipDuration}
          onClose={() => setSelectedClipId(null)}
          onChanged={() => refetch()}
        />
      )}

      {/* 목록 */}
      <div className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm rounded-xl border border-light-primary/20 dark:border-dark-primary/20 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="w-7 h-7 border-2 border-light-accent/30 dark:border-dark-accent/30 border-t-light-accent dark:border-t-dark-accent rounded-full animate-spin" />
          </div>
        ) : !data || data.clips.length === 0 ? (
          <p className="p-8 text-sm text-light-text/50 dark:text-dark-text/50 text-center">조건에 맞는 클립이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-light-primary/10 dark:divide-dark-primary/10">
            {data.clips.map((clip) => (
              <li key={clip._id}>
                <button
                  onClick={() => setSelectedClipId(clip._id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-light-primary/5 dark:hover:bg-dark-primary/10 transition-colors ${
                    selectedClipId === clip._id ? "bg-light-accent/10 dark:bg-dark-accent/10" : ""
                  }`}
                >
                  <div className="relative w-20 h-12 flex-shrink-0 rounded overflow-hidden bg-gray-200 dark:bg-gray-700">
                    <Image src={thumbnailSrc(clip)} alt="" fill className="object-cover" unoptimized />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-light-text dark:text-dark-text truncate">
                      {clip.songDetail?.titleAlias || clip.title}
                      <span className="ml-1.5 font-normal text-light-text/50 dark:text-dark-text/50">
                        {clip.songDetail?.artistAlias || clip.artist}
                      </span>
                    </div>
                    <div className="text-xs text-light-text/50 dark:text-dark-text/50 mt-0.5 font-mono">
                      {formatTime(clip.startTime || 0)}
                      {clip.endTime != null && ` ~ ${formatTime(clip.endTime)}`}
                      <span className="ml-2 font-sans">
                        {clip.sungDate?.slice(0, 10)} · {clip.addedByName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] ${platformBadgeClass(clip.platform)}`}>
                      {platformLabel(clip.platform)}
                    </span>
                    {clip.isVerified && <CheckCircleSolid className="w-4 h-4 text-blue-500" />}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {data && <PaginationControl pagination={data.pagination} onPageChange={setPage} />}
      </div>
    </div>
  );
}
