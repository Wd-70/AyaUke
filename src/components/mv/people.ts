// 군중 드로잉 — 옆모습으로 걷는 행인 / 정면 관객. 모든 MV에서 재사용.
// 좌표 단위는 키(h) 비율. 발 중심이 원점, 위쪽이 -y.
import { TAU } from './engine';

type Ctx = CanvasRenderingContext2D;

export type Outfit = 'coat' | 'jacket' | 'skirt' | 'hoodie';
export type Hair = 'short' | 'long' | 'bun' | 'cap' | 'ponytail';
export type Prop = 'none' | 'bag' | 'phone' | 'backpack';

export interface PedestrianStyle {
  /** 체격(가로 배율) */
  build: number;
  outfit: Outfit;
  hair: Hair;
  prop: Prop;
  /** 비 올 때 드는 우산 (없으면 그냥 맞는다) */
  umbrella: 'dark' | 'clear' | null;
}

function pick<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

export function pickPedestrianStyle(r: () => number): PedestrianStyle {
  const u = r();
  return {
    build: 0.88 + r() * 0.26,
    outfit: pick<Outfit>(r, ['coat', 'coat', 'jacket', 'skirt', 'hoodie']),
    hair: pick<Hair>(r, ['short', 'short', 'long', 'bun', 'cap', 'ponytail']),
    prop: pick<Prop>(r, ['none', 'none', 'bag', 'phone', 'backpack']),
    umbrella: u < 0.34 ? 'dark' : u < 0.48 ? 'clear' : null,
  };
}

/** '#rrggbb'를 k배 밝기로 (hex가 아니면 그대로) */
export function shade(hex: string, k: number): string {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export interface PedestrianPaint {
  body: string;
  /** 도시 불빛이 실루엣 윗가장자리에 닿는 림 라이트. null이면 생략(먼 군중) */
  rim: string | null;
  raining: boolean;
}

/**
 * 옆모습 행인. facing 1=오른쪽, -1=왼쪽. phase는 보행 주기(라디안).
 * 다리 길이로 골반 높이를 정해 디딤발이 항상 땅에 닿는다.
 */
export function drawPedestrian(
  c: Ctx, x: number, ground: number, h: number, facing: number, phase: number,
  st: PedestrianStyle, paint: PedestrianPaint,
) {
  const L = 0.25 * h;
  const legs = [0, 1].map((i) => {
    const p = phase + i * Math.PI;
    const th = 0.42 * Math.sin(p);
    const bend = 0.08 + 0.6 * Math.max(0, Math.cos(p));
    return { th, bend, ext: L * Math.cos(th) + L * Math.cos(th - bend) };
  });
  const hip = -(Math.max(legs[0].ext, legs[1].ext) + 0.014 * h);
  const b = st.build;
  /** 골반 기준 좌표(위로 v) → 캔버스 좌표 */
  const X = (u: number) => u * h * b;
  const Y = (v: number) => hip - v * h;
  const umbrella = paint.raining && st.umbrella;
  const looking = st.prop === 'phone' && !umbrella;

  c.save();
  c.translate(x, ground);
  c.scale(facing, 1);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  // 림 라이트: 실루엣 전체를 림 색으로 살짝 위·뒤로 어긋나게 먼저 그리고, 본체로 덮는다(바깥 윤곽에만 빛)
  if (paint.rim) {
    c.save();
    c.translate(-1 * facing, -1.5);
    draw(paint.rim, paint.rim, true);
    c.restore();
  }
  draw(paint.body, shade(paint.body, 0.78), false);
  c.restore();

  function draw(body: string, far: string, rimPass: boolean) {
    const leg = (i: number, color: string) => {
      const { th, bend } = legs[i];
      const hx = (i === 0 ? 0.006 : -0.006) * h;
      const kx = hx + L * Math.sin(th);
      const ky = hip + L * Math.cos(th);
      const ax = kx + L * Math.sin(th - bend);
      const ay = ky + L * Math.cos(th - bend);
      c.strokeStyle = color;
      c.lineWidth = 0.082 * h;
      c.beginPath();
      c.moveTo(hx, hip);
      c.lineTo(kx, ky);
      c.stroke();
      c.lineWidth = 0.062 * h;
      c.beginPath();
      c.moveTo(kx, ky);
      c.lineTo(ax, ay);
      c.stroke();
      c.lineWidth = 0.045 * h;
      c.beginPath();
      c.moveTo(ax - 0.01 * h, ay);
      c.lineTo(ax + 0.065 * h, ay + 0.004 * h);
      c.stroke();
    };

    const arm = (swing: number, color: string) => {
      const sx = X(0.0);
      const sy = Y(0.285);
      const ex = sx + 0.165 * h * Math.sin(swing);
      const ey = sy + 0.165 * h * Math.cos(swing);
      const fa = swing + 0.35;
      const hx = ex + 0.15 * h * Math.sin(fa);
      const hy = ey + 0.15 * h * Math.cos(fa);
      c.strokeStyle = color;
      c.lineWidth = 0.052 * h;
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(ex, ey);
      c.lineTo(hx, hy);
      c.stroke();
      return [hx, hy] as const;
    };

    const poly = (pts: [number, number][], color: string) => {
      c.fillStyle = color;
      c.beginPath();
      pts.forEach(([u, v], i) => (i ? c.lineTo(X(u), Y(v)) : c.moveTo(X(u), Y(v))));
      c.closePath();
      c.fill();
    };

    // 먼 쪽 팔·다리 (어둡게)
    const farHand = arm(0.38 * Math.sin(phase), far);
    if (st.prop === 'bag') {
      c.fillStyle = far;
      c.fillRect(farHand[0] - 0.045 * h, farHand[1] - 0.01 * h, 0.09 * h, 0.075 * h);
    }
    leg(1, far);
    if (st.prop === 'backpack') poly([[-0.14, 0.27], [-0.05, 0.29], [-0.05, 0.06], [-0.14, 0.08]], body);

    // 몸통 + 가까운 다리
    leg(0, body);
    poly([[-0.07, 0.3], [0.055, 0.3], [0.085, 0.22], [0.07, 0.1], [0.066, 0], [-0.07, 0], [-0.082, 0.15]], body);
    const flutter = 0.012 * Math.sin(phase * 2);
    if (st.outfit === 'coat') poly([[0.074, 0.12], [0.092 + flutter, -0.23], [-0.105 + flutter, -0.23], [-0.082, 0.12]], body);
    if (st.outfit === 'skirt') poly([[0.07, 0.07], [0.105 + flutter, -0.15], [-0.105 + flutter, -0.15], [-0.072, 0.07]], body);

    // 목·머리
    c.strokeStyle = body;
    c.lineWidth = 0.05 * h;
    c.beginPath();
    c.moveTo(X(0.0), Y(0.29));
    c.lineTo(X(0.018), Y(0.37));
    c.stroke();
    const hcx = X(looking ? 0.034 : 0.026);
    const hcy = Y(looking ? 0.415 : 0.425);
    c.fillStyle = body;
    c.beginPath();
    c.ellipse(hcx, hcy, 0.056 * h, 0.064 * h, 0, 0, TAU);
    c.fill();
    // 코·턱 윤곽
    c.beginPath();
    c.moveTo(hcx + 0.045 * h, hcy - 0.012 * h);
    c.lineTo(hcx + 0.068 * h, hcy + 0.012 * h);
    c.lineTo(hcx + 0.04 * h, hcy + 0.03 * h);
    c.closePath();
    c.fill();
    if (st.outfit === 'hoodie') {
      c.beginPath();
      c.ellipse(hcx - 0.06 * h, hcy + 0.055 * h, 0.045 * h, 0.035 * h, -0.4, 0, TAU);
      c.fill();
    }

    // 머리 모양
    const sway = 0.012 * Math.sin(phase * 2);
    switch (st.hair) {
      case 'long':
        poly([[0.0, 0.49], [-0.06, 0.47], [-0.088 + sway, 0.36], [-0.095 + sway, 0.2], [-0.05, 0.23], [-0.02, 0.36]], body);
        break;
      case 'bun':
        c.beginPath();
        c.arc(hcx - 0.05 * h, hcy - 0.05 * h, 0.032 * h, 0, TAU);
        c.fill();
        break;
      case 'cap':
        c.beginPath();
        c.ellipse(hcx - 0.004 * h, hcy - 0.02 * h, 0.062 * h, 0.05 * h, 0, Math.PI, TAU);
        c.fill();
        c.fillRect(hcx, hcy - 0.03 * h, 0.095 * h, 0.014 * h);
        break;
      case 'ponytail':
        c.strokeStyle = body;
        c.lineWidth = 0.034 * h;
        c.beginPath();
        c.moveTo(hcx - 0.05 * h, hcy - 0.03 * h);
        c.quadraticCurveTo(hcx - 0.1 * h, hcy - 0.01 * h, hcx - 0.11 * h + sway * h, hcy + 0.08 * h);
        c.stroke();
        break;
      default:
        break;
    }

    // 가까운 팔 / 소지품
    if (umbrella) {
      const sx = X(0.0);
      const sy = Y(0.285);
      const hx = X(0.085);
      const hy = Y(0.22);
      c.strokeStyle = body;
      c.lineWidth = 0.052 * h;
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(X(0.045), Y(0.14));
      c.lineTo(hx, hy);
      c.stroke();
      // 우산 — 걷는 방향으로 살짝 기울임
      c.save();
      c.translate(hx, hy);
      c.rotate(0.12);
      if (rimPass && umbrella === 'clear') {
        c.restore();
        return;
      }
      c.strokeStyle = umbrella === 'clear' ? 'rgba(225,230,245,0.55)' : body;
      c.lineWidth = 0.014 * h;
      c.beginPath();
      c.moveTo(0, 0.02 * h);
      c.lineTo(0, -0.47 * h);
      c.stroke();
      const R = 0.3 * h;
      const cy = -0.44 * h;
      c.beginPath();
      c.ellipse(0, cy, R, R * 0.45, 0, Math.PI, TAU);
      const ribs = 6;
      for (let i = ribs; i > 0; i--) {
        const x1 = -R + ((i - 1) / ribs) * 2 * R;
        const xm = (x1 + (-R + (i / ribs) * 2 * R)) / 2;
        c.quadraticCurveTo(xm, cy - 0.04 * h, x1, cy);
      }
      c.closePath();
      if (umbrella === 'clear') {
        c.fillStyle = 'rgba(210,215,235,0.16)';
        c.fill();
        c.stroke();
      } else {
        c.fillStyle = rimPass ? body : shade(body, 1.25);
        c.fill();
      }
      c.restore();
    } else if (looking) {
      // 폰 보며 걷기 — 손에 작은 화면 불빛
      const sx = X(0.0);
      const sy = Y(0.285);
      c.strokeStyle = body;
      c.lineWidth = 0.052 * h;
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(X(0.035), Y(0.16));
      c.lineTo(X(0.1), Y(0.3));
      c.stroke();
      if (!rimPass) {
        c.fillStyle = 'rgba(205,225,255,0.9)';
        c.fillRect(X(0.1) - 0.006 * h, Y(0.3) - 0.03 * h, 0.012 * h, 0.022 * h);
      }
    } else {
      arm(-0.38 * Math.sin(phase), body);
    }
  }
}

export interface FanPaint {
  body: string;
  rim: string;
  /** 응원봉 색. null이면 꺼짐 */
  light: string | null;
}

/** 정면 관객(머리·어깨) — raise(0~1)만큼 팔을 들어 응원봉을 흔든다 */
export function drawFan(
  c: Ctx, x: number, baseY: number, h: number, hair: Hair, raise: number, wave: number, paint: FanPaint,
) {
  c.save();
  c.translate(x, baseY);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  // 흐림 없는 그림자 = 위쪽 윤곽 빛 (블러 그림자는 24명분이면 비싸다)
  c.shadowColor = paint.rim;
  c.shadowOffsetY = -2;
  c.shadowBlur = 0;
  c.fillStyle = paint.body;
  c.strokeStyle = paint.body;

  // 들어 올린 팔 + 응원봉
  if (raise > 0.01) {
    const ang = -0.25 + wave * 0.35;
    const sx = 0.14 * h;
    const sy = -0.66 * h;
    const ex = sx + Math.sin(ang + 0.5) * 0.2 * h;
    const ey = sy - Math.cos(ang + 0.5) * 0.2 * h * raise;
    const hx = ex + Math.sin(ang) * 0.19 * h;
    const hy = ey - Math.cos(ang) * 0.19 * h * raise;
    c.lineWidth = 0.075 * h;
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(ex, ey);
    c.lineTo(hx, hy);
    c.stroke();
    if (paint.light) {
      const tx = hx + Math.sin(ang) * 0.26 * h;
      const ty = hy - Math.cos(ang) * 0.26 * h;
      c.save();
      c.shadowColor = paint.light;
      c.shadowBlur = 18;
      c.shadowOffsetY = 0;
      c.strokeStyle = paint.light;
      c.lineWidth = 0.045 * h;
      c.beginPath();
      c.moveTo(hx, hy);
      c.lineTo(tx, ty);
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      c.lineWidth = 0.016 * h;
      c.stroke();
      c.restore();
    }
  }

  // 어깨·몸
  c.beginPath();
  c.moveTo(-0.24 * h, 0.3 * h);
  c.lineTo(-0.22 * h, -0.6 * h);
  c.quadraticCurveTo(-0.2 * h, -0.72 * h, -0.06 * h, -0.74 * h);
  c.lineTo(0.06 * h, -0.74 * h);
  c.quadraticCurveTo(0.2 * h, -0.72 * h, 0.22 * h, -0.6 * h);
  c.lineTo(0.24 * h, 0.3 * h);
  c.closePath();
  c.fill();
  // 머리
  c.beginPath();
  c.ellipse(0, -0.88 * h, 0.105 * h, 0.12 * h, 0, 0, TAU);
  c.fill();
  switch (hair) {
    case 'long':
      c.beginPath();
      c.ellipse(0, -0.8 * h, 0.15 * h, 0.2 * h, 0, Math.PI * 1.05, Math.PI * 1.95, true);
      c.fill();
      break;
    case 'bun':
      c.beginPath();
      c.arc(0, -1.02 * h, 0.05 * h, 0, TAU);
      c.fill();
      break;
    case 'cap':
      c.fillRect(-0.12 * h, -0.95 * h, 0.24 * h, 0.03 * h);
      break;
    case 'ponytail':
      c.beginPath();
      c.ellipse(0.1 * h, -0.86 * h, 0.04 * h, 0.1 * h, 0.4, 0, TAU);
      c.fill();
      break;
    default:
      break;
  }
  c.restore();
}
