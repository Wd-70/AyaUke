// 片っぽ 입자 — 눈, 꽃잎, 먼지. 모두 시각만으로 위치가 정해진다(결정적).
import { TAU, hash, noise1 } from '../../engine';
import { fallingPetal } from './flora';
import { type Ctx, H, W } from './kit';

export interface FallOpts {
  count: number;
  seed: number;
  /** 낙하 속도(px/s) 범위 */
  speed?: [number, number];
  /** 크기 범위 */
  size?: [number, number];
  /** 바람(px/s, +면 오른쪽) */
  wind?: number;
  alpha?: number;
  area?: [number, number, number, number];
  color?: string;
  /** 깊이감 — 크고 빠른 입자일수록 흐리게(초점 밖) */
  blur?: boolean;
}

/** 눈 */
export function snowfall(c: Ctx, t: number, o: FallOpts) {
  const [ax, ay, aw, ah] = o.area ?? [0, 0, W, H];
  const [s0, s1] = o.speed ?? [30, 90];
  const [z0, z1] = o.size ?? [1.5, 5];
  c.save();
  c.fillStyle = o.color ?? '#f5f8fb';
  for (let i = 0; i < o.count; i++) {
    const d = hash(o.seed + i * 13);
    const sp = s0 + (s1 - s0) * d;
    const r = z0 + (z1 - z0) * d;
    const span = ah + 40;
    const y = ay - 20 + ((hash(o.seed + i * 7) * span + t * sp) % span);
    const x = ax + ((((hash(o.seed + i * 3) * aw + t * (o.wind ?? 8) * (0.5 + d) + noise1(t * 0.5 + i, o.seed) * 24) % aw) + aw) % aw);
    c.globalAlpha = (o.alpha ?? 0.85) * (0.45 + 0.55 * hash(o.seed + i * 17)) * (o.blur && d > 0.85 ? 0.5 : 1);
    c.beginPath();
    c.arc(x, y, o.blur && d > 0.85 ? r * 1.8 : r, 0, TAU);
    c.fill();
  }
  c.restore();
}

/** 꽃잎 비 */
export function petalfall(c: Ctx, t: number, o: FallOpts & { sat?: number }) {
  const [ax, ay, aw, ah] = o.area ?? [0, 0, W, H];
  const [s0, s1] = o.speed ?? [40, 110];
  const [z0, z1] = o.size ?? [10, 26];
  for (let i = 0; i < o.count; i++) {
    const d = hash(o.seed + i * 13);
    const sp = s0 + (s1 - s0) * d;
    const len = z0 + (z1 - z0) * d;
    const span = ah + 80;
    const y = ay - 40 + ((hash(o.seed + i * 7) * span + t * sp) % span);
    const x = ax + ((((hash(o.seed + i * 3) * aw + t * (o.wind ?? 20) * (0.5 + d) + Math.sin(t * 1.3 + i) * 30) % aw) + aw) % aw);
    fallingPetal(c, x, y, len, t * (0.6 + d) + i, t * (2 + d * 2) + i, o.sat ?? 1, (o.alpha ?? 1) * (0.6 + 0.4 * hash(i + o.seed)));
  }
}

/** 공중에 떠도는 빛 먼지 */
export function dust(c: Ctx, t: number, count: number, seed: number, color: string, alpha = 0.5) {
  c.save();
  c.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = (hash(seed + i) * W + noise1(t * 0.15 + i, seed) * 80 + W) % W;
    const y = (hash(seed + i * 5) * H + noise1(t * 0.12 + i, seed + 9) * 60 - t * 6 + H * 4) % H;
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
    c.globalAlpha = alpha * tw * (0.3 + 0.7 * hash(seed + i * 9));
    c.beginPath();
    c.arc(x, y, 1 + hash(seed + i * 11) * 2.2, 0, TAU);
    c.fill();
  }
  c.restore();
}
