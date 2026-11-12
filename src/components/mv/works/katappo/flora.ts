// 片っぽ 소품 — 해바라기, 꽃잎, 잎, 서리 결정, 물방울.
import { TAU, clamp, hash, noise1, rng } from '../../engine';
import { desat, mixHex } from '../../paint';

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

export const PETAL = '#f6b81f';
export const PETAL_DEEP = '#e08a12';
export const SEED = '#4a2f17';
export const SEED_RIM = '#7a4a1c';
export const LEAF = '#6d8c45';
export const LEAF_DEEP = '#45602c';

/** 꽃잎 하나 — 밑동(0,0)에서 위(-len)로 뻗는 끝이 뾰족한 잎 모양 */
export function petalPath(c: Ctx, len: number, wid: number, curl = 0) {
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(wid * 0.9, -len * 0.25, wid * 0.7 + curl, -len * 0.8, curl * 1.4, -len);
  c.bezierCurveTo(-wid * 0.7 + curl, -len * 0.8, -wid * 0.9, -len * 0.25, 0, 0);
  c.closePath();
}

export interface SunflowerOpts {
  /** 피어남 0(봉오리)~1(활짝) */
  bloom?: number;
  /** 남은 꽃잎 비율 1~0 — 떨어진 꽃잎은 빈자리로 */
  petals?: number;
  /** 채도 0~1 */
  sat?: number;
  /** 시각(초) — 꽃잎 흔들림 */
  t?: number;
  /** 세로 눌림(고개 숙임/옆에서 본 각도) 1=정면 */
  squash?: number;
  rot?: number;
  seed?: number;
  /** 씨앗 판 대신 그릴 것(원본 영상 등) — 반지름을 받아 (0,0) 중심으로 그린다 */
  disk?: (c: Ctx, r: number) => void;
  alpha?: number;
}

/** 해바라기 꽃송이(정면) — 반지름 r은 꽃잎 끝까지 */
export function sunflower(c: Ctx, x: number, y: number, r: number, o: SunflowerOpts = {}) {
  const bloom = clamp(o.bloom ?? 1);
  const sat = o.sat ?? 1;
  const seed = o.seed ?? 1;
  const t = o.t ?? 0;
  const keep = o.petals ?? 1;
  const diskR = r * 0.36;
  const n = 21;
  c.save();
  c.translate(x, y);
  if (o.rot) c.rotate(o.rot);
  c.scale(1, o.squash ?? 1);
  c.globalAlpha *= o.alpha ?? 1;
  const ring = (layer: number) => {
    const col = desat(layer ? PETAL : PETAL_DEEP, sat);
    const edge = desat(layer ? mixHex(PETAL, '#fff4c2', 0.4) : PETAL_DEEP, sat);
    for (let i = 0; i < n; i++) {
      const id = layer * n + i;
      if (hash(id * 3 + seed) > keep) continue;
      const a = ((i + layer * 0.5) / n) * TAU + noise1(id * 0.7, seed) * 0.08;
      const len = r * (0.58 + hash(id + seed * 7) * 0.12) * (0.25 + 0.75 * bloom);
      const wid = r * 0.12 * (0.6 + 0.4 * bloom);
      const sway = Math.sin(t * 1.3 + id) * 0.04;
      c.save();
      c.rotate(a + sway);
      c.translate(0, -diskR * 0.85);
      // 덜 핀 꽃잎은 가운데로 오므라든다
      c.scale(1, 0.4 + 0.6 * bloom);
      const g = c.createLinearGradient(0, 0, 0, -len);
      g.addColorStop(0, col);
      g.addColorStop(1, edge);
      c.fillStyle = g;
      petalPath(c, len, wid, noise1(id, seed + 3) * wid * 0.4);
      c.fill();
      c.strokeStyle = desat(PETAL_DEEP, sat * 0.8);
      c.globalAlpha *= 0.35;
      c.lineWidth = 0.8;
      c.stroke();
      c.restore();
    }
  };
  ring(0);
  ring(1);
  if (o.disk) {
    c.save();
    c.beginPath();
    c.arc(0, 0, diskR, 0, TAU);
    c.clip();
    o.disk(c, diskR);
    c.restore();
    c.strokeStyle = desat(SEED_RIM, sat);
    c.lineWidth = r * 0.03;
    c.beginPath();
    c.arc(0, 0, diskR, 0, TAU);
    c.stroke();
  } else seedDisk(c, diskR, sat, seed);
  c.restore();
}

/** 씨앗 판 — 해바라기 나선(황금각) 점들 */
function seedDisk(c: Ctx, R: number, sat: number, seed: number) {
  const g = c.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
  g.addColorStop(0, desat('#5c3b1c', sat));
  g.addColorStop(0.75, desat(SEED, sat));
  g.addColorStop(1, desat(SEED_RIM, sat));
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, R, 0, TAU);
  c.fill();
  const count = Math.min(260, Math.floor(R * 2.2));
  const golden = Math.PI * (3 - Math.sqrt(5));
  c.fillStyle = desat('#2a1a0c', sat);
  for (let i = 1; i < count; i++) {
    const d = R * 0.92 * Math.sqrt(i / count);
    const a = i * golden + seed;
    const s = 0.6 + (R / 60) * (0.4 + 0.6 * (i / count));
    c.globalAlpha = 0.55;
    c.beginPath();
    c.arc(Math.cos(a) * d, Math.sin(a) * d, s, 0, TAU);
    c.fill();
  }
  c.globalAlpha = 1;
}

/** 줄기 + 잎 두 장 — (x,y) 꽃 밑에서 아래(ground)까지 */
export function stem(c: Ctx, x: number, y: number, ground: number, w: number, o: { sat?: number; lean?: number; seed?: number; leaves?: number } = {}) {
  const sat = o.sat ?? 1;
  const lean = o.lean ?? 0;
  c.save();
  c.strokeStyle = desat(LEAF_DEEP, sat);
  c.lineWidth = w;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + lean, (y + ground) / 2, x + lean * 0.4, ground);
  c.stroke();
  const leaves = o.leaves ?? 2;
  for (let i = 0; i < leaves; i++) {
    const u = 0.35 + i * 0.25;
    const ly = y + (ground - y) * u;
    const lx = x + lean * (1 - (1 - u) * (1 - u)) * 0.8;
    const side = i % 2 ? 1 : -1;
    c.save();
    c.translate(lx, ly);
    c.rotate(side * (1.1 + hash(i + (o.seed ?? 0)) * 0.3));
    c.fillStyle = desat(i % 2 ? LEAF : mixHex(LEAF, LEAF_DEEP, 0.3), sat);
    leafPath(c, w * 9, w * 3.4);
    c.fill();
    c.restore();
  }
  c.restore();
}

export function leafPath(c: Ctx, len: number, wid: number) {
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(wid, -len * 0.2, wid * 0.9, -len * 0.75, 0, -len);
  c.bezierCurveTo(-wid * 0.9, -len * 0.75, -wid, -len * 0.2, 0, 0);
  c.closePath();
}

/** 떨어지는 꽃잎 한 장 — 회전하며 펄럭이는 모습(가로 눌림으로 뒤집힘 표현) */
const petalSprites = new Map<number, HTMLCanvasElement>();

/**
 * 꽃잎 한 장 이미지(길이 100px, 가운데 기준) — 꽃잎 비는 수백 장이라 매번 그라데이션을 만들지 않고 찍는다.
 * 화면을 덮는 큰 꽃잎(길이 200px 넘게)도 흐려지지 않게 두 배 크기로 그려 둔다
 */
function petalSprite(sat: number) {
  const key = Math.round(sat * 10);
  let cv = petalSprites.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = 112;
    cv.height = 216;
    const c = cv.getContext('2d')!;
    c.scale(2, 2);
    c.translate(28, 104);
    const g = c.createLinearGradient(0, 0, 0, -100);
    g.addColorStop(0, desat(PETAL_DEEP, key / 10));
    g.addColorStop(1, desat(PETAL, key / 10));
    c.fillStyle = g;
    petalPath(c, 100, 22);
    c.fill();
    petalSprites.set(key, cv);
  }
  return cv;
}

export function fallingPetal(c: Ctx, x: number, y: number, len: number, spin: number, flutter: number, sat = 1, alpha = 1) {
  if (alpha <= 0) return;
  c.save();
  c.translate(x, y);
  c.rotate(spin);
  c.scale(0.35 + 0.65 * Math.abs(Math.cos(flutter)), 1);
  c.globalAlpha *= alpha;
  if (typeof document !== 'undefined') {
    const k = len / 100;
    c.drawImage(petalSprite(sat), -28 * k, -54 * k, 56 * k, 108 * k);
  }
  c.restore();
}

/** 물방울(눈물) — 아래가 둥근 방울, 위가 뾰족 */
export function dropPath(c: Ctx, x: number, y: number, r: number, stretch = 1) {
  c.beginPath();
  c.moveTo(x, y - r * 2.2 * stretch);
  c.bezierCurveTo(x + r * 0.35, y - r * 1.2 * stretch, x + r, y - r * 0.4, x + r, y);
  c.arc(x, y, r, 0, Math.PI);
  c.bezierCurveTo(x - r, y - r * 0.4, x - r * 0.35, y - r * 1.2 * stretch, x, y - r * 2.2 * stretch);
  c.closePath();
}

// ── 서리 결정 ─────────────────────────────────────────

export interface FrostSeg {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 자라기 시작하는 진행도(0~1)와 다 자라는 진행도 */
  b0: number;
  b1: number;
  w: number;
}

/**
 * 유리창 가장자리에서 안쪽으로 자라는 수지상 결정(가지에서 60°로 곁가지).
 * 진행도 p에서 b0~b1 사이인 선분은 그만큼 자라 있다.
 */
export function frostSegments(w: number, h: number, seed: number, roots = 14): FrostSeg[] {
  const r = rng(seed);
  const out: FrostSeg[] = [];
  const grow = (x: number, y: number, a: number, len: number, b: number, depth: number, width: number) => {
    const steps = 6;
    let px = x;
    let py = y;
    let ang = a;
    const span = 0.55 / (depth + 1.2);
    for (let i = 0; i < steps; i++) {
      const l = len / steps;
      ang += (r() - 0.5) * 0.18;
      const nx = px + Math.cos(ang) * l;
      const ny = py + Math.sin(ang) * l;
      const b0 = b + (span * i) / steps;
      out.push({ x0: px, y0: py, x1: nx, y1: ny, b0, b1: b0 + span / steps, w: width * (1 - i / (steps * 1.4)) });
      if (depth < 2 && i > 0 && r() < 0.75) {
        for (const side of [-1, 1]) {
          if (r() < 0.8) grow(nx, ny, ang + side * (Math.PI / 3), len * (0.42 - depth * 0.08) * (1 - i / steps) * 1.4, b0 + 0.02, depth + 1, width * 0.6);
        }
      }
      px = nx;
      py = ny;
    }
  };
  for (let i = 0; i < roots; i++) {
    // 네 변 중 하나에서 안쪽으로 — 모서리 쪽에 몰리게
    const edge = Math.floor(r() * 4);
    const u = Math.pow(r(), 1.6) * (r() < 0.5 ? 1 : -1) * 0.5 + 0.5;
    const pts: Record<number, Pt> = { 0: [u * w, 0], 1: [w, u * h], 2: [u * w, h], 3: [0, u * h] };
    const [x, y] = pts[edge];
    const inward = [Math.PI / 2, Math.PI, -Math.PI / 2, 0][edge] + (r() - 0.5) * 0.9;
    grow(x, y, inward, (0.22 + r() * 0.2) * Math.min(w, h), r() * 0.25, 0, 2.4);
  }
  return out;
}

const frostDone = new WeakMap<FrostSeg[], HTMLCanvasElement>();

/** 다 자란 서리 — 선분이 수천 개라 한 번 그려 두고 찍는다 */
function frostSprite(segs: FrostSeg[], color: string) {
  let cv = frostDone.get(segs);
  if (!cv) {
    let w = 0;
    let h = 0;
    for (const s of segs) {
      w = Math.max(w, s.x0, s.x1);
      h = Math.max(h, s.y0, s.y1);
    }
    cv = document.createElement('canvas');
    cv.width = Math.ceil(w) + 4;
    cv.height = Math.ceil(h) + 4;
    drawFrost(cv.getContext('2d')!, segs, 0.999, color);
    frostDone.set(segs, cv);
  }
  return cv;
}

export function drawFrost(c: Ctx, segs: FrostSeg[], p: number, color: string, alpha = 1) {
  if (p >= 1 && typeof document !== 'undefined') {
    c.save();
    c.globalAlpha *= alpha;
    c.drawImage(frostSprite(segs, color), 0, 0);
    c.restore();
    return;
  }
  // 굵기를 0.5px 단위로 묶어 한 번에 긋는다(선분마다 stroke하면 수천 번)
  const paths = new Map<number, Path2D>();
  for (const s of segs) {
    if (p <= s.b0) continue;
    const k = clamp((p - s.b0) / (s.b1 - s.b0));
    const w = Math.max(0.5, Math.round(s.w * 2) / 2);
    let path = paths.get(w);
    if (!path) paths.set(w, (path = new Path2D()));
    path.moveTo(s.x0, s.y0);
    path.lineTo(s.x0 + (s.x1 - s.x0) * k, s.y0 + (s.y1 - s.y0) * k);
  }
  c.save();
  c.strokeStyle = color;
  c.lineCap = 'round';
  c.globalAlpha *= alpha;
  for (const [w, path] of paths) {
    c.lineWidth = w;
    c.stroke(path);
  }
  c.restore();
}

/** 눈 결정(작은 육각 별) */
export function snowflake(c: Ctx, x: number, y: number, r: number, rot: number) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    c.moveTo(0, 0);
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    const bx = Math.cos(a) * r * 0.55;
    const by = Math.sin(a) * r * 0.55;
    c.moveTo(bx, by);
    c.lineTo(bx + Math.cos(a + 0.8) * r * 0.3, by + Math.sin(a + 0.8) * r * 0.3);
    c.moveTo(bx, by);
    c.lineTo(bx + Math.cos(a - 0.8) * r * 0.3, by + Math.sin(a - 0.8) * r * 0.3);
  }
  c.stroke();
  c.restore();
}

// ── 해바라기 스프라이트 ────────────────────────────────
// 밭처럼 여러 송이를 매 프레임 그리면 무거우므로, 활짝 핀 꽃을 몇 가지 미리 그려 두고 찍는다.

const flowerSprites = new Map<string, HTMLCanvasElement>();

export function sunflowerSprite(seed: number, sat: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = `${seed % 4}|${Math.round(sat * 10)}`;
  let cv = flowerSprites.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 256;
    sunflower(cv.getContext('2d')!, 128, 128, 120, { sat: Math.round(sat * 10) / 10, seed: (seed % 4) + 1, t: seed });
    flowerSprites.set(key, cv);
  }
  return cv;
}

/** 스프라이트로 해바라기 찍기 — r은 꽃잎 끝까지 반지름, open(0~1)은 피어나는 정도(크기·회전으로) */
export function stampFlower(c: Ctx, x: number, y: number, r: number, o: { seed: number; sat: number; rot?: number; squash?: number; open?: number; alpha?: number }) {
  const sp = sunflowerSprite(o.seed, o.sat);
  if (!sp) return;
  const open = o.open ?? 1;
  if (open <= 0) return;
  const s = (r / 120) * (0.25 + 0.75 * open);
  c.save();
  c.translate(x, y);
  c.rotate((o.rot ?? 0) + (1 - open) * 1.2);
  c.scale(s, s * (o.squash ?? 1));
  c.globalAlpha *= (o.alpha ?? 1) * clamp(open * 3);
  c.drawImage(sp, -128, -128);
  c.restore();
}
