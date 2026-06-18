/** 클립 만들기 항목 공용 헬퍼 (영상 단위·곡 단위 패널 공유) */
import { matchSongs } from "@/shared/utils/song-match";
import type { WorkflowItem, WorkflowSong } from "./types";

export function fmt(s: number | null | undefined): string {
  if (s == null) return "—";
  const v = Math.max(0, Math.floor(s));
  const m = Math.floor(v / 60);
  const sec = String(v % 60).padStart(2, "0");
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** 곡 매칭 시 낙관적 반영 partial — 종료시각=시작+기본길이(검증분 보존) */
export function assignOptimistic(item: WorkflowItem, song: WorkflowSong | null): Partial<WorkflowItem> {
  let endTimeSeconds = item.endTimeSeconds;
  if (song?.clipDuration && song.clipDuration > 0 && !item.isTimeVerified) {
    endTimeSeconds = item.startTimeSeconds + song.clipDuration;
  }
  return { matchedSongId: song?.id, endTimeSeconds };
}

export interface SongSuggestion { songId: string; title: string; artist: string; confidence: number; }

/** 곡 검색: 쿼리 있으면 제목/가수/별칭/태그 부분일치, 없으면 자동 유사도 추천 */
export function songSuggestions(
  artist: string, songTitle: string, query: string, songs: WorkflowSong[],
): SongSuggestion[] {
  const q = query.trim();
  if (q) {
    const lower = q.toLowerCase();
    return songs
      .filter((s) => `${s.artist} ${s.title} ${s.artistAlias || ""} ${s.titleAlias || ""} ${(s.searchTags || []).join(" ")}`.toLowerCase().includes(lower))
      .slice(0, 8)
      .map((s) => ({ songId: s.id, title: s.title, artist: s.artist, confidence: 0 }));
  }
  return matchSongs(artist, songTitle, songs, { minConfidence: 0.5, limit: 6 });
}
