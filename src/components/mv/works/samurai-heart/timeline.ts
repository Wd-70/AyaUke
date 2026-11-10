// 사무라이 하트 (SPYAIR) — 아야 커버, 2026.08.26 노래방송 클립 z1baTcmHs8WJ
// 시간은 모두 클립 시작(다시보기 9725초) 기준 초.
// 가사 원문/번역은 SongDetail DB, 타이밍은 whisper 단어 타임스탬프 + 113BPM 비트 그리드로 맞춘 뒤 lyrics.json에 둔다.
// 커버는 원곡을 줄인 편곡이라 2절 후렴 일부가 생략돼 있다(실제 부른 순서대로 기록).
import type { MvLyricLine, MvSection } from '../../types';
import { type LyricsDoc, toLines } from '../../lyrics-doc';
import lyricsDoc from './lyrics.json';

export const BEAT_PERIOD = 0.531;
export const BEAT_PHASE = 0.05;

export const SECTIONS: MvSection[] = [
  { id: 'intro', start: -1, end: 14.9 },
  { id: 'verse1', start: 14.9, end: 31.75 },
  { id: 'pre1', start: 31.75, end: 40.3 },
  { id: 'chorus1', start: 40.3, end: 59.5 },
  { id: 'post1', start: 59.5, end: 69.5 },
  { id: 'verse2', start: 69.5, end: 87.0 },
  { id: 'glass', start: 87.0, end: 95.55 },
  { id: 'chorus2', start: 95.55, end: 113.2 },
  { id: 'interlude', start: 113.2, end: 133.75 },
  { id: 'quiet', start: 133.75, end: 150.65 },
  { id: 'final', start: 150.65, end: 168.6 },
  { id: 'break', start: 168.6, end: 171.85 },
  { id: 'finale', start: 171.85, end: 190.4 },
  { id: 'outro', start: 190.4, end: 200 },
];

/** 가사 타이밍 — lyrics.json (로컬 편집기 `/mv/[id]/edit`로 조정) */
export const LYRICS: MvLyricLine[] = toLines(lyricsDoc as LyricsDoc);

export interface RapidWord {
  t: number;
  text: string;
  /** 글자 중심 좌표 — 읽는 순서대로 좌우 지그재그, 붉은 주인공 머리 위는 비움 */
  x: number;
  y: number;
  /** 가운데 크게 찍히고 앞 단어들을 날려 보내는 단어 */
  punch?: boolean;
}

/** 1·2절 후반 말이 빨라지는 구간 — 자막 대신 단어를 하나씩 터뜨린다 */
export const RAPID_RANGES: [number, number][] = [
  [23.05, 31.7],
  [78.15, 86.95],
];

/** 빠른 구간의 단어 = 그 구간 줄들 중 배치 힌트(x,y)가 있는 덩어리 */
export function rapidPassages(lines: MvLyricLine[]) {
  return RAPID_RANGES.map((range) => ({
    range,
    words: lines
      .filter((l) => l.t >= range[0] && l.t < range[1])
      .flatMap((l) => l.ja)
      .filter((c): c is RapidWord => c.x !== undefined && c.y !== undefined),
  }));
}

/** 사무라이 하트 "칼베기" 타이밍 */
export function slashTimes(lines: MvLyricLine[]) {
  return lines.flatMap((l) => l.ja.filter((c) => c.text === 'サムライハート').map((c) => c.t));
}

/** 화면 채도(무채색 세계 → 붉은 마음이 번져가는 서사) */
export const CHROMA_KEYS: [number, number][] = [
  [0, 0.15], [14.9, 0], [31.8, 0.05], [40.0, 0.1], [40.3, 0.65], [59.5, 0.7], [69.5, 0.15],
  [87.0, 0.3], [95.5, 0.35], [95.6, 0.8], [113.2, 0.55], [133.7, 0.15], [150.0, 0.3],
  [150.65, 1], [168.6, 0.6], [171.85, 1], [192, 1],
];
