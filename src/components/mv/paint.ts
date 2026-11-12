// 손그림 질감 도구 — 수채 번짐, 연필 선, 종이결. 여러 MV 작품이 같이 쓴다.
//
// 수채 번짐은 행글라이터 「클로드 코드 뮤비 만들기」 키트(https://www.youtube.com/@hangglwriter)의 붓을 옮겼다
// (Tyler Hobbs식: 다각형 변이 중점을 가우스 잡음으로 밀어내며 여러 번 나누고, 그런 변형 층을 아주 옅게 수십 번 겹친다).
// 실시간 60fps라 키트처럼 매 프레임 겹치지 않고, 한 번 그린 번짐을 오프스크린 캔버스(스프라이트)로 두고 찍는다.
import { TAU, clamp, noise1, rng } from './engine';

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

function gauss(r: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v) * 0.5;
}

/** 다각형 변형 — 변마다 중점을 바깥/안쪽으로 밀어 넣는 것을 depth번 */
export function deform(pts: Pt[], depth: number, variance: number, r: () => number): Pt[] {
  let cur = pts;
  for (let d = 0; d < depth; d++) {
    const next: Pt[] = [];
    for (let i = 0; i < cur.length; i++) {
      const a = cur[i];
      const b = cur[(i + 1) % cur.length];
      next.push(a);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const g = gauss(r) * len * variance;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2 + gauss(r) * 0.4;
      next.push([(a[0] + b[0]) / 2 + Math.cos(ang) * g, (a[1] + b[1]) / 2 + Math.sin(ang) * g]);
    }
    cur = next;
  }
  return cur;
}

export function regularPoly(n: number, rx: number, ry = rx): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    return [Math.cos(a) * rx, Math.sin(a) * ry] as Pt;
  });
}

function fillPts(c: Ctx, pts: Pt[]) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
}

const isClient = typeof document !== 'undefined';
const sprites = new Map<string, HTMLCanvasElement>();

function canvas(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w));
  cv.height = Math.max(1, Math.round(h));
  return cv;
}

export interface WashOpts {
  color: string;
  /** 스프라이트 한 변(px) — 번짐은 가운데 지름 약 60%를 차지한다 */
  size?: number;
  /** 가로/세로 비율 (1 = 둥근 번짐) */
  aspect?: number;
  layers?: number;
  variance?: number;
  /** 층 하나의 불투명도 */
  alpha?: number;
  /** 바탕 다각형 모양을 직접 줄 때(정규화 좌표, 반지름 약 1) */
  shape?: Pt[];
}

/**
 * 수채 번짐 스프라이트(가운데 기준). 같은 key면 같은 모양을 재사용한다.
 * 찍을 때 drawImage(sprite, x - w/2, y - h/2, w, h).
 */
export function washSprite(key: string, o: WashOpts): HTMLCanvasElement {
  const ck = `${key}|${o.color}|${o.size ?? 256}|${o.aspect ?? 1}`;
  const hit = sprites.get(ck);
  if (hit) return hit;
  const size = o.size ?? 256;
  const aspect = o.aspect ?? 1;
  const w = size * Math.max(1, aspect);
  const h = size / Math.min(1, aspect);
  const cv = canvas(w, h);
  if (!isClient) return cv;
  const c = cv.getContext('2d')!;
  const r = rng(hashKey(key));
  const rad = size * 0.3;
  const base0 = (o.shape ?? regularPoly(10, 1)).map(([x, y]) => [x * rad * Math.max(1, aspect), y * rad / Math.min(1, aspect)] as Pt);
  const variance = o.variance ?? 0.45;
  const base = deform(base0, 2, variance, r);
  c.translate(w / 2, h / 2);
  c.fillStyle = o.color;
  const layers = o.layers ?? 26;
  c.globalAlpha = o.alpha ?? 0.05;
  for (let i = 0; i < layers; i++) fillPts(c, deform(base, 3, variance * 0.9, r));
  // 가장자리에 물감이 고이는 띠(수채 특유의 진한 테두리) — 살짝 줄인 층을 몇 번 더
  c.globalAlpha = (o.alpha ?? 0.05) * 0.6;
  for (let i = 0; i < 4; i++) {
    const ring = deform(base, 3, variance * 0.5, r);
    c.save();
    c.lineWidth = 2.5;
    c.strokeStyle = o.color;
    c.beginPath();
    ring.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.stroke();
    c.restore();
  }
  sprites.set(ck, cv);
  return cv;
}

/** 번짐 하나를 (x,y)에 지름 d로 찍는다 — grow(0~1)로 번져 나가는 모습 */
export function wash(c: Ctx, key: string, o: WashOpts, x: number, y: number, d: number, grow = 1, alpha = 1, rot = 0) {
  if (grow <= 0 || alpha <= 0) return;
  const sp = washSprite(key, o);
  // 스프라이트 짧은 변의 60%가 번짐 지름 d가 되도록
  const scale = (d / (Math.min(sp.width, sp.height) * 0.6)) * (0.35 + 0.65 * grow);
  const w = sp.width * scale;
  const h = sp.height * scale;
  c.save();
  c.globalAlpha *= alpha * clamp(grow * 1.6);
  c.translate(x, y);
  if (rot) c.rotate(rot);
  c.drawImage(sp, -w / 2, -h / 2, w, h);
  c.restore();
}

/** 전체 화면 수채 바탕(종이 + 큰 번짐 여러 개) — 장면 배경. 한 번 그려 캐시 */
export function washBackdrop(
  key: string,
  w: number,
  h: number,
  paperColor: string,
  blots: { color: string; x: number; y: number; d: number; aspect?: number }[],
): HTMLCanvasElement {
  const ck = `bg|${key}|${w}x${h}`;
  const hit = sprites.get(ck);
  if (hit) return hit;
  const cv = canvas(w, h);
  if (!isClient) return cv;
  const c = cv.getContext('2d')!;
  c.fillStyle = paperColor;
  c.fillRect(0, 0, w, h);
  blots.forEach((b, i) => {
    const sp = washSprite(`${key}:${i}`, { color: b.color, size: 320, aspect: b.aspect ?? 1, layers: 30, alpha: 0.055 });
    const sw = (b.d / 0.6) * Math.max(1, b.aspect ?? 1);
    const sh = (b.d / 0.6) / Math.min(1, b.aspect ?? 1);
    c.drawImage(sp, b.x - sw / 2, b.y - sh / 2, sw, sh);
  });
  sprites.set(ck, cv);
  return cv;
}

function hashKey(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 종이결 텍스처(밝기 잡음 + 섬유) — 화면 전체에 multiply로 얹는다 */
export function paperGrain(w = 640, h = 360): HTMLCanvasElement {
  const ck = `paper|${w}x${h}`;
  const hit = sprites.get(ck);
  if (hit) return hit;
  const cv = canvas(w, h);
  if (!isClient) return cv;
  const c = cv.getContext('2d')!;
  const img = c.createImageData(w, h);
  const r = rng(77);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 236 + (r() - 0.5) * 34;
    img.data[i] = v;
    img.data[i + 1] = v - 2;
    img.data[i + 2] = v - 8;
    img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  for (let i = 0; i < 900; i++) {
    c.strokeStyle = `rgba(110,95,80,${0.03 + r() * 0.05})`;
    c.lineWidth = 0.6;
    const x = r() * w;
    const y = r() * h;
    const a = r() * Math.PI;
    const l = 3 + r() * 16;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }
  sprites.set(ck, cv);
  return cv;
}

/**
 * 연필 선 — 점 목록을 따라 progress(0~1)만큼 그린다. 두세 번 살짝 어긋나게 겹쳐 손맛을 낸다.
 * 굵기는 끝으로 갈수록 약간 가늘어지고, 그리는 중이면 끝(연필 촉) 위치를 돌려준다.
 */
export function pencil(
  c: Ctx,
  pts: Pt[],
  progress: number,
  o: { width?: number; color?: string; seed?: number; passes?: number; jitter?: number; alpha?: number } = {},
): Pt | null {
  if (progress <= 0 || pts.length < 2) return null;
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = lens[lens.length - 1];
  const stop = total * clamp(progress);
  const seed = o.seed ?? 1;
  const passes = o.passes ?? 2;
  const jit = o.jitter ?? 1.1;
  let tip: Pt | null = null;
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = o.color ?? '#3b3a44';
  for (let p = 0; p < passes; p++) {
    c.globalAlpha = (o.alpha ?? 1) * (p ? 0.45 : 0.85);
    c.lineWidth = (o.width ?? 2) * (p ? 0.7 : 1);
    c.beginPath();
    for (let i = 0; i < pts.length; i++) {
      let [x, y] = pts[i];
      if (lens[i] > stop) {
        const k = (stop - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
        x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k;
        y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k;
      }
      const ox = noise1(i * 0.7 + p * 31, seed) * jit;
      const oy = noise1(i * 0.7 + p * 31 + 50, seed) * jit;
      if (i === 0) c.moveTo(x + ox, y + oy);
      else c.lineTo(x + ox, y + oy);
      if (lens[i] > stop) {
        tip = [x, y];
        break;
      }
    }
    c.stroke();
  }
  c.restore();
  return progress < 1 ? (tip ?? pts[pts.length - 1]) : null;
}

/** 곡선 함수를 점 목록으로 */
export function sample(f: (u: number) => Pt, n = 40): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => f(i / n));
}

/** 색 섞기 — '#rrggbb' 두 개, k=0이면 a */
export function mixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * clamp(k));
  return `#${((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1)}`;
}

/** 채도 줄이기 — k=1이면 그대로, 0이면 회색 */
export function desat(hex: string, k: number): string {
  const p = parseInt(hex.slice(1), 16);
  const r = (p >> 16) & 255;
  const g = (p >> 8) & 255;
  const b = p & 255;
  const l = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
  const gray = `#${((1 << 24) | (l << 16) | (l << 8) | l).toString(16).slice(1)}`;
  return mixHex(gray, hex, k);
}

/** rgba 문자열 */
export function rgba(hex: string, a: number): string {
  const p = parseInt(hex.slice(1), 16);
  return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${a})`;
}
