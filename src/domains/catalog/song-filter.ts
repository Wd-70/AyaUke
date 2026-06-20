/**
 * 노래책 카탈로그 질의(검색/필터/정렬) — 순수 로직.
 *
 * UI(SongSearch)에서 분리해 단위 테스트가 가능하도록 만든 도메인 모듈.
 * React/상태에 의존하지 않으며, 입력(songs + 조건)만으로 결과가 결정된다.
 * (random 셔플만 주입 가능한 rng로 비결정성을 격리한다.)
 */
import type { Song } from "@/types";
import { isTextMatch } from "@/lib/searchUtils";

export type FilterMode = "individual" | "intersection" | "union";
export type SortBy = "default" | "random" | "likes" | "sungCount" | "title";
export type SortOrder = "asc" | "desc";

export interface SongFilterCriteria {
  /** 디바운스된 검색어 */
  searchTerm: string;
  /** 가사를 검색 대상에 포함할지 */
  includeLyrics: boolean;
  /** OR로 묶이는 언어 필터 */
  activeLanguages: ReadonlySet<string>;
  /** 필터 결합 방식 */
  filterMode: FilterMode;
  /** individual 모드에서 선택된 단일 필터 ("liked" | "playlist-<id>" | null) */
  selectedSingleFilter: string | null;
  /** intersection/union 모드에서 좋아요 필터 on/off */
  showLikedOnly: boolean;
  /** intersection/union 모드에서 선택된 플레이리스트 id 집합 */
  activePlaylists: ReadonlySet<string>;
  /** 좋아요한 곡 id 목록 */
  likedSongIds: readonly string[];
  /** 플레이리스트별 곡 id 집합 (playlistId -> Set<songId>) */
  playlistSongIds: Record<string, ReadonlySet<string>>;
}

/** 곡이 텍스트 검색어와 일치하는지(제목/가수/별칭/태그, 선택적으로 가사). */
export function matchesSearch(
  song: Song,
  term: string,
  includeLyrics: boolean
): boolean {
  if (!term) return true;

  const basicMatch =
    isTextMatch(term, song.title) ||
    isTextMatch(term, song.artist) ||
    (!!song.titleAlias && isTextMatch(term, song.titleAlias)) ||
    (!!song.artistAlias && isTextMatch(term, song.artistAlias)) ||
    !!song.tags?.some((tag) => isTextMatch(term, tag)) ||
    !!song.searchTags?.some((tag) => isTextMatch(term, tag));

  const lyricsMatch =
    includeLyrics && !!song.lyrics && isTextMatch(term, song.lyrics);

  return basicMatch || lyricsMatch;
}

/** 좋아요/플레이리스트 등 "언어 외" 필터를 통과하는지 (모드별 결합 규칙 적용). */
function passesOtherFilters(song: Song, c: SongFilterCriteria): boolean {
  const liked = (id: string) => c.likedSongIds.includes(id);
  const inPlaylist = (playlistId: string) =>
    c.playlistSongIds[playlistId]?.has(song.id) || false;

  if (c.filterMode === "individual") {
    if (c.selectedSingleFilter === "liked") return liked(song.id);
    if (c.selectedSingleFilter?.startsWith("playlist-")) {
      return inPlaylist(c.selectedSingleFilter.replace("playlist-", ""));
    }
    return true; // null이면 다른 필터 없음
  }

  // intersection / union 모드
  const checks: boolean[] = [];
  if (c.showLikedOnly) checks.push(liked(song.id));
  if (c.activePlaylists.size > 0) {
    for (const playlistId of c.activePlaylists) checks.push(inPlaylist(playlistId));
  }

  if (checks.length === 0) return true;
  return c.filterMode === "intersection"
    ? checks.every(Boolean)
    : checks.some(Boolean);
}

/**
 * 검색 + 언어(OR) + 기타 필터(모드별) 적용. 언어와 기타는 항상 AND로 결합된다.
 * 어떤 필터도 활성화돼 있지 않으면 검색 결과를 그대로 반환한다.
 */
export function filterSongs(
  songs: readonly Song[],
  c: SongFilterCriteria
): Song[] {
  const searched = c.searchTerm
    ? songs.filter((s) => matchesSearch(s, c.searchTerm, c.includeLyrics))
    : [...songs];

  const hasLanguageFilter = c.activeLanguages.size > 0;
  const hasOtherFilters =
    (c.filterMode === "individual" && !!c.selectedSingleFilter) ||
    (c.filterMode !== "individual" &&
      (c.showLikedOnly || c.activePlaylists.size > 0));

  if (!hasLanguageFilter && !hasOtherFilters) return searched;

  return searched.filter((song) => {
    const languagePass =
      c.activeLanguages.size === 0 || c.activeLanguages.has(song.language);
    return languagePass && passesOtherFilters(song, c);
  });
}

/** Fisher-Yates 셔플(원본 불변). rng 주입으로 테스트 가능. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 결정적 정렬(likes/sungCount/title). default/random은 그대로 반환한다.
 * (random은 비결정적이라 호출부에서 shuffle을 사용한다.)
 */
export function sortSongs(
  songs: readonly Song[],
  sortBy: SortBy,
  sortOrder: SortOrder
): Song[] {
  if (sortBy === "default" || sortBy === "random") return [...songs];

  const dir = sortOrder === "desc" ? -1 : 1;
  return [...songs].sort((a, b) => {
    switch (sortBy) {
      case "likes":
        return dir * ((a.likeCount || 0) - (b.likeCount || 0));
      case "sungCount":
        return dir * ((a.sungCount || 0) - (b.sungCount || 0));
      case "title": {
        const aTitle = a.titleAlias || a.title;
        const bTitle = b.titleAlias || b.title;
        return dir * aTitle.localeCompare(bTitle, "ko", { numeric: true });
      }
      default:
        return 0;
    }
  });
}
