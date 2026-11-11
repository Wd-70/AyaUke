/**
 * 클립 MV(코드로 그리는 뮤직비디오) 공용 타입.
 *
 * MV는 "시간 t(클립 시작 기준 초)를 넣으면 화면이 결정되는" 결정적 렌더러다.
 * 오디오는 원본 플레이어(ClipPlayer)가 재생하고, MV는 그 재생 시각만 읽어 그린다.
 * 그래서 음원을 재배포하지 않고, 같은 코드를 프레임 캡처해 영상 파일로 뽑을 수도 있다.
 */

/** 가사 한 덩어리 — 화면에 한 번에 등장하는 단위(단어/구) */
export interface MvLyricChunk {
  t: number;
  text: string;
  /** 연출용 배치 힌트(글자 중심 좌표) — 단어를 화면에 흩뿌리는 구간에서만 쓴다 */
  x?: number;
  y?: number;
  /** 가운데 크게 찍히는 강조 단어 */
  punch?: boolean;
}

export interface MvLyricLine {
  t: number;
  end: number;
  ja: MvLyricChunk[];
  ko?: string;
}

export interface MvSection {
  id: string;
  start: number;
  end: number;
}

/** 사전 분석한 오디오 엔벨로프 — 실시간 오디오 접근 없이 "오디오 반응형" 연출을 하기 위함 */
export interface MvEnvelope {
  fps: number;
  onset: string;
  rms: string;
  low: string;
  high: string;
}

export interface MvFrame {
  /** 클립 시작 기준 초. 재생 전이면 null(포스터 상태) */
  t: number | null;
  /** 원본 영상 프레임(치지직 <video>). 없거나 그릴 수 없으면 null */
  footage: HTMLVideoElement | null;
}

/** 재생 중인 클립 정보 — 같은 작품이 여러 클립에 쓰이므로 클립마다 다른 내용(날짜 등)은 여기로 받는다 */
export interface MvClipContext {
  /** 부른 날짜 (KST, YYYY.MM.DD) */
  sungDateLabel: string | null;
}

export interface MvRenderer {
  render(ctx: CanvasRenderingContext2D, frame: MvFrame): void;
  /** 가사 타이밍 교체 — 로컬 타이밍 편집기의 실시간 미리보기용 */
  setLyrics?(lines: MvLyricLine[]): void;
  /** 효과 타이밍 교체 — 같은 용도 */
  setCues?(cues: Record<string, number>): void;
}

/** 편집기에서 조정할 수 있는 효과 시각(장면 전환, 칼베기, 섬광 등) */
export interface MvCue {
  id: string;
  /** 편집기에 보이는 이름 */
  label: string;
  t: number;
  /** 장면 경계 — 경계끼리는 순서가 뒤집히면 안 된다 */
  section?: boolean;
  /** 시각이 아니라 보정값(초, 음수 가능) — 예: 비트 연출 보정 */
  offset?: boolean;
}

/**
 * 곡 단위 작품. 클립 범위가 곡 시작~끝에 정확히 맞춰져 있다는 전제로
 * 클립 시작 시각을 t=0으로 쓴다(그래서 길이가 비슷한 클립에만 적용).
 */
export interface MvWork {
  /** 기준 클립 길이(초) */
  duration: number;
  /** 가사 타이밍 (편집기 초기값) */
  lyrics: MvLyricLine[];
  title: string;
  subtitle?: string;
  /** 효과 타이밍 (편집기 초기값) */
  cues?: MvCue[];
  /** 비트 그리드(보정 전) — 편집기에서 박자 탭으로 보정값을 잴 때 쓴다 */
  beat?: { period: number; phase: number };
  /** 렌더 전에 로드해 둘 폰트 — family(CSS)와 그 폰트로 그릴 글자 전체 */
  fonts: { family: string; text: string }[];
  createRenderer(clip: MvClipContext): MvRenderer;
}
