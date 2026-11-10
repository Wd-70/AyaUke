// 아야 실루엣 캐릭터(정면) — 라벤더 긴 머리, 귀 달린 검은 베레모, 붉은 오프숄더, 하트 자물쇠 초커.
// 방송 아바타 디자인을 단순화한 MV용 캐릭터. 좌표 단위는 키(h) 비율, 발 중심 원점.
import { TAU } from './engine';

type Ctx = CanvasRenderingContext2D;

const HAIR_TOP = '#cdb8f2';
const HAIR_BOTTOM = '#8a6cc4';
const HAIR_SIDE = '#ab93e0';
const SKIN = '#f6e1dc';
const BERET = '#17121d';
const TOP = '#e3383f';
const TOP_SHADE = '#b52a35';
const DARK = '#1b1522';
const HEART = '#ff5f7e';

export interface AyaOpts {
  /** 초 — 머리카락 흔들림 */
  t: number;
  /** 걷기 위상(라디안). 0이면 서 있음 */
  walk?: number;
  /** 하트 펜던트 빛 (0~1) */
  heart?: number;
  /** 바람(머리카락 쏠림, -1~1) */
  wind?: number;
  /** 윤곽 빛 색 */
  rim?: string;
}

export function drawAya(c: Ctx, x: number, ground: number, h: number, o: AyaOpts) {
  const walking = !!o.walk;
  const step = walking ? Math.sin(o.walk!) : 0;
  const bob = walking ? Math.abs(Math.cos(o.walk!)) * 0.012 * h : 0;
  const sway = Math.sin(o.t * 1.4) * 0.01 + (o.wind ?? 0) * 0.03;
  const X = (u: number) => u * h;
  const Y = (v: number) => -v * h - bob;
  const poly = (pts: [number, number][]) => {
    c.beginPath();
    pts.forEach(([u, v], i) => (i ? c.lineTo(X(u), Y(v)) : c.moveTo(X(u), Y(v))));
    c.closePath();
    c.fill();
  };

  c.save();
  c.translate(x, ground);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (o.rim) {
    c.shadowColor = o.rim;
    c.shadowBlur = 8;
  }

  // 뒷머리 — 어깨보다 넓게 퍼져 허리 아래까지, 끝이 물결치며 흔들린다
  const hairGrad = c.createLinearGradient(0, Y(0.95), 0, Y(0.4));
  hairGrad.addColorStop(0, HAIR_TOP);
  hairGrad.addColorStop(1, HAIR_BOTTOM);
  c.fillStyle = hairGrad;
  c.beginPath();
  c.moveTo(X(-0.085), Y(0.92));
  c.bezierCurveTo(X(-0.15), Y(0.84), X(-0.165 + sway), Y(0.6), X(-0.16 + sway * 1.6), Y(0.42));
  const tips = 6;
  for (let i = 0; i < tips; i++) {
    const u0 = -0.16 + (i / tips) * 0.32 + sway * 1.6;
    const u1 = -0.16 + ((i + 1) / tips) * 0.32 + sway * 1.6;
    c.quadraticCurveTo(X((u0 + u1) / 2), Y(0.37 + (i % 2) * 0.025), X(u1), Y(0.42));
  }
  c.bezierCurveTo(X(0.165 + sway), Y(0.6), X(0.15), Y(0.84), X(0.085), Y(0.92));
  c.closePath();
  c.fill();
  c.shadowColor = 'transparent';

  // 다리(검은 스타킹, 허벅지→발목으로 가늘어짐) + 짧은 부츠
  c.fillStyle = DARK;
  for (const side of [-1, 1]) {
    const lift = walking ? Math.max(0, side * step) * 0.03 : 0;
    const k = side;
    poly([[k * 0.012, 0.42], [k * 0.068, 0.42], [k * 0.056, 0.2 + lift], [k * 0.05, 0.06 + lift], [k * 0.026, 0.06 + lift], [k * 0.018, 0.2 + lift]]);
    c.fillStyle = '#0c0a10';
    poly([[k * 0.022, 0.1 + lift], [k * 0.056, 0.1 + lift], [k * 0.06, 0.012 + lift], [k * 0.068, lift], [k * 0.016, lift]]);
    c.fillStyle = DARK;
  }

  // 치마 (주름)
  poly([[-0.068, 0.555], [0.068, 0.555], [0.122, 0.395], [-0.122, 0.395]]);
  c.strokeStyle = 'rgba(255,255,255,0.08)';
  c.lineWidth = 1;
  for (const u of [-0.07, -0.025, 0.025, 0.07]) {
    c.beginPath();
    c.moveTo(X(u * 0.55), Y(0.55));
    c.lineTo(X(u), Y(0.4));
    c.stroke();
  }

  // 팔(피부)
  c.strokeStyle = SKIN;
  c.lineWidth = 0.03 * h;
  for (const side of [-1, 1]) {
    const swing = walking ? -side * step * 0.02 : 0;
    c.beginPath();
    c.moveTo(X(side * 0.09), Y(0.7));
    c.quadraticCurveTo(X(side * 0.112), Y(0.6), X(side * 0.104 + swing), Y(0.48));
    c.stroke();
  }

  // 붉은 오프숄더 상의 + 작은 퍼프 소매
  c.fillStyle = TOP;
  poly([[-0.092, 0.7], [0.092, 0.7], [0.078, 0.63], [0.068, 0.55], [-0.068, 0.55], [-0.078, 0.63]]);
  c.fillStyle = TOP_SHADE;
  for (const side of [-1, 1]) {
    c.beginPath();
    c.ellipse(X(side * 0.098), Y(0.683), 0.02 * h, 0.024 * h, side * 0.4, 0, TAU);
    c.fill();
  }
  c.fillStyle = TOP_SHADE;
  poly([[-0.068, 0.565], [0.068, 0.565], [0.068, 0.55], [-0.068, 0.55]]);

  // 어깨·쇄골·목(피부)
  c.fillStyle = SKIN;
  c.beginPath();
  c.moveTo(X(-0.09), Y(0.703));
  c.quadraticCurveTo(X(0), Y(0.728), X(0.09), Y(0.703));
  c.lineTo(X(0.05), Y(0.745));
  c.lineTo(X(-0.05), Y(0.745));
  c.closePath();
  c.fill();
  c.fillRect(X(-0.017), Y(0.785), 0.034 * h, 0.045 * h);
  // 초커 + 하트 자물쇠
  c.fillStyle = '#0c0a10';
  c.fillRect(X(-0.023), Y(0.77), 0.046 * h, 0.011 * h);
  const glow = o.heart ?? 0;
  c.save();
  c.fillStyle = HEART;
  c.shadowColor = HEART;
  c.shadowBlur = 4 + glow * 22;
  const hs = 0.012 * h * (1 + glow * 0.5);
  const hy = Y(0.75);
  c.beginPath();
  c.moveTo(0, hy + hs);
  c.bezierCurveTo(-hs * 1.6, hy - hs * 0.2, -hs * 0.6, hy - hs * 1.3, 0, hy - hs * 0.5);
  c.bezierCurveTo(hs * 0.6, hy - hs * 1.3, hs * 1.6, hy - hs * 0.2, 0, hy + hs);
  c.fill();
  c.restore();

  // 얼굴 (작은 키에서도 읽히도록 머리를 크게)
  const fy = 0.845;
  c.fillStyle = SKIN;
  c.beginPath();
  c.ellipse(0, Y(fy), 0.074 * h, 0.084 * h, 0, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(255,140,160,0.35)';
  for (const side of [-1, 1]) {
    c.beginPath();
    c.ellipse(X(side * 0.042), Y(fy - 0.03), 0.014 * h, 0.007 * h, 0, 0, TAU);
    c.fill();
  }
  c.fillStyle = '#4a2f6e';
  for (const side of [-1, 1]) {
    c.beginPath();
    c.ellipse(X(side * 0.028), Y(fy - 0.008), 0.009 * h, 0.013 * h, 0, 0, TAU);
    c.fill();
  }

  // 앞머리
  c.fillStyle = HAIR_TOP;
  c.beginPath();
  c.moveTo(X(-0.086), Y(fy - 0.02));
  c.quadraticCurveTo(X(-0.095), Y(fy + 0.1), X(0), Y(fy + 0.105));
  c.quadraticCurveTo(X(0.095), Y(fy + 0.1), X(0.086), Y(fy - 0.02));
  for (const u of [0.062, 0.031, 0.0, -0.031, -0.062]) {
    c.lineTo(X(u + 0.013), Y(fy + 0.045));
    c.lineTo(X(u - 0.006), Y(fy + 0.02));
  }
  c.closePath();
  c.fill();
  // 옆머리 — 얼굴 옆에서 어깨 앞으로 가늘게 흘러내림
  c.fillStyle = HAIR_SIDE;
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(X(side * 0.07), Y(fy + 0.06));
    c.quadraticCurveTo(X(side * 0.1), Y(fy - 0.06), X(side * 0.088 + sway), Y(0.62));
    c.lineTo(X(side * 0.07 + sway), Y(0.64));
    c.quadraticCurveTo(X(side * 0.078), Y(fy - 0.06), X(side * 0.056), Y(fy + 0.03));
    c.closePath();
    c.fill();
  }

  // 귀 달린 검은 베레모
  c.fillStyle = BERET;
  const by = fy + 0.09;
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(X(side * 0.028), Y(by + 0.015));
    c.quadraticCurveTo(X(side * 0.072), Y(by + 0.095), X(side * 0.085), Y(by + 0.04));
    c.lineTo(X(side * 0.078), Y(by + 0.005));
    c.closePath();
    c.fill();
  }
  c.beginPath();
  c.ellipse(X(0.01), Y(by), 0.1 * h, 0.04 * h, -0.12, 0, TAU);
  c.fill();
  c.restore();
}
