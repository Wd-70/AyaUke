/**
 * 곡 매칭 (순수 함수) — 아티스트/제목 문자열로 등록곡 후보를 찾는다.
 * timeline-parser 라우트의 findSongMatches 로직을 추출해 클라이언트(로컬 작업)
 * 에서도 쓸 수 있게 한 것. 정규화 → 유사도(포함/공통접두접미/Levenshtein) → 가중합.
 */

export interface MatchableSong {
  id: string;
  title: string;
  artist: string;
  titleAlias?: string;
  artistAlias?: string;
  searchTags?: string[];
}

export interface SongMatch {
  songId: string;
  title: string;
  artist: string;
  confidence: number;
}

/** 공백/구두점 제거 + 소문자, 한글·영문·숫자만 */
export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[-_.,!?()[\]{}]/g, '')
    .replace(/[^\w가-힣]/g, '');
}

function levenshtein(a: string, b: string): number {
  const m: number[][] = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] =
        b.charAt(i - 1) === a.charAt(j - 1)
          ? m[i - 1][j - 1]
          : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[b.length][a.length];
}

/** 두 (정규화된) 문자열의 유사도 0~1 */
export function similarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    return 0.8 + (shorter.length / longer.length) * 0.2;
  }

  let common = 0;
  const minLen = Math.min(s1.length, s2.length);
  for (let i = 0; i < minLen; i++) {
    if (s1[i] === s2[i]) common++;
    else break;
  }
  for (let i = 1; i <= minLen - common; i++) {
    if (s1[s1.length - i] === s2[s2.length - i]) common++;
    else break;
  }
  if (common > 0) {
    const sim = common / Math.max(s1.length, s2.length);
    if (sim >= 0.3) return sim;
  }

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  return Math.max(0, (maxLen - levenshtein(s1, s2)) / maxLen);
}

/**
 * 등록곡 중 입력 아티스트/제목에 맞는 후보를 신뢰도순(상위 limit)으로 반환.
 * 아티스트 40% + 제목 60% 가중, 최소 신뢰도 minConfidence 이상만.
 */
export function matchSongs(
  artist: string,
  title: string,
  songs: MatchableSong[],
  { minConfidence = 0.6, limit = 5 }: { minConfidence?: number; limit?: number } = {},
): SongMatch[] {
  const qArtist = normalizeText(artist);
  const qTitle = normalizeText(title);
  const matches: SongMatch[] = [];

  for (const song of songs) {
    let bestArtist = similarity(qArtist, normalizeText(song.artist));
    let bestTitle = similarity(qTitle, normalizeText(song.title));

    if (song.artistAlias) bestArtist = Math.max(bestArtist, similarity(qArtist, normalizeText(song.artistAlias)));
    if (song.titleAlias) bestTitle = Math.max(bestTitle, similarity(qTitle, normalizeText(song.titleAlias)));

    for (const tag of song.searchTags || []) {
      const nt = normalizeText(tag);
      bestArtist = Math.max(bestArtist, similarity(qArtist, nt));
      bestTitle = Math.max(bestTitle, similarity(qTitle, nt));
    }

    const confidence = bestArtist * 0.4 + bestTitle * 0.6;
    if (confidence >= minConfidence) {
      matches.push({ songId: song.id, title: song.title, artist: song.artist, confidence });
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}
