"use client";

/**
 * 미등록 곡 발견 패널 (곡 단위 뷰의 가상 검색 항목).
 * 등록곡과 무관하게 자유 텍스트로 미매칭 타임라인을 모아 보여준다.
 * 클립 생성은 등록곡이 필요하므로 여기선 하지 않고(발견·분류 전용),
 * 각 항목은 공용 ItemEditor로 미리보기 + 등록곡에 개별 매칭(오파싱 교정)까지 가능.
 */

import { useCallback, useEffect, useState } from "react";
import ItemEditor from "./ItemEditor";
import { fmt } from "./itemUtils";
import type { WorkflowItem, WorkflowSong } from "./types";

interface Props {
  query: string;
  songs: WorkflowSong[];
  songsById: Map<string, WorkflowSong>;
  onStatusRefresh: () => void;
}

export default function UnmatchedSearchPanel({ query, songs, songsById, onStatusRefresh }: Props) {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clip-workflow/search-timelines?q=${encodeURIComponent(query)}`).then((r) => r.json());
      if (res.success) {
        const list: WorkflowItem[] = res.data.items;
        setItems(list);
        setSelectedId((prev) => (prev && list.some((it) => it.id === prev) ? prev : list[0]?.id ?? null));
      }
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  // 항목 PATCH. matchedSongId가 바뀌면(등록곡에 매칭) 미매칭 목록에서 빠지므로 재로드.
  const patchItem = useCallback(async (id: string, body: Record<string, unknown>, optimistic?: Partial<WorkflowItem>) => {
    const reload = "matchedSongId" in body;
    if (optimistic && !reload) setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...optimistic } : it)));
    await fetch(`/api/admin/clip-workflow/item/${encodeURIComponent(id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => {});
    if (reload) { await load(); onStatusRefresh(); }
  }, [load, onStatusRefresh]);

  const selected = items.find((it) => it.id === selectedId) || null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">미등록 검색: &ldquo;{query}&rdquo;</h2>
        <p className="text-xs text-light-text/60 dark:text-dark-text/60">
          이름이 일치하는 미매칭 타임라인 {items.length}건. 클립을 만들려면 먼저 곡을 등록하세요 —
          등록 후 곡 단위 목록에서 &lsquo;미등록 출현 찾기&rsquo;로 자동 편입됩니다.
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-light-text/50">검색 중...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-4">
          {/* 좌: 미매칭 출현 목록 */}
          <div className="border border-light-primary/20 dark:border-dark-primary/20 rounded-lg overflow-hidden flex flex-col lg:order-1 max-h-[78vh]">
            <div className="overflow-y-auto">
              {items.length === 0 && <p className="px-3 py-2 text-xs text-light-text/40">일치하는 미매칭 타임라인이 없습니다.</p>}
              {items.map((it) => {
                const isSel = it.id === selectedId;
                return (
                  <div key={it.id} onClick={() => setSelectedId(it.id)} className={`px-2.5 py-1.5 text-sm cursor-pointer border-b border-light-primary/10 dark:border-dark-primary/10 ${isSel ? "bg-light-accent/10 dark:bg-dark-accent/10" : "hover:bg-light-primary/5 dark:hover:bg-dark-primary/5"} ${it.isExcluded ? "opacity-40" : ""}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-light-text/60 dark:text-dark-text/60 shrink-0">{it.date?.slice(2) || "?"}</span>
                      <span className={`text-[10px] px-1 rounded shrink-0 ${it.platform === "chzzk" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300"}`}>{it.platform === "chzzk" ? "CH" : "YT"}</span>
                      <span className="font-mono text-[11px] text-light-text/55 dark:text-dark-text/55 shrink-0">{fmt(it.startTimeSeconds)}</span>
                      <span className="flex-1 min-w-0 truncate text-light-text/70 dark:text-dark-text/70">{it.videoTitle || it.videoId}</span>
                    </div>
                    <div className="text-[11px] text-light-text/50 dark:text-dark-text/50 truncate">파싱: {it.artist} - {it.songTitle}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 우: 편집 알맹이 (공용) */}
          <div className="lg:order-2">
            {selected ? (
              <ItemEditor item={selected} songs={songs} songsById={songsById} onPatch={patchItem} />
            ) : (
              <p className="text-sm text-light-text/50 p-8 text-center">항목을 선택하세요.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
