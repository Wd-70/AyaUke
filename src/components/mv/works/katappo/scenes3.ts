// 片っぽ 장면 24~36 — 무음 · 브릿지 · 마지막 후렴(전조) · 아웃트로 (PLAN.md 표 번호)
import { TAU, clamp, easeInCubic, easeOutBack, easeOutCubic, hash, lerp, setFont } from '../../engine';
import { desat, mixHex, pencil, sample, wash, washBackdrop } from '../../paint';
import { type FrostSeg, PETAL, dropPath, drawFrost, fallingPetal, frostSegments, stampFlower, sunflower } from './flora';
import { girl, profile } from './figure';
import { dust, petalfall, snowfall } from './fx';
import { type Ctx, H, type Kit, type SceneFn, W, cam, chunkT, glow, span01, vgrad } from './kit';
import { vaseFlower } from './scenes1';
import { cutWithin } from './timeline';

type Pt = [number, number];

/**
 * 눈물 방울 — 밝은 물빛. 꼬리는 움직임의 반대쪽을 향한다.
 * dir: 꼬리가 향하는 각도(기본 위쪽 = 아래로 떨어지는 방울), stretch: 꼬리 길이(빠를수록 길게)
 */
function tear(c: Ctx, x: number, y: number, r: number, stretch = 1, alpha = 1, dir = -Math.PI / 2) {
  c.save();
  c.globalAlpha *= alpha;
  c.translate(x, y);
  c.rotate(dir + Math.PI / 2);
  const g = c.createLinearGradient(-r, -r * 2, r, r);
  g.addColorStop(0, 'rgba(235,245,255,0.95)');
  g.addColorStop(1, 'rgba(150,185,225,0.85)');
  c.fillStyle = g;
  dropPath(c, 0, 0, r, stretch);
  c.fill();
  c.rotate(-(dir + Math.PI / 2));
  // 반사광은 화면 기준 왼쪽 위에 고정
  c.fillStyle = 'rgba(255,255,255,0.9)';
  c.beginPath();
  c.ellipse(-r * 0.35, -r * 0.2, r * 0.18, r * 0.3, -0.4, 0, TAU);
  c.fill();
  c.restore();
}

/** 밭의 한 송이 — 줄에서 조금씩 어긋나게(앞뒤·좌우 위치, 키, 크기, 고개 각도), 드문드문 빈자리 */
function looseSpot(id: number, size: number) {
  return {
    dx: (hash(id * 3 + 1) - 0.5) * size * 0.9,
    dy: (hash(id * 3 + 2) - 0.5) * size * 0.55,
    s: 0.82 + hash(id * 3 + 3) * 0.36,
    tilt: (hash(id * 3 + 4) - 0.5) * 0.7,
    skip: hash(id * 3 + 5) < 0.06,
  };
}

/** 원근 해바라기 밭 — horizon 아래로 줄지어, open(d)로 줄마다 피어나는 정도 */
function field(c: Ctx, t: number, horizon: number, rows: number, sat: number, open: (d: number, i: number) => number) {
  for (let r = 0; r < rows; r++) {
    const d = (r + 1) / rows;
    const y0 = horizon + Math.pow(d, 1.8) * (H + 260 - horizon);
    const size0 = 10 + d * 120;
    const n = Math.ceil(W / (size0 * 1.25)) + 2;
    for (let i = 0; i < n; i++) {
      const id = r * 37 + i;
      const j = looseSpot(id, size0);
      if (j.skip) continue;
      const size = size0 * j.s;
      const x = (i - 0.5) * size0 * 1.25 + (r % 2) * size0 * 0.6 + j.dx;
      const y = y0 + j.dy;
      const o = open(d, id);
      c.strokeStyle = desat('#4f6b33', sat);
      c.lineWidth = Math.max(1, size * 0.08);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + (hash(id + 3) - 0.5) * size * 0.3, y + size * 1.6);
      c.stroke();
      stampFlower(c, x + Math.sin(t * 0.9 + id) * size * 0.04, y, size * 0.55, { seed: id, sat, squash: 0.82, rot: j.tilt, open: o });
    }
  }
}

export function scenes3(kit: Kit): Record<string, SceneFn> {
  let frost: FrostSeg[] | null = null;

  return {
    // 24 무음 4초 — 멈춘 꽃잎 하나, 나머지 거의 검정
    hush(c, f) {
      c.fillStyle = '#060508';
      c.fillRect(0, 0, W, H);
      glow(c, 640, 340, 280, 'rgba(255,214,120,0.4)', 0.45);
      // 거의 멈춘 듯 — 그래도 아주 천천히 가라앉으며 돈다
      fallingPetal(c, 640, 326 + f.age * 7 + Math.sin(f.age * 0.8) * 5, 96, 0.5 + f.age * 0.42, Math.PI / 3 + f.age * 0.35, 0.75, 1);
      dust(c, f.t, 14, 241, '#ffe9b8', 0.35);
    },

    // 25 흑백에 가까운 수채, 방 안 꽃병 — 고요하게, 카메라만 옆으로 아주 천천히 흐른다
    bridgeVase(c, f) {
      const { t } = f;
      c.translate(W / 2, H / 2);
      c.scale(1.06 + f.k * 0.03, 1.06 + f.k * 0.03);
      c.translate(-W / 2 + 26 - f.k * 52, -H / 2);
      c.drawImage(
        washBackdrop('k-bridge', W, H, '#cfd0d4', [
          { color: '#9a9ca4', x: 300, y: 300, d: 700 },
          { color: '#bcbec4', x: 1000, y: 200, d: 620 },
          { color: '#80828a', x: 640, y: 700, d: 900, aspect: 2 },
        ]),
        0,
        0,
      );
      c.save();
      c.beginPath();
      c.rect(760, 110, 380, 300);
      c.clip();
      vgrad(c, [[0, '#e9ebee'], [1, '#d7dadf']], 760, 110, 380, 300);
      snowfall(c, t, { count: 40, seed: 251, area: [760, 110, 380, 300], wind: 8, size: [1, 3] });
      c.restore();
      c.strokeStyle = '#5d5f66';
      c.lineWidth = 10;
      c.strokeRect(760, 110, 380, 300);
      c.fillRect(945, 110, 10, 300);
      c.fillStyle = '#6c6e75';
      c.fillRect(0, 560, W, 160);
      vaseFlower(c, t, 480, 566, 0.78, { sat: 0.08, petals: 0.5, seed: 5 });
      dust(c, t, 18, 252, '#f4f4f6', 0.3);
    },

    // 26 아야를 감싸는 희미한 따뜻한 빛(유일한 색)
    warmLight(c, f) {
      const { t } = f;
      const warm = 0.4 + 0.5 * f.k;
      // 27(빛이 팔처럼 감쌈)과 같은 구도 — 여기서 1.06까지 다가가 27이 이어받는다
      cam(c, 1 + 0.06 * f.k, 640, 380, () => {
        vgrad(c, [[0, '#3a3d48'], [1, '#22232b']], 0, -60, W, H + 120);
        glow(c, 640, 400, 520, 'rgba(255,200,120,0.85)', warm);
        girl(c, 640, 1270, 1150, { t, color: '#25202c', rim: 'rgba(255,214,150,0.95)', rimBlur: 30 + 20 * warm });
      });
      dust(c, t, 36, 261, '#ffd9a0', 0.55 * warm);
    },

    // 27 빛이 팔처럼 아야를 감쌈 — 끝에 가장자리가 조이며 암전
    embrace(c, f) {
      const { t } = f;
      const lines = kit.lines();
      const a1 = chunkT(lines, 31, 0);
      const a2 = chunkT(lines, 31, 1);
      // 26에서 이어받아(1.06) 점점 빨리 다가가며 암전으로
      cam(c, 1.06 + 0.3 * (0.3 * f.k + 0.7 * f.k * f.k), 640, 380, () => {
        vgrad(c, [[0, '#33343f'], [1, '#1b1c23']], 0, -60, W, H + 120);
        glow(c, 640, 400, 560, 'rgba(255,196,110,0.85)', 0.85);
        girl(c, 640, 1270, 1150, { t, color: '#25202c', rim: 'rgba(255,214,150,0.95)', rimBlur: 46 });
        const arm = (pts: Pt[], p: number, seed: number) => {
          c.save();
          c.shadowColor = 'rgba(255,214,140,1)';
          c.shadowBlur = 34;
          pencil(c, pts, p, { width: 22, color: 'rgba(255,226,170,0.55)', seed, passes: 1, jitter: 0.5 });
          c.shadowBlur = 0;
          pencil(c, pts, p, { width: 3, color: '#fff3d8', seed: seed + 1, passes: 2, jitter: 0.8 });
          c.restore();
        };
        // 등 뒤 어깨에서 바깥으로 둥글게 돌아 허리 앞에서 만난다(엇갈리지 않게)
        const left = sample((u) => [lerp(500, 626, u) - Math.sin(u * Math.PI) * 120, lerp(250, 560, u)], 30);
        const right = sample((u) => [lerp(780, 654, u) + Math.sin(u * Math.PI) * 120, lerp(245, 556, u)], 30);
        arm(left, easeOutCubic(span01(t, a1, a1 + 2.2)), 271);
        arm(right, easeOutCubic(span01(t, a2, a2 + 2.2)), 273);
      });
      const tight = f.k * f.k;
      const v = c.createRadialGradient(W / 2, H / 2, 360 - 260 * tight, W / 2, H / 2, 760 - 380 * tight);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(4,3,6,${0.5 + 0.5 * tight})`);
      c.fillStyle = v;
      c.fillRect(0, 0, W, H);
      const out = span01(t, f.span.end - 0.6, f.span.end);
      if (out > 0) {
        c.fillStyle = `rgba(0,0,0,${easeInCubic(out)})`;
        c.fillRect(0, 0, W, H);
      }
    },

    // 28 겨울 땅에서 해바라기가 한꺼번에 피어남 — 크레인 업, 아껴 둔 금색 전부
    bloom(c, f) {
      const { t } = f;
      const t0 = f.span.start;
      // 크레인 업 — 처음에 빠르게 올라오고, 끝까지 천천히 계속 올라간다(멈춘 채 넘어가지 않게)
      const p = easeOutCubic(span01(t, t0, t0 + 2.2));
      const horizon = lerp(-160, 400, p) + f.age * 16;
      vgrad(c, [[0, '#fff6d6'], [1, '#ffd27a']], 0, 0, W, Math.max(1, horizon + 4));
      glow(c, 640, horizon - 60, 520, 'rgba(255,250,232,0.95)', 0.8);
      const melt = easeOutCubic(span01(t, t0, t0 + 1.4));
      vgrad(c, [[0, mixHex('#e9eef3', '#9a8f3e', melt)], [1, mixHex('#f5f8fb', '#5d6e2c', melt)]], 0, horizon, W, H - horizon + 10);
      field(c, t, horizon, 9, 1, (d, i) => easeOutBack(span01(t, t0 + 0.05 + (1 - d) * 0.5 + hash(i) * 0.35, t0 + 0.6 + (1 - d) * 0.5 + hash(i) * 0.35)));
      // 꽃잎이 위로 솟구침
      c.save();
      c.scale(1, -1);
      c.translate(0, -H);
      petalfall(c, t, { count: 50, seed: 281, speed: [160, 320], size: [12, 26], wind: 30 });
      c.restore();
    },

    // 29 해바라기 밭 한가운데 아야(비스듬한 부감)
    fieldWide(c, f) {
      const { t } = f;
      cam(c, 1.12 - 0.1 * f.k, W / 2, H / 2 - 20, () => {
        const horizon = 90;
        vgrad(c, [[0, '#fff3cf'], [1, '#ffd98a']], 0, -200, W, horizon + 204);
        vgrad(c, [[0, '#7f8a3a'], [1, '#4c5e26']], 0, horizon, W, H - horizon + 200);
        // 뒤쪽 줄 → 아야 → 앞쪽 줄 (아야가 꽃 사이에 서 있게)
        const rows = 10;
        const at = (r: number) => horizon + Math.pow((r + 1) / rows, 1.5) * (H + 200 - horizon);
        const row = (r: number) => {
          const d = (r + 1) / rows;
          const size0 = 14 + d * 110;
          const n = Math.ceil(W / (size0 * 1.15)) + 2;
          for (let i = 0; i < n; i++) {
            const id = r * 41 + i + 500;
            const j = looseSpot(id, size0);
            if (j.skip) continue;
            const size = size0 * j.s;
            const x = (i - 0.5) * size0 * 1.15 + (r % 2) * size0 * 0.55 + j.dx;
            const y = at(r) + j.dy;
            if (Math.abs(x - W / 2) < size0 * 0.9 && Math.abs(y - 470) < 60) continue;
            stampFlower(c, x + Math.sin(t * 0.9 + id) * size * 0.05, y, size * 0.55, { seed: id, sat: 1, squash: 0.75, rot: j.tilt });
          }
        };
        for (let r = 0; r < rows; r++) {
          if (at(r) > 470) break;
          row(r);
        }
        girl(c, W / 2, 500, 150, { t, color: '#33262a', back: true, wind: 0.5, rim: 'rgba(255,246,220,0.9)', rimBlur: 12 });
        for (let r = 0; r < rows; r++) if (at(r) > 470) row(r);
      });
      petalfall(c, t, { count: 22, seed: 291, wind: 40, size: [12, 22] });
    },

    // 30 해바라기 꽃 가운데 원본 영상
    flowerFootage(c, f) {
      const { t } = f;
      vgrad(c, [[0, '#ffe9a6'], [1, '#f2a43c']]);
      cam(c, 1 + 0.12 * f.k, W / 2, H / 2, () => {
        sunflower(c, W / 2, H / 2, 470, {
          sat: 1,
          t,
          seed: 9,
          rot: f.age * 0.05,
          disk: (cc, r) => {
            // 원본 화면은 인물이 가운데보다 왼쪽에 있어서 오른쪽으로 당긴다 — 꽃이 도는 축이 인물에 오게
            // (영상 폭 2.3r 중 원 밖 여유가 양쪽 0.15r라 0.13r까지는 원 가장자리가 비지 않는다)
            if (!kit.footage(cc, f.video, -r * 1.02, -r, r * 2.3, r * 2)) {
              cc.fillStyle = '#5b4a62';
              cc.fillRect(-r, -r, r * 2, r * 2);
              wash(cc, 'k-ff', { color: '#c4b0e6', size: 220 }, 0, 0, r * 1.6, 1, 0.8);
            }
          },
        });
      });
      dust(c, t, 30, 301, '#fffbe8', 0.6);
    },

    // 31 아야가 두 팔을 펼침(로우 앵글)
    armsOpen(c, f) {
      const { t } = f;
      cam(c, 1.04, W / 2, H / 2 - f.k * 30, () => {
        vgrad(c, [[0, '#fff2c8'], [0.6, '#ffd98a'], [1, '#f6b450']], 0, -100, W, H + 200);
        glow(c, 640, 260, 520, 'rgba(255,252,240,0.95)', 0.9);
        girl(c, 640, 880, 780, { t, color: '#33262a', arms: 'open', wind: 0.6 + Math.sin(t) * 0.2, rim: 'rgba(255,246,220,0.95)', rimBlur: 30 });
        for (let i = 0; i < 7; i++) {
          const x = -40 + i * 225 + hash(i + 3) * 40;
          stampFlower(c, x, 700 + hash(i) * 50, 120 + hash(i + 1) * 40, { seed: i + 40, sat: 1, rot: (hash(i + 2) - 0.5) * 0.6, squash: 0.85 });
        }
      });
      c.save();
      c.scale(1, -1);
      c.translate(0, -H);
      petalfall(c, t, { count: 40, seed: 311, speed: [90, 200], wind: 20 });
      c.restore();
    },

    // 32 가슴에서 해바라기가 피어남 — 선이 그려지고 「心に咲かせておくよ」에서 활짝
    heartBloom(c, f) {
      const { t } = f;
      const t0 = f.span.start;
      const bloomT = chunkT(kit.lines(), 36, 1);
      vgrad(c, [[0, '#fbe3a8'], [1, '#e9a24a']]);
      glow(c, 640, 380, 520, 'rgba(255,248,226,0.9)', 0.8);
      cam(c, 1 + 0.1 * f.k, 640, 370, () => {
        girl(c, 640, 1600, 1820, { t, color: '#33262a', arms: 'chest', rim: 'rgba(255,240,205,0.9)', rimBlur: 30 });
        const cx = 640;
        const cy = 360;
        // 꽃잎 선이 가슴에서 하나씩
        const n = 18;
        for (let i = 0; i < n; i++) {
          const at = t0 + 0.2 + (i / n) * Math.max(0.5, bloomT - t0 - 0.4);
          const k = span01(t, at, at + 0.5);
          if (k <= 0) continue;
          const a = (i / n) * TAU;
          const pts = sample((u) => {
            const len = 150;
            const w = 34 * Math.sin(u * Math.PI);
            const side = u < 0.5 ? 1 : -1;
            const along = u < 0.5 ? u * 2 : (1 - u) * 2;
            const lx = side * w * 0.7;
            const ly = -60 - along * len;
            return [cx + Math.cos(a) * lx - Math.sin(a) * ly, cy + Math.sin(a) * lx + Math.cos(a) * ly];
          }, 24);
          pencil(c, pts, k, { width: 3, color: '#fff1c8', seed: i + 320, passes: 2 });
        }
        const open = easeOutCubic(span01(t, bloomT - 0.1, bloomT + 0.9));
        if (open > 0) {
          // 핀 뒤에도 천천히 돌고 빛이 숨 쉰다
          const after = Math.max(0, t - bloomT);
          glow(c, cx, cy, 300 + after * 30, 'rgba(255,230,160,0.9)', open * (0.85 + 0.15 * Math.sin(after * 2.4)));
          sunflower(c, cx, cy, 230 + after * 8, { sat: 1, t, seed: 11, bloom: open, alpha: open, rot: after * 0.12 });
        }
      });
    },

    // 33 하늘 가득한 금빛
    goldSky(c, f) {
      const { t } = f;
      vgrad(c, [[0, '#ffe9b0'], [0.5, '#ffc861'], [1, '#f39a32']]);
      for (let i = 0; i < 6; i++) {
        wash(c, `k-cloud-${i}`, { color: i % 2 ? '#fff6dc' : '#ffdf9a', size: 300, aspect: 2.6, layers: 22, alpha: 0.05 }, ((i * 260 + f.age * (20 + i * 6)) % (W + 600)) - 300, 120 + (i % 3) * 140, 380, 1, 0.8);
      }
      glow(c, 640, 300, 600, 'rgba(255,252,236,0.95)', 0.6 + 0.4 * f.k);
      c.save();
      c.scale(1, -1);
      c.translate(0, -H);
      petalfall(c, t, { count: 60, seed: 331, speed: [60, 160], wind: 60, size: [12, 24] });
      c.restore();
      dust(c, t, 60, 333, '#fffdf2', 0.8);
    },

    // 34 「落ちて」마다 컷 — 꽃잎이 눈물 방울로
    tears(c, f) {
      const { t } = f;
      const line = kit.lines()[37];
      const cut = cutWithin(line, t);
      const age = t - Math.max(cut.at, f.span.start);
      switch (cut.n) {
        case 0: {
          // 정면 — 꽃잎이 떨어지다 방울이 된다
          vgrad(c, [[0, '#ffe6a8'], [1, '#f0a849']]);
          for (let i = 0; i < 14; i++) {
            const x = 120 + i * 80 + hash(i) * 40;
            const y = -60 + ((hash(i + 3) * 300 + age * (260 + hash(i + 7) * 120)) % (H + 120));
            const m = clamp((y - 200) / 220);
            if (m < 1) fallingPetal(c, x, y, 40, age + i, age * 3 + i, 1, 1 - m);
            if (m > 0) tear(c, x, y, 15, 1.2, m);
          }
          break;
        }
        case 1: {
          // 옆 — 옆얼굴 앞으로 방울이 떨어진다(최고음)
          vgrad(c, [[0, '#fff3cf'], [1, '#ffcf73']]);
          glow(c, 760, 320, 600, 'rgba(255,253,244,1)', 0.95);
          profile(c, 420, 300, 520, { t, color: '#33262a', rim: 'rgba(255,246,220,0.95)', rimBlur: 30 });
          for (let i = 0; i < 6; i++) {
            const y = 260 + ((age * 260 + i * 110) % 520);
            tear(c, 650 + i * 80 + Math.sin(i) * 20, y, 18, 1.4, 0.95);
          }
          break;
        }
        case 2: {
          // 위에서 — 물 위에 떨어져 동심원
          vgrad(c, [[0, '#5d7393'], [1, '#2e3d55']]);
          for (let i = 0; i < 7; i++) {
            const hit = i * 0.14;
            const ra = age - hit;
            if (ra < 0) continue;
            const x = 260 + hash(i) * 760;
            const y = 160 + hash(i + 9) * 400;
            for (let k = 0; k < 3; k++) {
              const rr = (ra - k * 0.25) * 140;
              if (rr <= 0) continue;
              c.strokeStyle = `rgba(230,240,252,${clamp(0.7 - rr / 300)})`;
              c.lineWidth = 2;
              c.beginPath();
              c.ellipse(x, y, rr, rr * 0.9, 0, 0, TAU);
              c.stroke();
            }
            glow(c, x, y, 40, 'rgba(255,214,120,0.8)', clamp(1 - ra * 1.5));
          }
          break;
        }
        default: {
          // 아래에서 — 방울이 카메라 쪽으로
          vgrad(c, [[0, '#9fb3cf'], [1, '#e8c890']]);
          for (let i = 0; i < 16; i++) {
            const z = ((age * 0.8 + hash(i)) % 1);
            const a = hash(i + 5) * TAU;
            const r = z * z * 700;
            const dx = Math.cos(a);
            const dy = Math.sin(a) * 0.7;
            // 소실점(가운데)에서 카메라 쪽으로 오므로 꼬리는 가운데를 향하고, 가까울수록 정면이라 짧다
            tear(c, 640 + dx * r, 360 + dy * r, 4 + z * z * 36, 1.5 - z * 0.9, clamp(z * 3) * (1 - clamp((z - 0.85) * 6)), Math.atan2(-dy, -dx));
          }
        }
      }
    },

    // 35 방울 하나가 바닥에 떨어져 번짐
    lastDrop(c, f) {
      const { t } = f;
      const lines = kit.lines();
      const hitT = chunkT(lines, 39, 2);
      c.fillStyle = '#231e28';
      c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(10,8,12,0.5)';
      c.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        c.beginPath();
        c.moveTo(0, 80 + i * 90);
        c.lineTo(W, 80 + i * 90 + 20);
        c.stroke();
      }
      glow(c, 640, 400, 500, 'rgba(120,110,150,0.6)', 0.5);
      const fallK = span01(t, f.span.start, hitT);
      if (fallK < 1) tear(c, 640, lerp(-60, 420, easeInCubic(fallK)), 22, 1.3, 1);
      const spread = span01(t, hitT, f.span.end);
      if (spread > 0) {
        // 왕관 모양으로 튀는 작은 방울
        for (let i = 0; i < 9; i++) {
          const a = Math.PI + (i / 8) * Math.PI;
          const d = easeOutCubic(clamp(spread * 5)) * 80;
          const up = Math.sin(clamp(spread * 5) * Math.PI) * 50;
          const px = 640 + Math.cos(a) * d;
          const py = 420 + Math.sin(a) * d * 0.3 - up;
          // 튀어 오르는 동안 꼬리는 떨어진 자리를 향한다
          if (spread < 0.25) tear(c, px, py, 5, 1, 1 - spread * 4, Math.atan2(420 - py, 640 - px));
        }
        wash(c, 'k-last-blue', { color: '#8fa6c8', size: 300, alpha: 0.06 }, 640, 430, 160 + 1200 * easeOutCubic(spread), spread, 0.9);
        wash(c, 'k-last-gold', { color: PETAL, size: 300, alpha: 0.05 }, 660, 420, 80 + 640 * easeOutCubic(span01(t, hitT + 0.3, f.span.end)), spread, 0.5);
      }
    },

    // 36 0번과 같은 창 — 꽃병 해바라기에 꽃잎 하나, 창밖엔 눈 · 엔딩 타이틀
    coda(c, f) {
      const { t } = f;
      frost ??= frostSegments(W, H, 9, 16);
      const C = kit.cues();
      cam(c, 1.12 - 0.12 * f.k, W / 2, H / 2, () => {
        vgrad(c, [[0, '#cfd9e4'], [1, '#e7ecf1']]);
        snowfall(c, t, { count: 80, seed: 361, wind: 10, size: [1.5, 4.5] });
        drawFrost(c, frost!, 1, 'rgba(255,255,255,0.8)');
        c.fillStyle = '#2a2430';
        c.beginPath();
        c.rect(-300, -300, W + 600, H + 600);
        c.rect(150, 40, 980, 560);
        c.fill('evenodd');
        c.strokeStyle = '#3b3340';
        c.lineWidth = 16;
        c.strokeRect(150, 40, 980, 560);
        c.fillStyle = '#3b3340';
        c.fillRect(120, 596, 1040, 30);
        vaseFlower(c, t, 930, 598, 0.62, { sat: 0.6, petals: 0.05, seed: 2 });
      });
      const a = span01(t, C.endTitle, C.endTitle + 1.6);
      if (a > 0) {
        c.save();
        c.globalAlpha = a;
        c.textAlign = 'center';
        c.fillStyle = '#34405a';
        c.shadowColor = 'rgba(255,255,255,0.9)';
        c.shadowBlur = 22;
        setFont(c, 96, kit.fonts.ja, 600);
        c.fillText('片っぽ', 520, 330);
        setFont(c, 21, kit.fonts.ko, 600);
        c.fillStyle = 'rgba(52,64,90,0.85)';
        c.fillText(kit.dateLabel ? `eill · AyaUke cover · ${kit.dateLabel}` : 'eill · AyaUke cover', 520, 376);
        c.restore();
      }
    },
  };
}
