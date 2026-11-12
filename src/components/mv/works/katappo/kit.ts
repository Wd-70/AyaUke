// 片っぽ 장면 함수들이 함께 쓰는 타입·색·도구.
import type { MvLyricLine } from '../../types';
import { clamp } from '../../engine';
import type { beatGrid } from '../../engine';
import type { Cues, SceneSpan } from './timeline';

export type Ctx = CanvasRenderingContext2D;

export const W = 1280;
export const H = 720;

/** 색 — 겨울(나)은 청백·회청, 너(해바라기)는 금색. 금색은 마지막 후렴까지 아낀다 */
export const COL = {
  snow: '#f5f8fb',
  ice: '#d6e0ea',
  frostBg: '#dfe7ef',
  blue: '#8aa0ba',
  blueDeep: '#46597a',
  night: '#161b28',
  ink: '#34323c',
  paper: '#f4efe4',
  desk: '#3a2e29',
  room: '#2a2430',
  roomLight: '#4a4052',
  shadow: '#252131',
  lav: '#c4b0e6',
  lavDeep: '#7c64a8',
  cream: '#fbf1d8',
  warm: '#ffd98a',
  gold: '#f2b632',
  goldDeep: '#d9821e',
  ochre: '#e3c98f',
} as const;

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
  fonts: { ja: string; ko: string };
  /** 부른 날짜 (엔딩 타이틀) */
  dateLabel: string | null;
  /** 지금의 가사·효과 시각(편집기에서 실시간 교체되므로 함수로) */
  lines(): MvLyricLine[];
  cues(): Cues;
  beat(): ReturnType<typeof beatGrid>;
  env(ch: 'onset' | 'rms' | 'low' | 'high', t: number): number;
  /** 원본 방송 화면의 아바타 부분을 (x,y,w,h)에 꽉 채워 그린다. 영상이 없으면 false */
  footage(c: Ctx, video: HTMLVideoElement | null, x: number, y: number, w: number, h: number): boolean;
}

/** 줄 번호(1부터)의 n번째 덩어리 시각 */
export function chunkT(lines: MvLyricLine[], line: number, chunk = 0) {
  const l = lines[line - 1];
  return l?.ja[Math.min(chunk, l.ja.length - 1)]?.t ?? 0;
}

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

/** a~b 사이 진행 0→1 */
export const span01 = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

/** 세로 그라데이션 채우기 */
export function vgrad(c: Ctx, stops: [number, string][], x = 0, y = 0, w = W, h = H) {
  const g = c.createLinearGradient(0, y, 0, y + h);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
}

/**
 * 부드러운 빛 덩어리 — color는 'rgba(r,g,b,a)'.
 * 끝을 같은 색의 투명으로 맞춰야 가장자리에 회색 띠가 안 생긴다(검은 투명으로 보간하면 탁해짐).
 */
export function glow(c: Ctx, x: number, y: number, r: number, color: string, alpha: number) {
  if (alpha <= 0 || r <= 0) return;
  const m = color.match(/rgba?\(([^,]+),([^,]+),([^,)]+)(?:,([^)]+))?\)/);
  const [cr, cg, cb, ca] = m ? [m[1], m[2], m[3], Number(m[4] ?? 1)] : ['255', '255', '255', 1];
  const at = (a: number) => `rgba(${cr},${cg},${cb},${a})`;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, at(ca));
  g.addColorStop(0.35, at(ca * 0.55));
  g.addColorStop(0.7, at(ca * 0.15));
  g.addColorStop(1, at(0));
  c.save();
  c.globalAlpha *= alpha;
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}
