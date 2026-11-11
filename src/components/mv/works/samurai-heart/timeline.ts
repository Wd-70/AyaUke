// 사무라이 하트 (SPYAIR) — 아야 커버, 2026.08.26 노래방송 클립 z1baTcmHs8WJ
// 시간은 모두 클립 시작(다시보기 9725초) 기준 초.
// 가사 원문/번역은 SongDetail DB, 타이밍은 whisper 단어 타임스탬프 + 113BPM 비트 그리드로 맞춘 뒤 lyrics.json에 둔다.
// 커버는 원곡을 줄인 편곡이라 2절 후렴 일부가 생략돼 있다(실제 부른 순서대로 기록).
import type { MvCue, MvLyricLine, MvSection } from '../../types';
import { type LyricsDoc, toLines } from '../../lyrics-doc';
import lyricsDoc from './lyrics.json';
import cuesDoc from './cues.json';

export const BEAT_PERIOD = 0.531;
export const BEAT_PHASE = 0.05;

/** 효과 시각 — cues.json (로컬 편집기 `/mv/[id]/edit`의 "효과" 탭으로 조정). 연출 길이는 코드에 두고 시작점만 여기서 */
export type Cues = Record<keyof typeof cuesDoc, number>;
export const CUES: Cues = cuesDoc;

/** 편집기에 보이는 이름 — 순서도 이대로 */
export const CUE_LABELS: Record<keyof Cues, string> = {
  bloom1: '전주 먹 번짐 ①',
  ensoDraw: '제목 원상 그리기',
  bloom2: '전주 먹 번짐 ②',
  titleText: '제목 글자 등장',
  bloom3: '전주 먹 번짐 ③',
  credit: '제목 아래 크레딧',
  groove: '베이스·킥 진입 — 도시 등장',
  build: '빌드업 — 카메라가 제목을 뚫고 들어감',
  verse1: '1절 진입 칼베기 · 섬광',
  pre1: '프리코러스 — 비 고조',
  skyTilt: '하늘 올려다보기 (虚しくって)',
  catchball: '캐치볼 (届かない)',
  kodoku: '孤独 붓글씨',
  chorus1: '1절 후렴 · 섬광',
  post1: '후렴 뒤 간주 (サムライハート)',
  verse2: '2절 — 노을 도시',
  footprints: '발자국',
  heroWalk: '주인공 걸어 나감 (歩けてるかも)',
  glass: '유리창 장면',
  crack1: '유리 금 ①',
  crack2: '유리 금 ②',
  chorus2: '유리 깨짐 · 2절 후렴',
  interlude: '간주 — 아야 크게',
  ensoErase: '간주 원 지우기',
  quiet: '조용한 후렴',
  quietBuild: '조용한 후렴 고조 시작',
  final: '마지막 후렴 · 섬광',
  break: '브레이크 — 하트',
  heartSwell: '하트 부풀기',
  finale: '피날레 · 섬광',
  endTitle: '엔딩 타이틀',
  outro: '페이드 아웃',
};

const SECTION_IDS = ['verse1', 'pre1', 'chorus1', 'post1', 'verse2', 'glass', 'chorus2', 'interlude', 'quiet', 'final', 'break', 'finale', 'outro'] as const;

export const CUE_LIST: MvCue[] = (Object.keys(CUE_LABELS) as (keyof Cues)[]).map((id) => ({
  id,
  label: CUE_LABELS[id],
  t: CUES[id],
  ...((SECTION_IDS as readonly string[]).includes(id) ? { section: true } : {}),
}));

/** 장면 구간 — 경계는 효과 시각에서 */
export function sectionsOf(c: Cues): MvSection[] {
  const bounds = [-1, ...SECTION_IDS.map((id) => c[id]), 200];
  return ['intro', ...SECTION_IDS].map((id, i) => ({ id, start: bounds[i], end: bounds[i + 1] }));
}

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

export const isRapidLine = (l: MvLyricLine) => l.ja.some((c) => c.x !== undefined && c.y !== undefined);

/**
 * 1·2절 후반 말이 빨라지는 구간 — 자막 대신 단어를 하나씩 터뜨린다.
 * 배치 힌트(x,y)가 있는 줄이 연달아 있으면 한 구간이고, 범위는 그 줄들의 첫 단어~마지막 줄이 사라질 때까지.
 */
export function rapidPassages(lines: MvLyricLine[]) {
  const out: { range: [number, number]; words: RapidWord[] }[] = [];
  let prev = false;
  for (const l of lines) {
    const rapid = isRapidLine(l);
    if (rapid) {
      const words = l.ja.filter((c): c is RapidWord => c.x !== undefined && c.y !== undefined);
      if (!prev) out.push({ range: [l.t, l.end + 0.35], words });
      else {
        const p = out[out.length - 1];
        p.words.push(...words);
        p.range[1] = l.end + 0.35;
      }
    }
    prev = rapid;
  }
  return out;
}

/** 사무라이 하트 "칼베기" 타이밍 */
export function slashTimes(lines: MvLyricLine[]) {
  return lines.flatMap((l) => l.ja.filter((c) => c.text === 'サムライハート').map((c) => c.t));
}

/** 화면 채도(무채색 세계 → 붉은 마음이 번져가는 서사) */
export function chromaKeys(c: Cues): [number, number][] {
  return [
    [0, 0.15], [c.verse1, 0], [c.pre1 + 0.05, 0.05], [c.chorus1 - 0.3, 0.1], [c.chorus1, 0.65], [c.post1, 0.7],
    [c.verse2, 0.15], [c.glass, 0.3], [c.chorus2 - 0.05, 0.35], [c.chorus2 + 0.05, 0.8], [c.interlude, 0.55],
    [c.quiet - 0.05, 0.15], [c.final - 0.65, 0.3], [c.final, 1], [c.break, 0.6], [c.finale, 1], [192, 1],
  ];
}
