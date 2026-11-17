// 踊 인물 — 관절 각도로 서는 사람. 같은 뼈대에 두 가지 옷: 픽토그램(비상구 표지의 사람)과 아야 실루엣(긴 머리·치마).
// 각도는 '아래가 0, 오른쪽(+x)으로 벌어지면 +, 위는 ±π'. 좌표 단위는 키(h) 비율, 발 닿는 바닥이 원점.
import { TAU, clamp, easeOutCubic, lerp } from '../../engine';
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
  sit: P({ lean: 0.22, la: [0.5, 2.5], ra: [0.3, 1.2], ll: [1.45, 0.05], rl: [1.5, 0.12], head: 0.18 }),
  /** 고개를 듦 */
  lookUp: P({ head: -0.45, la: [-0.25, -0.15], ra: [0.25, 0.15] }),
} as const;

/** 춤 동작 묶음 — 박마다 하나씩 */
export const DANCE: Pose[] = [POSE.point, POSE.waveL, POSE.vee, POSE.low, POSE.pointL, POSE.waveR, POSE.tee, POSE.disco];
export const DANCE2: Pose[] = [POSE.disco, POSE.hips, POSE.discoL, POSE.armsUp, POSE.low, POSE.vee, POSE.waveR, POSE.waveL];

const mix2 = (a: [number, number], b: [number, number], k: number): [number, number] => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

export function mixPose(a: Pose, b: Pose, k: number): Pose {
  if (k <= 0) return a;
  if (k >= 1) return b;
  return {
    lean: lerp(a.lean, b.lean, k),
    air: lerp(a.air, b.air, k),
    la: mix2(a.la, b.la, k),
    ra: mix2(a.ra, b.ra, k),
    ll: mix2(a.ll, b.ll, k),
    rl: mix2(a.rl, b.rl, k),
    head: lerp(a.head, b.head, k),
    fold: lerp(a.fold, b.fold, k),
  };
}

/** 박 위치(pos, 소수)에서의 춤 — 박이 떨어지자마자 다음 동작으로 탁 넘어간다(snap=넘어가는 데 쓰는 박 비율) */
export function danceAt(seq: Pose[], pos: number, snap = 0.3): Pose {
  const n = seq.length;
  const i = Math.floor(pos);
  const f = pos - i;
  const cur = seq[((i % n) + n) % n];
  if (f >= snap) return cur;
  return mixPose(seq[(((i - 1) % n) + n) % n], cur, easeOutCubic(f / snap));
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
  };
}

export interface FigureOpts {
  skin?: 'picto' | 'aya';
  color: string;
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

interface Joints {
  hip: [number, number];
  neck: [number, number];
  head: [number, number];
  ls: [number, number];
  rs: [number, number];
  le: [number, number];
  re: [number, number];
  lh: [number, number];
  rh: [number, number];
  lhip: [number, number];
  rhip: [number, number];
  lk: [number, number];
  rk: [number, number];
  lf: [number, number];
  rf: [number, number];
}

const dir = (a: number, len: number): [number, number] => [Math.sin(a) * len, Math.cos(a) * len];

/** 관절 위치(키 = 1, 바닥 y = 0, 위가 음수) */
export function joints(p: Pose, aya = false): Joints {
  const hipW = aya ? 0.04 : 0.055;
  const shW = aya ? 0.07 : 0.085;
  const thigh = 0.25;
  const shin = 0.25;
  const upper = 0.16;
  const fore = 0.16;
  const leg = (side: number, a: [number, number]) => {
    const k = dir(a[0], thigh);
    const f = dir(a[1], shin);
    return { k: [side * hipW + k[0], k[1]] as [number, number], f: [side * hipW + k[0] + f[0], k[1] + f[1]] as [number, number] };
  };
  const L = leg(-1, p.ll);
  const R = leg(1, p.rl);
  // 낮은 쪽 발이 바닥에 닿게 엉덩이 높이를 정한다
  const hipY = -Math.max(L.f[1], R.f[1], 0.12) - p.air;
  const torso = 0.3 * (1 - 0.55 * p.fold);
  const up: [number, number] = [Math.sin(p.lean), -Math.cos(p.lean)];
  const side: [number, number] = [Math.cos(p.lean), Math.sin(p.lean)];
  const neck: [number, number] = [up[0] * torso, hipY + up[1] * torso];
  const headUp = 0.105 * (1 - 0.5 * p.fold);
  const head: [number, number] = [neck[0] + Math.sin(p.lean + p.head) * headUp, neck[1] - Math.cos(p.lean + p.head) * headUp + 0.05 * p.fold];
  const ls: [number, number] = [neck[0] - side[0] * shW, neck[1] - side[1] * shW + 0.02];
  const rs: [number, number] = [neck[0] + side[0] * shW, neck[1] + side[1] * shW + 0.02];
  const le0 = dir(p.la[0], upper);
  const lh0 = dir(p.la[1], fore);
  const re0 = dir(p.ra[0], upper);
  const rh0 = dir(p.ra[1], fore);
  const le: [number, number] = [ls[0] + le0[0], ls[1] + le0[1]];
  const re: [number, number] = [rs[0] + re0[0], rs[1] + re0[1]];
  return {
    hip: [0, hipY],
    neck,
    head,
    ls,
    rs,
    le,
    re,
    lh: [le[0] + lh0[0], le[1] + lh0[1]],
    rh: [re[0] + rh0[0], re[1] + rh0[1]],
    lhip: [-hipW, hipY],
    rhip: [hipW, hipY],
    lk: [L.k[0], hipY + L.k[1]],
    rk: [R.k[0], hipY + R.k[1]],
    lf: [L.f[0], hipY + L.f[1]],
    rf: [R.f[0], hipY + R.f[1]],
  };
}

/** 사람 한 명. (x, ground)가 발 닿는 바닥, h가 키 */
export function figure(c: Ctx, x: number, ground: number, h: number, pose: Pose, o: FigureOpts) {
  const aya = o.skin === 'aya';
  const j = joints(pose, aya);
  const swing = o.swing ?? 0;
  c.save();
  c.translate(x, ground);
  if (o.flip) c.scale(-1, 1);
  c.scale(h, h);
  c.globalAlpha *= o.alpha ?? 1;
  c.lineCap = 'round';
  c.lineJoin = 'round';

  const line = (a: [number, number], b: [number, number], m: [number, number], w: number) => {
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(m[0], m[1]);
    c.lineTo(b[0], b[1]);
    c.stroke();
  };

  const paint = () => {
    if (aya) {
      // 뒷머리 — 머리에서 허리 아래까지, 몸이 기울면 늦게 따라온다
      const hx = j.head[0];
      const hy = j.head[1];
      const lag = -pose.lean * 0.22 + swing * 0.09;
      const bottom = j.hip[1] + 0.07;
      c.beginPath();
      c.moveTo(hx - 0.072, hy - 0.03);
      c.bezierCurveTo(hx - 0.105, hy + 0.07, hx - 0.085 + lag * 0.4, bottom - 0.2, hx - 0.115 + lag, bottom);
      c.quadraticCurveTo(hx - 0.055 + lag, bottom - 0.03, hx + lag, bottom + 0.014);
      c.quadraticCurveTo(hx + 0.055 + lag, bottom - 0.03, hx + 0.115 + lag, bottom);
      c.bezierCurveTo(hx + 0.085 + lag * 0.4, bottom - 0.2, hx + 0.105, hy + 0.07, hx + 0.072, hy - 0.03);
      c.closePath();
      c.fill();
    }
    // 다리
    const legW = aya ? 0.052 : 0.088;
    line(j.lhip, j.lf, j.lk, legW);
    line(j.rhip, j.rf, j.rk, legW);
    // 몸통
    if (aya) {
      const waist: [number, number] = [lerp(j.hip[0], j.neck[0], 0.42), lerp(j.hip[1], j.neck[1], 0.42)];
      c.beginPath();
      c.moveTo(j.ls[0], j.ls[1]);
      c.lineTo(j.rs[0], j.rs[1]);
      c.lineTo(waist[0] + 0.045, waist[1]);
      c.lineTo(waist[0] - 0.045, waist[1]);
      c.closePath();
      c.fill();
      c.lineWidth = 0.03;
      c.stroke();
      // 치마 — 허리에서 퍼지고 자락이 쏠린다
      const hem = j.hip[1] + 0.15;
      const sw = swing * 0.05 - pose.lean * 0.1;
      c.beginPath();
      c.moveTo(waist[0] - 0.05, waist[1]);
      c.lineTo(waist[0] + 0.05, waist[1]);
      c.quadraticCurveTo(j.hip[0] + 0.15, j.hip[1] + 0.01, j.hip[0] + 0.205 + sw, hem);
      c.quadraticCurveTo(j.hip[0] + sw, hem + 0.035, j.hip[0] - 0.205 + sw, hem);
      c.quadraticCurveTo(j.hip[0] - 0.15, j.hip[1] + 0.01, waist[0] - 0.05, waist[1]);
      c.closePath();
      c.fill();
    } else {
      c.beginPath();
      c.moveTo(j.ls[0], j.ls[1]);
      c.lineTo(j.rs[0], j.rs[1]);
      c.lineTo(j.rhip[0] + 0.012, j.rhip[1]);
      c.lineTo(j.lhip[0] - 0.012, j.lhip[1]);
      c.closePath();
      c.fill();
      c.lineWidth = 0.06;
      c.stroke();
    }
    // 팔
    const armW = aya ? 0.038 : 0.066;
    line(j.ls, j.lh, j.le, armW);
    line(j.rs, j.rh, j.re, armW);
    // 머리
    c.beginPath();
    c.arc(j.head[0], j.head[1], aya ? 0.078 : 0.082, 0, TAU);
    c.fill();
    if (aya) {
      // 더듬이 머리
      c.lineWidth = 0.014;
      c.beginPath();
      c.moveTo(j.head[0] - 0.01, j.head[1] - 0.07);
      c.quadraticCurveTo(j.head[0] - 0.05 + swing * 0.02, j.head[1] - 0.16, j.head[0] + 0.03 + swing * 0.03, j.head[1] - 0.13);
      c.stroke();
    }
    if (o.hold === 'mic') {
      c.lineWidth = 0.022;
      c.beginPath();
      c.moveTo(j.rh[0], j.rh[1]);
      c.lineTo(j.rh[0] - 0.015, j.rh[1] - 0.07);
      c.stroke();
      c.beginPath();
      c.arc(j.rh[0] - 0.02, j.rh[1] - 0.09, 0.03, 0, TAU);
      c.fill();
    }
  };

  c.fillStyle = o.color;
  c.strokeStyle = o.color;
  if (o.rim) {
    // 윤곽 빛: 그림자를 켜고 한 번, 끄고 한 번 더(안쪽 경계가 빛나지 않게)
    c.save();
    c.shadowColor = o.rim;
    c.shadowBlur = o.rimBlur ?? 16;
    c.fillStyle = o.rim;
    c.strokeStyle = o.rim;
    paint();
    c.restore();
  }
  paint();
  c.restore();

  if (o.hold === 'light' && o.holdColor) {
    const hx = x + (o.flip ? -1 : 1) * j.rh[0] * h;
    const hy = ground + j.rh[1] * h;
    glow(c, hx, hy - h * 0.03, h * 0.16, o.holdColor, (o.alpha ?? 1) * 0.9);
    c.save();
    c.globalAlpha *= o.alpha ?? 1;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(hx, hy - h * 0.03, h * 0.022, 0, TAU);
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
  /** 머리·어깨 위 가장자리 빛 */
  rim?: string | null;
  /** 두 팔 다 */
  both?: boolean;
}

/** 뒤에서 본 관객(머리·어깨·든 팔). (x, y)가 어깨 아래 기준, s가 크기 */
export function fan(c: Ctx, x: number, y: number, s: number, o: FanOpts) {
  const raise = clamp(o.raise ?? 0);
  const sway = o.sway ?? 0;
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.lineCap = 'round';
  if (o.rim) {
    c.fillStyle = o.rim;
    c.beginPath();
    c.arc(0, -63, 21, 0, TAU);
    c.fill();
    c.beginPath();
    c.ellipse(0, -5, 46, 38, 0, Math.PI, TAU);
    c.rect(-46, -6, 92, 62);
    c.fill();
  }
  c.fillStyle = o.color;
  c.strokeStyle = o.color;
  c.beginPath();
  c.arc(0, -62, 18, 0, TAU);
  c.fill();
  c.beginPath();
  c.ellipse(0, -4, 42, 34, 0, Math.PI, TAU);
  c.rect(-42, -5, 84, 60);
  c.fill();
  const arm = (side: number) => {
    const a = side * (0.5 - raise * 0.38) + sway * 0.35 * raise;
    const ex = side * 34 + Math.sin(a) * 26;
    const ey = -26 - raise * 34;
    const hx = ex + Math.sin(a + sway * 0.3) * 34;
    const hy = ey - raise * 44 + (1 - raise) * 30;
    c.lineWidth = 13;
    c.beginPath();
    c.moveTo(side * 34, -22);
    c.lineTo(ex, ey);
    c.lineTo(hx, hy);
    c.stroke();
    return [hx, hy] as const;
  };
  let hand: readonly [number, number] | null = null;
  if (raise > 0.02) {
    hand = arm(1);
    if (o.both) arm(-1);
  }
  c.restore();
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
