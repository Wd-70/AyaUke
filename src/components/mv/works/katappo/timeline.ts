// 片っぽ (eill) — 아야 커버, 2026.09.02 클립 edPahqLkwmHs (다시보기 14991767, 32752~32972초)
// 시간은 모두 클립 시작 기준 초. 기획은 PLAN.md — 장면 번호·내용이 그 표와 같다.
// 가사 원문/번역은 SongDetail DB, 타이밍은 scripts/mv/align_lyrics.py 초안 → 편집기에서 다듬어 lyrics.json에 둔다.
import type { MvCue, MvLyricLine, MvSection } from '../../types';
import { type LyricsDoc, toLines } from '../../lyrics-doc';
import lyricsDoc from './lyrics.json';
import cuesDoc from './cues.json';

/** scripts/mv/analyze.py — 82 BPM */
export const BEAT_PERIOD = 0.73175;
export const BEAT_PHASE = 0.3;
export const DURATION = 220;

/** 효과 시각 — cues.json (로컬 편집기 `/mv/[id]/edit`의 "효과" 탭으로 조정) */
export type Cues = Record<keyof typeof cuesDoc, number>;
export const CUES: Cues = cuesDoc;

/** 편집기에 보이는 이름 — 순서도 이대로 */
export const CUE_LABELS: Record<keyof Cues, string> = {
  beatOffset: '비트 연출 보정 (+ 늦게 / − 일찍)',
  cutOffset: '가사 줄에 붙은 장면 전환 보정 (+ 늦게 / − 일찍)',
  titleIn: '제목 등장',
  hush: '무음 — 꽃잎 하나만 (장면 24)',
  climax: '마지막 후렴 · 전조 폭발 (장면 28)',
  peak: '최고음 A5 — 가장 밝게',
  coda: '아웃트로 — 꽃병으로 돌아옴 (장면 36)',
  endTitle: '엔딩 타이틀',
  outro: '페이드 아웃',
};

const OFFSET_IDS: (keyof Cues)[] = ['beatOffset', 'cutOffset'];
const SECTION_IDS: (keyof Cues)[] = ['hush', 'climax', 'coda'];

export const CUE_LIST: MvCue[] = (Object.keys(CUE_LABELS) as (keyof Cues)[]).map((id) => ({
  id,
  label: CUE_LABELS[id],
  t: CUES[id],
  ...(SECTION_IDS.includes(id) ? { section: true } : {}),
  ...(OFFSET_IDS.includes(id) ? { offset: true } : {}),
}));

/** 가사 타이밍 — lyrics.json (로컬 편집기 `/mv/[id]/edit`로 조정) */
export const LYRICS: MvLyricLine[] = toLines(lyricsDoc as LyricsDoc);

// ── 장면 ──────────────────────────────────────────

/** 표현 기법(PLAN.md 약호) */
export type Tech = '수채' | '선화' | '실루엣' | '입자' | '타이포' | '분할' | '영상' | '빛';

/** 화면 온도 — 겨울(나) ↔ 해바라기(너). 분할 장면은 두 온도 */
export type Tone = 'frost' | 'winter' | 'sun' | 'room' | 'dark' | 'bloom';

export interface SceneDef {
  id: string;
  /** 시작: 가사 줄 번호(1부터 — 그 줄 첫 덩어리 + cutOffset), 효과 시각 이름, 0이면 클립 시작 */
  at: number | keyof Cues;
  /** 무엇을 보여 주나 */
  what: string;
  /** 구도 */
  shot: string;
  tech: Tech[];
  tone: Tone | [Tone, Tone];
  /** 분할 방향(tone이 둘일 때) */
  split?: 'lr' | 'tb';
}

/** PLAN.md '구간별 장면' 표와 같은 순서·번호(0부터) */
export const SCENES: SceneDef[] = [
  { id: 'frost', at: 0, what: '서리 낀 유리창, 결정이 자람 · 흐린 노란 점 · 제목', shot: '유리창 정면 클로즈업', tech: ['선화'], tone: 'frost' },
  { id: 'unfinishedMap', at: 1, what: '연필 선이 길·집·두 사람을 그리다 멈춤', shot: '책상 부감', tech: ['선화'], tone: 'room' },
  { id: 'morningBack', at: 2, what: '아침 역광 속 누군가의 등', shot: '아야 시점, 살짝 올려다봄', tech: ['실루엣', '수채'], tone: 'winter' },
  { id: 'hands', at: 3, what: '맞잡은 두 손 · 「ぎゅっと」에서 선이 굵어짐', shot: '손 클로즈업, 옆', tech: ['선화', '수채'], tone: 'room' },
  { id: 'halfAlone', at: 5, what: '왼쪽 반 아야, 오른쪽 반 텅 빈 눈밭', shot: '와이드, 좌우 반', tech: ['분할', '실루엣'], tone: ['winter', 'frost'], split: 'lr' },
  { id: 'scatter', at: 6, what: '방 안 물건이 공중에 흩어져 돎, 가운데 아야', shot: '정면, 카메라 뒤로 빠짐', tech: ['입자'], tone: 'room' },
  { id: 'scatterRing', at: 7, what: '조각들이 아야를 원으로 감쌈 · 빌드업', shot: '위에서 수직', tech: ['타이포', '입자'], tone: 'room' },
  { id: 'vase', at: 8, what: '꽃병의 해바라기 — 처음 나오는 금색(채도 절반)', shot: '꽃 클로즈업, 정면', tech: ['수채'], tone: 'sun' },
  { id: 'polaroids', at: 10, what: '폴라로이드가 놓임, 사진 속은 원본 아야 영상', shot: '부감, 하나씩 놓임', tech: ['영상'], tone: 'room' },
  { id: 'crackedWords', at: 11, what: '큰 글자가 써지고 「気づかなきゃ」가 갈라짐', shot: '정면, 글자 크게', tech: ['타이포'], tone: 'winter' },
  { id: 'splitLR', at: 12, what: '좌 겨울 / 우 햇빛 해바라기, 경계에 아야', shot: '와이드, 좌우 분할', tech: ['분할', '실루엣'], tone: ['winter', 'sun'], split: 'lr' },
  { id: 'petalFall', at: 13, what: '떨어지는 꽃잎을 따라 내려감', shot: '옆, 틸트 다운', tech: ['입자'], tone: 'sun' },
  { id: 'footprints', at: 15, what: '눈길 발자국이 멀리 낮은 해 쪽으로', shot: '낮은 각도, 원근 깊게', tech: ['수채', '선화'], tone: 'winter' },
  { id: 'standing', at: 16, what: '발자국이 멈춘 자리의 아야, 해는 지평선 너머', shot: '뒷모습 와이드', tech: ['실루엣'], tone: 'winter' },
  { id: 'winterCore', at: 17, what: '눈보라 한가운데 아야 — 청백만', shot: '정면, 화면 중앙', tech: ['입자', '실루엣'], tone: 'winter' },
  { id: 'sunFlower', at: 18, what: '같은 자리에 해바라기 한 송이 — 17과 대칭', shot: '정면, 화면 중앙', tech: ['수채'], tone: 'sun' },
  { id: 'splitGap', at: 19, what: '17·18을 좌우로 붙임, 「片っぽ」에서 틈이 벌어짐', shot: '와이드 분할', tech: ['분할'], tone: ['winter', 'sun'], split: 'lr' },
  { id: 'scatterTop', at: 20, what: '흩어진 방을 위에서 — 조각에 눈송이·꽃잎이 섞임', shot: '위에서 수직(5와 반대)', tech: ['입자'], tone: 'room' },
  { id: 'scatterPull', at: 21, what: '조각들이 아야에게 빨려 듦 · 빌드업', shot: '정면 줌인', tech: ['타이포', '입자'], tone: 'room' },
  { id: 'window', at: 22, what: '창밖 눈 덮인 해바라기 밭, 창틀 안의 아야', shot: '실내에서 창 너머 와이드', tech: ['수채', '실루엣'], tone: 'winter' },
  { id: 'filmStrip', at: 24, what: '원본 영상 프레임이 필름처럼 흐름', shot: '옆으로 흐르는 띠', tech: ['영상'], tone: 'room' },
  { id: 'profile', at: 25, what: '아야 옆얼굴, 뒤로 빛 번짐', shot: '옆얼굴 클로즈업', tech: ['실루엣', '빛'], tone: 'sun' },
  { id: 'splitTB', at: 26, what: '위 겨울 / 아래 해', shot: '상하 분할', tech: ['분할'], tone: ['winter', 'sun'], split: 'tb' },
  { id: 'petalStorm', at: 27, what: '꽃잎 폭풍 — 고음에서 화면 가득', shot: '아래에서 올려다봄', tech: ['입자'], tone: 'sun' },
  { id: 'hush', at: 'hush', what: '멈춘 꽃잎 하나, 나머지 거의 검정', shot: '꽃잎 클로즈업', tech: [], tone: 'dark' },
  { id: 'bridgeVase', at: 29, what: '흑백에 가까운 수채, 방 안 꽃병', shot: '와이드 정적', tech: ['수채'], tone: 'room' },
  { id: 'warmLight', at: 30, what: '아야를 감싸는 희미한 따뜻한 빛(유일한 색)', shot: '아야 미디엄, 정면', tech: ['실루엣', '빛'], tone: 'room' },
  { id: 'embrace', at: 31, what: '빛이 팔처럼 감쌈 · 끝에 비네팅 최대 → 암전', shot: '같은 구도 줌인', tech: ['선화', '빛'], tone: 'dark' },
  { id: 'bloom', at: 'climax', what: '겨울 땅에서 해바라기가 한꺼번에 피어남 — 금색 전부', shot: '크레인 업, 땅 → 하늘', tech: ['수채', '입자'], tone: 'bloom' },
  { id: 'fieldWide', at: 33, what: '해바라기 밭 한가운데 아야', shot: '와이드 부감', tech: ['실루엣'], tone: 'bloom' },
  { id: 'flowerFootage', at: 34, what: '해바라기 꽃 가운데 원본 영상', shot: '꽃 정면 클로즈업', tech: ['영상'], tone: 'bloom' },
  { id: 'armsOpen', at: 35, what: '아야가 두 팔을 펼침', shot: '로우 앵글, 정면 크게', tech: ['실루엣'], tone: 'bloom' },
  { id: 'heartBloom', at: 36, what: '가슴에서 해바라기가 피어남', shot: '가슴 클로즈업', tech: ['선화', '수채'], tone: 'bloom' },
  { id: 'goldSky', at: 37, what: '하늘 가득한 금빛 — 최고음에서 최대 밝기', shot: '하늘 와이드', tech: ['입자', '빛'], tone: 'bloom' },
  { id: 'tears', at: 38, what: '「落ちて」마다 컷 — 꽃잎이 눈물 방울로', shot: '매 컷 다른 각도', tech: ['입자'], tone: 'sun' },
  { id: 'lastDrop', at: 39, what: '방울 하나가 바닥에 떨어져 번짐', shot: '바닥 클로즈업', tech: ['수채'], tone: 'room' },
  { id: 'coda', at: 'coda', what: '꽃병 해바라기에 꽃잎 하나, 창밖엔 눈 · 엔딩', shot: '0번과 같은 창 정면(수미상관)', tech: ['수채', '선화'], tone: 'frost' },
];

export interface SceneSpan extends MvSection {
  /** SCENES 안 번호 = PLAN.md 장면 번호 */
  index: number;
  def: SceneDef;
}

/** 장면 시작 시각 — 가사 줄에 붙은 장면은 줄 타이밍을 고치면 같이 움직인다 */
function sceneStart(def: SceneDef, k: number, lines: MvLyricLine[], c: Cues) {
  if (def.at === 0) return -1;
  if (typeof def.at === 'number') return (lines[def.at - 1]?.t ?? 0) + c.cutOffset;
  return c[def.at];
}

export function scenesOf(lines: MvLyricLine[], c: Cues): SceneSpan[] {
  const starts: number[] = [];
  SCENES.forEach((def, k) => {
    const s = sceneStart(def, k, lines, c);
    // 편집 중 순서가 뒤집혀도 장면이 사라지지 않게 최소 0.05초는 남긴다
    starts.push(k ? Math.max(s, starts[k - 1] + 0.05) : s);
  });
  return SCENES.map((def, k) => ({
    id: def.id,
    index: k,
    def,
    start: starts[k],
    end: k + 1 < starts.length ? starts[k + 1] : DURATION + 1,
  }));
}

/**
 * 「落ちて」 컷(장면 34) — 줄 38의 덩어리마다 각도를 바꾼다.
 * 몇 번째 컷인지(0~)와 그 컷의 시작 시각.
 */
export function cutWithin(line: MvLyricLine | undefined, t: number) {
  if (!line) return { n: 0, at: 0 };
  let n = 0;
  line.ja.forEach((ch, i) => {
    if (t >= ch.t) n = i;
  });
  return { n, at: line.ja[n].t };
}
