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

export interface MvRenderer {
  render(ctx: CanvasRenderingContext2D, frame: MvFrame): void;
}

export interface MvWork {
  /** 원본 다시보기 기준, MV t=0에 해당하는 절대 초 */
  sourceStart: number;
  duration: number;
  title: string;
  subtitle?: string;
  sections: MvSection[];
  /** 렌더 전에 로드해 둘 폰트 — family(CSS)와 그 폰트로 그릴 글자 전체 */
  fonts: { family: string; text: string }[];
  createRenderer(): MvRenderer;
}
