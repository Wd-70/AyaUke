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
  /** 아야 머리카락 색 — 주면 머리와 몸이 두 색으로 나뉜다(밝게 비춘 아야). 없으면 한 색 실루엣 */
  hair?: string;
  /** 아야 꽃 머리핀 색 — 없으면 실루엣에 붙은 꽃 모양만 */
  accent?: string;
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

/** 밝게 비춘 아야의 두 색 — 흰 몸에 라벤더 머리, 분홍 꽃핀. `figure(..., { skin: 'aya', color: NEON.white, ...AYA_LIT })` */
export const AYA_LIT = { hair: '#b99cf7', accent: '#ff4f9a' } as const;

type Pt = [number, number];

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
  const ls: Pt = [neck[0] - side[0] * shW, neck[1] - side[1] * shW + 0.02];
  const rs: Pt = [neck[0] + side[0] * shW, neck[1] + side[1] * shW + 0.02];
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
    const bottom = Math.min(hy + 0.5, -0.07);
    const len = bottom - hy;
    const wB = 0.15;
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

  const ayaBody = () => {
    // 다리·구두
    for (const [hp, k, f, t] of [[j.lhip, j.lk, j.lf, j.lt], [j.rhip, j.rk, j.rf, j.rt]] as const) {
      cap(c, hp, k, 0.036, 0.027);
      cap(c, k, f, 0.027, 0.019);
      cap(c, f, t, 0.022, 0.015);
    }
    // 몸판 — 어깨선에서 잘록한 허리로
    shape(c, [[j.ls[0] - sd[0] * 0.016, j.ls[1] - sd[1] * 0.016], [j.rs[0] + sd[0] * 0.016, j.rs[1] + sd[1] * 0.016], wr, wl], false);
    cap(c, j.ls, j.rs, 0.026, 0.026);
    cap(c, wl, wr, 0.012, 0.012);
    // 치마 — 허리에서 종 모양으로 퍼지고, 다리를 벌리거나 몸을 낮추면 더 퍼진다. 자락이 늦게 따라온다
    const hem = j.hip[1] + 0.185;
    const sw = swing * 0.05 - pose.lean * 0.09 - face * 0.02;
    const flare = (pose.dip ?? 0) * 1.4 + Math.abs(swing) * 0.02;
    const hl = Math.max(0.165 * lerp(1, 0.8, face), j.hip[0] - j.lk[0] + 0.075) + flare;
    const hr = Math.max(0.165 * lerp(1, 0.8, face), j.rk[0] - j.hip[0] + 0.075) + flare;
    const pts: Pt[] = [wl, wl, wr, wr, [j.hip[0] + 0.1 + flare * 0.5, j.hip[1] + 0.02]];
    const x0 = j.hip[0] + hr + sw;
    const x1 = j.hip[0] - hl + sw;
    const frills = 6;
    pts.push([x0, hem], [x0, hem]);
    for (let i = 0; i < frills; i++) {
      const a = lerp(x0, x1, (i + 0.5) / frills);
      const b = lerp(x0, x1, (i + 1) / frills);
      const sag = 0.026 + 0.012 * Math.sin(i * 1.7 + swing * 2);
      pts.push([a, hem + sag], [b, hem + 0.006 * Math.sin(i * 2.3)], [b, hem + 0.006 * Math.sin(i * 2.3)]);
    }
    pts.push([j.hip[0] - 0.1 - flare * 0.5, j.hip[1] + 0.02]);
    shape(c, pts);
    // 팔 — 어깨 아래 소매 주름, 가는 팔, 손
    for (const [s, e, w, hd] of [[j.ls, j.le, j.lh, j.lhand], [j.rs, j.re, j.rh, j.rhand]] as const) {
      cap(c, s, [lerp(s[0], e[0], 0.42), lerp(s[1], e[1], 0.42)], 0.03, 0.036);
      cap(c, s, e, 0.026, 0.021);
      cap(c, e, w, 0.021, 0.016);
      dot(c, hd, 0.021);
    }
    // 목·얼굴(턱이 갸름하게)
    cap(c, j.neck, j.head, 0.02, 0.02);
    cap(c, j.head, [hx + face * 0.025, hy + 0.044], 0.068, 0.034);
    mic();
  };

  const hairFront = () => {
    // 정수리에서 이마까지 덮는 머리 — 앞머리 끝이 지그재그
    const b = (dx: number, dy: number): Pt => [hx + dx, hy + dy];
    shape(c, [
      b(-0.084, 0.03), b(-0.09, -0.035), b(-0.058, -0.088), b(0, -0.1), b(0.058, -0.088), b(0.09, -0.035), b(0.084, 0.03),
      b(0.07, 0.004), b(0.07, 0.004), b(0.052, -0.03), b(0.03, 0), b(0.03, 0), b(0.004, -0.034), b(-0.022, 0), b(-0.022, 0),
      b(-0.05, -0.03), b(-0.07, 0.004), b(-0.07, 0.004),
    ]);
    // 옆머리 — 얼굴 옆에서 가슴 앞으로 흘러내림
    for (const s of [-1, 1]) {
      const k = s * sideK;
      const tip: Pt = [hx + k * 0.082 + lag * 0.55, hy + 0.3];
      shape(c, [
        [hx + k * 0.066, hy - 0.02], [hx + k * 0.1, hy + 0.05], [hx + k * 0.096 + lag * 0.3, hy + 0.19], tip, tip,
        [hx + k * 0.072 + lag * 0.3, hy + 0.2], [hx + k * 0.068, hy + 0.06],
      ]);
    }
    // 더듬이 머리 — 정수리에서 휘어 올라가는 한 가닥
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
      const w = lerp(0.011, 0.002, u);
      lft.push([px - (ty / n) * w, py + (tx / n) * w]);
      rgt.push([px + (ty / n) * w, py - (tx / n) * w]);
    }
    shape(c, [...lft, ...rgt.reverse()], false);
  };

  const flowerAt: Pt = [hx + 0.074 * sideK, hy - 0.05];
  const flower = (r: number) => {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      dot(c, [flowerAt[0] + Math.cos(a) * r * 1.15, flowerAt[1] + Math.sin(a) * r * 1.15], r);
    }
  };

  /**
   * tint: 어두운 실루엣일 때 머리카락에 윤곽 빛 색을 옅게 덧입힌다 — 머리와 몸이 한 덩어리로 뭉치지 않게.
   * hair를 주면(밝게 비춘 아야) 머리·몸·꽃이 제 색으로 나뉘고 눈과 허리끈이 생긴다.
   */
  const paint = (body: string, hair: string | undefined, accent: string | undefined, tint: string | undefined) => {
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
    const tinted = (part: () => void, a: number) => {
      if (!tint) return;
      c.save();
      c.globalAlpha *= a;
      fillPart(tint, part);
      c.restore();
    };
    if (!hair && !tint) {
      // 한 색 실루엣: 전부 한 path로(반투명 잔상에서도 겹친 자리가 진해지지 않게)
      fillPart(body, () => {
        hairBack();
        ayaBody();
        hairFront();
        flower(0.017);
      });
    } else {
      fillPart(hair ?? body, hairBack);
      tinted(hairBack, 0.2);
      fillPart(body, ayaBody);
      fillPart(hair ?? body, () => {
        hairFront();
        if (!accent) flower(0.017);
      });
      tinted(hairFront, 0.2);
      if (!accent) tinted(() => flower(0.017), 0.75);
    }
    if (hair) {
      // 눈 — 점 두 개. 허리끈
      fillPart('#4a3a86', () => {
        for (const sx of [-1, 1]) {
          const ex = hx + sx * 0.03 * sideK + face * 0.03;
          c.moveTo(ex + 0.009, hy + 0.027);
          c.ellipse(ex, hy + 0.027, 0.009, 0.014, 0, 0, TAU);
          c.closePath();
        }
      });
      fillPart(accent ?? hair, () => cap(c, wl, wr, 0.013, 0.013));
    }
    if (accent) {
      fillPart(accent, () => flower(0.017));
      fillPart('#ffffff', () => dot(c, flowerAt, 0.009));
    }
  };

  if (o.rim) {
    // 윤곽 빛: 그림자를 켜고 한 번, 끄고 한 번 더(안쪽 경계가 빛나지 않게)
    c.save();
    c.shadowColor = o.rim;
    c.shadowBlur = o.rimBlur ?? 16;
    paint(o.rim, undefined, undefined, undefined);
    c.restore();
  }
  paint(o.color, o.hair, o.accent, o.hair ? undefined : o.rim);
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
