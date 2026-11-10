// MV 렌더러 공용 유틸 (순수 함수 + 캔버스 드로잉 헬퍼). 모든 난수는 시드 고정 — 같은 t면 같은 그림.
import type { MvEnvelope, MvLyricLine, MvSection } from './types';

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a));
export const smooth = (k: number) => k * k * (3 - 2 * k);
export const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
export const easeInCubic = (k: number) => k * k * k;
export const easeOutExpo = (k: number) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
export const easeOutBack = (k: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};

/** 정수 시드 → [0,1) */
export function hash(n: number): number {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 1D 값 노이즈 [-1,1] */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i * 7919 + seed) * 2 - 1;
  const b = hash((i + 1) * 7919 + seed) * 2 - 1;
  return lerp(a, b, smooth(f));
}

/** 구간 키프레임 선형 보간: [[t, v], ...] (t 오름차순) */
export function keyframes(frames: [number, number][], t: number): number {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    if (t <= frames[i][0]) {
      const [t0, v0] = frames[i - 1];
      const [t1, v1] = frames[i];
      return lerp(v0, v1, smooth(invLerp(t0, t1, t)));
    }
  }
  return frames[frames.length - 1][1];
}

// ── 오디오 ──────────────────────────────────────────

export type EnvelopeChannel = 'onset' | 'rms' | 'low' | 'high';

export function decodeEnvelope(env: MvEnvelope) {
  const decode = (s: string) => {
    const out = new Float32Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = (s.charCodeAt(i) - 48) / 63;
    return out;
  };
  const data: Record<EnvelopeChannel, Float32Array> = {
    onset: decode(env.onset),
    rms: decode(env.rms),
    low: decode(env.low),
    high: decode(env.high),
  };
  return (ch: EnvelopeChannel, t: number) => {
    const arr = data[ch];
    const x = t * env.fps;
    const i = Math.floor(x);
    if (i < 0 || i >= arr.length - 1) return 0;
    return lerp(arr[i], arr[i + 1], x - i);
  };
}

/** 고정 템포 비트 그리드 (라이브 MR이라 템포가 일정) */
export function beatGrid(period: number, phase: number) {
  return {
    period,
    /** 연속 비트 위치 */
    pos: (t: number) => (t - phase) / period,
    index: (t: number) => Math.floor((t - phase) / period),
    /** 현재 비트 안에서 0→1 */
    frac: (t: number) => {
      const p = (t - phase) / period;
      return p - Math.floor(p);
    },
    /** 비트 직후 튀었다가 감쇠하는 펄스 */
    pulse: (t: number, decay = 6) => {
      const p = (t - phase) / period;
      return Math.exp(-(p - Math.floor(p)) * decay);
    },
    /** 마디(4비트) 첫 박 직후 펄스 */
    barPulse: (t: number, decay = 4) => {
      const p = (t - phase) / period / 4;
      return Math.exp(-(p - Math.floor(p)) * decay);
    },
    timeOf: (beat: number) => phase + beat * period,
  };
}

// ── 타임라인 조회 ───────────────────────────────────

export function sectionAt(sections: MvSection[], t: number): MvSection {
  for (const s of sections) if (t >= s.start && t < s.end) return s;
  return t < sections[0].start ? sections[0] : sections[sections.length - 1];
}

export function lineAt(lines: MvLyricLine[], t: number): MvLyricLine | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (t >= lines[i].t) return t < lines[i].end + 0.35 ? lines[i] : null;
  }
  return null;
}

/** 현재 줄에서 이미 등장한 덩어리 개수 */
export function chunksShown(line: MvLyricLine, t: number): number {
  let n = 0;
  for (const c of line.ja) if (t >= c.t) n++;
  return n;
}

// ── 드로잉 ──────────────────────────────────────────

type Ctx = CanvasRenderingContext2D;

export function setFont(c: Ctx, size: number, family: string, weight = 400) {
  c.font = `${weight} ${size}px ${family}`;
}

/** 폭에 맞춰 폰트 크기 축소 */
export function fitSize(c: Ctx, text: string, family: string, size: number, maxWidth: number, weight = 400) {
  setFont(c, size, family, weight);
  const w = c.measureText(text).width;
  return w > maxWidth ? Math.floor(size * (maxWidth / w)) : size;
}

/**
 * 붓 자국: 경로 함수 p(u) 위를 따라 여러 가닥(bristle)을 그린다.
 * u∈[0, progress]까지만 그려서 "써 내려가는" 애니메이션이 된다.
 */
export function brushPath(
  c: Ctx,
  p: (u: number) => [number, number],
  width: number,
  progress: number,
  seed: number,
  color: string,
  alpha = 1,
) {
  if (progress <= 0.001) return;
  const r = rng(seed);
  const steps = 48;
  const n = Math.max(2, Math.ceil(steps * progress));
  const pts: [number, number, number, number][] = []; // x, y, nx, ny
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * progress;
    const [x, y] = p(u);
    const [x2, y2] = p(Math.min(1, u + 0.002));
    const [x0, y0] = p(Math.max(0, u - 0.002));
    const dx = x2 - x0;
    const dy = y2 - y0;
    const len = Math.hypot(dx, dy) || 1;
    pts.push([x, y, -dy / len, dx / len]);
  }
  c.save();
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineCap = 'round';
  c.lineJoin = 'round';

  // 몸통: 시작이 굵고 끝으로 갈수록 가늘어지는 면
  const taper = (k: number) => Math.pow(Math.sin(Math.PI * clamp(0.08 + k * 0.92)), 0.45) * (1 - k * 0.35);
  c.globalAlpha = alpha * 0.92;
  c.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [x, y, nx, ny] = pts[i];
    const w = width * 0.36 * taper((i / (pts.length - 1)) * progress);
    if (i === 0) c.moveTo(x + nx * w, y + ny * w);
    else c.lineTo(x + nx * w, y + ny * w);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const [x, y, nx, ny] = pts[i];
    const w = width * 0.36 * taper((i / (pts.length - 1)) * progress);
    c.lineTo(x - nx * w, y - ny * w);
  }
  c.closePath();
  c.fill();

  // 가닥: 갈라지는 마른 붓 질감
  const bristles = 16;
  for (let b = 0; b < bristles; b++) {
    const off = (r() - 0.5) * width;
    const lw = (width / bristles) * (0.6 + r() * 1.6);
    const stop = 0.72 + r() * 0.28;
    const wob = r() * 1000;
    c.globalAlpha = alpha * (0.45 + r() * 0.55);
    c.lineWidth = lw;
    c.beginPath();
    let started = false;
    for (let i = 0; i < pts.length; i++) {
      const k = i / (pts.length - 1);
      if (k * progress > stop) break;
      const [x, y, nx, ny] = pts[i];
      const o = off * taper(k * progress) + noise1(k * 6 + wob) * width * 0.04;
      if (!started) {
        c.moveTo(x + nx * o, y + ny * o);
        started = true;
      } else c.lineTo(x + nx * o, y + ny * o);
    }
    c.stroke();
  }
  c.restore();
}

/** 먹 번짐 얼룩 경로 (clip/fill용) */
export function blotPath(c: Ctx, cx: number, cy: number, radius: number, seed: number, wobble = 0.18, time = 0) {
  const r = rng(seed);
  const harmonics = Array.from({ length: 7 }, (_, k) => ({
    k: k + 2,
    a: (r() * wobble) / (1 + k * 0.45),
    ph: r() * TAU,
    sp: (r() - 0.5) * 0.6,
  }));
  c.beginPath();
  const n = 72;
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * TAU;
    let k = 1;
    for (const h of harmonics) k += h.a * Math.sin(h.k * th + h.ph + time * h.sp);
    const x = cx + Math.cos(th) * radius * k;
    const y = cy + Math.sin(th) * radius * k;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
}

/** 먹 튐 */
export function splatter(c: Ctx, cx: number, cy: number, spread: number, count: number, seed: number, color: string, alpha = 1) {
  const r = rng(seed);
  c.save();
  c.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = r() * TAU;
    const d = Math.pow(r(), 0.6) * spread;
    const s = (1 - d / spread) * 9 * (0.3 + r());
    c.globalAlpha = alpha * (0.5 + r() * 0.5);
    c.beginPath();
    c.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, s * (0.6 + r() * 0.4), a, 0, TAU);
    c.fill();
  }
  c.restore();
}
