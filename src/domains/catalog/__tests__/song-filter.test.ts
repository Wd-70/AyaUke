import { describe, test, expect } from "vitest";
import type { Song } from "@/types";
import {
  matchesSearch,
  filterSongs,
  sortSongs,
  shuffle,
  type SongFilterCriteria,
} from "../song-filter";

const song = (over: Partial<Song> & Pick<Song, "id" | "title">): Song => ({
  artist: "Artist",
  language: "Korean",
  source: "merged",
  ...over,
});

// 필터 조건 기본값(아무 필터도 활성화되지 않은 상태)
const baseCriteria = (over: Partial<SongFilterCriteria> = {}): SongFilterCriteria => ({
  searchTerm: "",
  includeLyrics: false,
  activeLanguages: new Set(),
  filterMode: "individual",
  selectedSingleFilter: null,
  showLikedOnly: false,
  activePlaylists: new Set(),
  likedSongIds: [],
  playlistSongIds: {},
  ...over,
});

describe("matchesSearch", () => {
  const s = song({
    id: "1",
    title: "Love Dive",
    artist: "IVE",
    titleAlias: "러브다이브",
    searchTags: ["여름", "댄스"],
    lyrics: "narcissistic my god",
  });

  test("빈 검색어는 항상 통과", () => {
    expect(matchesSearch(s, "", false)).toBe(true);
  });

  test("제목/가수 부분 일치(대소문자 무시)", () => {
    expect(matchesSearch(s, "love", false)).toBe(true);
    expect(matchesSearch(s, "ive", false)).toBe(true);
  });

  test("titleAlias와 searchTags도 검색 대상", () => {
    expect(matchesSearch(s, "러브다이브", false)).toBe(true);
    expect(matchesSearch(s, "여름", false)).toBe(true);
  });

  test("가사는 includeLyrics가 켜졌을 때만", () => {
    expect(matchesSearch(s, "narcissistic", false)).toBe(false);
    expect(matchesSearch(s, "narcissistic", true)).toBe(true);
  });

  test("일치하지 않으면 false", () => {
    expect(matchesSearch(s, "zzzz", true)).toBe(false);
  });
});

describe("filterSongs", () => {
  const songs: Song[] = [
    song({ id: "a", title: "Korean A", language: "Korean" }),
    song({ id: "b", title: "English B", language: "English" }),
    song({ id: "c", title: "Korean C", language: "Korean" }),
  ];

  test("필터가 없으면 전체 반환(복사본)", () => {
    const result = filterSongs(songs, baseCriteria());
    expect(result.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(result).not.toBe(songs);
  });

  test("언어 필터는 OR로 동작", () => {
    const result = filterSongs(
      songs,
      baseCriteria({ activeLanguages: new Set(["Korean"]) })
    );
    expect(result.map((s) => s.id)).toEqual(["a", "c"]);
  });

  test("검색어 + 언어는 AND로 결합", () => {
    const result = filterSongs(
      songs,
      baseCriteria({ searchTerm: "Korean A", activeLanguages: new Set(["Korean"]) })
    );
    expect(result.map((s) => s.id)).toEqual(["a"]);
  });

  describe("individual 모드", () => {
    test("liked 필터", () => {
      const result = filterSongs(
        songs,
        baseCriteria({ selectedSingleFilter: "liked", likedSongIds: ["b"] })
      );
      expect(result.map((s) => s.id)).toEqual(["b"]);
    });

    test("playlist 필터", () => {
      const result = filterSongs(
        songs,
        baseCriteria({
          selectedSingleFilter: "playlist-p1",
          playlistSongIds: { p1: new Set(["a", "c"]) },
        })
      );
      expect(result.map((s) => s.id)).toEqual(["a", "c"]);
    });
  });

  describe("intersection / union 모드", () => {
    test("intersection: 좋아요 AND 플레이리스트 모두 만족", () => {
      const result = filterSongs(
        songs,
        baseCriteria({
          filterMode: "intersection",
          showLikedOnly: true,
          likedSongIds: ["a", "c"],
          activePlaylists: new Set(["p1"]),
          playlistSongIds: { p1: new Set(["c"]) },
        })
      );
      expect(result.map((s) => s.id)).toEqual(["c"]);
    });

    test("union: 좋아요 OR 플레이리스트 중 하나라도 만족", () => {
      const result = filterSongs(
        songs,
        baseCriteria({
          filterMode: "union",
          showLikedOnly: true,
          likedSongIds: ["a"],
          activePlaylists: new Set(["p1"]),
          playlistSongIds: { p1: new Set(["b"]) },
        })
      );
      expect(result.map((s) => s.id)).toEqual(["a", "b"]);
    });
  });
});

describe("sortSongs", () => {
  const songs: Song[] = [
    song({ id: "a", title: "Banana", likeCount: 5, sungCount: 1 }),
    song({ id: "b", title: "apple", likeCount: 1, sungCount: 9 }),
    song({ id: "c", title: "Cherry", likeCount: 3, sungCount: 3 }),
  ];

  test("default/random은 순서 유지(복사본)", () => {
    const result = sortSongs(songs, "default", "desc");
    expect(result.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(result).not.toBe(songs);
  });

  test("likes desc/asc", () => {
    expect(sortSongs(songs, "likes", "desc").map((s) => s.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(sortSongs(songs, "likes", "asc").map((s) => s.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  test("sungCount desc", () => {
    expect(sortSongs(songs, "sungCount", "desc").map((s) => s.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  test("title asc는 대소문자 무시 정렬", () => {
    expect(sortSongs(songs, "title", "asc").map((s) => s.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  test("title 정렬은 titleAlias를 우선", () => {
    const withAlias: Song[] = [
      song({ id: "x", title: "Zebra", titleAlias: "가나다" }),
      song({ id: "y", title: "Apple", titleAlias: "하하하" }),
    ];
    expect(sortSongs(withAlias, "title", "asc").map((s) => s.id)).toEqual([
      "x",
      "y",
    ]);
  });
});

describe("shuffle", () => {
  test("원본 불변 + 동일 원소 보존", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr, () => 0);
    expect(result).not.toBe(arr);
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test("rng 주입으로 결정적", () => {
    // rng가 항상 0이면 j는 항상 0 → 각 단계에서 result[i]와 result[0] 교환
    const result = shuffle([1, 2, 3], () => 0);
    expect(result).toEqual([2, 3, 1]);
  });
});
