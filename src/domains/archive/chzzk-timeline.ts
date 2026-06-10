/**
 * 치지직 타임라인 댓글 → 곡 항목 파싱 (순수 함수).
 * 치지직 댓글은 일반 텍스트라 유튜브(HTML 앵커)보다 단순하다:
 * "H:MM:SS 아티스트 - 곡명" 형태의 줄을 곡 항목으로 해석한다.
 */
import { parseTimeToSeconds } from './timeline-parser';

export interface ChzzkTimelineEntry {
  startTimeSeconds: number;
  /** 다음 항목의 시작 시간. 마지막 항목은 null (영상 끝까지) */
  endTimeSeconds: number | null;
  duration: number | null;
  artist: string;
  songTitle: string;
  /** ' - ' 류 구분자가 있어 곡으로 보이는 항목인가 (없으면 방송 메모일 가능성) */
  isRelevant: boolean;
}

/** 줄 머리 타임스탬프: "1:23:45 내용" 또는 "3:45 내용" */
const LINE_TIMESTAMP_REGEX = /^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/;

/** 아티스트/곡명 구분자 (유튜브 파서와 동일한 규칙) */
const SONG_SEPARATORS = [' - ', ' – ', ' — ', ' | ', ' / '];

export function parseSongInfo(songText: string): { artist: string; songTitle: string } {
  const cleanText = songText.trim();

  for (const separator of SONG_SEPARATORS) {
    if (cleanText.includes(separator)) {
      const parts = cleanText.split(separator);
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        return {
          artist: parts[0].trim(),
          songTitle: parts.slice(1).join(separator).trim(),
        };
      }
    }
  }

  // 구분자가 없으면 전체를 곡명으로, 아티스트는 미상 처리
  return { artist: '알 수 없음', songTitle: cleanText };
}

export function parseChzzkTimelineComment(content: string): ChzzkTimelineEntry[] {
  const rawEntries: Array<{
    timeSeconds: number;
    artist: string;
    songTitle: string;
    isRelevant: boolean;
  }> = [];

  for (const line of content.split('\n')) {
    const match = line.match(LINE_TIMESTAMP_REGEX);
    if (!match) continue;

    const timeSeconds = parseTimeToSeconds(match[1]);
    const text = match[2].trim();
    if (!text) continue;

    const songInfo = parseSongInfo(text);
    rawEntries.push({
      timeSeconds,
      artist: songInfo.artist,
      songTitle: songInfo.songTitle,
      isRelevant: songInfo.artist !== '알 수 없음',
    });
  }

  rawEntries.sort((a, b) => a.timeSeconds - b.timeSeconds);

  return rawEntries.map((current, i) => {
    const next = rawEntries[i + 1];
    return {
      startTimeSeconds: current.timeSeconds,
      endTimeSeconds: next ? next.timeSeconds : null,
      duration: next ? next.timeSeconds - current.timeSeconds : null,
      artist: current.artist,
      songTitle: current.songTitle,
      isRelevant: current.isRelevant,
    };
  });
}
