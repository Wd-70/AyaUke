// 踊 장면 함수들이 함께 쓰는 타입·색·도구 — 검정 바탕 위의 빛(네온 관·빛 덩이·전광판·스포트라이트).
import type { MvLyricLine } from '../../types';
import { TAU, clamp, hash, setFont } from '../../engine';
import type { beatGrid } from '../../engine';
import { rgba } from '../../paint';
import type { Cues, SceneSpan } from './timeline';

export type Ctx = CanvasRenderingContext2D;

export const W = 1280;
export const H = 720;

/** 빛의 색 — 흰빛에서 시작해 하나씩 늘린다 */
export const NEON = {
  white: '#f6f4ff',
  violet: '#b46bff',
  cyan: '#35e0ff',
  yellow: '#ffe14a',
  pink: '#ff4f9a',
  green: '#3dff8f',
  gray: '#8a8a92',
} as const;
export const PARTY = [NEON.violet, NEON.cyan, NEON.yellow, NEON.pink] as const;
export const BG = '#050408';

/** 장면 안 간판·전광판·글자 연출에 쓰는 글자 전부 — 글꼴을 미리 받아 두려고 index.ts가 읽는다 */
export const SIGN_TEXT =
  '踊暗転満員御礼終演次回半端NOPARTYYEAHK.O.またのお越しをALRIGHTDON\'TMINDBADご法度UPDOWN▲▼既読…！？あのねほんとはだってでもねえずっと本音劣等感非常口EXITADMITONE別に興味ない特に関係ない「」ふわふわどうぞ夜行独言テンションねえ>0123456789·:';

export interface SceneFrame {
  t: number;
  /** 장면 안 진행 0→1 */
  k: number;
  /** 장면 시작 후 초 */
  age: number;
  /** 장면 길이(초) */
  dur: number;
  span: SceneSpan;
  video: HTMLVideoElement | null;
}

export type SceneFn = (c: Ctx, f: SceneFrame) => void;

export interface Kit {
  fonts: { ja: string; display: string; ko: string };
  /** 부른 날짜 (엔딩 타이틀) */
  dateLabel: string | null;
  /** 지금의 가사·효과 시각(편집기에서 실시간 교체되므로 함수로) */
  lines(): MvLyricLine[];
  cues(): Cues;
  beat(): ReturnType<typeof beatGrid>;
  /** 마디 번호 → 시각 */
  bar(n: number): number;
  env(ch: 'onset' | 'rms' | 'low' | 'high', t: number): number;
  /**
   * 원본 방송 화면의 아바타 부분을 (x,y,w,h)에 꽉 채워 그린다. 영상이 없으면 false.
   * 늘 지금 화면 — 지난 화면을 되풀이하는 방식은 끊겨 보여서 쓰지 않는다(2026-11-17 사용자 지적).
   */
  footage(c: Ctx, video: HTMLVideoElement | null, x: number, y: number, w: number, h: number, crop?: FootageCrop): boolean;
}

/** 원본 화면 일부만 크게 — zoom 배율, (cx, cy)는 아바타 부분 안 비율 위치(얼굴은 0.5, 0.47 무렵) */
export interface FootageCrop {
  zoom?: number;
  cx?: number;
  cy?: number;
  mirror?: boolean;
}

/** 줄 번호(1부터)의 n번째 덩어리 시각 */
export function chunkT(lines: MvLyricLine[], line: number, chunk = 0) {
  const l = lines[line - 1];
  return l?.ja[Math.min(chunk, l.ja.length - 1)]?.t ?? 0;
}

/** a~b 사이 진행 0→1 */
export const span01 = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
/** 시각 a 직후 튀었다가 사라지는 값(1→0) */
export const hit = (t: number, a: number, decay = 6) => (t < a ? 0 : Math.exp(-(t - a) * decay));

/** 화면 가운데 기준 확대·이동 후 그리기 */
export function cam(c: Ctx, zoom: number, cx: number, cy: number, draw: () => void, rot = 0) {
  c.save();
  c.translate(W / 2, H / 2);
  if (rot) c.rotate(rot);
  c.scale(zoom, zoom);
  c.translate(-cx, -cy);
  draw();
  c.restore();
}

/** (px,py)를 화면의 같은 자리에 둔 채 확대해 그리기 — zoom ≥ 1이면 가장자리가 비지 않는다 */
export function zoomAt(c: Ctx, zoom: number, px: number, py: number, draw: () => void, rot = 0) {
  c.save();
  c.translate(px, py);
  if (rot) c.rotate(rot);
  c.scale(zoom, zoom);
  c.translate(-px, -py);
  draw();
  c.restore();
}

export function fillBg(c: Ctx, color: string = BG) {
  c.fillStyle = color;
  c.fillRect(-200, -200, W + 400, H + 400);
}

// ── 빛 덩이 ─────────────────────────────────────────

const sprites = new Map<string, HTMLCanvasElement>();
function glowSprite(color: string) {
  let s = sprites.get(color);
  if (!s) {
    s = document.createElement('canvas');
    s.width = s.height = 128;
    const g = s.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    // 끝을 같은 색의 투명으로(검은 투명이면 가장자리에 회색 띠)
    grad.addColorStop(0, rgba(color, 1));
    grad.addColorStop(0.22, rgba(color, 0.62));
    grad.addColorStop(0.55, rgba(color, 0.16));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    sprites.set(color, s);
  }
  return s;
}

/** 부드러운 빛 덩이(더하기 합성). rx/ry를 달리 주면 타원 */
export function glow(c: Ctx, x: number, y: number, r: number, color: string, alpha = 1, ry = r) {
  if (alpha <= 0.003 || r <= 0) return;
  const prev = c.globalCompositeOperation;
  const a = c.globalAlpha;
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = a * Math.min(1, alpha);
  c.drawImage(glowSprite(color), x - r, y - ry, r * 2, ry * 2);
  c.globalAlpha = a;
  c.globalCompositeOperation = prev;
}

// ── 네온 ────────────────────────────────────────────

/** 네온 관: path()가 그리는 선(beginPath 포함)을 빛 번짐과 함께 긋는다. a=밝기(0~1), 꺼진 관은 dead() */
export function neon(c: Ctx, color: string, w: number, path: () => void, a = 1) {
  if (a <= 0.004) return;
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = color;
  const base = c.globalAlpha;
  c.globalAlpha = base * 0.09 * a;
  c.lineWidth = w * 8;
  path();
  c.stroke();
  c.globalAlpha = base * 0.22 * a;
  c.lineWidth = w * 3.2;
  path();
  c.stroke();
  c.globalAlpha = base * a;
  c.lineWidth = w;
  path();
  c.stroke();
  c.strokeStyle = '#ffffff';
  c.globalAlpha = base * 0.7 * a;
  c.lineWidth = w * 0.36;
  path();
  c.stroke();
  c.restore();
}

/** 꺼진 네온 관(어두운 유리관) */
export function dead(c: Ctx, w: number, path: () => void, a = 0.16) {
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = '#8f8aa8';
  c.globalAlpha *= a;
  c.lineWidth = w;
  path();
  c.stroke();
  c.restore();
}

/** 지지직거리는 네온의 밝기 — 대체로 켜져 있다가 가끔 꺼진다 */
export const flicker = (t: number, seed = 0, p = 0.1, rate = 28) => (hash(Math.floor(t * rate) * 31 + seed) < p ? 0.2 : 1);

export interface TextOpts {
  weight?: number;
  align?: CanvasTextAlign;
  /** 0이면 관 모양(윤곽선만), 1이면 속을 채운 글자 */
  fill?: number;
  /** 윤곽선 굵기(글자 크기 대비) */
  tube?: number;
  baseline?: CanvasTextBaseline;
}

/** 빛나는 글자. fill=0이면 네온 관(윤곽선) 글자 */
export function neonText(c: Ctx, text: string, x: number, y: number, size: number, family: string, color: string, a = 1, o: TextOpts = {}) {
  if (a <= 0.004) return;
  c.save();
  setFont(c, size, family, o.weight ?? 400);
  c.textAlign = o.align ?? 'center';
  c.textBaseline = o.baseline ?? 'middle';
  c.lineJoin = 'round';
  c.globalCompositeOperation = 'lighter';
  const base = c.globalAlpha;
  const fill = o.fill ?? 1;
  // 속을 채운 큰 글자는 번짐을 얇게(굵은 번짐은 회색 테두리처럼 보인다)
  const tube = o.tube !== undefined ? size * o.tube : fill >= 1 ? Math.min(size * 0.035, 3 + size * 0.008) : size * 0.035;
  c.strokeStyle = color;
  c.globalAlpha = base * (fill >= 1 ? 0.06 : 0.1) * a;
  c.lineWidth = tube * 7;
  c.strokeText(text, x, y);
  c.globalAlpha = base * (fill >= 1 ? 0.15 : 0.24) * a;
  c.lineWidth = tube * 3;
  c.strokeText(text, x, y);
  if (fill > 0) {
    c.globalAlpha = base * a * fill;
    c.fillStyle = color;
    c.fillText(text, x, y);
    c.globalAlpha = base * a * fill * 0.5;
    c.fillStyle = '#ffffff';
    c.fillText(text, x, y);
  }
  if (fill < 1) {
    c.globalAlpha = base * a;
    c.lineWidth = tube;
    c.strokeText(text, x, y);
    c.strokeStyle = '#ffffff';
    c.globalAlpha = base * a * 0.7;
    c.lineWidth = tube * 0.4;
    c.strokeText(text, x, y);
  }
  c.restore();
}

/** 폭에 맞춘 글자 크기 */
export function fit(c: Ctx, text: string, family: string, size: number, maxW: number, weight = 400) {
  setFont(c, size, family, weight);
  const w = c.measureText(text).width;
  return w > maxW ? size * (maxW / w) : size;
}

// ── 조명 ────────────────────────────────────────────

/** 스포트라이트: (sx,sy)에서 (tx,ty) 바닥의 타원(rx)으로 떨어지는 빛 원뿔 */
export function cone(c: Ctx, sx: number, sy: number, tx: number, ty: number, rx: number, color: string, a = 1, top = 8) {
  if (a <= 0.004) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(sx, sy, tx, ty);
  g.addColorStop(0, rgba(color, 0.55 * a));
  g.addColorStop(1, rgba(color, 0.05 * a));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(sx - top, sy);
  c.lineTo(sx + top, sy);
  c.lineTo(tx + rx, ty);
  c.lineTo(tx - rx, ty);
  c.closePath();
  c.fill();
  c.restore();
  glow(c, tx, ty, rx * 1.25, color, 0.5 * a, rx * 0.34);
}

/** 화면 흔들림(박·충격) */
export function shake(c: Ctx, amp: number, t: number, seed = 0) {
  if (amp <= 0.01) return;
  c.translate((hash(Math.floor(t * 60) + seed) - 0.5) * 2 * amp, (hash(Math.floor(t * 60) + seed + 99) - 0.5) * 2 * amp);
}

/** 색종이 — 시각만으로 위치가 정해진다 */
export function confetti(c: Ctx, t: number, n: number, seed: number, colors: readonly string[], speed = 150, a = 1) {
  c.save();
  for (let i = 0; i < n; i++) {
    const x = hash(seed + i * 7) * (W + 80) - 40 + Math.sin(t * (1 + hash(i)) + i) * 26;
    const y = ((hash(seed + i * 11) * (H + 60) + t * (speed * (0.6 + hash(seed + i * 3) * 0.9))) % (H + 60)) - 30;
    const flip = Math.cos(t * (5 + hash(i * 5) * 6) + i);
    c.fillStyle = colors[i % colors.length];
    c.globalAlpha = a * (0.55 + 0.45 * Math.abs(flip));
    c.save();
    c.translate(x, y);
    c.rotate(t * (1 + hash(i * 13) * 2) + i);
    c.fillRect(-6, -4 * flip, 12, 8 * flip);
    c.restore();
  }
  c.restore();
}

// ── 전광판(점 격자) ─────────────────────────────────

export interface LedMask {
  w: number;
  h: number;
  bits: Uint8Array;
}
const masks = new Map<string, LedMask>();

/** 글자를 rows줄짜리 점 격자로 */
export function ledMask(text: string, family: string, rows = 16, weight = 900): LedMask {
  const key = `${text}|${family}|${rows}|${weight}`;
  let m = masks.get(key);
  if (!m) {
    const cv = document.createElement('canvas');
    const g = cv.getContext('2d', { willReadFrequently: true })!;
    setFont(g, rows * 1.02, family, weight);
    const w = Math.max(1, Math.ceil(g.measureText(text).width) + 2);
    cv.width = w;
    cv.height = rows;
    setFont(g, rows * 1.02, family, weight);
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.fillText(text, 1, rows * 0.54);
    const data = g.getImageData(0, 0, w, rows).data;
    const bits = new Uint8Array(w * rows);
    for (let i = 0; i < bits.length; i++) bits[i] = data[i * 4 + 3] > 150 ? 1 : 0;
    m = { w, h: rows, bits };
    masks.set(key, m);
  }
  return m;
}

export interface LedOpts {
  /** 글자를 왼쪽으로 민 칸 수(소수 가능) */
  scroll?: number;
  /** 보이는 칸 수 */
  cols: number;
  /** 칸마다 세로로 민 칸 수 */
  wave?: (col: number) => number;
  a?: number;
  /** 꺼진 점도 희미하게 */
  off?: number;
  dot?: number;
}

/** 전광판: (x,y)가 왼쪽 위, pitch 간격의 점 */
export function led(c: Ctx, m: LedMask, x: number, y: number, pitch: number, color: string, o: LedOpts) {
  const a = o.a ?? 1;
  const d = pitch * (o.dot ?? 0.62);
  const scroll = Math.floor(o.scroll ?? 0);
  c.save();
  if (o.off) {
    c.fillStyle = rgba(color, o.off);
    c.beginPath();
    for (let cx = 0; cx < o.cols; cx++) for (let r = 0; r < m.h; r++) c.rect(x + cx * pitch, y + r * pitch, d, d);
    c.fill();
  }
  c.globalCompositeOperation = 'lighter';
  const on = new Path2D();
  const halo = new Path2D();
  for (let cx = 0; cx < o.cols; cx++) {
    const src = cx + scroll;
    if (src < 0 || src >= m.w) continue;
    const dy = o.wave ? Math.round(o.wave(cx)) : 0;
    for (let r = 0; r < m.h; r++) {
      const sr = r - dy;
      if (sr < 0 || sr >= m.h || !m.bits[sr * m.w + src]) continue;
      on.rect(x + cx * pitch, y + r * pitch, d, d);
      halo.rect(x + cx * pitch - d * 0.7, y + r * pitch - d * 0.7, d * 2.4, d * 2.4);
    }
  }
  c.fillStyle = rgba(color, 0.13 * a);
  c.fill(halo);
  c.fillStyle = rgba(color, a);
  c.fill(on);
  c.restore();
}

// ── 그 밖 ───────────────────────────────────────────

/** 둥근 사각형 경로 */
export function rr(c: Ctx | Path2D, x: number, y: number, w: number, h: number, r: number) {
  const q = Math.min(r, w / 2, h / 2);
  c.moveTo(x + q, y);
  c.lineTo(x + w - q, y);
  c.quadraticCurveTo(x + w, y, x + w, y + q);
  c.lineTo(x + w, y + h - q);
  c.quadraticCurveTo(x + w, y + h, x + w - q, y + h);
  c.lineTo(x + q, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - q);
  c.lineTo(x, y + q);
  c.quadraticCurveTo(x, y, x + q, y);
  c.closePath();
}

/** 원 경로 한 줄(neon의 path로 쓰기 좋게) */
export const ring = (c: Ctx, x: number, y: number, r: number, ry = r) => {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.1, r), Math.max(0.1, ry), 0, 0, TAU);
};

/** 원본 영상이 없을 때(정지 화면 검수 등) 대신 채우는 화면 — 보라 번짐 */
export function noFootage(c: Ctx, x: number, y: number, w: number, h: number, t: number) {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.fillStyle = '#1a1230';
  c.fillRect(x, y, w, h);
  glow(c, x + w * (0.5 + 0.2 * Math.sin(t * 0.7)), y + h * 0.42, Math.max(w, h) * 0.6, NEON.violet, 0.5);
  glow(c, x + w * 0.5, y + h * 0.95, Math.max(w, h) * 0.5, NEON.pink, 0.35);
  c.restore();
}
