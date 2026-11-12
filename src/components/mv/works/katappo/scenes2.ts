// 片っぽ 장면 12~23 — 2절 · 프리코러스 2 · 후렴 2 (PLAN.md 표 번호)
import { TAU, clamp, easeInCubic, easeOutCubic, hash, lerp, noise1, rng, setFont, smooth } from '../../engine';
import { desat, mixHex, wash } from '../../paint';
import { fallingPetal, stampFlower, stem, sunflower } from './flora';
import { girl, profile } from './figure';
import { dust, petalfall, snowfall } from './fx';
import { COL, type Ctx, H, type Kit, type SceneFn, W, cam, chunkT, glow, span01, vgrad, zoomAt } from './kit';
import { ayaTop, drawFragment, roomScatter } from './scenes1';

// ── 공용 ──────────────────────────────────────────────

/** 눈밭 원근 — 지평선 y */
function snowField(c: Ctx, horizon: number, sky: [string, string], ground: [string, string]) {
  vgrad(c, [[0, sky[0]], [1, sky[1]]], 0, 0, W, horizon + 2);
  vgrad(c, [[0, ground[0]], [1, ground[1]]], 0, horizon, W, H - horizon);
  c.save();
  c.strokeStyle = 'rgba(150,170,195,0.25)';
  c.lineWidth = 1;
  for (let i = 1; i < 14; i++) {
    const y = horizon + Math.pow(i / 14, 2) * (H - horizon);
    c.beginPath();
    for (let x = 0; x <= W; x += 40) {
      const yy = y + noise1(x * 0.006 + i, 3) * (4 + i);
      if (x) c.lineTo(x, yy);
      else c.moveTo(x, yy);
    }
    c.stroke();
  }
  c.restore();
}

/** 원근 발자국 — near(화면 아래)에서 vanish(지평선 위 점)까지. reveal: 보이는 비율 */
function footprints(c: Ctx, horizon: number, vx: number, n: number, reveal: number, shift: number) {
  c.save();
  for (let i = n - 1; i >= 0; i--) {
    const z = (i + shift) / n;
    if (z > reveal || z < 0) continue;
    const d = Math.pow(1 - z, 2.2);
    const y = horizon + d * (H + 60 - horizon);
    const x = lerp(vx, 640, d) + (i % 2 ? 1 : -1) * 26 * d;
    const s = 0.15 + 0.85 * d;
    c.fillStyle = `rgba(110,128,156,${0.25 + 0.4 * d})`;
    c.beginPath();
    c.ellipse(x, y, 13 * s, 26 * s * 0.45, 0, 0, TAU);
    c.fill();
    c.beginPath();
    c.ellipse(x, y + 26 * s * 0.5, 10 * s, 12 * s * 0.4, 0, 0, TAU);
    c.fill();
  }
  c.restore();
}

/** 눈보라 속 아야(14·16) */
function winterPortrait(c: Ctx, t: number, cx: number, seed: number) {
  vgrad(c, [[0, '#b8c7d7'], [0.6, '#cdd8e3'], [1, '#e8edf3']]);
  glow(c, cx, 300, 380, 'rgba(240,245,252,0.9)', 0.6);
  snowfall(c, t, { count: 90, seed, wind: 140, speed: [120, 260], size: [1.5, 4], alpha: 0.75 });
  girl(c, cx, 690, 480, { t, color: '#2e3548', wind: 0.5 + Math.sin(t * 2) * 0.15, rim: 'rgba(240,246,255,0.7)', rimBlur: 16 });
  snowfall(c, t, { count: 40, seed: seed + 1, wind: 220, speed: [200, 340], size: [4, 9], alpha: 0.55, blur: true });
}

/** 같은 자리의 해바라기 한 송이(15·16) */
function flowerPortrait(c: Ctx, t: number, cx: number) {
  vgrad(c, [[0, '#fff1c4'], [0.6, '#f8cf72'], [1, '#e9a23f']]);
  glow(c, cx, 270, 420, 'rgba(255,250,232,0.9)', 0.7);
  stem(c, cx, 300, H + 40, 14, { sat: 0.9, lean: -10, seed: 2 });
  sunflower(c, cx + Math.sin(t * 0.9) * 4, 262, 170, { sat: 0.9, t, seed: 5 });
  dust(c, t, 30, 151, '#fffbe8', 0.7);
}

// ── 장면 ──────────────────────────────────────────────

export function scenes2(kit: Kit): Record<string, SceneFn> {
  return {
    // 12 눈길 발자국이 멀리 낮은 해 쪽으로 — 해가 멀어지며 작아지고, 카메라는 발자국을 따라 낮게 나아감
    footprints(c, f) {
      const { t } = f;
      const horizon = 300;
      zoomAt(c, 1 + f.k * 0.12, 780, 300, () => {
        snowField(c, horizon, ['#c8d4e2', '#f0e6dc'], ['#e2e8ef', '#f6f8fb']);
        const sunR = lerp(70, 34, f.k);
        const sunY = lerp(horizon - 40, horizon - 8, f.k);
        glow(c, 780, sunY, sunR * 5, 'rgba(255,246,228,0.95)', 0.85);
        c.fillStyle = 'rgba(255,252,244,0.95)';
        c.beginPath();
        c.arc(780, sunY, sunR * 0.6, 0, TAU);
        c.fill();
        footprints(c, horizon, 780, 26, 0.25 + 0.75 * smooth(span01(t, f.span.start, f.span.start + 2.5)), (f.age * 0.35) % 2);
      });
      snowfall(c, t, { count: 50, seed: 121, wind: 20, alpha: 0.75, size: [1, 3.5] });
    },

    // 13 발자국이 멈춘 자리의 아야(뒷모습) — 해는 지평선 너머, 청색 저녁
    // 저물어 가는 빛과 함께 카메라가 천천히 물러나 혼자 선 모습이 작아진다
    standing(c, f) {
      const { t } = f;
      const horizon = 380;
      const dusk = f.k;
      zoomAt(c, 1.12 - 0.12 * f.k, 700, 420, () => {
        snowField(c, horizon, [mixHex('#c3cfde', '#5d6f8c', dusk), mixHex('#efe2d6', '#9aa6bd', dusk)], [mixHex('#dfe6ee', '#a9b6c8', dusk), '#eef2f6']);
        glow(c, 760, horizon + 4, 260, 'rgba(255,236,214,0.9)', 0.6 * (1 - clamp(dusk)));
        footprints(c, horizon, 700, 18, 0.82, 0);
        girl(c, 700, horizon + 70, 190, { t, color: '#2b3244', back: true, wind: 0.6 + Math.sin(t) * 0.2 });
      });
      snowfall(c, t, { count: 60, seed: 131, wind: 30, alpha: 0.75, size: [1, 3.5] });
    },

    // 14 눈보라 한가운데 아야 — 청백만
    winterCore(c, f) {
      cam(c, 1 + f.k * 0.05, W / 2, H / 2, () => winterPortrait(c, f.t, W / 2, 141));
    },

    // 15 같은 자리에 해바라기 한 송이 — 14와 대칭
    sunFlower(c, f) {
      cam(c, 1 + f.k * 0.05, W / 2, H / 2, () => flowerPortrait(c, f.t, W / 2));
    },

    // 16 14·15를 좌우로 붙임 — 「片っぽ」에서 틈이 벌어져 화면 밖으로
    splitGap(c, f) {
      const { t } = f;
      const openT = chunkT(kit.lines(), 19, 1);
      const open = easeOutCubic(span01(t, openT, openT + 0.8)) * 90 + easeInCubic(span01(t, f.span.end - 1.6, f.span.end)) * (W / 2 + 20);
      c.fillStyle = '#f7f9fb';
      c.fillRect(0, 0, W, H);
      c.save();
      c.beginPath();
      c.rect(0, 0, W / 2 - open, H);
      c.clip();
      c.translate(-open - W / 4, 0);
      winterPortrait(c, t, W / 2, 161);
      c.restore();
      c.save();
      c.beginPath();
      c.rect(W / 2 + open, 0, W / 2, H);
      c.clip();
      c.translate(open + W / 4, 0);
      flowerPortrait(c, t, W / 2);
      c.restore();
    },

    // 17 흩어진 방을 위에서 — 조각에 눈송이·꽃잎이 섞임
    scatterTop(c, f) {
      const { t } = f;
      const rot = f.age * 0.06;
      c.fillStyle = '#211c27';
      c.fillRect(0, 0, W, H);
      glow(c, W / 2, H / 2, 560, 'rgba(110,96,130,0.8)', 0.7);
      const r = rng(171);
      const items = Array.from({ length: 40 }, () => ({ a: r() * TAU, d: 140 + r() * 520, z: 0.6 + r() * 0.8, kind: Math.floor(r() * 7), ph: r() * TAU }));
      const draw = (near: boolean) => {
        for (const [i, it] of items.entries()) {
          if (near !== it.z > 1.1) continue;
          const a = it.a + rot * (0.6 + it.z * 0.4);
          const x = W / 2 + Math.cos(a) * it.d * 1.2;
          const y = H / 2 + Math.sin(a) * it.d * 0.75;
          const s = it.z * (1 + f.k * 0.1);
          if (it.kind === 5) fallingPetal(c, x, y, 30 * s, a + t * 0.4, t * 2 + it.ph, 0.6, 0.9);
          else if (it.kind === 6) {
            c.save();
            c.strokeStyle = '#eef3f9';
            c.lineWidth = 2 * s;
            c.globalAlpha = 0.9;
            c.beginPath();
            for (let j = 0; j < 6; j++) {
              const an = (j / 6) * TAU + t * 0.3 + it.ph;
              c.moveTo(x, y);
              c.lineTo(x + Math.cos(an) * 16 * s, y + Math.sin(an) * 16 * s);
            }
            c.stroke();
            c.restore();
          } else drawFragment(c, x, y, s, a + it.ph, it.kind, i + 3);
        }
      };
      draw(false);
      ayaTop(c, W / 2, H / 2, 1.05, -rot * 0.5, t);
      draw(true);
    },

    // 18 조각과 가사 글자가 아야에게 빨려 듦 — 빌드업, 끝까지 빨라지며 다음 장면으로
    scatterPull(c, f) {
      const { t } = f;
      const k = clamp(f.k);
      roomScatter(c, t, lerp(1.0, 1.55, easeInCubic(k)), 181, 0.45, easeInCubic(k) * 0.9);
      const line = kit.lines()[20];
      if (line) {
        const chars = [...line.ja.map((j) => j.text).join('').replace(/\s/g, '')];
        const ld = Math.max(1, line.end - line.t);
        chars.forEach((ch, i) => {
          const at = line.t + (i / chars.length) * ld * 0.8;
          const born = span01(t, at, at + 0.3);
          if (born <= 0) return;
          const pull = easeInCubic(span01(t, at + 0.4, at + 2.6));
          const a = (i / chars.length) * TAU * 1.3 + 0.4;
          const R = lerp(560, 30, pull);
          const x = W / 2 + Math.cos(a + pull * 2) * R * 1.1;
          const y = H / 2 + 40 + Math.sin(a + pull * 2) * R * 0.62;
          c.save();
          c.globalAlpha = born * (1 - clamp((pull - 0.85) * 6));
          c.translate(x, y);
          c.rotate(pull * 4 + i);
          c.scale(1 - pull * 0.7, 1 - pull * 0.7);
          c.fillStyle = '#efe6fb';
          c.shadowColor = 'rgba(196,176,230,0.9)';
          c.shadowBlur = 14;
          setFont(c, '逸恋慕'.includes(ch) ? 80 : 54, kit.fonts.ja, 600);
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(ch, 0, 0);
          c.restore();
        });
      }
      const v = c.createRadialGradient(W / 2, H / 2, 380 - 200 * k, W / 2, H / 2, 760 - 240 * k);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(6,4,10,${0.4 + 0.5 * k})`);
      c.fillStyle = v;
      c.fillRect(0, 0, W, H);
    },

    // 19 창밖 눈 덮인 해바라기 밭, 창틀 안의 아야 — 창틀 따라 살짝 회전
    window(c, f) {
      const { t } = f;
      cam(c, 1.08, W / 2, H / 2, () => {
        // 창밖
        vgrad(c, [[0, '#d6e0ea'], [0.55, '#eef1f4'], [1, '#e2e8ee']]);
        glow(c, 860, 200, 380, 'rgba(255,248,230,0.9)', 0.6);
        for (let row = 0; row < 3; row++) {
          for (let i = 0; i < 12; i++) {
            const x = 120 + i * 95 + hash(i + row * 31) * 50 + row * 30;
            const y = 420 + row * 70 + (hash(i * 7 + row) - 0.5) * 44;
            const r = (26 + row * 12) * (0.82 + hash(i * 5 + row * 3) * 0.36);
            stem(c, x, y, H + 40, 4 + row * 2, { sat: 0.35, lean: 8, seed: i, leaves: 1 });
            stampFlower(c, x, y, r, { seed: i + row * 12, sat: 0.4, squash: 0.7, rot: 0.5 + hash(i) * 0.3 });
            c.fillStyle = 'rgba(248,250,252,0.92)';
            c.beginPath();
            c.ellipse(x - r * 0.1, y - r * 0.5, r * 0.75, r * 0.28, 0.4, 0, TAU);
            c.fill();
          }
        }
        snowfall(c, t, { count: 60, seed: 191, wind: 20, alpha: 0.85 });
        // 방 안 벽과 창틀
        c.fillStyle = '#2a2430';
        c.beginPath();
        c.rect(-200, -200, W + 400, H + 400);
        c.rect(260, 70, 760, 560);
        c.fill('evenodd');
        c.fillStyle = '#3b3340';
        c.fillRect(260, 340, 760, 16);
        c.fillRect(632, 70, 16, 560);
        c.strokeStyle = '#4a4150';
        c.lineWidth = 18;
        c.strokeRect(260, 70, 760, 560);
        c.fillStyle = '#3b3340';
        c.fillRect(230, 630, 820, 26);
        girl(c, 780, 760, 560, { t, color: '#211c29', back: true, rim: 'rgba(240,244,250,0.7)', rimBlur: 22 });
      }, Math.sin(f.age * 0.3) * 0.02 - f.k * 0.03);
    },

    // 20 원본 영상 프레임이 필름처럼 흐름
    filmStrip(c, f) {
      const { t } = f;
      vgrad(c, [[0, '#2c2532'], [1, '#18141c']]);
      glow(c, W / 2, H / 2, 600, 'rgba(120,100,140,0.6)', 0.6);
      // 칸마다 다른 순간 — 띠가 들어오는 쪽 칸이 가장 최근, 흘러갈수록 지난 순간(아래 띠는 1.2초 더 지난 것부터)
      const strip = (y: number, dir: number, rot: number, tint: string, seed: number, lag: number) => {
        c.save();
        c.translate(W / 2, y);
        c.rotate(rot);
        const fw = 300;
        const fh = 200;
        const gap = 30;
        const step = fw + gap;
        const off = ((f.age * 90 * dir) % step + step) % step;
        c.fillStyle = '#0f0d12';
        c.fillRect(-W, -fh / 2 - 34, W * 2, fh + 68);
        for (let i = -5; i <= 5; i++) {
          const x = i * step + off - step / 2;
          const past = lag + clamp((x * dir + W / 2) / W) * 3;
          if (!kit.footage(c, f.video, x - fw / 2, -fh / 2, fw, fh, past)) {
            c.fillStyle = '#4c4258';
            c.fillRect(x - fw / 2, -fh / 2, fw, fh);
            wash(c, `k-film-${seed}-${(i + 20) % 3}`, { color: COL.lav, size: 200 }, x, 0, fh * 0.9, 1, 0.7);
          }
          c.fillStyle = tint;
          c.fillRect(x - fw / 2, -fh / 2, fw, fh);
        }
        c.fillStyle = '#d8d0c4';
        for (let x = -W; x < W; x += 34) {
          const xx = x + ((off * 1.0) % 34);
          c.fillRect(xx, -fh / 2 - 24, 16, 12);
          c.fillRect(xx, fh / 2 + 12, 16, 12);
        }
        c.restore();
      };
      strip(220, 1, -0.06, 'rgba(255,220,160,0.14)', 1, 0);
      strip(520, -1, -0.06, 'rgba(170,190,230,0.16)', 2, 1.2);
      dust(c, t, 30, 201, '#fff4e0', 0.4);
    },

    // 21 아야 옆얼굴, 뒤로 빛 번짐 — 「あぁ」에 입김
    profile(c, f) {
      const { t } = f;
      const line = kit.lines()[24];
      vgrad(c, [[0, '#f6dfa8'], [0.6, '#e9b866'], [1, '#c98a3c']].map(([o, col]) => [o as number, desat(col as string, 0.7)] as [number, string]));
      glow(c, 360, 300, 560, 'rgba(255,248,226,0.95)', 0.9);
      dust(c, t, 50, 211, '#fffaf0', 0.8);
      const ah = line ? span01(t, line.t, line.t + 1.6) : 0;
      cam(c, 1 + f.k * 0.12, 700 - f.k * 30, 360, () => {
        profile(c, 640, 330, 520, { t, color: '#2a2233', rim: 'rgba(255,240,205,0.95)', rimBlur: 36, breath: ah > 0 && ah < 1 ? ah : 0 });
      });
    },

    // 22 위 겨울 / 아래 해 — 경계에 선 아야, 아래 비친 모습은 해바라기
    splitTB(c, f) {
      const { t } = f;
      const mid = H / 2 + 40;
      // 경계(수면) 높이를 기준으로 천천히 다가간다
      c.translate(W / 2, mid);
      c.scale(1 + f.k * 0.07, 1 + f.k * 0.07);
      c.translate(-W / 2, -mid);
      vgrad(c, [[0, '#9fb3ca'], [1, '#dce4ed']], 0, 0, W, mid);
      snowfall(c, t, { count: 60, seed: 221, wind: 18, area: [0, 0, W, mid] });
      vgrad(c, [[0, desat('#f7c96a', 0.85)], [1, desat('#e48d2a', 0.85)]], 0, mid, W, H - mid);
      c.save();
      c.beginPath();
      c.rect(0, mid, W, H - mid);
      c.clip();
      // 물에 비친 듯 거꾸로 선 해바라기 + 위로 떠오르는 꽃잎
      c.translate(W / 2, mid);
      c.scale(1, -1);
      const ripple = Math.sin(t * 2) * 3;
      stem(c, ripple, -200, 0, 9, { sat: 0.85, seed: 3 });
      sunflower(c, ripple, -232, 105, { sat: 0.85, t, seed: 7 });
      c.restore();
      c.save();
      c.beginPath();
      c.rect(0, mid, W, H - mid);
      c.clip();
      c.scale(1, -1);
      c.translate(0, -2 * mid - (H - mid) - 120);
      petalfall(c, t, { count: 16, seed: 223, sat: 0.85, area: [0, 0, W, H - mid + 120], wind: 10 });
      c.restore();
      // 경계선 물결
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.lineWidth = 2;
      c.beginPath();
      for (let x = 0; x <= W; x += 20) c.lineTo(x, mid + Math.sin(x * 0.02 + t * 2) * 2);
      c.stroke();
      girl(c, W / 2, mid, 300, { t, color: '#2b3244', wind: 0.4 });
    },

    // 23 꽃잎 폭풍(올려다봄) — 위쪽 꽃송이에서 꽃잎이 떨어져 나와 바람을 타고 흘러내린다.
    // 고음에 가까울수록 바람이 세지고 꽃잎이 많아진다. 무음 직전엔 큰 꽃잎 떼가 몰려와 화면을 덮은 채로
    // 무음(어둠 속 꽃잎 하나)으로 끊긴다 — 느려지거나 멈추지 않고 가장 꽉 찬 순간에 컷
    petalStorm(c, f) {
      const C = kit.cues();
      const { t, age } = f;
      const k = span01(t, f.span.start, C.hush);
      const gust = k * k;
      const flowers = Array.from({ length: 9 }, (_, i) => ({
        x: -80 + i * 180 + hash(i + 40) * 50,
        y: 60 + hash(i + 41) * 240,
        r: 110 + hash(i + 42) * 50,
      }));
      // 꽃잎 — 일부는 꽃송이 가장자리에서 막 떨어져 나오고, 나머지는 바람 위쪽(왼쪽 밖)에서 실려 와 화면을 가로지른다.
      // 바람은 오른쪽으로, 올려다보는 쪽(아래)으로 천천히 내려오며 다가올수록 커진다
      const N = 320;
      const active = 30 + (N - 30) * gust;
      const windX = 90 + 300 * gust;
      const petals = (front: boolean) => {
        for (let i = 0; i < active; i++) {
          const near = hash(i * 5 + 1) > 0.55;
          if (near !== front) continue;
          const sp = near ? 1.35 : 0.75;
          const vx = windX * sp;
          const vy = (25 + 55 * hash(i * 29 + 4)) * sp;
          const fromFlower = hash(i * 31 + 6) < 0.4;
          const life = fromFlower ? 2.2 + hash(i * 7 + 2) * 1.6 : (W + 300) / vx;
          const run = age + hash(i * 11 + 3) * life;
          const a = run % life;
          const cyc = Math.floor(run / life);
          let x0: number;
          let y0: number;
          if (fromFlower) {
            const fl = flowers[Math.floor(hash(i * 13 + cyc * 17) * flowers.length)];
            const ang = hash(i * 19 + cyc * 23) * TAU;
            x0 = fl.x + Math.cos(ang) * fl.r * 0.55;
            y0 = fl.y + Math.sin(ang) * fl.r * 0.45;
          } else {
            x0 = -150;
            y0 = -60 + hash(i * 37 + cyc * 41) * (H * 0.85);
          }
          const x = x0 + vx * a + Math.sin(a * 1.8 + i) * 36;
          const y = y0 + vy * a + Math.sin(a * 1.1 + i * 0.7) * 24;
          const len = (near ? 20 + 26 * gust : 11) * (1 + a * (near ? 0.35 : 0.12));
          const fade = clamp(a * (fromFlower ? 4 : 8)) * (fromFlower ? clamp((life - a) * 2) : 1);
          fallingPetal(c, x, y, len, a * (1.2 + hash(i)) + i, a * 4 + i, 0.85, fade * (near ? 0.95 : 0.7));
        }
      };
      cam(c, 1.08 + k * 0.12, W / 2, H / 2, () => {
        vgrad(c, [[0, desat('#d3e2ef', 0.9)], [0.55, desat('#fff1cf', 0.9)], [1, desat('#ffd27a', 0.9)]], -200, -200, W + 400, H + 400);
        for (let i = 0; i < 4; i++) {
          const cx = ((160 + i * 330 + age * 18 * (1 + gust * 4)) % (W + 500)) - 250;
          wash(c, `k-storm-cloud-${i}`, { color: '#fffaf0', size: 300, aspect: 2.4, layers: 20, alpha: 0.05 }, cx, 120 + (i % 2) * 90, 360, 1, 0.7);
        }
        petals(false);
        flowers.forEach((fl, i) => {
          // 바람이 세지면 꽃송이도 흔들린다
          const sway = Math.sin(t * 0.8 + i) * 6 + gust * Math.sin(t * 3.2 + i * 1.7) * 12;
          stem(c, fl.x, fl.y + fl.r * 0.4, H + 220, 13, { sat: 0.85, lean: (W / 2 - fl.x) * 0.06, seed: i });
          stampFlower(c, fl.x + sway, fl.y, fl.r, { seed: i + 30, sat: 0.85, squash: 0.9, rot: (hash(i + 43) - 0.5) * 0.5 + sway * 0.004 });
        });
        petals(true);
      }, Math.sin(age * 0.25) * 0.04 + gust * 0.03);

      // 마지막 1.6초 — 큰 꽃잎 떼가 바람 위쪽(왼쪽 위)에서 빠르게 몰려온다. 늦게 출발할수록 많고 크고 가까워서
      // 컷 순간 화면이 꽃잎으로 덮인다
      const waveFrom = C.hush - 1.6;
      if (t > waveFrom) {
        for (let j = 0; j < 420; j++) {
          const lateness = Math.pow(hash(j * 3 + 900), 0.55);
          const born = waveFrom + lateness * 1.6;
          const a = t - born;
          if (a < 0) continue;
          const vx = 1500 + hash(j * 5 + 901) * 1000;
          const vy = vx * (0.2 + hash(j * 7 + 902) * 0.22);
          const x = -300 + vx * a;
          const y = -420 + hash(j * 11 + 903) * (H + 360) + vy * a;
          if (x > W + 300 || y > H + 300) continue;
          const len = (80 + hash(j * 13 + 904) * 140) * (0.6 + 0.8 * lateness);
          fallingPetal(c, x, y, len, a * 2.4 + j, a * 7 + j, 0.85, 0.96);
        }
      }
    },
  };
}
