// 片っぽ 인물 실루엣 — 이 클립의 아야(아주 긴 라벤더 머리, 더듬이 머리, 꽃 머리핀, 오프숄더 원피스)와 "너"의 뒷모습.
// 역광 실루엣으로만 쓰므로 한 가지 색으로 채우고, 윤곽 빛(rim)은 그림자 번짐으로 낸다.
// 좌표 단위는 키(h) 비율, 발 중심이 원점(위가 음수).
import { TAU, clamp } from '../../engine';

type Ctx = CanvasRenderingContext2D;

export type Arms = 'down' | 'open' | 'chest';

export interface FigureOpts {
  t: number;
  color: string;
  /** 윤곽 빛 색과 세기(번짐 px) */
  rim?: string;
  rimBlur?: number;
  arms?: Arms;
  /** 바람(-1~1) — 머리카락·치맛자락이 쏠림 */
  wind?: number;
  /** 뒷모습이면 머리카락이 등을 덮는다 */
  back?: boolean;
  alpha?: number;
}

export function girl(c: Ctx, x: number, ground: number, h: number, o: FigureOpts) {
  const wind = (o.wind ?? 0) + Math.sin(o.t * 0.9) * 0.15;
  const X = (u: number) => u * h;
  const Y = (v: number) => -v * h;
  c.save();
  c.translate(x, ground);
  c.globalAlpha *= o.alpha ?? 1;
  c.fillStyle = o.color;
  c.strokeStyle = o.color;
  c.lineCap = 'round';
  c.lineJoin = 'round';

  const hair = () => {
    // 머리 뒤에서 허리 아래까지 퍼지는 긴 머리 — 끝은 물결치며 바람에 쏠림
    const sw = wind * 0.07;
    // 어깨까지는 머리에 붙어 좁게, 그 아래로 퍼지며 끝만 바람에 쏠린다
    c.beginPath();
    c.moveTo(X(-0.06), Y(0.97));
    c.bezierCurveTo(X(-0.12), Y(0.9), X(-0.12 + sw * 0.3), Y(0.7), X(-0.135 + sw), Y(0.46));
    const tips = 7;
    for (let i = 0; i < tips; i++) {
      const u0 = -0.135 + (i / tips) * 0.27 + sw;
      const u1 = -0.135 + ((i + 1) / tips) * 0.27 + sw;
      const wave = Math.sin(o.t * 1.6 + i) * 0.012;
      c.quadraticCurveTo(X((u0 + u1) / 2 + wave), Y(0.42 + (i % 2) * 0.03), X(u1), Y(0.46 + wave));
    }
    c.bezierCurveTo(X(0.12 + sw * 0.3), Y(0.7), X(0.12), Y(0.9), X(0.06), Y(0.97));
    c.closePath();
    c.fill();
  };

  const paint = () => {
    if (!o.back) hair();

    // 다리
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(X(s * 0.012), Y(0.24));
      c.lineTo(X(s * 0.045), Y(0.24));
      c.lineTo(X(s * 0.034), Y(0.02));
      c.lineTo(X(s * 0.05), Y(0));
      c.lineTo(X(s * 0.012), Y(0));
      c.closePath();
      c.fill();
    }

    // 원피스 — 오프숄더 몸판에서 무릎 아래까지 퍼지는 치마
    const hem = wind * 0.03;
    c.beginPath();
    c.moveTo(X(-0.1), Y(0.765));
    c.quadraticCurveTo(X(0), Y(0.78), X(0.1), Y(0.765));
    c.lineTo(X(0.075), Y(0.6));
    c.bezierCurveTo(X(0.12), Y(0.45), X(0.16 + hem), Y(0.3), X(0.18 + hem), Y(0.2));
    c.quadraticCurveTo(X(0 + hem), Y(0.17), X(-0.18 + hem), Y(0.2));
    c.bezierCurveTo(X(-0.16 + hem), Y(0.3), X(-0.12), Y(0.45), X(-0.075), Y(0.6));
    c.closePath();
    c.fill();

    // 팔 — 어깨에서 손목으로 가늘어지는 면
    const pose: Record<Arms, [number, number][]> = {
      down: [
        [0.1, 0.755],
        [0.125, 0.62],
        [0.115, 0.5],
      ],
      open: [
        [0.1, 0.755],
        [0.2, 0.795],
        [0.31, 0.87],
      ],
      chest: [
        [0.1, 0.755],
        [0.13, 0.64],
        [0.02, 0.68],
      ],
    };
    for (const sd of [-1, 1]) {
      const pts = pose[o.arms ?? 'down'].map(([u, v], i) => [sd * u + (i === 2 ? wind * 0.01 : 0), v] as [number, number]);
      limb(
        c,
        pts.map(([u, v]) => [X(u), Y(v)] as [number, number]),
        [0.034 * h, 0.026 * h, 0.019 * h],
      );
      const [hx, hy] = pts[2];
      c.beginPath();
      c.arc(X(hx), Y(hy), 0.014 * h, 0, TAU);
      c.fill();
    }

    // 목·어깨선
    c.fillRect(X(-0.016), Y(0.83), 0.032 * h, 0.07 * h);
    c.beginPath();
    c.ellipse(0, Y(0.765), 0.1 * h, 0.018 * h, 0, 0, TAU);
    c.fill();

    // 머리
    c.beginPath();
    c.ellipse(0, Y(0.9), 0.068 * h, 0.078 * h, 0, 0, TAU);
    c.fill();
    // 정수리 더듬이 머리(작게)
    c.lineWidth = 0.006 * h;
    c.beginPath();
    c.moveTo(X(0.004), Y(0.975));
    c.quadraticCurveTo(X(0.024), Y(1.012), X(-0.004), Y(1.008));
    c.stroke();
    // 꽃 머리핀(오른쪽 위)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      c.beginPath();
      c.arc(X(0.06 + Math.cos(a) * 0.012), Y(0.94 + Math.sin(a) * 0.012), 0.009 * h, 0, TAU);
      c.fill();
    }
    // 옆머리 — 얼굴 옆에서 가슴 앞으로
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(X(s * 0.06), Y(0.95));
      c.quadraticCurveTo(X(s * 0.095), Y(0.82), X(s * 0.085 + wind * 0.02), Y(0.62));
      c.lineTo(X(s * 0.06 + wind * 0.02), Y(0.64));
      c.quadraticCurveTo(X(s * 0.07), Y(0.8), X(s * 0.045), Y(0.9));
      c.closePath();
      c.fill();
    }
    if (o.back) hair();
  };
  rimmed(c, o.rim, o.rimBlur ?? 18, paint);
  c.restore();
}

/**
 * 윤곽 빛 — 그림자 번짐을 켠 채 한 번, 끈 채 한 번 더 그린다.
 * 부위마다 따로 칠하므로 한 번만 그리면 몸 안쪽 경계에도 빛이 생겨 줄무늬처럼 보인다.
 */
function rimmed(c: Ctx, rim: string | undefined, blur: number, paint: () => void) {
  if (rim) {
    c.save();
    c.shadowColor = rim;
    c.shadowBlur = blur;
    paint();
    c.restore();
  }
  paint();
}

/** 어깨→팔꿈치→손목, 굵기가 점점 가늘어지는 팔다리 */
function limb(c: Ctx, pts: [number, number][], widths: number[]) {
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  pts.forEach(([x, y], i) => {
    const [ax, ay] = pts[Math.max(0, i - 1)];
    const [bx, by] = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    const w = widths[i] / 2;
    left.push([x + nx * w, y + ny * w]);
    right.push([x - nx * w, y - ny * w]);
  });
  c.beginPath();
  left.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  for (let i = right.length - 1; i >= 0; i--) c.lineTo(right[i][0], right[i][1]);
  c.closePath();
  c.fill();
  // 관절을 둥글게
  pts.forEach(([x, y], i) => {
    c.beginPath();
    c.arc(x, y, widths[i] / 2, 0, TAU);
    c.fill();
  });
}

/** "너" — 짧은 머리, 코트 차림의 뒷모습 */
export function personBack(
  c: Ctx,
  x: number,
  ground: number,
  h: number,
  o: { t: number; color: string; rim?: string; rimBlur?: number },
) {
  const X = (u: number) => u * h;
  const Y = (v: number) => -v * h;
  c.save();
  c.translate(x, ground);
  c.fillStyle = o.color;
  const breathe = Math.sin(o.t * 1.2) * 0.003;
  const paint = () => {
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(X(s * 0.015), Y(0.42));
      c.lineTo(X(s * 0.07), Y(0.42));
      c.lineTo(X(s * 0.06), Y(0.0));
      c.lineTo(X(s * 0.02), Y(0.0));
      c.closePath();
      c.fill();
    }
    // 코트
    c.beginPath();
    c.moveTo(X(-0.05), Y(0.83));
    c.quadraticCurveTo(X(-0.15), Y(0.82 + breathe), X(-0.155), Y(0.76));
    c.lineTo(X(-0.13), Y(0.36));
    c.lineTo(X(0.13), Y(0.36));
    c.lineTo(X(0.155), Y(0.76));
    c.quadraticCurveTo(X(0.15), Y(0.82 + breathe), X(0.05), Y(0.83));
    c.closePath();
    c.fill();
    // 팔
    c.lineWidth = 0.045 * h;
    c.lineCap = 'round';
    c.strokeStyle = o.color;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(X(s * 0.14), Y(0.76));
      c.quadraticCurveTo(X(s * 0.17), Y(0.6), X(s * 0.15), Y(0.47));
      c.stroke();
    }
    // 목·머리(짧은 머리)
    c.fillRect(X(-0.025), Y(0.88), 0.05 * h, 0.06 * h);
    c.beginPath();
    c.ellipse(0, Y(0.925), 0.068 * h, 0.08 * h, 0, 0, TAU);
    c.fill();
    c.beginPath();
    c.ellipse(X(0.004), Y(0.955), 0.074 * h, 0.06 * h, 0.1, 0, TAU);
    c.fill();
  };
  rimmed(c, o.rim, o.rimBlur ?? 18, paint);
  c.restore();
}

/**
 * 옆얼굴 클로즈업(오른쪽을 봄) — (x,y)는 눈높이 중심, s는 얼굴 높이.
 * 이마·코·입술·턱 윤곽선 + 뒤로 흐르는 긴 머리 + 더듬이 머리 + 속눈썹.
 */
export function profile(
  c: Ctx,
  x: number,
  y: number,
  s: number,
  o: {
    t: number;
    color: string;
    rim?: string;
    rimBlur?: number;
    breath?: number;
  },
) {
  const P = (u: number, v: number): [number, number] => [x + u * s, y + v * s];
  const sway = Math.sin(o.t * 0.8) * 0.02;
  c.save();
  c.fillStyle = o.color;
  c.strokeStyle = o.color;
  const paint = () => {
    c.beginPath();
    c.moveTo(...P(-0.15, -0.62));
    c.bezierCurveTo(...P(0.1, -0.7), ...P(0.24, -0.5), ...P(0.25, -0.3)); // 정수리 → 이마
    c.bezierCurveTo(...P(0.26, -0.22), ...P(0.27, -0.16), ...P(0.29, -0.12)); // 이마 → 미간
    c.bezierCurveTo(...P(0.31, -0.06), ...P(0.36, 0.02), ...P(0.37, 0.06)); // 콧등
    c.bezierCurveTo(...P(0.36, 0.09), ...P(0.32, 0.1), ...P(0.31, 0.11)); // 코끝 → 인중
    c.bezierCurveTo(...P(0.33, 0.14), ...P(0.33, 0.16), ...P(0.31, 0.17)); // 윗입술
    c.bezierCurveTo(...P(0.33, 0.19), ...P(0.32, 0.22), ...P(0.29, 0.23)); // 아랫입술
    c.bezierCurveTo(...P(0.3, 0.28), ...P(0.28, 0.32), ...P(0.22, 0.34)); // 턱
    c.bezierCurveTo(...P(0.14, 0.36), ...P(0.1, 0.34), ...P(0.06, 0.38)); // 턱선 → 목
    c.lineTo(...P(0.08, 0.7));
    c.bezierCurveTo(...P(0.2, 0.78), ...P(0.3, 0.86), ...P(0.42, 1.0)); // 쇄골 → 어깨
    c.lineTo(...P(-0.9, 1.0));
    // 뒤로 흐르는 머리
    c.bezierCurveTo(...P(-0.85 + sway, 0.6), ...P(-0.7 + sway, 0.1), ...P(-0.45, -0.3));
    c.bezierCurveTo(...P(-0.38, -0.5), ...P(-0.3, -0.6), ...P(-0.15, -0.62));
    c.closePath();
    c.fill();
    // 옆머리 — 귀 앞에서 목 옆으로 흘러내림(머리에 붙여 틈이 없게)
    c.beginPath();
    c.moveTo(...P(0.16, -0.48));
    c.bezierCurveTo(...P(0.22, -0.3), ...P(0.16 + sway, 0.1), ...P(0.12 + sway, 0.5));
    c.lineTo(...P(-0.05 + sway, 0.5));
    c.bezierCurveTo(...P(-0.02, 0.1), ...P(0.0, -0.3), ...P(-0.05, -0.5));
    c.closePath();
    c.fill();
    // 더듬이 머리
    c.lineWidth = s * 0.014;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(...P(0.02, -0.66));
    c.quadraticCurveTo(...P(0.09, -0.77), ...P(0.01, -0.76));
    c.stroke();
    // 속눈썹
    c.lineWidth = s * 0.012;
    c.beginPath();
    c.moveTo(...P(0.24, -0.1));
    c.quadraticCurveTo(...P(0.28, -0.11), ...P(0.3, -0.07));
    c.stroke();
  };
  rimmed(c, o.rim, o.rimBlur ?? 24, paint);
  // 숨(입김) — breath 0~1
  if (o.breath && o.breath > 0) {
    const b = clamp(o.breath);
    const g = c.createRadialGradient(...P(0.45 + b * 0.15, 0.17), 0, ...P(0.45 + b * 0.15, 0.17), s * 0.12);
    g.addColorStop(0, `rgba(255,255,255,${0.35 * (1 - b)})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(x + 0.2 * s, y - 0.1 * s, s * 0.6, s * 0.5);
  }
  c.restore();
}
