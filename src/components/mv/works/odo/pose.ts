// 踊 인물 — 관절 각도로 서는 사람. 같은 뼈대에 두 가지 옷: 픽토그램(비상구 표지의 사람)과 아야(긴 머리·꽃 머리핀·원피스).
// 졸라맨처럼 보이지 않게(2026-11-17 사용자 지적): 팔다리는 끝으로 갈수록 가늘고 손·발이 있으며, 춤은 박마다 무릎을 굽혀 무게를 싣는다.
// 각도는 '아래가 0, 오른쪽(+x)으로 벌어지면 +, 위는 ±π'. 좌표 단위는 키(h) 비율, 발 닿는 바닥이 원점.
import { TAU, clamp, easeOutBack, hash, lerp } from '../../engine';
import { type Ctx, glow } from './kit';

export interface Pose {
  /** 몸통 기울기 */
  lean: number;
  /** 공중으로 뜬 높이(키 비율) */
  air: number;
  /** 왼팔 [위팔, 아래팔] · 오른팔 · 왼다리 [허벅지, 정강이] · 오른다리 */
  la: [number, number];
  ra: [number, number];
  ll: [number, number];
  rl: [number, number];
  /** 고개 기울기 */
  head: number;
  /** 허리 숙임 0~1 (정면 인사·웅크림 — 몸통이 짧아지고 고개가 내려감) */
  fold: number;
  /** 0 정면 ~ 1 옆모습(오른쪽을 봄) — 어깨·골반 폭이 좁아지고 발끝이 앞을 향한다 */
  face?: number;
  /** 무릎을 굽혀 몸을 낮춤(키 비율) — 발은 그 자리에 둔다 */
  dip?: number;
  /** 골반을 옆으로 밀기(키 비율) — 발은 그 자리에 둔다 */
  sway?: number;
}

const P = (o: Partial<Pose> = {}): Pose => ({
  lean: 0,
  air: 0,
  la: [-0.18, -0.1],
  ra: [0.18, 0.1],
  ll: [-0.07, -0.05],
  rl: [0.07, 0.05],
  head: 0,
  fold: 0,
  ...o,
});

export const POSE = {
  stand: P(),
  /** 두 팔을 내리고 고개 숙임 */
  down: P({ head: 0.25, fold: 0.12, la: [-0.08, -0.04], ra: [0.08, 0.04] }),
  armsUp: P({ la: [-2.75, -2.95], ra: [2.75, 2.95], ll: [-0.16, -0.1], rl: [0.16, 0.1] }),
  vee: P({ la: [-2.35, -2.5], ra: [2.35, 2.5], ll: [-0.3, -0.18], rl: [0.3, 0.18] }),
  /** 오른팔 찌르기 */
  point: P({ lean: 0.12, la: [-0.55, 0.9], ra: [2.5, 2.6], ll: [-0.34, -0.1], rl: [0.22, 0.3] }),
  pointL: P({ lean: -0.12, ra: [0.55, -0.9], la: [-2.5, -2.6], rl: [0.34, 0.1], ll: [-0.22, -0.3] }),
  /** 양팔 옆으로 */
  tee: P({ la: [-1.57, -1.57], ra: [1.57, 1.57], ll: [-0.2, -0.12], rl: [0.2, 0.12] }),
  /** 한쪽으로 기울며 팔 물결 */
  waveL: P({ lean: -0.22, la: [-1.9, -2.6], ra: [1.2, 0.3], ll: [-0.12, 0.2], rl: [0.4, 0.1], head: -0.2 }),
  waveR: P({ lean: 0.22, ra: [1.9, 2.6], la: [-1.2, -0.3], rl: [0.12, -0.2], ll: [-0.4, -0.1], head: 0.2 }),
  /** 낮게 앉아 팔을 앞으로 */
  low: P({ la: [-0.9, -2.0], ra: [0.9, 2.0], ll: [-0.75, 0.25], rl: [0.75, -0.25], fold: 0.15 }),
  /** 허리에 손 */
  hips: P({ la: [-0.7, 0.55], ra: [0.7, -0.55], ll: [-0.24, -0.16], rl: [0.24, 0.16] }),
  /** 한 팔 위, 한 팔 아래 사선 */
  disco: P({ lean: 0.1, la: [-0.75, -0.6], ra: [2.45, 2.3], ll: [-0.12, -0.05], rl: [0.5, 0.2] }),
  discoL: P({ lean: -0.1, ra: [0.75, 0.6], la: [-2.45, -2.3], rl: [0.12, 0.05], ll: [-0.5, -0.2] }),
  jump: P({ air: 0.16, la: [-2.6, -2.9], ra: [2.6, 2.9], ll: [-0.5, 0.5], rl: [0.5, -0.5] }),
  /** 손 흔들기(오른팔) — wave()로 아래팔을 흔든다 */
  bye: P({ ra: [2.3, 2.9], la: [-0.2, -0.12], head: 0.08 }),
  bow: P({ fold: 0.85, head: 0.5, la: [-0.5, -0.3], ra: [0.5, 0.3] }),
  /** 손을 잡고 든 팔 */
  linked: P({ la: [-2.2, -2.2], ra: [2.2, 2.2] }),
  /** 웅크림 */
  crouch: P({ fold: 0.7, head: 0.6, la: [-0.35, 0.9], ra: [0.35, -0.9], ll: [-1.25, 0.3], rl: [1.25, -0.3] }),
  /** 가라앉는 몸 — 팔다리가 위로 끌림 */
  sink: P({ lean: 0.18, la: [-2.3, -2.9], ra: [2.0, 2.7], ll: [-0.25, -0.6], rl: [0.3, 0.75], head: -0.3 }),
  /** 파도타기 */
  surf: P({ lean: 0.2, la: [-1.5, -1.9], ra: [1.4, 1.1], ll: [-0.5, 0.2], rl: [0.6, 0.05] }),
  /** 마이크를 든 오른팔 */
  mic: P({ ra: [0.75, 2.55], la: [-0.5, -0.25], lean: -0.04, head: -0.12, ll: [-0.16, -0.08], rl: [0.2, 0.1] }),
  /** 마이크를 치켜든 팔 */
  micUp: P({ ra: [2.6, 2.8], la: [-0.9, -0.5], lean: -0.1, head: -0.35, ll: [-0.28, -0.12], rl: [0.3, 0.14] }),
  /** 앉아서 턱을 굄(옆모습) */
  sit: P({ lean: 0.22, la: [0.5, 2.5], ra: [0.3, 1.2], ll: [1.45, 0.05], rl: [1.5, 0.12], head: 0.18, face: 1 }),
  /** 고개를 듦 */
  lookUp: P({ head: -0.45, la: [-0.25, -0.15], ra: [0.25, 0.15] }),
} as const;

/** 춤 동작 묶음 — 박마다 하나씩 */
export const DANCE: Pose[] = [POSE.point, POSE.waveL, POSE.vee, POSE.low, POSE.pointL, POSE.waveR, POSE.tee, POSE.disco];
export const DANCE2: Pose[] = [POSE.disco, POSE.hips, POSE.discoL, POSE.armsUp, POSE.low, POSE.vee, POSE.waveR, POSE.waveL];

const mix2 = (a: [number, number], b: [number, number], k: number): [number, number] => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

/** k를 0~1로 자르지 않는 섞기(넘치는 반동에 쓴다) */
function mixRaw(a: Pose, b: Pose, k: number): Pose {
  return {
    lean: lerp(a.lean, b.lean, k),
    air: lerp(a.air, b.air, k),
    la: mix2(a.la, b.la, k),
    ra: mix2(a.ra, b.ra, k),
    ll: mix2(a.ll, b.ll, k),
    rl: mix2(a.rl, b.rl, k),
    head: lerp(a.head, b.head, k),
    fold: lerp(a.fold, b.fold, k),
    face: lerp(a.face ?? 0, b.face ?? 0, k),
    dip: lerp(a.dip ?? 0, b.dip ?? 0, k),
    sway: lerp(a.sway ?? 0, b.sway ?? 0, k),
  };
}

export function mixPose(a: Pose, b: Pose, k: number): Pose {
  if (k <= 0) return a;
  if (k >= 1) return b;
  return mixRaw(a, b, k);
}

/** 박 위치(pos, 소수)에서의 춤 — 박이 떨어지자마자 다음 동작으로 탁 넘어간다(snap=넘어가는 데 쓰는 박 비율) */
export function danceAt(seq: Pose[], pos: number, snap = 0.3): Pose {
  const n = seq.length;
  const i = Math.floor(pos);
  const f = pos - i;
  const cur = seq[((i % n) + n) % n];
  // 동작은 조금 지나쳤다 돌아오고(반동), 박이 떨어질 때 무릎을 굽혔다 올라온다(무게)
  const base = f >= snap ? cur : mixRaw(seq[(((i - 1) % n) + n) % n], cur, easeOutBack(f / snap));
  const dip = 0.05 * Math.exp(-f * 5.5) * Math.min(1, f / 0.06);
  return { ...base, dip: (base.dip ?? 0) + dip };
}

// 달리기·걷기: 허벅지 각도가 sin(phase)라서 다리가 앞으로 나가는 때는 cos > 0(왼다리) / cos < 0(오른다리).
// 무릎은 다리가 앞으로 나갈 때(공중) 접히고, 뒤로 밀 때(땅을 디딤) 펴져야 앞으로 가는 걸음이 된다 —
// 반대로 두면 뒤로 걷는 것처럼 보인다(2026-11-17 사용자 지적).

/** 달리기(옆모습, 오른쪽으로) — phase 한 바퀴에 두 걸음 */
export function runPose(phase: number): Pose {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  return {
    lean: 0.3,
    air: 0.03 * Math.abs(s),
    la: [-s * 1.0 + 0.1, -s * 1.0 + 1.5],
    ra: [s * 1.0 + 0.1, s * 1.0 + 1.5],
    ll: [s * 0.95, s * 0.95 - 0.2 - Math.max(0, c) * 1.6],
    rl: [-s * 0.95, -s * 0.95 - 0.2 - Math.max(0, -c) * 1.6],
    head: 0.1,
    fold: 0,
    face: 1,
  };
}

/** 걷기(옆모습, 오른쪽으로) */
export function walkPose(phase: number): Pose {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  return {
    lean: 0.06,
    air: 0.008 * Math.abs(s),
    la: [-s * 0.45, -s * 0.45 + 0.25],
    ra: [s * 0.45, s * 0.45 + 0.25],
    ll: [s * 0.42, s * 0.42 - 0.08 - Math.max(0, c) * 0.6],
    rl: [-s * 0.42, -s * 0.42 - 0.08 - Math.max(0, -c) * 0.6],
    head: 0,
    fold: 0,
    face: 1,
  };
}

/** 계단 한 칸 뛰어오르기(옆모습, 오른쪽 위로) — k: 0 디딤 → 1 다음 칸 디딤, side로 앞발을 번갈아 */
export function climbPose(k: number, side: 1 | -1): Pose {
  const up = Math.sin(clamp(k) * Math.PI);
  // 앞다리: 무릎을 높이 들었다가 다음 칸을 디딤 / 뒷다리: 아래 칸을 차고 뒤로 뻗음
  const lead: [number, number] = [lerp(0.35, 1.25, up), lerp(-0.15, 0.05, up)];
  const back: [number, number] = [lerp(-0.25, -0.55, up), lerp(-0.35, -1.25, up)];
  return {
    lean: 0.32 + 0.08 * up,
    air: 0.02 * up,
    la: side > 0 ? [-0.9 * up - 0.2, -0.3 * up + 0.9] : [0.9 * up + 0.2, 0.9 * up + 1.7],
    ra: side > 0 ? [0.9 * up + 0.2, 0.9 * up + 1.7] : [-0.9 * up - 0.2, -0.3 * up + 0.9],
    ll: side > 0 ? lead : back,
    rl: side > 0 ? back : lead,
    head: 0.05,
    fold: 0,
    face: 1,
  };
}

export interface FigureOpts {
  skin?: 'picto' | 'aya';
  color: string;
  /** 밝게 비춘 아야의 색(AYA_LIT) — 주면 살·옷·머리가 제 색으로 나뉜다(color는 옷 색). 없으면 한 색 실루엣 */
  lit?: AyaColors;
  /** lit일 때 무대 조명이 옷·머리에 물드는 정도(0~1) — 조명 색은 rim. 기본 0.45 */
  wash?: number;
  /** 윤곽에 번지는 빛 */
  rim?: string;
  rimBlur?: number;
  /** 머리카락·치맛자락이 쏠리는 정도(-1~1) */
  swing?: number;
  /** 좌우 뒤집기 */
  flip?: boolean;
  alpha?: number;
  /** 오른손에 든 것 */
  hold?: 'mic' | 'light' | null;
  /** 손에 든 빛의 색 */
  holdColor?: string;
}

export interface AyaColors {
  hair: string;
  skinColor: string;
  /** 노란 테·허리띠·소맷부리·샌들·더듬이 머리 */
  accent: string;
  /** 세일러 타이 */
  tie: string;
  /** 꽃 머리핀 */
  flower: string;
}

/** 밝게 비춘 아야의 색 — 전신 그림 고증. `figure(..., { skin: 'aya', color: NEON.white, lit: AYA_LIT })` */
export const AYA_LIT: AyaColors = { hair: '#b99cf7', skinColor: '#ffe4d8', accent: '#ffd23f', tie: '#8a68d8', flower: '#f1e8ff' };

type Pt = [number, number];

/** '#rrggbb' → [r, g, b], 아니면 null */
function hexRgb(c: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * 조명 색이 물든 색 — 바탕색에 조명 색을 곱한 것(색 있는 빛을 받은 물체)과 원래 색을 k만큼 섞는다.
 * 흰 옷은 조명 색으로, 노란 장식은 분홍 조명 아래 주홍으로, 라벤더 머리는 더 붉은 보라로 간다.
 */
function washed(base: string, light: string, k: number): string {
  const b = hexRgb(base);
  const l = hexRgb(light);
  if (!b || !l || k <= 0) return base;
  const ch = (i: number) => {
    const lit = (b[i] * (0.35 + 0.65 * (l[i] / 255)));
    return Math.round(b[i] + (lit - b[i]) * k);
  };
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

interface Joints {
  hip: Pt;
  neck: Pt;
  head: Pt;
  ls: Pt;
  rs: Pt;
  le: Pt;
  re: Pt;
  /** 손목 */
  lh: Pt;
  rh: Pt;
  /** 손(손목에서 조금 더 나간 곳) */
  lhand: Pt;
  rhand: Pt;
  lhip: Pt;
  rhip: Pt;
  lk: Pt;
  rk: Pt;
  /** 발목 */
  lf: Pt;
  rf: Pt;
  /** 발끝 */
  lt: Pt;
  rt: Pt;
  face: number;
}

const dir = (a: number, len: number): Pt => [Math.sin(a) * len, Math.cos(a) * len];

const THIGH = 0.25;
const SHIN = 0.25;

/**
 * 엉덩이(h)와 발(f)이 정해졌을 때의 무릎 — 원래 무릎(k0, 그때 엉덩이 h0)이 꺾여 있던 쪽으로 꺾는다.
 * 다리가 거의 펴져 있었으면 out(바깥 또는 앞) 쪽으로.
 */
function kneeFor(h: Pt, f: Pt, h0: Pt, k0: Pt, out: number): { k: Pt; f: Pt } {
  const dx = f[0] - h[0];
  const dy = f[1] - h[1];
  const full = Math.hypot(dx, dy) || 1e-6;
  if (full >= THIGH + SHIN - 1e-4) {
    // 발이 닿지 않으면 다리를 곧게 뻗는다(발이 조금 뜬다)
    const ux = dx / full;
    const uy = dy / full;
    return { k: [h[0] + ux * THIGH, h[1] + uy * THIGH], f: [h[0] + ux * (THIGH + SHIN), h[1] + uy * (THIGH + SHIN)] };
  }
  const a = Math.acos(clamp((THIGH * THIGH + full * full - SHIN * SHIN) / (2 * THIGH * full), -1, 1));
  const base = Math.atan2(dy, dx);
  const cross = (k0[0] - h0[0]) * (f[1] - h0[1]) - (k0[1] - h0[1]) * (f[0] - h0[0]);
  let s: number;
  if (Math.abs(cross) > 4e-4) s = cross > 0 ? -1 : 1;
  else s = Math.cos(base + a) * out >= Math.cos(base - a) * out ? 1 : -1;
  return { k: [h[0] + Math.cos(base + s * a) * THIGH, h[1] + Math.sin(base + s * a) * THIGH], f };
}

/** 관절 위치(키 = 1, 바닥 y = 0, 위가 음수) */
export function joints(p: Pose, aya = false): Joints {
  const face = clamp(p.face ?? 0);
  const narrow = 1 - 0.7 * face;
  const hipW = (aya ? 0.036 : 0.055) * narrow;
  const shW = (aya ? 0.066 : 0.088) * narrow;
  const upper = 0.16;
  const fore = 0.16;
  const leg = (side: number, a: [number, number]) => {
    const k = dir(a[0], THIGH);
    const f = dir(a[1], SHIN);
    return { k: [side * hipW + k[0], k[1]] as Pt, f: [side * hipW + k[0] + f[0], k[1] + f[1]] as Pt };
  };
  const L = leg(-1, p.ll);
  const R = leg(1, p.rl);
  // 낮은 쪽 발이 바닥에 닿게 엉덩이 높이를 정한다
  const hipY0 = -Math.max(L.f[1], R.f[1], 0.12) - p.air;
  let lk: Pt = [L.k[0], hipY0 + L.k[1]];
  let rk: Pt = [R.k[0], hipY0 + R.k[1]];
  let lf: Pt = [L.f[0], hipY0 + L.f[1]];
  let rf: Pt = [R.f[0], hipY0 + R.f[1]];
  // 무릎 굽히기·골반 밀기: 발은 그 자리에 두고 엉덩이만 옮긴 뒤 무릎을 다시 푼다
  const dip = p.dip ?? 0;
  const sway = p.sway ?? 0;
  const hip: Pt = [sway, hipY0 + dip];
  const lhip: Pt = [-hipW + sway, hip[1]];
  const rhip: Pt = [hipW + sway, hip[1]];
  if (dip !== 0 || sway !== 0) {
    const nl = kneeFor(lhip, lf, [-hipW, hipY0], lk, face > 0.5 ? 1 : -1);
    const nr = kneeFor(rhip, rf, [hipW, hipY0], rk, 1);
    lk = nl.k;
    lf = nl.f;
    rk = nr.k;
    rf = nr.f;
  }
  const torso = 0.3 * (1 - 0.55 * p.fold);
  const up: Pt = [Math.sin(p.lean), -Math.cos(p.lean)];
  const side: Pt = [Math.cos(p.lean), Math.sin(p.lean)];
  const neck: Pt = [hip[0] + up[0] * torso, hip[1] + up[1] * torso];
  const headUp = (aya ? 0.1 : 0.122) * (1 - 0.5 * p.fold);
  const head: Pt = [neck[0] + Math.sin(p.lean + p.head) * headUp + 0.02 * face, neck[1] - Math.cos(p.lean + p.head) * headUp + 0.05 * p.fold];
  const shDrop = aya ? 0.034 : 0.02;
  const ls: Pt = [neck[0] - side[0] * shW, neck[1] - side[1] * shW + shDrop];
  const rs: Pt = [neck[0] + side[0] * shW, neck[1] + side[1] * shW + shDrop];
  const le0 = dir(p.la[0], upper);
  const lh0 = dir(p.la[1], fore);
  const re0 = dir(p.ra[0], upper);
  const rh0 = dir(p.ra[1], fore);
  const le: Pt = [ls[0] + le0[0], ls[1] + le0[1]];
  const re: Pt = [rs[0] + re0[0], rs[1] + re0[1]];
  const lh: Pt = [le[0] + lh0[0], le[1] + lh0[1]];
  const rh: Pt = [re[0] + rh0[0], re[1] + rh0[1]];
  const handLen = aya ? 0.02 : 0.026;
  // 발끝: 정강이에 수직으로. 정면이면 바깥쪽으로 짧게, 옆모습이면 앞으로 길게
  const toe = (k: Pt, f: Pt, sd: number): Pt => {
    const dx = f[0] - k[0];
    const dy = f[1] - k[1];
    const n = Math.hypot(dx, dy) || 1;
    const fwd = face > 0.5 ? 1 : sd;
    const len = (aya ? 0.05 : 0.062) * lerp(0.62, 1, face);
    // 정강이 방향 (dx,dy)/n 에 수직이고 fwd 쪽을 보는 벡터
    const px = (dy / n) * fwd;
    const py = (-dx / n) * fwd;
    return [f[0] + px * len, Math.min(f[1] + py * len, Math.max(f[1], 0))];
  };
  return {
    hip,
    neck,
    head,
    ls,
    rs,
    le,
    re,
    lh,
    rh,
    lhand: [lh[0] + (lh0[0] / fore) * handLen, lh[1] + (lh0[1] / fore) * handLen],
    rhand: [rh[0] + (rh0[0] / fore) * handLen, rh[1] + (rh0[1] / fore) * handLen],
    lhip,
    rhip,
    lk,
    rk,
    lf,
    rf,
    lt: toe(lk, lf, -1),
    rt: toe(rk, rf, 1),
    face,
  };
}

// ── 도형 조각 ─────────────────────────────────────────
// 한 사람을 path 하나에 조각조각 이어 붙여 한 번에 칠한다(반투명 잔상에서도 겹친 자리가 진해지지 않게).
// 그러려면 조각이 모두 같은 방향으로 돌아야 한다(nonzero 채움) — arc 기본 방향(화면에서 시계 방향)에 맞춘다.

/** 굵기가 변하는 막대(양 끝이 둥근) — a에서 굵기 ra, b에서 rb */
function cap(c: Ctx, a: Pt, b: Pt, ra: number, rb: number) {
  const th = Math.atan2(b[1] - a[1], b[0] - a[0]);
  c.moveTo(a[0] + Math.cos(th + Math.PI / 2) * ra, a[1] + Math.sin(th + Math.PI / 2) * ra);
  c.arc(a[0], a[1], ra, th + Math.PI / 2, th + Math.PI * 1.5);
  c.arc(b[0], b[1], rb, th - Math.PI / 2, th + Math.PI / 2);
  c.closePath();
}

function dot(c: Ctx, p: Pt, r: number) {
  c.moveTo(p[0] + r, p[1]);
  c.arc(p[0], p[1], r, 0, TAU);
  c.closePath();
}

/**
 * 닫힌 도형. round면 점과 점 사이 가운데를 지나는 부드러운 곡선(같은 점을 두 번 넣으면 그 자리는 뾰족),
 * 아니면 직선. 도는 방향은 알아서 맞춘다.
 */
function shape(c: Ctx, pts: Pt[], round = true) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const p = area < 0 ? [...pts].reverse() : pts;
  const n = p.length;
  if (!round) {
    c.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < n; i++) c.lineTo(p[i][0], p[i][1]);
    c.closePath();
    return;
  }
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(p[n - 1], p[0]);
  c.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(p[i], p[(i + 1) % n]);
    c.quadraticCurveTo(p[i][0], p[i][1], m[0], m[1]);
  }
  c.closePath();
}

/** 사람 한 명. (x, ground)가 발 닿는 바닥, h가 키 */
export function figure(c: Ctx, x: number, ground: number, h: number, pose: Pose, o: FigureOpts) {
  const aya = o.skin === 'aya';
  const j = joints(pose, aya);
  const swing = o.swing ?? 0;
  const face = j.face;
  c.save();
  c.translate(x, ground);
  if (o.flip) c.scale(-1, 1);
  c.scale(h, h);
  c.globalAlpha *= o.alpha ?? 1;

  const mic = () => {
    if (o.hold !== 'mic') return;
    const top: Pt = [j.rhand[0] - 0.012, j.rhand[1] - 0.075];
    cap(c, j.rhand, top, 0.012, 0.012);
    dot(c, [top[0] - 0.004, top[1] - 0.02], 0.03);
  };

  // ── 픽토그램: 떠 있는 둥근 머리, 어깨에서 허리로 좁아지는 몸, 끝으로 갈수록 가는 팔다리, 손·발 ──
  const picto = () => {
    c.beginPath();
    const chest: Pt = [(j.ls[0] + j.rs[0]) / 2, (j.ls[1] + j.rs[1]) / 2];
    cap(c, j.ls, j.rs, 0.047, 0.047);
    cap(c, j.ls, j.lhip, 0.047, 0.044);
    cap(c, j.rs, j.rhip, 0.047, 0.044);
    cap(c, chest, j.hip, 0.07, 0.056);
    cap(c, j.lhip, j.rhip, 0.044, 0.044);
    for (const [hp, k, f, t] of [[j.lhip, j.lk, j.lf, j.lt], [j.rhip, j.rk, j.rf, j.rt]] as const) {
      cap(c, hp, k, 0.05, 0.039);
      cap(c, k, f, 0.039, 0.027);
      cap(c, f, t, 0.027, 0.02);
    }
    for (const [s, e, w, hd] of [[j.ls, j.le, j.lh, j.lhand], [j.rs, j.re, j.rh, j.rhand]] as const) {
      cap(c, s, e, 0.04, 0.031);
      cap(c, e, w, 0.031, 0.024);
      dot(c, hd, 0.031);
    }
    dot(c, j.head, 0.076);
    mic();
    c.fill();
  };

  // ── 아야: 허리 아래까지 오는 긴 머리, 앞머리·옆머리, 더듬이 머리, 꽃 머리핀, 오프숄더 원피스 ──
  const hx = j.head[0];
  const hy = j.head[1];
  // 머리카락은 몸이 기울어도 아래로 늘어지고, 움직임을 늦게 따라온다. 옆모습이면 뒤(왼쪽)로
  const lag = -pose.lean * 0.2 + swing * 0.085 - face * 0.07;
  const sideK = 1 - 0.55 * face;

  // 허리(치마가 시작하는 곳)
  const up: Pt = [Math.sin(pose.lean), -Math.cos(pose.lean)];
  const sd: Pt = [Math.cos(pose.lean), Math.sin(pose.lean)];
  const spine = Math.hypot(j.neck[0] - j.hip[0], j.neck[1] - j.hip[1]);
  const waist: Pt = [j.hip[0] + up[0] * spine * 0.4, j.hip[1] + up[1] * spine * 0.4];
  const wW = 0.04 * lerp(1, 0.8, face);
  const wl: Pt = [waist[0] - sd[0] * wW, waist[1] - sd[1] * wW];
  const wr: Pt = [waist[0] + sd[0] * wW, waist[1] + sd[1] * wW];

  const hairBack = () => {
    const bottom = Math.min(hy + 0.56, -0.06);
    const len = bottom - hy;
    const wB = 0.165;
    const pts: Pt[] = [
      [hx - 0.078, hy - 0.04],
      [hx - 0.1, hy + len * 0.22],
      [hx - 0.112 + lag * 0.35, hy + len * 0.6],
      [hx - wB + lag, bottom - 0.02],
    ];
    // 끝이 다섯 갈래로 갈라진다
    const tips = 5;
    for (let i = 0; i < tips; i++) {
      const u0 = -wB + (i / tips) * wB * 2;
      const u1 = -wB + ((i + 1) / tips) * wB * 2;
      const drop = 0.035 + 0.02 * Math.sin(i * 2.1) + 0.012 * swing * (i - 2);
      const tip: Pt = [hx + (u0 + u1) / 2 + lag * 1.12, bottom + drop];
      pts.push([hx + u0 + lag, bottom - 0.03], tip, tip);
    }
    pts.push([hx + wB + lag, bottom - 0.02], [hx + 0.112 + lag * 0.35, hy + len * 0.6], [hx + 0.1, hy + len * 0.22], [hx + 0.078, hy - 0.04], [hx, hy - 0.09]);
    shape(c, pts);
  };

  // 몸은 겹치는 순서대로 조각을 나눠 둔다 — 한 색 실루엣이면 한꺼번에, 밝게 비출 땐 살·옷·머리를 제 색으로 칠한다.
  const limbs = [[j.lhip, j.lk, j.lf, j.lt], [j.rhip, j.rk, j.rf, j.rt]] as const;
  const armsOf = [[j.ls, j.le, j.lh, j.lhand], [j.rs, j.re, j.rh, j.rhand]] as const;

  // 옷은 아야 전신 그림 고증(사용자 제공, 2026-11-17): 오프숄더 세일러 원피스 — 어깨를 드러낸 흰 프릴 깃(노란 테),
  // 보라 세일러 타이, 노란 허리띠와 리본, 허벅지 중간까지 오는 흰 치마(노란 줄 두 줄 + 노란 속치마 프릴),
  // 손등까지 덮는 넓은 시스루 소매(노란 소맷부리), 노란 통굽 샌들. 더듬이 머리는 노란색.
  const B = (u: number, v: number): Pt => [j.neck[0] + sd[0] * u * nw - up[0] * v, j.neck[1] + sd[1] * u * nw - up[1] * v];
  const nw = 1 - 0.6 * face;

  const legs = () => {
    for (const [hp, k, f] of limbs) {
      cap(c, hp, k, 0.034, 0.026);
      cap(c, k, f, 0.026, 0.018);
    }
  };
  /** 통굽 샌들 */
  const shoes = () => {
    for (const [, , f, t] of limbs) {
      cap(c, f, t, 0.024, 0.019);
      cap(c, [f[0], f[1] + 0.006], [t[0], t[1] + 0.006], 0.02, 0.017);
    }
  };
  /** 드러난 목·어깨·가슴 위 — 목에서 어깨로 흘러내린다 */
  const chest = () => {
    const nb: Pt = [j.neck[0] + up[0] * 0.004, j.neck[1] + up[1] * 0.004];
    cap(c, nb, j.ls, 0.017, 0.023);
    cap(c, nb, j.rs, 0.017, 0.023);
    shape(c, [nb, j.rs, B(0.07, 0.07), B(-0.07, 0.07), j.ls], false);
  };
  /** 몸판 — 프릴 깃 아래에서 잘록한 허리로 */
  const bodice = () => {
    shape(c, [B(-0.075, 0.06), B(0.075, 0.06), wr, wl], false);
    cap(c, wl, wr, 0.012, 0.012);
  };
  // 치마 — 다리를 벌리거나 몸을 낮추면 더 퍼지고, 자락이 늦게 따라온다
  const sw = swing * 0.05 - pose.lean * 0.09 - face * 0.02;
  const flare = (pose.dip ?? 0) * 1.4 + Math.abs(swing) * 0.02;
  const hemY = j.hip[1] + 0.115;
  const skirtHalf = (side: number) =>
    Math.max(0.15 * lerp(1, 0.8, face), (side < 0 ? j.hip[0] - j.lk[0] : j.rk[0] - j.hip[0]) + 0.07) + flare;
  /** 허리선(hip+0.02)에서 단까지의 가장자리 x — side -1 왼쪽, 1 오른쪽, k 0 위 ~ 1 단 */
  const skirtEdge = (side: number, k: number, widen = 0) =>
    lerp(j.hip[0] + side * (0.1 + flare * 0.5 + widen * 0.4), j.hip[0] + side * (skirtHalf(side) + widen) + sw, k);
  const skirt = (drop = 0, widen = 0, frills = 6, sagAmp = 0.022) => {
    const hem = hemY + drop;
    const x0 = skirtEdge(1, 1, widen);
    const x1 = skirtEdge(-1, 1, widen);
    const pts: Pt[] = [wl, wl, wr, wr, [skirtEdge(1, 0, widen), j.hip[1] + 0.02], [x0, hem], [x0, hem]];
    for (let i = 0; i < frills; i++) {
      const a = lerp(x0, x1, (i + 0.5) / frills);
      const b = lerp(x0, x1, (i + 1) / frills);
      const sag = sagAmp + sagAmp * 0.45 * Math.sin(i * 1.7 + swing * 2);
      pts.push([a, hem + sag], [b, hem + 0.004 * Math.sin(i * 2.3)], [b, hem + 0.004 * Math.sin(i * 2.3)]);
    }
    pts.push([skirtEdge(-1, 0, widen), j.hip[1] + 0.02]);
    shape(c, pts);
  };
  /** 노란 속치마 프릴 — 치마 단 밑으로 살짝 */
  const petticoat = () => skirt(0.026, 0.012, 11, 0.012);
  /** 치마 단 위 노란 줄 두 줄 */
  const stripes = () => {
    const top = j.hip[1] + 0.02;
    for (const off of [0.034, 0.054]) {
      const y = hemY - off;
      const k = (y - top) / (hemY - top);
      const k2 = (y + 0.008 - top) / (hemY - top);
      shape(c, [[skirtEdge(-1, k), y], [skirtEdge(1, k), y], [skirtEdge(1, k2), y + 0.008], [skirtEdge(-1, k2), y + 0.008]], false);
    }
  };
  /** 어깨 아래로 두른 프릴 깃 — 두 겹 물결 */
  const collar = (trim = false) => {
    const t = trim ? 0.012 : 0;
    const pts: Pt[] = [B(-0.098 - t * 0.3, 0.045), B(-0.098 - t * 0.3, 0.045), B(0.098 + t * 0.3, 0.045), B(0.098 + t * 0.3, 0.045)];
    const n = 5;
    for (let i = 0; i <= n; i++) {
      const u = lerp(0.112, -0.112, i / n) * (1 + t);
      const v = 0.098 + t + (i % 2 ? 0.012 : 0);
      pts.push(B(u, v));
    }
    shape(c, pts);
  };
  /** 보라 세일러 타이 — 깃 가운데에서 명치까지 */
  const tie = () => {
    shape(c, [B(-0.03, 0.05), B(0.03, 0.05), B(0.006, 0.09), B(0.022, 0.15), B(0.022, 0.15), B(0, 0.135), B(-0.022, 0.15), B(-0.022, 0.15), B(-0.006, 0.09)]);
  };
  /** 노란 허리띠와 리본 */
  const sash = () => {
    const wl2: Pt = [wl[0] - sd[0] * 0.008, wl[1] - sd[1] * 0.008];
    const wr2: Pt = [wr[0] + sd[0] * 0.008, wr[1] + sd[1] * 0.008];
    cap(c, wl2, wr2, 0.015, 0.015);
    for (const s of [-1, 1]) {
      const loop: Pt = [waist[0] + sd[0] * s * 0.03, waist[1] + sd[1] * s * 0.03 - 0.004];
      dot(c, loop, 0.015);
      cap(c, waist, [waist[0] + s * 0.014 - up[0] * 0.06, waist[1] - up[1] * 0.06], 0.007, 0.005);
    }
    dot(c, waist, 0.01);
  };
  /** 팔(살) — 손만 소매 밖으로 */
  const arms = () => {
    for (const [s, e, w, hd] of armsOf) {
      cap(c, s, e, 0.022, 0.018);
      cap(c, e, w, 0.018, 0.015);
      dot(c, hd, 0.02);
    }
  };
  /**
   * 손목 쪽으로 넓어지는 나팔 소매 — 끝은 평평하게 열려 손이 나온다(둥근 끝이면 손을 덮은 공처럼 보인다).
   * u0~u1은 아래팔 위 비율, 굵기는 팔꿈치 r0 → 소맷부리 r1
   */
  const band = (e: Pt, w: Pt, u0: number, u1: number, r0: number, r1: number) => {
    const dx = w[0] - e[0];
    const dy = w[1] - e[1];
    const n = Math.hypot(dx, dy) || 1;
    const nx = -dy / n;
    const ny = dx / n;
    const a: Pt = [e[0] + dx * u0, e[1] + dy * u0];
    const b: Pt = [e[0] + dx * u1, e[1] + dy * u1];
    shape(c, [[a[0] + nx * r0, a[1] + ny * r0], [b[0] + nx * r1, b[1] + ny * r1], [b[0] - nx * r1, b[1] - ny * r1], [a[0] - nx * r0, a[1] - ny * r0]], false);
  };
  const SLEEVE_END = 0.9;
  const sleeves = () => {
    for (const [s, e, w] of armsOf) {
      cap(c, [lerp(s[0], e[0], 0.12), lerp(s[1], e[1], 0.12)], e, 0.027, 0.03);
      band(e, w, 0, SLEEVE_END, 0.03, 0.043);
    }
  };
  const cuffs = () => {
    for (const [, e, w] of armsOf) band(e, w, SLEEVE_END - 0.09, SLEEVE_END, 0.0395, 0.044);
  };
  /** 목과 얼굴 — 동그란 얼굴에 턱만 살짝 */
  const headNeck = () => {
    cap(c, j.neck, j.head, 0.015, 0.015);
    cap(c, j.head, [hx + face * 0.025, hy + 0.03], 0.066, 0.046);
  };
  const whole = () => {
    legs();
    shoes();
    chest();
    petticoat();
    skirt();
    bodice();
    collar();
    arms();
    sleeves();
    headNeck();
    mic();
  };

  const hairFront = () => {
    // 정수리에서 이마까지 덮는 머리. 앞머리는 둥근 가닥 셋이 내려오고 그 사이만 뾰족하게 갈라진다
    // (끝을 뾰족하게 내리면 얼굴이 톱니 모양으로 잘려 보인다)
    const b = (dx: number, dy: number): Pt => [hx + dx, hy + dy];
    shape(c, [
      b(-0.086, 0.035), b(-0.092, -0.035), b(-0.06, -0.09), b(0, -0.102), b(0.06, -0.09), b(0.092, -0.035), b(0.086, 0.035),
      b(0.07, 0.012), b(0.07, 0.012), b(0.05, 0.022), b(0.03, -0.016), b(0.03, -0.016), b(0.004, 0.024), b(-0.022, -0.016), b(-0.022, -0.016),
      b(-0.046, 0.022), b(-0.07, 0.012), b(-0.07, 0.012),
    ]);
    // 옆머리 — 얼굴 바깥을 따라 가슴 앞으로 흘러내림(뺨을 가리지 않는다). 끝만 움직임을 따라간다
    for (const s of [-1, 1]) {
      const k = s * sideK;
      const tip: Pt = [hx + k * 0.088 + lag * 0.5, hy + 0.3];
      shape(c, [
        [hx + k * 0.07, hy - 0.01], [hx + k * 0.104, hy + 0.05], [hx + k * 0.1 + lag * 0.25, hy + 0.19], tip, tip,
        [hx + k * 0.076 + lag * 0.25, hy + 0.2], [hx + k * 0.07, hy + 0.06],
      ]);
    }
  };
  /** 더듬이 머리 — 정수리 가운데에서 휘어 올라가는 한 가닥(노란색) */
  const ahoge = () => {
    const a0: Pt = [hx - 0.004, hy - 0.092];
    const a1: Pt = [hx - 0.05 + swing * 0.025, hy - 0.185];
    const a2: Pt = [hx + 0.04 + swing * 0.04, hy - 0.15];
    const lft: Pt[] = [];
    const rgt: Pt[] = [];
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      const px = (1 - u) * (1 - u) * a0[0] + 2 * u * (1 - u) * a1[0] + u * u * a2[0];
      const py = (1 - u) * (1 - u) * a0[1] + 2 * u * (1 - u) * a1[1] + u * u * a2[1];
      const tx = 2 * (1 - u) * (a1[0] - a0[0]) + 2 * u * (a2[0] - a1[0]);
      const ty = 2 * (1 - u) * (a1[1] - a0[1]) + 2 * u * (a2[1] - a1[1]);
      const n = Math.hypot(tx, ty) || 1;
      const w = lerp(0.012, 0.003, u);
      lft.push([px - (ty / n) * w, py + (tx / n) * w]);
      rgt.push([px + (ty / n) * w, py - (tx / n) * w]);
    }
    shape(c, [...lft, ...rgt.reverse()], false);
  };

  // 꽃 머리핀 — 오른쪽 위(보는 쪽에서), 연보라 꽃 두 송이
  const flowerAt: Pt = [hx + 0.074 * sideK, hy - 0.05];
  const flowerAt2: Pt = [hx + 0.088 * sideK, hy - 0.012];
  const flower = () => {
    for (const [at, r] of [[flowerAt, 0.017], [flowerAt2, 0.012]] as const) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU - Math.PI / 2;
        dot(c, [at[0] + Math.cos(a) * r * 1.15, at[1] + Math.sin(a) * r * 1.15], r);
      }
    }
  };
  const flowerCore = () => {
    dot(c, flowerAt, 0.008);
    dot(c, flowerAt2, 0.006);
  };

  /**
   * 세 가지 칠:
   * - 한 색(잔상·색 그림자): 전부 한 path로 — 반투명에서도 겹친 자리가 진해지지 않는다.
   * - 어두운 실루엣(tint = 윤곽 빛 색): 머리카락에 그 색을 옅게 덧입혀 몸과 한 덩어리로 뭉치지 않게. 더듬이 머리는 노랗게.
   * - 밝게 비춘 아야(lit): 살·옷·머리·꽃을 제 색으로. 얼굴에 눈·입은 그리지 않는다(넣어 보니 어색했다, 2026-11-17).
   */
  const paint = (body: string, lit: AyaColors | null, tint: string | undefined) => {
    c.fillStyle = body;
    if (!aya) {
      picto();
      return;
    }
    const fillPart = (color: string, part: () => void) => {
      c.fillStyle = color;
      c.beginPath();
      part();
      c.fill();
    };
    if (lit) {
      fillPart(lit.hair, hairBack);
      fillPart(lit.skinColor, () => {
        legs();
        chest();
      });
      fillPart(lit.accent, () => {
        shoes();
        petticoat();
      });
      fillPart(body, () => {
        skirt();
        bodice();
      });
      fillPart(lit.accent, () => {
        stripes();
        collar(true);
      });
      fillPart(body, () => collar());
      fillPart(lit.tie, tie);
      fillPart(lit.accent, sash);
      fillPart(lit.skinColor, () => {
        arms();
        headNeck();
      });
      fillPart(body, () => {
        sleeves();
        mic();
      });
      fillPart(lit.accent, cuffs);
      fillPart(lit.hair, hairFront);
      fillPart(lit.accent, ahoge);
      fillPart(lit.flower, flower);
      fillPart(lit.hair, flowerCore);
      return;
    }
    if (!tint) {
      fillPart(body, () => {
        hairBack();
        whole();
        hairFront();
        ahoge();
        flower();
      });
      return;
    }
    const tinted = (color: string, part: () => void, a: number) => {
      c.save();
      c.globalAlpha *= a;
      fillPart(color, part);
      c.restore();
    };
    fillPart(body, hairBack);
    tinted(tint, hairBack, 0.2);
    fillPart(body, whole);
    fillPart(body, () => {
      hairFront();
      ahoge();
      flower();
    });
    tinted(tint, hairFront, 0.2);
    tinted(tint, flower, 0.75);
  };

  if (o.rim) {
    // 윤곽 빛: 그림자를 켜고 한 번, 끄고 한 번 더(안쪽 경계가 빛나지 않게)
    c.save();
    c.shadowColor = o.rim;
    c.shadowBlur = o.rimBlur ?? 16;
    paint(o.rim, null, undefined);
    c.restore();
  }
  // 밝게 비춘 아야는 무대 조명(rim 색)을 받아 옷·머리·살이 그 색으로 물든다 — 공연장 분위기
  const wash = o.lit && o.rim ? (o.wash ?? 0.45) : 0;
  const w = (col: string) => (wash > 0 && o.rim ? washed(col, o.rim, wash) : col);
  const litW: AyaColors | null = o.lit
    ? { hair: w(o.lit.hair), skinColor: w(o.lit.skinColor), accent: w(o.lit.accent), tie: w(o.lit.tie), flower: w(o.lit.flower) }
    : null;
  paint(w(o.color), litW, o.lit ? undefined : o.rim);
  c.restore();

  if (o.hold === 'light' && o.holdColor) {
    const lx = x + (o.flip ? -1 : 1) * j.rhand[0] * h;
    const ly = ground + j.rhand[1] * h;
    glow(c, lx, ly - h * 0.03, h * 0.16, o.holdColor, (o.alpha ?? 1) * 0.9);
    c.save();
    c.globalAlpha *= o.alpha ?? 1;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(lx, ly - h * 0.03, h * 0.022, 0, TAU);
    c.fill();
    c.restore();
  }
}

/** 손 흔들기 — 오른 아래팔만 좌우로 */
export function byePose(t: number, speed = 9): Pose {
  const w = Math.sin(t * speed) * 0.42;
  return { ...POSE.bye, ra: [2.3, 2.85 + w] };
}

export interface FanOpts {
  color: string;
  /** 팔을 든 정도 0~1 */
  raise?: number;
  /** 팔 흔들림(-1~1) */
  sway?: number;
  /** 손에 든 빛 */
  light?: string | null;
  /** 머리·어깨 위 가장자리 빛(무대 쪽에서 오는 역광) */
  rim?: string | null;
  /** 두 팔 다 */
  both?: boolean;
  /** 머리 모양 0 짧은 머리 · 1 단발 · 2 묶은 머리 · 3 양갈래 — 안 주면 자리(x)로 정한다 */
  kind?: number;
}

/** 뒤에서 본 관객(머리·목·처진 어깨·든 팔). (x, y)가 어깨 아래 기준, s가 크기 */
export function fan(c: Ctx, x: number, y: number, s: number, o: FanOpts) {
  const raise = clamp(o.raise ?? 0);
  const sway = o.sway ?? 0;
  const kind = o.kind ?? Math.floor(hash(Math.round(x) * 3.7 + 11) * 4);
  const arm = (side: number): [Pt, Pt, Pt] => {
    const a = side * (0.5 - raise * 0.38) + sway * 0.35 * raise;
    const sh: Pt = [side * 36, -20];
    const el: Pt = [sh[0] + Math.sin(a) * 26, -24 - raise * 34];
    const hd: Pt = [el[0] + Math.sin(a + sway * 0.3) * 34, el[1] - raise * 44 + (1 - raise) * 30];
    return [sh, el, hd];
  };
  const arms: [Pt, Pt, Pt][] = raise > 0.02 ? (o.both ? [arm(1), arm(-1)] : [arm(1)]) : [];
  const body = () => {
    c.beginPath();
    dot(c, [0, -62], 19);
    if (kind === 1) shape(c, [[-22, -66], [-24, -44], [-14, -37], [0, -39], [14, -37], [24, -44], [22, -66], [0, -86]]);
    else if (kind === 2) cap(c, [0, -62], [5 + sway * 5, -20], 9, 3.5);
    else if (kind === 3) {
      // 양갈래 — 귀 옆에서 어깨로 늘어진다
      cap(c, [-17, -68], [-25 + sway * 3, -30], 6.5, 2.5);
      cap(c, [17, -68], [25 + sway * 3, -30], 6.5, 2.5);
    }
    cap(c, [0, -50], [0, -32], 8, 11);
    shape(c, [[-53, 130], [-53, 130], [-45, -6], [-34, -27], [0, -34], [34, -27], [45, -6], [53, 130], [53, 130]]);
    for (const [sh, el, hd] of arms) {
      cap(c, sh, el, 8.5, 7);
      cap(c, el, hd, 7, 5.5);
      dot(c, hd, 7.5);
    }
    c.fill();
  };
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (o.rim) {
    // 같은 모양을 조금 위로 올려 먼저 칠하면 위쪽 가장자리에만 빛이 남는다
    c.save();
    c.translate(0, -2.8);
    c.fillStyle = o.rim;
    body();
    c.restore();
  }
  c.fillStyle = o.color;
  body();
  c.restore();
  const hand = arms.length ? arms[0][2] : null;
  if (hand && o.light) {
    const gx = x + hand[0] * s;
    const gy = y + (hand[1] - 16) * s;
    glow(c, gx, gy, 46 * s, o.light, 0.85 * raise);
    c.save();
    c.strokeStyle = '#ffffff';
    c.globalAlpha *= raise;
    c.lineCap = 'round';
    c.lineWidth = 5 * s;
    c.beginPath();
    c.moveTo(x + hand[0] * s, y + hand[1] * s);
    c.lineTo(gx + sway * 6 * s, gy - 14 * s);
    c.stroke();
    c.restore();
  }
}
