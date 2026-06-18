/**
 * 유튜브 타임라인 댓글 파싱 — 순수 함수만 (DB/네트워크/로그 없음).
 * 기존 timeline-parser 라우트의 인라인 파서를 추출한 것.
 * 유튜브 댓글은 타임스탬프가 HTML <a> 링크로 들어오므로 치지직과 파싱 방식이 다르다.
 */
import { parseTimeToSeconds } from './timeline-parser';

export interface YouTubeClipEntry {
  videoUrl: string;
  artist: string;
  songTitle: string;
  startTimeSeconds: number;
  endTimeSeconds: number | null;
  duration: number | null;
  uploadedDate: Date | null;
  originalDateString: string | null;
  isRelevant: boolean;
}

const NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&nbsp;': ' ', '&copy;': '©', '&reg;': '®', '&trade;': '™',
};

/** HTML 엔티티 디코딩 (&#39; / &#x27; / &amp; …) */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (m, code) => { try { return String.fromCharCode(parseInt(code, 10)); } catch { return m; } })
    .replace(/&#x([0-9a-fA-F]+);/g, (m, code) => { try { return String.fromCharCode(parseInt(code, 16)); } catch { return m; } })
    .replace(/&[a-zA-Z][a-zA-Z0-9]*;/g, (e) => NAMED_ENTITIES[e] || e);
}

/** 의미 있는 텍스트인가 (빈 문자열/기호만 제외) */
function isMusicContent(text: string): boolean {
  if (!text || text.trim() === '' || /^[?!.~\s]*$/.test(text)) return false;
  return true;
}

/** 아티스트/곡명 분리 (구분자: " - " " – " " — " " | " " / ") */
export function parseSongInfo(songText: string): { artist: string; songTitle: string } {
  const clean = songText.trim();
  const separators = [' - ', ' – ', ' — ', ' | ', ' / '];
  for (const sep of separators) {
    if (clean.includes(sep)) {
      const parts = clean.split(sep);
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        return { artist: parts[0].trim(), songTitle: parts.slice(1).join(sep).trim() };
      }
    }
  }
  return { artist: '알 수 없음', songTitle: clean };
}

interface Section {
  timeText: string;
  timeSeconds: number;
  content: string;
  baseVideoUrl: string;
}

/** HTML 댓글을 타임스탬프 <a> 링크 기준으로 구간 분할 */
function splitCommentByTimestamps(decodedHtml: string): Section[] {
  const results: Section[] = [];
  let baseVideoUrl = '';

  const linkMatch = decodedHtml.match(/<a[^>]*href="([^"]*youtube[^"]*)"[^>]*>/);
  if (linkMatch) {
    baseVideoUrl = linkMatch[1].replace(/[?&]t=\d+/, '').replace(/[?&]$/, '');
  }

  const allTimestampPattern = /<a[^>]*>(\d{1,2}:\d{2}(?::\d{2})?)<\/a>/g;
  const positions: { timeText: string; timeSeconds: number; startPos: number; endPos: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = allTimestampPattern.exec(decodedHtml)) !== null) {
    positions.push({
      timeText: m[1],
      timeSeconds: parseTimeToSeconds(m[1]),
      startPos: m.index,
      endPos: m.index + m[0].length,
    });
  }

  positions.forEach((ts, index) => {
    const nextStart = index < positions.length - 1 ? positions[index + 1].startPos : decodedHtml.length;
    const contextText = decodedHtml.substring(ts.endPos, nextStart);

    let cleanText = contextText
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    cleanText = cleanText
      .replace(/^[🎵🪻]\s*/, '')
      .replace(/^\[.*?\]\s*/, '')
      .replace(/^\s*-\s*/, '')
      .replace(/^\s*~\s*/, '')
      .trim();

    // "곡1 VS 시간 곡2" → VS 앞부분만 현재 타임스탬프에 연결
    const vsMatch = cleanText.match(/^(.*?)\s+VS\s+(\d{1,2}:\d{2}(?::\d{2})?)\s+(.*?)$/);
    if (vsMatch) cleanText = vsMatch[1].trim();

    if (!cleanText || cleanText.length < 2) return;
    if (!isMusicContent(cleanText)) return;

    results.push({ timeText: ts.timeText, timeSeconds: ts.timeSeconds, content: cleanText, baseVideoUrl });
  });

  results.sort((a, b) => a.timeSeconds - b.timeSeconds);
  return results;
}

/** 영상 제목에서 방송 날짜 추출 (YY.MM.DD / YYYY.MM.DD / YYYY년 M월 D일 등) */
export function extractDateFromTitle(title: string): { date: Date | null; originalString: string | null } {
  const shortYearMatch = title.match(/(\d{2})\.(\d{1,2})\.(\d{1,2})/);
  if (shortYearMatch) {
    const year = parseInt(shortYearMatch[1]);
    const fullYear = year < 50 ? 2000 + year : 1900 + year;
    const date = new Date(fullYear, parseInt(shortYearMatch[2]) - 1, parseInt(shortYearMatch[3]));
    if (!isNaN(date.getTime())) return { date, originalString: shortYearMatch[0] };
  }

  const datePatterns: { pattern: RegExp; parser: (m: RegExpMatchArray) => Date }[] = [
    { pattern: /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/, parser: (m) => new Date(+m[1], +m[2] - 1, +m[3]) },
    { pattern: /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/, parser: (m) => new Date(+m[3], +m[1] - 1, +m[2]) },
    { pattern: /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/, parser: (m) => new Date(+m[1], +m[2] - 1, +m[3]) },
  ];
  for (const { pattern, parser } of datePatterns) {
    const match = title.match(pattern);
    if (match) {
      const date = parser(match);
      if (!isNaN(date.getTime())) return { date, originalString: match[0] };
    }
  }

  return { date: null, originalString: null };
}

/**
 * 유튜브 타임라인 댓글(HTML) → 곡 항목 배열.
 * HTML <a> 타임스탬프 링크로 구간 분할 후 각 구간을 곡으로 파싱, 종료시각은 다음 구간 시작.
 */
export function parseYouTubeTimelineComment(htmlText: string, videoTitle: string): YouTubeClipEntry[] {
  const decoded = decodeHtmlEntities(htmlText);
  const sections = splitCommentByTimestamps(decoded);
  if (sections.length === 0) return [];

  const raw = sections.map((s) => {
    const info = parseSongInfo(s.content);
    return {
      url: s.baseVideoUrl || '',
      timeSeconds: s.timeSeconds,
      artist: info.artist,
      songTitle: info.songTitle,
      isRelevant: info.artist !== '알 수 없음',
    };
  });
  raw.sort((a, b) => a.timeSeconds - b.timeSeconds);

  const baseVideoUrl = raw.length > 0 ? raw[0].url.replace(/[?&]t=\d+/, '').replace(/[?&]$/, '') : '';
  const dateInfo = extractDateFromTitle(videoTitle);

  return raw.map((cur, i) => {
    const next = raw[i + 1];
    return {
      videoUrl: baseVideoUrl,
      artist: cur.artist,
      songTitle: cur.songTitle,
      startTimeSeconds: cur.timeSeconds,
      endTimeSeconds: next ? next.timeSeconds : null,
      duration: next ? next.timeSeconds - cur.timeSeconds : null,
      uploadedDate: dateInfo.date,
      originalDateString: dateInfo.originalString,
      isRelevant: cur.isRelevant,
    };
  });
}
