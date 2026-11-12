// 片っぽ 장면 0~11 — 인트로 · 1절 · 프리코러스 · 후렴 1 (PLAN.md 표 번호)
import { TAU, clamp, easeInCubic, easeOutCubic, hash, lerp, noise1, rng, setFont, smooth } from '../../engine';
import { desat, pencil, sample, wash, washBackdrop } from '../../paint';
import { type FrostSeg, drawFrost, fallingPetal, frostSegments, stampFlower, stem, sunflower } from './flora';
import { girl, personBack } from './figure';
import { dust, petalfall, snowfall } from './fx';
import { COL, type Ctx, H, type Kit, type SceneFn, W, cam, chunkT, glow, span01, vgrad } from './kit';

type Pt = [number, number];

// ── 공용 ──────────────────────────────────────────────

/** 위에서 본 나무 책상 */
export function desk(c: Ctx) {
  c.drawImage(
    washBackdrop('k-desk', W, H, COL.desk, [
      { color: '#2a201c', x: 200, y: 160, d: 760 },
      { color: '#4a3a32', x: 980, y: 520, d: 820 },
      { color: '#33271f', x: 640, y: 700, d: 900, aspect: 2 },
    ]),
    0,
    0,
  );
  c.save();
  c.strokeStyle = 'rgba(20,14,10,0.35)';
  c.lineWidth = 1.2;
  for (let i = 0; i < 22; i++) {
    const y0 = (i / 22) * H + hash(i) * 20;
    c.beginPath();
    for (let x = -20; x <= W + 20; x += 40) {
      const y = y0 + Math.sin(x * 0.004 + i) * 10 + noise1(x * 0.01, i) * 6;
      if (x < 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  c.restore();
}

/** 유리 꽃병 + 물 */
export function vase(c: Ctx, x: number, base: number, w: number, h: number) {
  c.save();
  const body = () => {
    c.beginPath();
    c.moveTo(x - w * 0.32, base - h);
    c.bezierCurveTo(x - w * 0.3, base - h * 0.75, x - w * 0.62, base - h * 0.55, x - w * 0.5, base - h * 0.12);
    c.quadraticCurveTo(x - w * 0.46, base, x, base);
    c.quadraticCurveTo(x + w * 0.46, base, x + w * 0.5, base - h * 0.12);
    c.bezierCurveTo(x + w * 0.62, base - h * 0.55, x + w * 0.3, base - h * 0.75, x + w * 0.32, base - h);
    c.closePath();
  };
  body();
  c.fillStyle = 'rgba(210,225,240,0.13)';
  c.fill();
  c.save();
  body();
  c.clip();
  c.fillStyle = 'rgba(170,200,225,0.18)';
  c.fillRect(x - w, base - h * 0.55, w * 2, h);
  c.strokeStyle = 'rgba(235,245,255,0.5)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.ellipse(x, base - h * 0.55, w * 0.55, 5, 0, 0, TAU);
  c.stroke();
  c.restore();
  body();
  c.strokeStyle = 'rgba(235,245,255,0.55)';
  c.lineWidth = 2;
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.45)';
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(x - w * 0.34, base - h * 0.62);
  c.quadraticCurveTo(x - w * 0.46, base - h * 0.4, x - w * 0.38, base - h * 0.18);
  c.stroke();
  c.restore();
}

/** 꽃병에 꽂힌 해바라기 한 송이(방 안) */
export function vaseFlower(c: Ctx, t: number, x: number, table: number, s: number, o: { sat: number; petals?: number; seed?: number }) {
  const fx = x + Math.sin(t * 0.7) * 4 * s;
  const fy = table - 380 * s;
  stem(c, fx, fy + 40 * s, table - 20 * s, 9 * s, { sat: o.sat, lean: -14 * s, seed: 4, leaves: 1 });
  vase(c, x, table, 150 * s, 230 * s);
  sunflower(c, fx, fy, 170 * s, { sat: o.sat, t, petals: o.petals ?? 1, seed: o.seed ?? 3, squash: 0.96, rot: -0.06 });
}

/** 위에서 본 폴라로이드 — 사진 칸에 원본 영상(없으면 라벤더 번짐) */
export function polaroid(kit: Kit, c: Ctx, video: HTMLVideoElement | null, x: number, y: number, s: number, rot: number, seed: number, delay = 0) {
  const w = 240 * s;
  const hh = 290 * s;
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.shadowColor = 'rgba(0,0,0,0.45)';
  c.shadowBlur = 18 * s;
  c.shadowOffsetY = 8 * s;
  c.fillStyle = '#f6f2ea';
  c.fillRect(-w / 2, -hh / 2, w, hh);
  c.shadowColor = 'transparent';
  const ix = -w / 2 + 15 * s;
  const iy = -hh / 2 + 15 * s;
  const iw = w - 30 * s;
  if (!kit.footage(c, video, ix, iy, iw, iw, delay)) {
    c.fillStyle = '#5b5068';
    c.fillRect(ix, iy, iw, iw);
    wash(c, `k-pol-${seed}`, { color: COL.lav, size: 200 }, 0, iy + iw / 2, iw * 0.8, 1, 0.8);
  }
  // 바랜 사진 느낌
  c.fillStyle = 'rgba(255,236,200,0.12)';
  c.fillRect(ix, iy, iw, iw);
  c.restore();
}

// ── 장면 ──────────────────────────────────────────────

export function scenes1(kit: Kit): Record<string, SceneFn> {
  let frost: FrostSeg[] | null = null;

  return {
    // 00 서리 낀 유리창 — 결정이 자라고, 너머로 흐린 노란 점. 제목
    frost(c, f) {
      const { t } = f;
      frost ??= frostSegments(W, H, 7, 18);
      cam(c, 1 + f.k * 0.05, W / 2, H / 2, () => {
        c.drawImage(
          washBackdrop('k-frost-out', W, H, '#cdd7e2', [
            { color: '#9fb2c8', x: 300, y: 260, d: 700 },
            { color: '#eef2f6', x: 980, y: 200, d: 620 },
            { color: '#7f93ad', x: 640, y: 640, d: 900, aspect: 2.2 },
          ]),
          0,
          0,
        );
        glow(c, 870, 440, 130, 'rgba(236,196,96,0.85)', 0.7 + 0.1 * Math.sin(t));
        glow(c, 870, 440, 52, 'rgba(255,226,140,0.9)', 0.55);
      });
      const fog = c.createRadialGradient(W / 2, H / 2, 160, W / 2, H / 2, 760);
      fog.addColorStop(0, 'rgba(240,245,250,0.15)');
      fog.addColorStop(1, 'rgba(240,245,250,0.78)');
      c.fillStyle = fog;
      c.fillRect(0, 0, W, H);
      // 장면 끝까지 자란다(감속해서 멈추지 않게 끝 무렵에도 속도가 남음)
      drawFrost(c, frost, 1 - Math.pow(1 - span01(t, 0.2, f.span.end + 1.5), 2), 'rgba(255,255,255,0.92)');

      // 제목 — 유리에 김이 서리듯
      const C = kit.cues();
      const a = span01(t, C.titleIn, C.titleIn + 1.6) * (1 - span01(t, f.span.end - 1.6, f.span.end - 0.6));
      if (a > 0) {
        c.save();
        c.globalAlpha = a;
        c.textAlign = 'center';
        c.fillStyle = '#3c4a62';
        c.shadowColor = 'rgba(255,255,255,0.8)';
        c.shadowBlur = 20;
        setFont(c, 104, kit.fonts.ja, 600);
        c.fillText('片っぽ', W / 2, 352 - (1 - a) * 8);
        setFont(c, 21, kit.fonts.ko, 600);
        c.fillStyle = 'rgba(60,74,98,0.8)';
        c.fillText('eill · AyaUke cover', W / 2, 400);
        c.restore();
      }
      // 입김 — 다음 장면으로 겹치는 동안에도 계속 퍼진다
      const b = Math.max(0, (t - (f.span.end - 1.3)) / 1.3);
      if (b > 0) glow(c, W / 2, H / 2 + 40, 220 + 820 * b, 'rgba(250,252,255,0.97)', clamp(b * 1.1));
    },

    // 01 미완성 지도 — 연필이 길·집·두 사람을 그리다 멈춤, 물방울이 떨어져 번짐
    unfinishedMap(c, f) {
      const { t } = f;
      const t0 = f.span.start;
      cam(c, 1.08 - 0.06 * f.k, W / 2, H / 2, () => desk(c), -0.02 + f.k * 0.02);
      const P = { x: 640, y: 365, w: 780, h: 500, rot: -0.035 };
      c.save();
      c.translate(P.x, P.y);
      c.rotate(P.rot + f.k * 0.01);
      c.scale(1.04 - 0.04 * f.k, 1.04 - 0.04 * f.k);
      c.shadowColor = 'rgba(0,0,0,0.5)';
      c.shadowBlur = 30;
      c.shadowOffsetY = 12;
      c.fillStyle = COL.paper;
      c.fillRect(-P.w / 2, -P.h / 2, P.w, P.h);
      c.shadowColor = 'transparent';
      c.translate(-P.w / 2, -P.h / 2);

      const road = sample((u) => [70 + u * 600, 420 - 300 * u + Math.sin(u * TAU * 1.1) * 55], 60);
      const at = (u: number) => road[Math.round(u * 60)];
      const [ax, ay] = at(0.42);
      const bx = ax + 44;
      const by = ay - 4;
      const circle = (cx: number, cy: number, r: number) => sample((u) => [cx + Math.sin(u * TAU) * r, cy - Math.cos(u * TAU) * r], 24);
      const strokes: [Pt[], number, number][] = [
        [road, 0, 0.28],
        [[[575, 175], [655, 175], [655, 112], [615, 74], [575, 112], [575, 175]], 0.28, 0.44],
        [[[607, 175], [607, 146], [623, 146], [623, 175]], 0.44, 0.49],
        [circle(ax, ay - 64, 13), 0.49, 0.55],
        [[[ax, ay - 51], [ax, ay - 18]], 0.55, 0.58],
        [[[ax, ay - 18], [ax - 11, ay]], 0.58, 0.6],
        [[[ax, ay - 18], [ax + 11, ay]], 0.6, 0.62],
        [[[ax, ay - 40], [ax + 22, ay - 30]], 0.62, 0.65],
        [circle(bx, by - 64, 13), 0.65, 0.72],
        [[[bx, by - 51], [bx, by - 18]], 0.72, 0.76],
        [[[bx, by - 18], [bx - 11, by]], 0.76, 0.79],
        [[[bx, by - 18], [bx + 11, by]], 0.79, 0.82],
        [[[bx, by - 40], [bx - 22, by - 30]], 0.82, 0.86],
      ];
      // 0.74에서 손이 멈춘다 — 두 번째 사람은 끝내 다 그려지지 않는다
      const stopAt = 0.74;
      const p = Math.min(stopAt, span01(t, t0 + 0.15, t0 + f.dur * 0.68) * 0.95);
      let tip: Pt | null = null;
      strokes.forEach(([pts, p0, p1], i) => {
        const k = clamp((p - p0) / (p1 - p0));
        const r = pencil(c, pts, k, { width: 2.2, seed: i + 1, color: '#46454f' });
        if (r && k > 0) tip = r;
      });
      // 연필 — 멈춘 뒤 천천히 들려 비켜난다
      const lift = span01(t, t0 + f.dur * 0.66, t0 + f.dur * 0.95);
      const [px, py] = tip ?? at(0.42);
      c.save();
      c.translate(px + easeOutCubic(lift) * 120, py + easeOutCubic(lift) * 60);
      c.rotate(-0.75);
      c.globalAlpha = 1 - lift * 0.6;
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(6 + lift * 20, 4 + lift * 20, 300, 18);
      c.fillStyle = '#e8c45a';
      c.fillRect(30, -9, 270, 18);
      c.fillStyle = '#e9d5b5';
      c.beginPath();
      c.moveTo(30, -9);
      c.lineTo(0, 0);
      c.lineTo(30, 9);
      c.closePath();
      c.fill();
      c.fillStyle = '#35343c';
      c.beginPath();
      c.moveTo(9, -2.7);
      c.lineTo(0, 0);
      c.lineTo(9, 2.7);
      c.closePath();
      c.fill();
      c.restore();
      // 물방울이 떨어져 번짐
      const d = span01(t, f.span.end - 1.5, f.span.end);
      if (d > 0) {
        wash(c, 'k-tear-map', { color: '#7d95b6', size: 220, alpha: 0.07 }, bx, by - 40, 60 + 230 * easeOutCubic(d), d, 0.9);
      }
      c.restore();
    },

    // 02 아침 역광 속 누군가의 등 — 올려다봄, 끝에 빛이 화면을 덮음
    morningBack(c, f) {
      const { t } = f;
      cam(c, 1.06, W / 2, 380 - f.k * 50, () => {
        vgrad(c, [[0, '#c7d4e3'], [0.55, '#efe9df'], [1, '#e6dfd4']], 0, -100, W, H + 200);
        glow(c, 820, 330, 460, 'rgba(255,246,222,0.95)', 0.95);
        glow(c, 820, 330, 150, 'rgba(255,255,250,1)', 0.9);
        vgrad(c, [[0, '#eef2f6'], [1, '#c9d3de']], 0, 610, W, 220);
        personBack(c, 820, 930, 680, { t, color: '#394052', rim: 'rgba(255,246,225,0.95)', rimBlur: 34 });
      });
      dust(c, t, 40, 12, '#fffaf0', 0.6);
      const b = span01(t, f.span.end - 0.7, f.span.end);
      if (b > 0) {
        c.fillStyle = `rgba(255,252,244,${easeInCubic(b)})`;
        c.fillRect(0, 0, W, H);
      }
    },

    // 03 맞잡은 두 손(벙어리장갑) — 선으로 그려지고 색이 번짐, 「ぎゅっと」에서 꽉, 끝에 한 손만 남음
    hands(c, f) {
      const { t } = f;
      const t0 = f.span.start;
      const lines = kit.lines();
      const squeezeT = chunkT(lines, 4, 0);
      c.drawImage(
        washBackdrop('k-paper-cool', W, H, '#f3efe6', [
          { color: '#cfdbe8', x: 220, y: 150, d: 560 },
          { color: '#e7dfd0', x: 1040, y: 600, d: 640 },
          { color: '#dfe6ee', x: 900, y: 120, d: 420 },
        ]),
        0,
        0,
      );
      const grip = easeOutCubic(span01(t, squeezeT - 0.05, squeezeT + 0.3));
      const release = easeInCubic(span01(t, f.span.end - 0.8, f.span.end));
      const lw = 2 + 1.6 * grip;
      const fillK = span01(t, t0 + 1.6, t0 + 3.2);
      const pulse = 1 + 0.03 * Math.exp(-Math.max(0, t - squeezeT) * 6) * (t > squeezeT ? 1 : 0);
      // 그리는 사이에도 화면이 숨 쉬듯 — 아주 느리게 다가간다
      c.translate(W / 2, H / 2);
      c.scale(1 + f.k * 0.05, 1 + f.k * 0.05);
      c.rotate(-0.01 + f.k * 0.02);
      c.translate(-W / 2, -H / 2 - f.k * 10);

      const body: Pt[] = [
        ...sample((u) => [lerp(0, 110, u), -50 - 5 * Math.sin(u * Math.PI)], 10),
        ...sample((u) => {
          const a = -Math.PI / 2 + u * Math.PI;
          return [110 + Math.cos(a) * 55, Math.sin(a) * 55];
        }, 16),
        ...sample((u) => [lerp(110, 0, u), 50 + 4 * Math.sin(u * Math.PI)], 10),
      ];
      const bez = (a: Pt, b: Pt, cc: Pt, d: Pt) => (u: number): Pt => {
        const v = 1 - u;
        return [
          v * v * v * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * cc[0] + u * u * u * d[0],
          v * v * v * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * cc[1] + u * u * u * d[1],
        ];
      };
      const thumb = sample(bez([30, -48], [22, -112], [98, -106], [92, -52]), 18);
      const cuff: Pt[] = [[0, -58], [-58, -58], [-58, 58], [0, 58]];
      const sleeve1: Pt[] = [[-58, -60], [-620, -84]];
      const sleeve2: Pt[] = [[-58, 60], [-620, 88]];

      const S = 1.75;
      const mitten = (key: string, color: string, x: number, y: number, flip: boolean, seed: number, delay: number, alpha: number) => {
        c.save();
        c.globalAlpha = alpha;
        c.translate(x, y);
        // 왼쪽 아래·오른쪽 아래에서 비스듬히 올라와 가운데서 맞잡는다(오른쪽은 180° 돌려 엄지가 아래)
        c.rotate(flip ? 0.2 : -0.2);
        c.scale((flip ? -S : S) * pulse, (flip ? -S : S) * pulse);
        const path = (pts: Pt[]) => {
          c.beginPath();
          pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
          c.closePath();
        };
        if (fillK > 0) {
          for (const pts of [body, thumb, cuff]) {
            c.save();
            path(pts);
            c.clip();
            wash(c, `${key}-${pts.length}`, { color, size: 240, alpha: 0.09 }, 60, 0, 300, fillK, 0.95);
            c.restore();
          }
          c.save();
          c.globalAlpha *= fillK * 0.9;
          c.fillStyle = color;
          c.beginPath();
          c.moveTo(-58, -60);
          c.lineTo(-620, -84);
          c.lineTo(-620, 88);
          c.lineTo(-58, 60);
          c.closePath();
          c.fill();
          c.restore();
        }
        const s = (i: number, dur = 1.0) => span01(t, t0 + delay + 0.1 + i * 0.35, t0 + delay + 0.1 + i * 0.35 + dur);
        pencil(c, body, s(0, 1.3), { width: lw, seed, color: '#3f3d48' });
        pencil(c, thumb, s(1), { width: lw, seed: seed + 1, color: '#3f3d48' });
        pencil(c, cuff, s(2, 0.6), { width: lw, seed: seed + 2, color: '#3f3d48' });
        for (let i = 0; i < 5; i++) pencil(c, [[-48 + i * 10, -50], [-48 + i * 10, 50]], s(2.5 + i * 0.2, 0.3), { width: 1.2, seed: seed + 5 + i, color: '#5a5864' });
        pencil(c, sleeve1, s(3, 0.8), { width: lw, seed: seed + 3, color: '#3f3d48' });
        pencil(c, sleeve2, s(3.2, 0.8), { width: lw, seed: seed + 4, color: '#3f3d48' });
        c.restore();
      };
      const sq = 30 * grip;
      // 오른쪽(너) 먼저 — 뒤에 깔리고, 끝에 빠져나간다
      mitten('k-mit-r', COL.ochre, 900 - sq + release * 700, 450 + release * 260, true, 21, 0.5, 1 - release * 0.4);
      mitten('k-mit-l', COL.lav, 382 + sq, 452, false, 11, 0, 1);
      // ぎゅっ 표시
      if (grip > 0 && release === 0) {
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + (i - 1) * 0.5;
          const r0 = 150;
          pencil(c, [[640 + Math.cos(a) * r0, 360 + Math.sin(a) * r0], [640 + Math.cos(a) * (r0 + 40), 360 + Math.sin(a) * (r0 + 40)]], span01(t, squeezeT + i * 0.06, squeezeT + 0.25 + i * 0.06), { width: 2.4, seed: 40 + i, color: '#5d5068' });
        }
      }
    },

    // 04 왼쪽 반 아야, 오른쪽 반 텅 빈 눈밭 — 「片っぽ」에서 오른쪽이 하얗게 꺼짐
    halfAlone(c, f) {
      const { t } = f;
      const lines = kit.lines();
      const halfT = chunkT(lines, 5, 1);
      // 가운데 기준으로 천천히 다가간다 — 반쪽 경계는 화면 가운데에 그대로
      c.translate(W / 2, H / 2);
      c.scale(1 + f.k * 0.07, 1 + f.k * 0.07);
      c.translate(-W / 2, -H / 2);
      vgrad(c, [[0, '#b4c3d4'], [0.72, '#dde5ee'], [1, '#eef2f6']], 0, 0, W / 2, H);
      vgrad(c, [[0, '#e4ebf2'], [0.72, '#eff3f7'], [1, '#f5f7fa']], W / 2, 0, W / 2, H);
      c.fillStyle = 'rgba(150,170,195,0.35)';
      c.fillRect(0, 578, W, 2);
      girl(c, 330 + Math.sin(t * 0.3) * 3, 610, 330, { t, color: '#3a4157', wind: 0.25 + f.k * 0.35, rim: 'rgba(230,238,248,0.7)', rimBlur: 12 });
      c.save();
      c.beginPath();
      c.rect(0, 0, W / 2, H);
      c.clip();
      snowfall(c, t, { count: 70, seed: 41, wind: 14, area: [0, 0, W / 2, H] });
      c.restore();
      const w = easeOutCubic(span01(t, halfT, halfT + 1.1));
      c.fillStyle = `rgba(250,251,253,${w})`;
      c.fillRect(W / 2, 0, W / 2, H);
      if (w > 0) {
        c.save();
        c.beginPath();
        c.rect(W / 2, 0, W / 2, H);
        c.clip();
        snowfall(c, t, { count: 40, seed: 43, wind: 14, area: [W / 2, 0, W / 2, H], color: '#c9d4e1', alpha: 0.6 * w });
        c.restore();
      }
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.fillRect(W / 2 - 1, 0, 2, H);
    },

    // 05 방 안 물건이 공중에 흩어져 돎 — 가운데 아야, 카메라가 뒤로 빠짐
    scatter(c, f) {
      roomScatter(c, f.t, lerp(1.4, 1.0, f.k), 51, 0);
    },

    // 06 위에서 본 아야 — 조각과 가사 글자가 둘레를 돌며 빨라진 채로 다음 장면에 넘어감
    scatterRing(c, f) {
      const { t, age } = f;
      c.fillStyle = '#1f1a24';
      c.fillRect(0, 0, W, H);
      glow(c, W / 2, H / 2, 520, 'rgba(90,76,110,0.9)', 0.8);
      ayaTop(c, W / 2, H / 2, 1, age * 0.05, t);

      // 둘레를 도는 조각
      const spin = age * 0.25 + age * age * 0.03;
      const r = rng(61);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU + spin * (0.8 + r() * 0.4);
        const rad = 300 + r() * 60;
        drawFragment(c, W / 2 + Math.cos(a) * rad * 1.25, H / 2 + Math.sin(a) * rad * 0.82, 0.8 + r() * 0.5, a + spin, Math.floor(r() * 5), i);
      }
      // 가사 글자가 둘레에 하나씩
      const line = kit.lines()[6];
      if (line) {
        const text = line.ja.map((j) => j.text).join('').replace(/\s/g, '');
        const chars = [...text];
        const lt = line.t;
        const ld = Math.max(1, line.end - line.t);
        chars.forEach((ch, i) => {
          const at = lt + (i / chars.length) * ld * 0.85;
          const k = easeOutCubic(span01(t, at, at + 0.35));
          if (k <= 0) return;
          const a = -Math.PI / 2 + (i / chars.length) * TAU * 0.92 + spin * 0.6;
          const big = '外恋慕'.includes(ch);
          const rad = 178;
          c.save();
          c.translate(W / 2 + Math.cos(a) * rad * 1.35, H / 2 + Math.sin(a) * rad);
          c.rotate(a + Math.PI / 2);
          c.globalAlpha = k;
          c.fillStyle = big ? '#f1e8ff' : '#d9cdea';
          c.shadowColor = 'rgba(196,176,230,0.9)';
          c.shadowBlur = big ? 26 : 14;
          setFont(c, big ? 84 : 54, kit.fonts.ja, 600);
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(ch, 0, (1 - k) * 20);
          c.restore();
        });
      }
      // 빌드업 — 가장자리가 조여 온다
      const tight = f.k;
      const v = c.createRadialGradient(W / 2, H / 2, 420 - 220 * tight, W / 2, H / 2, 760 - 260 * tight);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(6,4,10,${0.55 + 0.4 * tight})`);
      c.fillStyle = v;
      c.fillRect(0, 0, W, H);
    },

    // 07 꽃병의 해바라기 — 처음 나오는 금색(채도 절반), 끝에 꽃잎 한 장이 떨어짐
    vase(c, f) {
      const { t } = f;
      const beat = kit.beat();
      cam(c, 1.0 + 0.12 * f.k, 640, 330, () => {
        c.drawImage(
          washBackdrop('k-vase-bg', W, H, '#3d3540', [
            { color: '#5d5161', x: 920, y: 240, d: 760 },
            { color: '#2c2630', x: 180, y: 620, d: 820 },
            { color: '#6a6070', x: 1100, y: 120, d: 380 },
          ]),
          0,
          0,
        );
        glow(c, 1020, 140, 420, 'rgba(210,225,245,0.55)', 0.8);
        c.fillStyle = '#4a3f47';
        c.fillRect(0, 590, W, 140);
        c.fillStyle = 'rgba(255,255,255,0.06)';
        c.fillRect(0, 590, W, 3);
        glow(c, 640, 250, 300, 'rgba(255,214,120,0.6)', 0.35 + 0.15 * beat.barPulse(t, 3));
        vaseFlower(c, t, 640, 600, 1, { sat: 0.5, petals: 1 });
      });
      const d = span01(t, f.span.end - 1.0, f.span.end);
      if (d > 0) fallingPetal(c, 720 + d * 40, 300 + easeInCubic(d) * 300, 34, 0.6 + d * 2.5, d * 7, 0.5);
    },

    // 08 폴라로이드가 박자마다 놓임(사진 속은 원본 영상) — 끝에 한 장으로 들어감.
    // 먼저 놓인 사진일수록 조금 전의 순간(1.2초씩) — 마지막 장(줌인)만 지금
    polaroids(c, f) {
      const { t } = f;
      const beat = kit.beat();
      const first = beat.timeOf(Math.ceil(beat.pos(f.span.start + 0.05)));
      const lands = [0, 1, 2, 3].map((i) => first + i * beat.period * 2);
      const r = rng(81);
      const spots = lands.map((_, i) => ({ x: 380 + i * 175 + (r() - 0.5) * 60, y: 340 + (r() - 0.5) * 110, rot: (r() - 0.5) * 0.4 }));
      const shown = lands.filter((l) => t >= l).length;
      const last = spots[Math.max(0, shown - 1)];
      const zoomK = easeInCubic(span01(t, f.span.end - 0.9, f.span.end));
      cam(c, 1.04 + f.k * 0.04 + zoomK * 1.7, lerp(W / 2 - 20 + f.k * 40, last.x, zoomK), lerp(H / 2, last.y - 30, zoomK), () => {
        desk(c);
        lands.forEach((l, i) => {
          if (t < l) return;
          const k = easeOutCubic(span01(t, l, l + 0.28));
          const s = 0.9 * (1.25 - 0.25 * k);
          c.save();
          c.globalAlpha = clamp(k * 2);
          polaroid(kit, c, f.video, spots[i].x, spots[i].y, s, spots[i].rot, i, (3 - i) * 1.2);
          c.restore();
        });
      });
    },

    // 09 큰 글자가 써지고 「気づかなきゃ」가 금 가며 갈라짐
    crackedWords(c, f) {
      const { t } = f;
      c.drawImage(
        washBackdrop('k-crack-bg', W, H, '#e8edf2', [
          { color: '#cbd7e4', x: 260, y: 200, d: 620 },
          { color: '#dbe2ea', x: 1000, y: 560, d: 700 },
        ]),
        0,
        0,
      );
      // 글자 쪽으로 천천히 다가간다(배경 번짐은 고정 — 종이 위의 글씨에 다가가는 느낌)
      c.translate(W / 2, 420);
      c.scale(1 + f.k * 0.06, 1 + f.k * 0.06);
      c.translate(-W / 2, -420);
      const line = kit.lines()[10];
      if (!line) return;
      const [c0, c1, c2] = line.ja;
      const ink = '#2f3a4d';
      const write = (text: string, x: number, y: number, size: number, at: number, dur: number) => {
        const k = easeOutCubic(span01(t, at, at + dur));
        if (k <= 0) return null;
        setFont(c, size, kit.fonts.ja, 600);
        const w = c.measureText(text).width;
        c.save();
        c.beginPath();
        c.rect(x - 10, y - size * 1.2, (w + 20) * k, size * 1.6);
        c.clip();
        c.fillStyle = ink;
        c.fillText(text, x, y);
        c.restore();
        return w;
      };
      c.textBaseline = 'alphabetic';
      write(c0.text.trim(), 150, 210, 68, c0.t, 0.45);
      write(c1.text.trim(), 330, 350, 84, c1.t, 0.6);
      // 마지막 덩어리 — 금이 가고 둘로 갈라진다
      const text = c2.text.trim();
      const size = 96;
      setFont(c, size, kit.fonts.ja, 600);
      const tw = c.measureText(text).width;
      const x = (W - tw) / 2;
      const y = 560;
      const crackT = Math.min(f.span.end - 1.6, c2.t + 1.8);
      // 갈라진 두 쪽은 점점 빨리 벌어지며 다음 장면으로(끝에서 서지 않게)
      const split = easeInCubic(span01(t, f.span.end - 1.3, f.span.end)) * 1.3;
      // 「気づかなきゃ」까지만 금이 가고 살짝 어긋난다 — 「よかった」는 그대로(읽혀야 하므로)
      const cutText = text.slice(0, text.indexOf('よかった') > 0 ? text.indexOf('よかった') : Math.ceil(text.length * 0.6));
      const xCut = x + c.measureText(cutText).width + 4;
      const crackPts: Pt[] = sample((u) => [x - 20 + u * (xCut - x + 20), y - size * 0.38 + noise1(u * 9, 5) * 22 + (u - 0.5) * 14], 22);
      const region = (top: boolean) => {
        c.beginPath();
        c.moveTo(x - 60, top ? y - size * 2 : y + size);
        c.lineTo(xCut, top ? y - size * 2 : y + size);
        for (let i = crackPts.length - 1; i >= 0; i--) c.lineTo(crackPts[i][0], crackPts[i][1]);
        c.lineTo(x - 60, crackPts[0][1]);
        c.closePath();
      };
      const half = (top: boolean, dx: number, dy: number, rot: number) => {
        c.save();
        c.translate(dx, dy);
        c.rotate(rot);
        region(top);
        c.clip();
        write(text, x, y, size, c2.t, 0.9);
        c.restore();
      };
      c.save();
      c.beginPath();
      c.rect(xCut, 0, W, H);
      c.clip();
      write(text, x, y, size, c2.t, 0.9);
      c.restore();
      half(true, -split * 5, -split * 7, -split * 0.012);
      half(false, split * 6, split * 9, split * 0.014);
      const ck = span01(t, crackT, crackT + 0.35);
      if (ck > 0) {
        pencil(c, crackPts, ck, { width: 2, seed: 9, color: '#1d2433', passes: 1, jitter: 0.4, alpha: 0.85 });
        // 금에서 떨어지는 작은 조각 — 금이 간 뒤 장면 끝까지 이어서 떨어진다
        const shed = Math.max(1.2, f.span.end - crackT - 0.2);
        for (let i = 0; i < 16; i++) {
          const at = crackT + 0.2 + hash(i) * shed;
          const fk = span01(t, at, at + 0.9);
          if (fk <= 0 || fk >= 1) continue;
          const [px, py] = crackPts[Math.floor(hash(i + 3) * (crackPts.length - 1))];
          c.save();
          c.globalAlpha = 1 - fk;
          c.fillStyle = '#2f3a4d';
          c.translate(px, py + easeInCubic(fk) * 120);
          c.rotate(fk * 4 + i);
          c.beginPath();
          c.moveTo(0, -4);
          c.lineTo(4, 3);
          c.lineTo(-3, 2);
          c.closePath();
          c.fill();
          c.restore();
        }
      }
    },

    // 10 좌 겨울 / 우 햇빛, 경계에 아야 — 경계가 흔들리다 닫힘
    splitLR(c, f) {
      const { t } = f;
      const close = easeInCubic(span01(t, f.span.end - 1.2, f.span.end));
      const wob = f.k * (Math.sin(t * 3.1) * 8 + Math.sin(t * 7.3) * 4);
      const xd = lerp(W / 2 + wob, W + 20, close);
      const edge = (x0: number) => {
        c.beginPath();
        c.moveTo(x0, -10);
        for (let y = 0; y <= H + 10; y += 30) c.lineTo(x0 + Math.sin(y * 0.02 + t * 4) * 6 * f.k, y);
        c.lineTo(x0, H + 10);
      };
      vgrad(c, [[0, '#aebfd2'], [0.7, '#dbe3ec'], [1, '#eef2f6']]);
      snowfall(c, t, { count: 80, seed: 101, wind: 16 });
      c.save();
      edge(xd);
      c.lineTo(W + 20, H + 10);
      c.lineTo(W + 20, -10);
      c.closePath();
      c.clip();
      vgrad(c, [[0, desat('#ffe39a', 0.8)], [0.7, desat('#f2b04c', 0.8)], [1, desat('#d98a2a', 0.8)]]);
      vgrad(c, [[0, 'rgba(255,250,232,0.55)'], [0.4, 'rgba(255,250,232,0)']], 0, 0, W, H);
      for (let i = 0; i < 9; i++) {
        const x = 700 + i * 72 + hash(i) * 30;
        const y = 560 + hash(i + 9) * 60;
        stem(c, x, y, H + 20, 7, { sat: 0.7, lean: (hash(i + 3) - 0.5) * 30, seed: i });
        stampFlower(c, x + Math.sin(t + i) * 2, y, 58 + hash(i + 5) * 20, { seed: i, sat: 0.7, squash: 0.85, rot: (hash(i + 7) - 0.5) * 0.4 });
      }
      petalfall(c, t, { count: 10, seed: 103, sat: 0.7, size: [10, 18], wind: 20 });
      c.restore();
      c.save();
      edge(xd);
      c.strokeStyle = 'rgba(255,255,255,0.75)';
      c.lineWidth = 2;
      c.stroke();
      c.restore();
      girl(c, W / 2, 660, 440, { t, color: '#2f2a3c', wind: 0.3, rim: 'rgba(255,255,255,0.5)', rimBlur: 14 });
    },

    // 11 꽃잎을 따라 내려감(틸트 다운) — 탁자 끝을 지나 바닥에 닿은 꽃잎 위로 눈이 덮임
    petalFall(c, f) {
      const { t } = f;
      const t0 = f.span.start;
      const fallEnd = t0 + 5.6;
      const fall = smooth(span01(t, t0 + 0.5, fallEnd));
      const camY = fall * H * 1.7;
      const snowK = span01(t, fallEnd + 0.3, f.span.end);
      const floorY = H * 1.7 + 470;
      c.save();
      c.translate(0, -camY);
      // 위: 방 안 꽃병 / 가운데: 벽 / 아래: 바닥(창빛이 비스듬히)
      vgrad(c, [[0, '#3d3540'], [0.36, '#352e38'], [0.62, '#2a2430'], [1, '#231e28']], 0, 0, W, H * 2.8);
      glow(c, 1020, 140, 420, 'rgba(210,225,245,0.5)', 0.7);
      c.fillStyle = '#4a3f47';
      c.fillRect(0, 590, W, 26);
      c.fillStyle = '#2f282f';
      c.fillRect(0, 616, W, 46);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(0, 616, W, 2);
      vaseFlower(c, t, 640, 600, 1, { sat: 0.55, petals: 0.82 });
      // 바닥 널 — 아래로 갈수록 넓어지는 원근
      const fy0 = H * 1.7 + 250;
      vgrad(c, [[0, '#2b2430'], [1, '#3a3038']], 0, fy0, W, H * 2.8 - fy0);
      c.strokeStyle = 'rgba(15,10,18,0.55)';
      c.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) {
        const y = fy0 + Math.pow(i / 8, 1.6) * (H * 2.8 - fy0);
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(W, y);
        c.stroke();
      }
      for (let i = -6; i <= 6; i++) {
        c.beginPath();
        c.moveTo(W / 2 + i * 60, fy0);
        c.lineTo(W / 2 + i * 260, H * 2.8);
        c.stroke();
      }
      c.save();
      c.globalAlpha = 0.16;
      c.fillStyle = '#c9d8ea';
      c.beginPath();
      c.moveTo(380, fy0);
      c.lineTo(760, fy0);
      c.lineTo(1040, H * 2.8);
      c.lineTo(420, H * 2.8);
      c.closePath();
      c.fill();
      c.restore();
      petalfall(c, t, { count: 14, seed: 111, sat: 0.55, area: [140, 300, 1000, H * 2.1], speed: [80, 150], size: [18, 30], wind: 12 });
      c.restore();
      // 앞을 스치는 큰 꽃잎(초점 밖)
      c.save();
      c.filter = 'blur(5px)';
      for (let i = 0; i < 2; i++) {
        const u = ((t - t0) * 0.32 + i * 0.5) % 1;
        fallingPetal(c, 240 + i * 820, -120 + u * (H + 240), 120, t * 0.7 + i, t * 1.8 + i, 0.55, 0.45 * (1 - snowK));
      }
      c.restore();
      // 따라 내려가는 꽃잎 — 화면 가운데에 머물다 바닥에 내려앉는다
      const landK = smooth(span01(t, fallEnd - 0.9, fallEnd));
      const px = 650 + Math.sin(t * 1.3) * 60 * (1 - landK);
      const py = lerp(330, floorY - camY, landK);
      const still = t >= fallEnd;
      if (snowK < 1) {
        glow(c, px, py, 110, 'rgba(255,214,120,0.5)', 0.4 * (1 - snowK));
        fallingPetal(c, px, py, 78, still ? 1.35 : t * 1.1, still ? Math.PI / 2.4 : t * 2.6, 0.62, 1);
      }
      if (snowK > 0) {
        snowfall(c, t, { count: Math.floor(30 + 80 * snowK), seed: 113, wind: 10, alpha: 0.9 * clamp(snowK * 2), size: [1.5, 5] });
        glow(c, px, py, 60 + 200 * snowK, 'rgba(244,247,251,0.98)', clamp(snowK * 1.2));
      }
    },
  };
}

/** 위에서 본 아야 — 퍼진 치맛자락, 어깨, 정수리(가르마·더듬이 머리) */
export function ayaTop(c: Ctx, x: number, y: number, s: number, rot: number, t: number) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(s, s);
  c.fillStyle = '#2d2639';
  c.shadowColor = 'rgba(196,176,230,0.7)';
  c.shadowBlur = 26;
  c.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * TAU;
    const r = 104 + Math.sin(a * 7 + t * 1.5) * 5;
    if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.92);
    else c.moveTo(Math.cos(a) * r, 0);
  }
  c.closePath();
  c.fill();
  c.shadowBlur = 0;
  c.fillStyle = '#3a3149';
  c.beginPath();
  c.ellipse(0, 6, 82, 34, 0, 0, TAU);
  c.fill();
  // 등 뒤로 흘러내린 머리
  c.fillStyle = '#4a3d63';
  c.beginPath();
  c.moveTo(-34, 0);
  c.quadraticCurveTo(-40, 60, -10, 92);
  c.lineTo(10, 92);
  c.quadraticCurveTo(40, 60, 34, 0);
  c.closePath();
  c.fill();
  c.beginPath();
  c.arc(0, -2, 40, 0, TAU);
  c.fill();
  c.strokeStyle = 'rgba(30,24,40,0.8)';
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(0, -38);
  c.lineTo(0, 30);
  c.stroke();
  c.strokeStyle = '#4a3d63';
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, -36);
  c.quadraticCurveTo(14, -62, -6, -60);
  c.stroke();
  c.restore();
}

// ── 흩어진 방(05·17·18) ───────────────────────────────

const FRAG_COLORS = ['#e9e1d4', '#c9bcd8', '#b6c4d4', '#d8cbb8', '#a99bb8'];

/** 방 안 물건 조각 하나 — 사진, 편지, 찻잔, 리본, 종이 */
export function drawFragment(c: Ctx, x: number, y: number, s: number, rot: number, kind: number, seed: number, alpha = 1) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(s, s);
  c.globalAlpha *= alpha;
  const col = FRAG_COLORS[seed % FRAG_COLORS.length];
  c.lineWidth = 1.5;
  c.strokeStyle = 'rgba(40,34,48,0.5)';
  switch (kind) {
    case 0: // 사진
      c.fillStyle = '#f2ede4';
      c.fillRect(-34, -40, 68, 80);
      c.fillStyle = col;
      c.fillRect(-28, -34, 56, 56);
      break;
    case 1: // 편지
      c.fillStyle = col;
      c.fillRect(-44, -28, 88, 56);
      c.beginPath();
      c.moveTo(-44, -28);
      c.lineTo(0, 6);
      c.lineTo(44, -28);
      c.stroke();
      break;
    case 2: // 찻잔
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(-26, -22);
      c.lineTo(26, -22);
      c.lineTo(18, 22);
      c.lineTo(-18, 22);
      c.closePath();
      c.fill();
      c.beginPath();
      c.arc(30, 0, 11, -Math.PI / 2, Math.PI / 2);
      c.stroke();
      break;
    case 3: // 리본
      c.strokeStyle = col;
      c.lineWidth = 7;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(-40, 0);
      c.bezierCurveTo(-20, -30, 0, 30, 20, 0);
      c.quadraticCurveTo(30, -14, 42, -4);
      c.stroke();
      break;
    default: // 글 쓴 종이
      c.fillStyle = '#efe9de';
      c.fillRect(-30, -40, 60, 80);
      c.strokeStyle = 'rgba(70,70,90,0.45)';
      c.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.moveTo(-22, -28 + i * 11);
        c.lineTo(10 + hash(seed + i) * 12, -28 + i * 11);
        c.stroke();
      }
  }
  c.restore();
}

/**
 * 흩어진 방 — 물건 조각들이 세 겹 깊이로 떠서 천천히 돈다(가까운 것일수록 크고 빠름).
 * zoom: 카메라 거리, mix: 눈송이·꽃잎이 섞이는 정도(0~1), pull: 조각이 가운데로 빨려 드는 정도(0~1)
 */
export function roomScatter(c: Ctx, t: number, zoom: number, seed: number, mix: number, pull = 0) {
  vgrad(c, [[0, '#302936'], [0.6, '#272130'], [1, '#1d1923']]);
  // 왼쪽 위 창에서 드는 차가운 빛
  c.save();
  c.globalAlpha = 0.18;
  c.fillStyle = '#c9d8ea';
  c.beginPath();
  c.moveTo(140, 0);
  c.lineTo(420, 0);
  c.lineTo(760, H);
  c.lineTo(380, H);
  c.closePath();
  c.fill();
  c.restore();
  glow(c, W / 2, H / 2 + 40, 360, 'rgba(160,140,190,0.5)', 0.6);
  const r = rng(seed);
  const items = Array.from({ length: 34 }, (_, i) => ({
    x: (r() - 0.5) * 2.4,
    y: (r() - 0.5) * 1.6,
    z: 0.55 + r() * 0.9,
    rot: r() * TAU,
    vr: (r() - 0.5) * 0.5,
    kind: Math.floor(r() * 5),
    i,
    swap: r() < mix,
    ph: r() * TAU,
  }));
  const draw = (back: boolean) => {
    for (const it of items) {
      if (back !== it.z < 1) continue;
      const pk = clamp(pull * (1.4 - it.z * 0.5));
      const ox = it.x * (1 - pk) + Math.sin(t * 0.3 + it.ph) * 0.03;
      const oy = it.y * (1 - pk) + Math.cos(t * 0.25 + it.ph) * 0.03 - t * 0.004 * it.z;
      const k = zoom * it.z;
      const x = W / 2 + ox * (W / 2) * k;
      const y = H / 2 + oy * (H / 2) * k;
      const s = k * (0.9 + 0.3 * it.z) * (1 - pk * 0.6);
      const a = clamp(1.2 - Math.abs(it.z - 1) * 0.6) * (1 - clamp((pk - 0.85) * 6));
      if (it.swap) {
        if (it.i % 2) fallingPetal(c, x, y, 26 * s, it.rot + t * it.vr, t * 2 + it.ph, 0.6, a);
        else {
          c.save();
          c.globalAlpha = a;
          c.strokeStyle = '#eef3f9';
          c.lineWidth = 2 * s;
          c.beginPath();
          for (let j = 0; j < 6; j++) {
            const an = (j / 6) * TAU + it.rot + t * it.vr;
            c.moveTo(x, y);
            c.lineTo(x + Math.cos(an) * 16 * s, y + Math.sin(an) * 16 * s);
          }
          c.stroke();
          c.restore();
        }
      } else drawFragment(c, x, y, s, it.rot + t * it.vr, it.kind, it.i, a);
    }
  };
  draw(true);
  girl(c, W / 2, H / 2 + 175 * zoom, 300 * zoom, { t, color: '#241f2d', rim: 'rgba(196,176,230,0.75)', rimBlur: 20, wind: Math.sin(t * 0.5) * 0.4 });
  draw(false);
}
