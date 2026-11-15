// 踊 (Ado) — 아야 커버, 2026.08.31 클립 maEp3Cz1puEI (다시보기 14959599, 9413~9622초)
// 시간은 모두 클립 시작 기준 초. 기획은 PLAN.md — 장면 번호·내용이 그 표와 같다.
// 가사 원문/번역은 SongDetail DB, 타이밍은 scripts/mv/align_lyrics.py 초안 → 편집기에서 다듬어 lyrics.json에 둔다.
import type { MvCue, MvLyricLine, MvSection } from '../../types';
import { type LyricsDoc, toLines } from '../../lyrics-doc';
import lyricsDoc from './lyrics.json';
import cuesDoc from './cues.json';

/**
 * scripts/mv/analyze.py — 128 BPM. 구간이 전부 8마디 단위. 가사가 없는 곳(드롭·간주)의 장면은 마디에, 나머지는 가사 타이밍에 붙인다.
 * 분석이 낸 위상은 0.048인데 그 박은 마디의 넷째 박이었다(큰 박이 한 박 일렀음) — 구간이 시작하는 킥, 「K.O.」·「Say NO」가
 * 떨어지는 자리가 모두 그다음 박이라 한 박 늦춘 값을 쓴다. 박 자체의 미세 보정은 cues.json의 beatOffset.
 */
export const BEAT_PERIOD = 0.46877;
export const BEAT_PHASE = 0.048 + BEAT_PERIOD;
export const BAR = BEAT_PERIOD * 4;
export const DURATION = 209;

/** 효과 시각 — cues.json (로컬 편집기 `/mv/[id]/edit`의 "효과" 탭으로 조정) */
export type Cues = Record<keyof typeof cuesDoc, number>;
export const CUES: Cues = cuesDoc;

/** 편집기에 보이는 이름 — 순서도 이대로 */
export const CUE_LABELS: Record<keyof Cues, string> = {
  beatOffset: '박 보정 — 장면 전환·박 연출 전체 (+ 늦게 / − 일찍)',
  titleIn: '제목 네온이 켜짐',
  scream: '「K.O.」 뒤 고음 C6 — 화면이 흰색으로 뒤집힘 (장면 39)',
  peak: '최고음 C6를 끄는 곳 — 빛기둥 (장면 46)',
  coda: '노래 끝 — 비상구 표지만 남음 (장면 56)',
  endTitle: '엔딩 타이틀',
  outro: '페이드 아웃',
};

const OFFSET_IDS: (keyof Cues)[] = ['beatOffset'];
const SECTION_IDS: (keyof Cues)[] = ['coda'];

export const CUE_LIST: MvCue[] = (Object.keys(CUE_LABELS) as (keyof Cues)[]).map((id) => ({
  id,
  label: CUE_LABELS[id],
  t: CUES[id],
  ...(SECTION_IDS.includes(id) ? { section: true } : {}),
  ...(OFFSET_IDS.includes(id) ? { offset: true } : {}),
}));

/** 가사 타이밍 — lyrics.json (로컬 편집기 `/mv/[id]/edit`로 조정) */
export const LYRICS: MvLyricLine[] = toLines(lyricsDoc as LyricsDoc);

/** 마디 번호(0부터, 소수 가능) → 시각 */
export const barTime = (bar: number, c: Cues) => BEAT_PHASE + c.beatOffset + bar * BAR;
/** 시각 → 마디 위치(소수) */
export const barAt = (t: number, c: Cues) => (t - BEAT_PHASE - c.beatOffset) / BAR;

// ── 장면 ──────────────────────────────────────────

/** 표현 기법(PLAN.md 약호) */
export type Tech = '네온' | '픽토' | '타이포' | '미터' | '댄서' | '전광판' | '영상' | '빛' | '실루엣' | '입자' | '분할';

/** 그 장면에 켜지는 빛의 색 — 흰빛에서 시작해 하나씩 늘린다 */
export type Glow = 'white' | 'violet' | 'cyan' | 'yellow' | 'pink' | 'green' | 'gray';

export interface SceneDef {
  id: string;
  /**
   * 시작: [가사 줄 번호(1부터), 덩어리 번호(0부터)] — 그 말이 시작하는 시각(사용자가 맞춘 가사 타이밍),
   * 마디 번호(소수 가능 — 가사가 없는 드롭·간주), 'start'(클립 시작), 효과 시각 이름
   */
  at: [number, number] | number | 'start' | keyof Cues;
  /** 무엇을 보여 주나 */
  what: string;
  /** 구도 */
  shot: string;
  tech: Tech[];
  glow: Glow[];
}

const ALL: Glow[] = ['violet', 'cyan', 'yellow', 'pink'];

/** PLAN.md '구간별 장면' 표와 같은 순서·번호(0부터) */
export const SCENES: SceneDef[] = [
  // 훅 1 — 개연 준비 (흰빛만)
  { id: 'neonTitle', at: 'start', what: '완전한 검정 · 네온 관이 지지직 깜빡이며 「踊」', shot: '정면, 글자 작게', tech: ['네온'], glow: ['white'] },
  { id: 'halfKO', at: [1, 0], what: '위 반쪽만 보이는 「半端」 → 「K.O.」에 글자가 쿵 쓰러짐 · 「ふわふわ」는 뜨다 터짐', shot: '정면, 글자가 화면 가득', tech: ['타이포'], glow: ['white'] },
  { id: 'switches', at: [3, 0], what: '분전반 스위치를 박마다 올림 → 무대 바닥에 스포트라이트 원이 하나씩(한 마디)', shot: '빈 무대 부감(바닥 테이프)', tech: ['빛', '네온'], glow: ['white'] },
  { id: 'faces', at: [4, 0], what: '우는 얼굴·웃는 얼굴 네온 간판이 번갈아 → 「愛してね」에 둘 다', shot: '간판 둘을 비스듬히 올려다봄', tech: ['네온'], glow: ['white'] },
  { id: 'sayNo', at: [5, 0], what: '거대한 「NO」 네온, 아래에서 손 실루엣 몇 개', shot: '로우 앵글, 손 너머 글자', tech: ['네온', '실루엣'], glow: ['white'] },
  { id: 'woofer', at: [6, 0], what: '우퍼 콘이 박마다 튀어나오고 고리 충격파 · 브레이크엔 고리만 어둠 속으로', shot: '스피커 정면 클로즈업', tech: ['미터', '빛'], glow: ['white'] },
  // 절 1 — 혼자 (보라 하나)
  { id: 'emptySeats', at: [7, 0], what: '텅 빈 객석에 픽토그램 한 명, 구석에 비상구 표지', shot: '정면 와이드, 의자 줄 원근', tech: ['픽토'], glow: ['violet', 'green'] },
  { id: 'notebook', at: [9, 0], what: '모눈 노트에 낙서(혼자 도는 화살표, 지워진 줄)', shot: '위에서 수직', tech: ['네온'], glow: ['violet'] },
  { id: 'escape', at: [10, 0], what: '비상구 표지 속 사람이 틀을 뛰쳐나와 달림', shot: '옆에서 따라감', tech: ['픽토'], glow: ['violet', 'green'] },
  { id: 'mud', at: [11, 0], what: '발이 검은 액체에 빠짐 · 「Bad」에 경고 테이프가 X자로', shot: '발밑 로우 앵글 클로즈업', tech: ['픽토', '타이포'], glow: ['violet', 'yellow'] },
  { id: 'sink', at: [13, 0], what: '검은 물속으로 가라앉음, 기포 · 「そろそろいっか」에 바닥을 박참', shot: '수직 하강을 따라 내려감', tech: ['픽토', '입자'], glow: ['violet'] },
  // 프리 — 늘어남 (+시안, +노랑)
  { id: 'eqStairs', at: [15, 0], what: '이퀄라이저 막대를 계단처럼 뛰어오름(막대는 실제 음량)', shot: '옆, 카메라 계속 상승', tech: ['미터', '픽토'], glow: ['violet'] },
  { id: 'plug', at: [16, 1], what: '케이블 잭이 꽂히며 선을 따라 불이 달림', shot: '잭 클로즈업 → 선을 따라', tech: ['네온'], glow: ['violet', 'cyan'] },
  { id: 'multiply', at: [17, 0], what: '화면이 1→2→4→8칸으로 쪼개지고 칸마다 한 명씩', shot: '정면 격자', tech: ['픽토', '분할'], glow: ['violet', 'cyan'] },
  { id: 'wave', at: [20, 0], what: '음성 파형이 큰 파도로 밀려옴 · 「Alright」「Don\'t mind」 스텐실 글자', shot: '옆, 파도가 오른쪽에서', tech: ['미터', '타이포'], glow: ['violet', 'cyan', 'yellow'] },
  { id: 'surf', at: [22, 0], what: '픽토그램 무리가 파형 파도를 타고 미끄러짐', shot: '비스듬히 위, 파도와 같이 이동', tech: ['미터', '픽토'], glow: ['violet', 'cyan', 'yellow'] },
  // 훅 2
  { id: 'ledKO', at: [24, 0], what: '전광판에 글자가 흐르다 「K.O.」에 점이 와르르 쏟아짐', shot: '전광판 비스듬히', tech: ['전광판'], glow: ['yellow'] },
  { id: 'curtain', at: [26, 0], what: '무대 막 뒤, 로프를 당기는 손 · 막 틈새 빛줄기', shot: '막을 옆에서, 세로 틈', tech: ['실루엣', '빛'], glow: ['white', 'violet'] },
  { id: 'mirror', at: [27, 0], what: '분장실 거울 — 전구가 박마다 켜지고 거울 안에 원본 영상', shot: '거울 정면', tech: ['영상'], glow: ['yellow', 'pink'] },
  { id: 'crowdNo', at: [28, 0], what: '관객 불빛이 「NO」 모양으로', shot: '객석 부감(4번과 반대)', tech: ['픽토', '빛'], glow: ['cyan', 'violet'] },
  { id: 'speakerWall', at: [29, 0], what: '벽 전체가 스피커 · 브레이크에 차단기가 내려가 암전', shot: '로우 앵글 올려다봄', tech: ['미터', '빛'], glow: ['white', 'violet'] },
  // 후렴 1 — 암전 파티
  { id: 'blackoutSign', at: 37, what: '어둠 속 「暗転」 네온 간판이 지지직, PARTY 깜빡', shot: '간판 클로즈업에서 뒤로', tech: ['네온'], glow: ['pink', 'violet'] },
  { id: 'strobeDancer', at: [31, 0], what: '「Woah」를 끄는 두 마디는 어둠 속 윤곽만 → 「踊りだせ」에 스트로브, 번쩍일 때마다 포즈가 바뀜', shot: '정면 전신', tech: ['댄서', '빛'], glow: ['white', 'violet'] },
  { id: 'fullHouse', at: [32, 0], what: '살균등 빛이 쓸고 지나가자 사람들이 드러남 · 「満員御礼」 세로 현수막(한 마디)', shot: '옆으로 쓸어 감', tech: ['빛', '타이포'], glow: ['violet', 'yellow'] },
  { id: 'hands', at: [33, 0], what: '「Woah」 동안 반창고 붙은 손들이 사방에서 모여듦 → 「おシェアで」에 맞부딪치고 손끝마다 빛', shot: '위에서 수직', tech: ['네온'], glow: ['cyan', 'pink'] },
  { id: 'letGo', at: [34, 0], what: '역광 속 손 흔드는 관객 뒷모습 · 「Let go」에 불빛을 던짐', shot: '객석 뒤에서 무대를', tech: ['실루엣', '빛'], glow: ['pink', 'violet', 'cyan'] },
  // 드롭 1
  { id: 'eqCity', at: 48, what: '이퀄라이저 막대가 스카이라인처럼 화면 가득', shot: '막대 숲 사이로 전진', tech: ['미터'], glow: ['violet', 'cyan'] },
  { id: 'mosaic', at: 50, what: '원본 영상 12칸 모자이크 — 칸마다 다른 순간이 끊겨 반복', shot: '정면 격자', tech: ['영상', '분할'], glow: ['pink', 'cyan'] },
  { id: 'trio', at: 52, what: '댄서 세 명, 색 다른 그림자가 어긋나 겹침', shot: '옆으로 미끄러지는 카메라', tech: ['댄서'], glow: ['cyan', 'pink', 'yellow'] },
  { id: 'laserTunnel', at: 54, what: '레이저 격자 터널 전진, 마디마다 문을 통과', shot: '정면 원근', tech: ['빛'], glow: ['violet', 'cyan'] },
  // 절 2 — 랩 (글자가 주인공)
  { id: 'crack', at: [35, 0], what: '화면에 금 → 노란 원반·반창고가 몰려와 메움 · 「劣等感」이 덮임', shot: '금을 따라가는 클로즈업', tech: ['타이포', '입자'], glow: ['white', 'yellow'] },
  { id: 'boxPress', at: [36, 0], what: '글자를 상자에 구겨 넣고 손바닥이 뚜껑을 누름, 틈으로 빛', shot: '위에서 누르는 손', tech: ['타이포'], glow: ['white', 'pink'] },
  { id: 'upDown', at: [37, 0], what: '세로 띠마다 글자가 위아래로 엇갈림(▲▼), 박마다 흑백 바뀜', shot: '정면, 세로 띠', tech: ['타이포', '분할'], glow: ['white', 'cyan'] },
  { id: 'burst', at: [39, 0], what: '상자 뚜껑이 터지며 말풍선이 분수처럼', shot: '로우 앵글, 아래에서 위로', tech: ['타이포', '입자'], glow: ['pink', 'yellow', 'cyan'] },
  { id: 'chatGray', at: 64, what: '회색 채팅 말풍선 둘이 타이핑됨 — 완전 무채색', shot: '정면 평면', tech: ['타이포'], glow: ['gray'] },
  { id: 'spikes', at: [42, 0], what: '웅크린 픽토그램 둘레로 날카로운 삼각형이 자라 위로 솟구침', shot: '중앙의 작은 사람, 조여 옴', tech: ['픽토', '네온'], glow: ['gray', 'pink'] },
  { id: 'ring', at: [43, 0], what: '네 칸에 호출 벨이 박마다 하나씩 울림', shot: '4분할', tech: ['네온', '분할'], glow: ['yellow', 'cyan'] },
  { id: 'ringAll', at: [43, 2], what: '4칸 → 16칸, 모든 칸에 불이 켜지고 사람들이 고개를 듦', shot: '16분할, 카메라 뒤로', tech: ['픽토', '분할'], glow: ALL },
  { id: 'parade', at: [44, 2], what: '야행 — 불빛을 든 행렬이 네온 거리를 걸어감', shot: '옆, 행렬과 같이 이동', tech: ['실루엣', '네온'], glow: ['yellow', 'violet', 'pink'] },
  { id: 'scream', at: [45, 0], what: '행렬 맨 앞 아야가 마이크를 듦 · 길게 끄는 「鳴いていこう」 → 고음에 백색 반전', shot: '로우 앵글 정면', tech: ['실루엣', '빛'], glow: ['white', 'pink'] },
  // 드롭 2 — 만원
  { id: 'jumpCrowd', at: 76, what: '흰 바탕에 검은 군중이 박마다 뛰어오름 — 객석이 가득', shot: '객석 뒤에서', tech: ['실루엣', '빛'], glow: ['white'] },
  { id: 'odoCuts', at: 78, what: '(반주 + 애드리브) 「踊」 한 글자가 박마다 다른 서체·자리·색으로 여덟 컷', shot: '매 컷 다른 배치', tech: ['타이포'], glow: ALL },
  { id: 'slitScan', at: 80, what: '원본 영상을 세로 띠로 잘라 띠마다 시간차', shot: '화면 가득', tech: ['영상'], glow: ['pink', 'cyan'] },
  { id: 'canon', at: 82, what: '댄서 군무(한 박씩 늦게 같은 동작), 색종이 · 끝 박에 전원 뚝', shot: '정면 와이드', tech: ['댄서', '입자'], glow: ALL },
  // 암전 — 정점
  { id: 'oneLight', at: 84, what: '완전한 어둠, 객석에서 작은 불빛 하나', shot: '와이드 검정, 점 하나', tech: ['빛'], glow: ['white'] },
  { id: 'starfield', at: 86, what: '불빛이 하나둘 늘어 별밭처럼', shot: '부감, 천천히 돎', tech: ['빛'], glow: ['white', 'violet'] },
  { id: 'beam', at: [46, 0], what: '「半端なら K.O.」 — 「K.O.」에 빛기둥이 떨어져 원 안에 원본 영상, 고음을 끄는 동안 계속 넓어짐', shot: '정면, 세로 빛기둥', tech: ['영상', '타이포', '빛'], glow: ['white'] },
  { id: 'reveal', at: [47, 0], what: '「yeah」 여섯 번 — 한 번에 객석 한 무리씩 색이 켜져 전원이 드러남, 무대 전체', shot: '크레인 백', tech: ['실루엣', '타이포', '빛'], glow: ALL },
  // 마지막 후렴 — 전부 켜짐
  { id: 'everyone', at: [48, 0], what: '「Woah」에 전원이 팔을 들고 → 「踊りだせ」에 다 같이 춤 — 22번과 같은 구도에 사람이 가득', shot: '정면 전신 와이드', tech: ['댄서'], glow: ALL },
  { id: 'ledFull', at: [49, 0], what: '전광판에 「満員御礼」가 흐르고 색종이', shot: '전광판을 올려다봄', tech: ['전광판', '입자'], glow: ['yellow', 'pink'] },
  { id: 'handWave', at: [50, 0], what: '「Woah」 동안 객석 파도타기 — 손이 차례로 올라갔다 내려감', shot: '옆에서 길게', tech: ['실루엣'], glow: ['cyan', 'violet'] },
  { id: 'signBack', at: [51, 0], what: '「暗転」 간판을 뒤에서(뒤집힌 글자), 아래 골목에서 춤추는 사람들', shot: '간판 뒤, 내려다봄', tech: ['네온', '댄서'], glow: ['pink', 'cyan'] },
  { id: 'curtainCall', at: [52, 0], what: '커튼콜 — 「Woah」 동안 한 줄로 서서 손잡고 길게 인사', shot: '정면, 무대 높이', tech: ['실루엣', '빛'], glow: ['white', 'yellow'] },
  { id: 'exitBoard', at: [52, 1], what: '출구 위 전광판 「またのお越しを」, 한 사람이 뒤돌아 손을 흔듦', shot: '출구를 안에서, 뒷모습들', tech: ['전광판', '픽토'], glow: ['green', 'yellow'] },
  { id: 'stamp', at: [53, 0], what: '「Woah」 동안 도장을 들어 올림 → 티켓 반쪽에 「次回」 쾅', shot: '위에서 클로즈업', tech: ['타이포'], glow: ['pink', 'white'] },
  { id: 'lightsOut', at: [54, 0], what: '무대 조명이 한 줄씩 꺼짐 · 손 흔드는 아야 역광 → 마지막 불이 꺼짐', shot: '객석에서 무대를(25번과 같은 자리)', tech: ['실루엣', '빛'], glow: ['violet', 'white'] },
  { id: 'exitSign', at: 'coda', what: '어둠 속 비상구 표지만 남음(6번과 수미상관) · 「終演」 · 엔딩', shot: '6번과 같은 객석 구도', tech: ['네온'], glow: ['green'] },
];

export interface SceneSpan extends MvSection {
  /** SCENES 안 번호 = PLAN.md 장면 번호 */
  index: number;
  def: SceneDef;
}

function sceneStart(def: SceneDef, lines: MvLyricLine[], c: Cues) {
  if (def.at === 'start') return -1;
  if (Array.isArray(def.at)) {
    const line = lines[def.at[0] - 1];
    return line?.ja[Math.min(def.at[1], line.ja.length - 1)]?.t ?? 0;
  }
  return typeof def.at === 'number' ? barTime(def.at, c) : c[def.at];
}

/** 장면 경계 — 가사에 붙은 장면은 가사 타이밍을 고치면 같이 움직이고, 마디에 붙은 장면은 박 보정을 따른다 */
export function scenesOf(lines: MvLyricLine[], c: Cues): SceneSpan[] {
  const starts: number[] = [];
  SCENES.forEach((def, k) => {
    const s = sceneStart(def, lines, c);
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
