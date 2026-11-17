// 踊 장면 21~43 — 후렴 1(암전 파티) · 드롭 1 · 절 2(랩, 글자가 주인공) · 야행 · 드롭 2(만원).
import { TAU, clamp, easeInCubic, easeOutBack, easeOutCubic, hash, lerp, setFont, smooth } from '../../engine';
import { rgba } from '../../paint';
import {
  BG, type Ctx, H, type Kit, NEON, PARTY, type SceneFn, W, cam, chunkT, cone, confetti, dead, fillBg, fit, flicker, glow, hit, led,
  ledMask, neon, neonText, noFootage, ring, rr, shake, span01, zoomAt,
} from './kit';
import { AYA_LIT, DANCE, DANCE2, danceAt, fan, figure, mixPose, POSE, walkPose } from './pose';

/** 편 손(손가락이 위) 윤곽 — 원점이 손바닥 가운데 */
function handPath(c: Ctx, s = 1) {
  c.beginPath();
  rr(c, -46 * s, -40 * s, 92 * s, 96 * s, 26 * s);
  for (let k = 0; k < 4; k++) {
    const x = (-34 + k * 23) * s;
    const len = (58 + (k === 1 || k === 2 ? 16 : 0)) * s;
    rr(c, x - 9 * s, -40 * s - len, 18 * s, len + 10 * s, 9 * s);
  }
  c.moveTo(-46 * s, 4 * s);
  c.lineTo(-78 * s, -34 * s);
}

/** 화면을 가로지르는 금 — 29번 끝에서 시작해 30번에서 끝까지 간다 */
const CRACK: [number, number][] = (() => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 56; i++) pts.push([-60 + i * 42, 372 + (hash(i * 17) - 0.5) * 120 + Math.sin(i * 0.5) * 36]);
  return pts;
})();

function crackLine(c: Ctx, k: number) {
  const n = (CRACK.length - 1) * clamp(k);
  c.beginPath();
  c.moveTo(CRACK[0][0], CRACK[0][1]);
  for (let i = 1; i <= Math.floor(n); i++) c.lineTo(CRACK[i][0], CRACK[i][1]);
  const i = Math.floor(n);
  if (i < CRACK.length - 1) c.lineTo(lerp(CRACK[i][0], CRACK[i + 1][0], n - i), lerp(CRACK[i][1], CRACK[i + 1][1], n - i));
  // 곁가지
  for (let b = 4; b < Math.floor(n); b += 5) {
    const d = hash(b * 3) > 0.5 ? 1 : -1;
    c.moveTo(CRACK[b][0], CRACK[b][1]);
    c.lineTo(CRACK[b][0] + 30, CRACK[b][1] + d * 46);
    c.lineTo(CRACK[b][0] + 44, CRACK[b][1] + d * 92);
  }
}

const deadText = (c: Ctx, text: string, x: number, y: number, size: number, family: string, a = 0.22) => {
  c.save();
  setFont(c, size, family, 400);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.strokeStyle = `rgba(143,138,168,${a})`;
  c.lineWidth = size * 0.03;
  c.strokeText(text, x, y);
  c.restore();
};

/** 「暗転」 간판 — a1·a2는 두 글자의 밝기, party는 PARTY 글자가 켜진 수. 51번도 쓴다 */
export const drawSign = (c: Ctx, display: string, a1: number, a2: number, party: number, t: number) => {
  const frame = () => {
    c.beginPath();
    rr(c, 330, 120, 620, 420, 30);
  };
  dead(c, 5, frame, 0.25);
  neon(c, NEON.violet, 5, frame, Math.min(a1, a2) * 0.9);
  deadText(c, '暗', 500, 290, 240, display);
  deadText(c, '転', 780, 290, 240, display);
  neonText(c, '暗', 500, 290, 240, display, NEON.pink, a1, { fill: 0, tube: 0.03 });
  neonText(c, '転', 780, 290, 240, display, NEON.pink, a2, { fill: 0, tube: 0.03 });
  'PARTY'.split('').forEach((ch, i) => {
    const x = 448 + i * 96;
    deadText(c, ch, x, 470, 74, display);
    if (party > i) neonText(c, ch, x, 470, 74, display, NEON.violet, clamp(party - i) * flicker(t, i * 7, 0.04), { fill: 0, tube: 0.05 });
  });
  glow(c, 640, 320, 620, NEON.pink, 0.22 * Math.max(a1, a2), 380);
};

/** 무대 쪽 조명(트러스·빛줄기) — lit는 켜진 조명 수. 55번도 쓴다 */
export const rig = (c: Ctx, t: number, lit: number, a = 1) => {
  glow(c, 640, 250, 760, NEON.violet, 0.3 * a * clamp(lit / 6), 150);
  glow(c, 640, 262, 560, NEON.white, 0.34 * a * clamp(lit / 6), 60);
  c.strokeStyle = 'rgba(246,244,255,0.22)';
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(60, 96);
  c.lineTo(W - 60, 96);
  c.moveTo(60, 116);
  c.lineTo(W - 60, 116);
  for (let x = 60; x < W - 60; x += 40) {
    c.moveTo(x, 96);
    c.lineTo(x + 20, 116);
    c.lineTo(x + 40, 96);
  }
  c.stroke();
  for (let i = 0; i < 6; i++) {
    const x = 160 + i * 192;
    const on = clamp(lit - i);
    c.fillStyle = '#15121f';
    c.fillRect(x - 16, 116, 32, 30);
    if (on <= 0) continue;
    const col = [NEON.violet, NEON.cyan, NEON.pink][i % 3];
    cone(c, x, 146, x + Math.sin(t * 1.3 + i * 1.7) * 300, 700, 120, col, 0.75 * on * a, 10);
    glow(c, x, 148, 46, NEON.white, on * a);
  }
};

/** 뒤에서 본 객석 세 줄 */
export const crowdRows = (c: Ctx, each: (i: number, x: number, y: number, s: number) => void) => {
  let i = 0;
  for (let r = 0; r < 3; r++) {
    const s = 1.05 + r * 0.42;
    const n = 13 - r * 3;
    const y = 520 + r * 96;
    for (let q = 0; q < n; q++) {
      const x = W / 2 + (q - (n - 1) / 2) * 100 * s + (r % 2 ? 30 : 0);
      each(i++, x, y, s);
    }
  }
};

export function scenes2(kit: Kit): Record<string, SceneFn> {
  const { fonts } = kit;
  const ct = (line: number, chunk = 0) => chunkT(kit.lines(), line, chunk);
  const pulse = (t: number, d = 6) => kit.beat().pulse(t, d);
  const pos = (t: number) => kit.beat().pos(t);
  const per = () => kit.beat().period;
  const sign = (c: Ctx, a1: number, a2: number, party: number, t: number) => drawSign(c, fonts.display, a1, a2, party, t);

  // ── 21. 今宵は暗転パーティー — 간판 ─────────────────────
  const blackoutSign: SceneFn = (c, f) => {
    const { t } = f;
    const tOn = ct(30, 0);
    const tParty = ct(30, 1);
    fillBg(c);
    const buzz = (seed: number) => (hash(Math.floor(t * 17) * 13 + seed) < 0.2 ? 0.85 : 0.03);
    const on = t >= tOn;
    const a1 = on ? flicker(t, 1, 0.03) : buzz(1);
    const a2 = on ? flicker(t, 2, 0.03) : buzz(5);
    const party = on ? (t - tParty) / 0.15 + 1 : 0;
    cam(c, lerp(1.75, 1.02, smooth(span01(f.k, 0, 1))), 640, lerp(290, 372, f.k), () => {
      // 벽
      c.strokeStyle = 'rgba(246,244,255,0.045)';
      c.lineWidth = 2;
      c.beginPath();
      for (let y = -100; y < 620; y += 44) {
        c.moveTo(-300, y);
        c.lineTo(W + 300, y);
      }
      c.stroke();
      sign(c, a1, a2, party, t);
      // 젖은 바닥에 비친 간판
      c.save();
      c.beginPath();
      c.rect(-300, 600, W + 600, 400);
      c.clip();
      c.translate(0, 1200);
      c.scale(1, -1);
      c.globalAlpha = 0.28;
      sign(c, a1, a2, party, t);
      c.restore();
      c.fillStyle = BG;
      for (let y = 612; y < 900; y += 14) c.fillRect(-300, y + Math.sin(t * 3 + y) * 2, W + 600, 5);
      neon(c, NEON.violet, 2, () => {
        c.beginPath();
        c.moveTo(-300, 600);
        c.lineTo(W + 300, 600);
      }, 0.4);
      glow(c, 640, 300, 700, NEON.white, 0.5 * hit(t, tOn, 6));
    });
  };

  // ── 22. Woah 踊りだせ 踊りだせ — 스트로브 댄서 ──────────
  const strobeDancer: SceneFn = (c, f) => {
    const { t } = f;
    const tOdo = ct(31, 1);
    const charge = span01(t, f.span.start, tOdo);
    const b = kit.beat();
    fillBg(c);
    const dancing = t >= tOdo;
    const first = Math.round(b.pos(tOdo));
    const idx = Math.floor(b.pos(t) + 0.02);
    const fl = dancing ? Math.exp(-(t - Math.max(tOdo, b.timeOf(idx))) * 5) : 0;
    zoomAt(c, 1 + f.k * 0.1, 640, 420, () => {
      // 차오르는 빛
      glow(c, 640, 600, 300 + 520 * charge, NEON.violet, 0.16 + 0.3 * charge, 90 + 80 * charge);
      neon(c, NEON.violet, 3, () => {
        c.beginPath();
        c.moveTo(640 - 80 - 560 * charge, 600);
        c.lineTo(640 + 80 + 560 * charge, 600);
      }, 0.5 + 0.5 * charge);
      // 모여드는 빛 알갱이
      if (!dancing) {
        for (let i = 0; i < 40; i++) {
          const a = ((t * (0.35 + hash(i) * 0.3) + hash(i * 7)) % 1);
          const ang = hash(i * 3) * TAU;
          const r = (1 - a) * 620;
          glow(c, 640 + Math.cos(ang) * r, 380 + Math.sin(ang) * r * 0.6, 7, NEON.violet, a * 0.9);
        }
      }
      // 번쩍이는 뒷빛
      if (fl > 0.01) {
        glow(c, 640, 380, 620, NEON.white, 0.95 * fl, 520);
        glow(c, 640, 600, 760, NEON.white, 0.8 * fl, 70);
      }
      // 지나간 포즈의 잔상
      if (dancing) {
        for (let g = 3; g >= 1; g--) {
          const gi = idx - g;
          if (gi < first) continue;
          const age = t - b.timeOf(gi);
          c.save();
          c.globalCompositeOperation = 'lighter';
          figure(c, 640 + (gi % 2 ? -1 : 1) * g * 26, 600, 470 * (1 + g * 0.03), DANCE[((gi - first) % 8 + 8) % 8], {
            skin: 'aya', color: rgba(g % 2 ? NEON.pink : NEON.violet, 0.3 * Math.exp(-age * 1.3)),
          });
          c.restore();
        }
      }
      const pose = dancing
        ? danceAt(DANCE, b.pos(t) - first, 0.16)
        : mixPose(POSE.down, POSE.vee, smooth(charge));
      figure(c, 640, 600, 470, pose, {
        skin: 'aya', color: '#060509', rim: fl > 0.3 ? '#ffffff' : NEON.violet, rimBlur: 14 + 16 * charge,
        swing: dancing ? Math.sin(b.pos(t) * Math.PI) : Math.sin(t * 2) * 0.3,
      });
    });
  };

  // ── 23. 孤独は殺菌 満員御礼 ────────────────────────────
  const fullHouse: SceneFn = (c, f) => {
    const { t } = f;
    const tMan = ct(32, 1);
    fillBg(c);
    const barX = lerp(-160, W + 200, span01(t, f.span.start, f.span.start + 0.78));
    c.save();
    c.translate(40 - f.k * 80, 0);
    glow(c, barX, 360, 420, NEON.violet, 0.5, 700);
    const hop = Math.sin(clamp(kit.beat().frac(t)) * Math.PI) * 0.035;
    for (let r = 1; r >= 0; r--) {
      const n = 13;
      for (let i = 0; i < n; i++) {
        const x = 40 + i * 104 + (r ? 52 : 0);
        const me = r === 0 && i === 6;
        const seen = me ? 1 : clamp((barX - x) / 90);
        if (seen <= 0) continue;
        const pose = t >= tMan ? { ...POSE.armsUp, air: hop } : mixPose(POSE.stand, POSE.lookUp, seen);
        figure(c, x, r ? 566 : 620, r ? 250 : 290, pose, {
          color: me ? NEON.white : rgba(NEON.violet, r ? 0.45 : 0.75), alpha: seen,
        });
      }
    }
    neon(c, NEON.violet, 9, () => {
      c.beginPath();
      c.moveTo(barX, -40);
      c.lineTo(barX, H + 40);
    });
    c.restore();
    // 세로 현수막
    [[250, 0], [1030, 0.07]].forEach(([x, d], k) => {
      const at = tMan + d;
      if (t < at) return;
      const un = easeOutBack(span01(t, at, at + 0.26));
      const hgt = 560 * un;
      c.save();
      c.translate(x, 0);
      c.rotate(Math.sin(t * 5 + k) * 0.012);
      c.fillStyle = NEON.yellow;
      c.fillRect(-76, 0, 152, hgt);
      c.beginPath();
      c.rect(-76, 0, 152, hgt);
      c.clip();
      c.fillStyle = '#0b0906';
      setFont(c, 112, fonts.display, 400);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      '満員御礼'.split('').forEach((ch, i) => c.fillText(ch, 0, hgt - 560 + 82 + i * 128));
      c.restore();
      c.fillStyle = '#2a2420';
      c.fillRect(x - 92, -4, 184, 16);
      glow(c, x, hgt * 0.5, 300, NEON.yellow, 0.22 + 0.3 * hit(t, at, 6), 420);
    });
  };

  // ── 24. Woah 痛みまで おシェアで — 모이는 손 ────────────
  const hands: SceneFn = (c, f) => {
    const { t } = f;
    const tIta = ct(33, 1);
    const tShare = ct(33, 2);
    fillBg(c);
    const n = 8;
    // 손이 들어오는 각도는 고르지 않게(붉은 원 + 방사선처럼 보이지 않도록 색도 시안·보라만)
    const armAng = (i: number) => (i / n) * TAU + (hash(i * 13 + 5) - 0.5) * 0.42;
    const r =
      t < tIta
        ? lerp(640, 300, span01(t, f.span.start, tIta))
        : t < tShare
          ? lerp(300, 150, easeInCubic(span01(t, tIta, tShare)))
          : 96 + 18 * pulse(t, 5) - 34 * hit(t, tShare, 9);
    c.save();
    shake(c, 12 * hit(t, tShare, 9), t);
    cam(c, 1 + f.k * 0.12, 640, 360, () => {
      glow(c, 640, 360, 520, NEON.cyan, 0.1 + 0.5 * hit(t, tShare, 3));
      for (let i = 0; i < n; i++) {
        const col = i % 2 ? NEON.violet : NEON.cyan;
        c.save();
        c.translate(640, 360);
        c.rotate(armAng(i));
        c.translate(0, -r);
        // 손(손가락이 가운데를 향함) + 팔
        c.rotate(Math.PI);
        neon(c, col, 4, () => {
          handPath(c, 0.92);
          c.moveTo(-30, 52);
          c.lineTo(-30, 1100);
          c.moveTo(30, 52);
          c.lineTo(30, 1100);
        });
        c.restore();
        // 반창고
        c.save();
        c.translate(640, 360);
        c.rotate(armAng(i));
        c.translate(0, -r - 190 - (i % 3) * 40);
        c.rotate(0.5 + i);
        neon(c, NEON.white, 2.5, () => {
          c.beginPath();
          rr(c, -34, -12, 68, 24, 12);
          c.rect(-10, -12, 20, 24);
        }, 0.75);
        c.restore();
      }
      if (t >= tShare) {
        const a = t - tShare;
        neon(c, NEON.white, 5, () => ring(c, 640, 360, 60 + a * 900), Math.exp(-a * 2.2));
        // 손끝마다 이어지는 빛
        neon(c, NEON.cyan, 3, () => {
          c.beginPath();
          for (let i = 0; i <= n * 3; i += 3) {
            const ang = armAng(i % n) - Math.PI / 2;
            const x = 640 + Math.cos(ang) * (r + 150);
            const y = 360 + Math.sin(ang) * (r + 150);
            if (i === 0) c.moveTo(x, y);
            else c.lineTo(x, y);
          }
        }, 0.6 + 0.4 * pulse(t));
      }
    }, f.age * 0.1);
    c.restore();
  };

  // ── 25. ここらでバイバイ Let go ────────────────────────
  const letGo: SceneFn = (c, f) => {
    const { t } = f;
    const tBye = ct(34, 1);
    const tLet = ct(34, 2);
    fillBg(c);
    const burst = easeInCubic(span01(t, f.span.end - 0.35, f.span.end));
    zoomAt(c, 1 + f.k * 0.08, 640, 300, () => {
      rig(c, t, 6);
      // 무대 위의 작은 사람
      figure(c, 640, 330, 110, POSE.armsUp, { skin: 'aya', color: '#060509' });
      const thrown: [number, number, string][] = [];
      crowdRows(c, (i, x, y, s) => {
        const col = PARTY[i % 4];
        const wave = t >= tBye ? Math.sin(t * 9 + i * 0.7) : Math.sin(t * 3 + i) * 0.3;
        const raise = t >= tBye ? 1 : 0.55 + 0.25 * pulse(t);
        fan(c, x, y - pulse(t, 5) * 8 * s, s, { color: '#06050a', rim: rgba(NEON.violet, 0.4), raise, sway: wave, light: t < tLet ? col : null });
        if (t >= tLet) {
          const a = t - tLet - hash(i) * 0.12;
          if (a > 0) {
            const vy = 620 + hash(i * 3) * 520;
            thrown.push([x + (40 + (hash(i * 7) - 0.5) * 260 * a) * s * 0.6, y - 120 * s - vy * a + 190 * a * a, col]);
          }
        }
      });
      // 던진 불빛 — 꼭대기에서 터지며 드롭으로
      thrown.forEach(([x, y, col], i) => {
        glow(c, x, y, 34 + burst * 420, col, 0.9);
        neon(c, col, 4, () => {
          c.beginPath();
          const ang = t * 9 + i;
          c.moveTo(x - Math.cos(ang) * 16, y - Math.sin(ang) * 16);
          c.lineTo(x + Math.cos(ang) * 16, y + Math.sin(ang) * 16);
        }, 1 - burst);
      });
    });
    if (burst > 0) {
      c.fillStyle = `rgba(246,244,255,${0.75 * burst})`;
      c.fillRect(0, 0, W, H);
    }
  };

  // ── 26. 드롭 1 — 이퀄라이저 도시 ───────────────────────
  const eqCity: SceneFn = (c, f) => {
    const { t } = f;
    fillBg(c);
    const p = pulse(t, 5);
    c.save();
    shake(c, 5 * p, t);
    zoomAt(c, 1 + f.k * 0.3, 640, 470, () => {
      const hz = 470;
      glow(c, 640, hz - 60, 800, NEON.violet, 0.2 + 0.25 * p, 330);
      // 하늘을 가르는 탐조등
      for (let i = 0; i < 4; i++) {
        const x = 200 + i * 300;
        cone(c, x, hz, x + Math.sin(t * 1.1 + i * 2.1) * 520, -120, 150, i % 2 ? NEON.cyan : NEON.violet, 0.3 + 0.3 * p, 6);
      }
      const layers = [
        { bw: 22, speed: 40, h: 200, col: NEON.violet, a: 0.3, ch: 'high' as const },
        { bw: 34, speed: 90, h: 300, col: NEON.violet, a: 0.6, ch: 'rms' as const },
        { bw: 52, speed: 170, h: 400, col: NEON.cyan, a: 0.95, ch: 'low' as const },
      ];
      layers.forEach((L, li) => {
        const scroll = f.age * L.speed;
        const n = Math.ceil((W + 400) / L.bw) + 2;
        const caps = new Path2D();
        c.fillStyle = rgba(L.col, L.a * 0.55);
        c.beginPath();
        for (let k = 0; k < n; k++) {
          const id = k + Math.floor(scroll / L.bw);
          const x = -200 + k * L.bw - (scroll % L.bw);
          const v = clamp(0.25 + 0.75 * kit.env(L.ch, t - (id % 9) * 0.035) * (0.5 + hash(id * 7 + li * 31)));
          const hgt = L.h * (0.2 + 0.8 * hash(id * 13 + li)) * v;
          c.rect(x + 2, hz - hgt, L.bw - 4, hgt);
          caps.rect(x + 2, hz - hgt, L.bw - 4, 4);
          // 물에 비친 그림자
          c.rect(x + 2, hz + 6, L.bw - 4, hgt * 0.34);
        }
        c.fill();
        c.fillStyle = rgba('#ffffff', L.a);
        c.fill(caps);
      });
      neon(c, NEON.white, 3, () => {
        c.beginPath();
        c.moveTo(-200, hz + 2);
        c.lineTo(W + 200, hz + 2);
      }, 0.5 + 0.5 * p);
      c.fillStyle = rgba(BG, 0.55);
      c.fillRect(-200, hz + 5, W + 400, 300);
    });
    c.restore();
  };

  // ── 27. 드롭 1 — 원본 영상 모니터 벽 ───────────────────
  // 열두 대의 모니터가 지금 화면 하나를 나눠 크게 비춘다(끊김 없이). 박마다 몇 대가 얼굴 가까이·좌우 반전으로
  // 바뀌고, 마디 넷째 박에는 열두 대가 모두 따로 아야를 비춘다. 지난 화면 되풀이는 끊겨 보여서 버림(2026-11-17).
  const mosaic: SceneFn = (c, f) => {
    const { t } = f;
    fillBg(c);
    const b = kit.beat();
    const idx = b.index(t);
    const p = pulse(t, 6);
    const cols = 4;
    const rows = 3;
    const gap = 12;
    const gx = 30;
    const gy = 22;
    const gw = W - 60;
    const gh = H - 44;
    const tw = (gw - gap * (cols - 1)) / cols;
    const th = (gh - gap * (rows - 1)) / rows;
    const beatInBar = ((idx % 4) + 4) % 4;
    zoomAt(c, 1 + f.k * 0.06, 640, 360, () => {
      for (let r = 0; r < rows; r++) {
        for (let q = 0; q < cols; q++) {
          const i = r * cols + q;
          const x = gx + q * (tw + gap);
          const y = gy + r * (th + gap);
          // 이 박에 따로 노는 모니터: 넷째 박은 전부, 나머지 박은 서너 대
          const solo = beatInBar === 3 || hash(i * 7 + idx * 13) > 0.72;
          const col = (q + r) % 2 ? NEON.pink : NEON.cyan;
          c.save();
          c.beginPath();
          rr(c, x, y, tw, th, 12);
          c.clip();
          let ok: boolean;
          if (solo) {
            const s = 1 + 0.05 * p;
            c.translate(x + tw / 2, y + th / 2);
            c.scale(s, s);
            c.translate(-(x + tw / 2), -(y + th / 2));
            ok = kit.footage(c, f.video, x, y, tw, th, beatInBar === 3 ? { mirror: i % 2 === 1 } : { zoom: 2.1, cy: 0.47, mirror: i % 2 === 1 });
          } else {
            ok = kit.footage(c, f.video, gx, gy, gw, gh);
          }
          if (!ok) noFootage(c, x, y, tw, th, t + i);
          c.globalCompositeOperation = 'multiply';
          c.fillStyle = solo ? rgba(col, 0.55) : 'rgba(150,140,190,1)';
          c.fillRect(x - 20, y - 20, tw + 40, th + 40);
          c.globalCompositeOperation = 'lighter';
          c.fillStyle = rgba(col, solo ? 0.1 + 0.18 * p : 0.02);
          c.fillRect(x - 20, y - 20, tw + 40, th + 40);
          c.restore();
          if (solo) {
            neon(c, col, 3.5, () => {
              c.beginPath();
              rr(c, x, y, tw, th, 12);
            });
          } else {
            dead(c, 2, () => {
              c.beginPath();
              rr(c, x, y, tw, th, 12);
            }, 0.5);
          }
        }
      }
      // 박마다 위에서 아래로 훑는 주사선 한 줄
      const sy = gy + gh * b.frac(t);
      c.fillStyle = `rgba(255,255,255,${0.12 * (1 - b.frac(t))})`;
      c.fillRect(gx, sy - 2, gw, 4);
    });
  };

  // ── 28. 드롭 1 — 댄서 셋, 어긋난 색 그림자 ──────────────
  const trio: SceneFn = (c, f) => {
    const { t } = f;
    fillBg(c);
    const p = pulse(t, 5);
    const bp = pos(t);
    c.save();
    c.translate(-50 + f.k * 100, 0);
    // 원근 바닥 격자
    const hz = 430;
    c.strokeStyle = rgba(NEON.violet, 0.35);
    c.lineWidth = 2;
    c.beginPath();
    for (let i = -14; i <= 14; i++) {
      const off = ((f.age * 0.9) % 1);
      c.moveTo(640 + (i - off) * 40, hz);
      c.lineTo(640 + (i - off) * 420, H + 40);
    }
    for (let k = 0; k < 9; k++) {
      const z = (k + ((bp * 0.5) % 1)) / 9;
      const y = hz + (H - hz + 40) * z * z;
      c.moveTo(-300, y);
      c.lineTo(W + 300, y);
    }
    c.stroke();
    glow(c, 640, hz, 900, NEON.violet, 0.22 + 0.2 * p, 150);
    // 뒤의 세로 네온 관 — 박마다 다른 관이 켜진다
    for (let i = 0; i < 7; i++) {
      const x = 100 + i * 180;
      const on = ((Math.floor(bp) + i) % 3 === 0 ? 1 : 0.12) * (0.6 + 0.4 * p);
      neon(c, PARTY[(i + 1) % 4], 6, () => {
        c.beginPath();
        c.moveTo(x, 60);
        c.lineTo(x, hz - 40);
      }, on);
    }
    const dancer = (x: number, y: number, h: number, lag: number, flip: boolean) => {
      const pose = danceAt(DANCE2, bp - lag, 0.2);
      const amp = 8 + 26 * p;
      c.save();
      c.globalCompositeOperation = 'lighter';
      ([[NEON.cyan, -amp, 0], [NEON.pink, amp, 0], [NEON.yellow, 0, -amp * 0.5]] as const).forEach(([col, dx, dy]) => {
        figure(c, x + dx, y + dy, h, pose, { skin: 'aya', color: rgba(col, 0.82), flip, swing: Math.sin(bp * Math.PI) });
      });
      c.restore();
    };
    dancer(330, 628, 330, 1, false);
    dancer(950, 628, 330, 1, true);
    dancer(640, 668, 450, 0, false);
    c.restore();
  };

  // ── 29. 드롭 1 — 레이저 터널 ────────────────────────────
  const laserTunnel: SceneFn = (c, f) => {
    const { t } = f;
    const tB = kit.bar(55);
    fillBg(c);
    const p = pulse(t, 5) * (t < tB ? 1 : 0.3);
    c.save();
    shake(c, 5 * p, t);
    glow(c, 640, 360, 300 + 200 * p, NEON.white, 0.25);
    // 모서리를 따라 달리는 선
    c.strokeStyle = rgba(NEON.violet, 0.3);
    c.lineWidth = 2;
    c.beginPath();
    for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]] as const) {
      c.moveTo(640, 360);
      c.lineTo(x, y);
    }
    c.stroke();
    const step = per() / 2;
    const first = Math.floor((f.span.start - 2.6 - kit.bar(54)) / step);
    for (let j = first; ; j++) {
      const born = kit.bar(54) + j * step;
      if (born > t) break;
      if (born >= tB) break;
      const q = (t - born) / 2.3;
      const size = 26 * Math.exp(q * 4.9);
      if (size > 3400) continue;
      const gate = ((j % 8) + 8) % 8 === 0;
      const col = gate ? NEON.white : j % 2 ? NEON.cyan : NEON.violet;
      c.save();
      c.translate(640, 360);
      c.rotate(Math.sin(j * 0.7) * 0.12 + f.age * 0.1);
      neon(c, col, gate ? 6 : 3, () => {
        c.beginPath();
        c.rect(-size * 0.89, -size * 0.5, size * 1.78, size);
      }, clamp(q * 5) * (gate ? 1 : 0.8));
      c.restore();
    }
    c.restore();
    // 화면에 금이 가기 시작한다
    const k = span01(t, f.span.end - 0.4, f.span.end) * 0.22;
    if (k > 0) {
      neon(c, NEON.white, 4, () => crackLine(c, k));
      const i = Math.floor((CRACK.length - 1) * k);
      glow(c, CRACK[i][0], CRACK[i][1], 120, NEON.white, 0.9);
    }
  };

  // ── 30. どんな劣等感だとて 即興の血小板で ───────────────
  const crack: SceneFn = (c, f) => {
    const { t } = f;
    const tSok = ct(35, 1);
    fillBg(c, '#06060b');
    const k = lerp(0.22, 1, span01(t, f.span.start, tSok - 0.15));
    const tipI = Math.min(CRACK.length - 1, Math.floor((CRACK.length - 1) * k));
    const camX = clamp(CRACK[tipI][0] - 260, 640, 1500) + Math.max(0, t - tSok) * 46;
    const heal = span01(t, tSok + 0.25, tSok + 1.5);
    c.save();
    shake(c, 5 * (1 - heal) * (t < tSok ? 1 : 0.4), t);
    cam(c, 1.12 - 0.1 * heal, camX, 372, () => {
      // 유리의 비침
      c.strokeStyle = 'rgba(246,244,255,0.04)';
      c.lineWidth = 60;
      c.beginPath();
      for (let x = -400; x < 3000; x += 380) {
        c.moveTo(x, -100);
        c.lineTo(x - 300, H + 100);
      }
      c.stroke();
      const tx = 1700;
      const ty = 262;
      neonText(c, '劣等感', tx + (hash(Math.floor(t * 30)) - 0.5) * 6 * (1 - heal), ty, 80, fonts.ja, NEON.gray, 0.9, { weight: 900 });
      neon(c, NEON.white, 4, () => crackLine(c, k), 1 - 0.8 * heal);
      if (k < 1) glow(c, CRACK[tipI][0], CRACK[tipI][1], 110, NEON.white, 0.9);
      if (t >= tSok) {
        // 몰려와 금을 메우는 혈소판
        for (let i = 0; i < 90; i++) {
          const target = CRACK[22 + (i * 7) % 34];
          const at = tSok + hash(i * 3) * 1.1;
          const a = easeOutCubic(span01(t, at - 0.45, at));
          if (a <= 0) continue;
          const ang = hash(i * 5) * TAU;
          const fx = target[0] + Math.cos(ang) * 900;
          const fy = target[1] + Math.sin(ang) * 600;
          const x = lerp(fx, target[0] + (hash(i * 11) - 0.5) * 30, a);
          const y = lerp(fy, target[1] + (hash(i * 13) - 0.5) * 24, a);
          c.save();
          c.translate(x, y);
          c.rotate(i + t * (1 - a) * 6);
          c.fillStyle = NEON.yellow;
          c.beginPath();
          c.ellipse(0, 0, 15, 9, 0, 0, TAU);
          c.fill();
          c.fillStyle = '#b8960f';
          c.beginPath();
          c.ellipse(0, 0, 7, 3.5, 0, 0, TAU);
          c.fill();
          c.restore();
        }
        // 반창고
        const patch = (x: number, y: number, rot: number, at: number, s: number) => {
          if (t < at) return;
          const kk = easeOutCubic(span01(t, at, at + 0.14));
          c.save();
          c.translate(x, y);
          c.rotate(rot);
          c.scale(s * (2.2 - 1.2 * kk), s * (2.2 - 1.2 * kk));
          c.globalAlpha = kk;
          c.fillStyle = '#ffe9a0';
          c.beginPath();
          rr(c, -110, -34, 220, 68, 34);
          c.fill();
          c.fillStyle = '#fff6d8';
          c.fillRect(-36, -34, 72, 68);
          c.fillStyle = 'rgba(160,120,30,0.5)';
          for (let i = 0; i < 6; i++) {
            c.beginPath();
            c.arc(-84 + (i % 3) * 18, -12 + Math.floor(i / 3) * 24, 3, 0, TAU);
            c.arc(52 + (i % 3) * 18, -12 + Math.floor(i / 3) * 24, 3, 0, TAU);
            c.fill();
          }
          c.restore();
          glow(c, x, y, 260, NEON.yellow, 0.4 * hit(t, at, 7));
        };
        patch(tx, ty, -0.08, tSok + 0.12, 1.25);
        patch(1320, 400, 0.5, tSok + 0.55, 1);
        patch(1840, 420, -0.4, tSok + 0.9, 1.1);
        patch(1560, 350, 0.2, tSok + 1.25, 0.9);
      }
    });
    c.restore();
  };

  // ── 31. 抑え込んで突っ込んで仕舞っちゃうでしょ ───────────
  const boxPress: SceneFn = (c, f) => {
    const { t } = f;
    const t2 = ct(36, 1);
    const t3 = ct(36, 2);
    fillBg(c);
    const glyphs = ['劣', '等', '感', '本', '音', '…', '？', '！', '独', '言', '別', 'に', '特', 'に', 'ね', 'え'];
    const press = t >= t3 + 0.12 ? 1 : 0;
    const strain = span01(t, t3, f.span.end);
    c.save();
    shake(c, 12 * hit(t, t2, 9) + 14 * hit(t, t3 + 0.12, 9) + 5 * strain, t);
    zoomAt(c, 1 + f.k * 0.12, 640, 360, () => {
      const bx = 420;
      const by = 200;
      const bw = 440;
      const bh = 320;
      glow(c, 640, 360, 520, NEON.pink, 0.12 + 0.45 * strain * (0.6 + 0.4 * pulse(t)));
      c.fillStyle = '#0a0812';
      c.beginPath();
      rr(c, bx, by, bw, bh, 16);
      c.fill();
      neon(c, NEON.white, 4, () => {
        c.beginPath();
        rr(c, bx, by, bw, bh, 16);
      });
      // 상자로 구겨 넣는 글자들
      glyphs.forEach((g, i) => {
        const at = (i < 8 ? f.span.start : t2 - 0.1) + (i % 8) * 0.1 + 0.25;
        const k = easeInCubic(span01(t, at - 0.4, at));
        const ang = hash(i * 7) * TAU;
        const fx = 640 + Math.cos(ang) * 760;
        const fy = 360 + Math.sin(ang) * 460;
        const jit = t >= at ? (1 + strain * 2.5) * 6 : 0;
        const tx = bx + 70 + (i % 4) * 100 + (hash(Math.floor(t * 24) + i) - 0.5) * jit;
        const ty = by + 60 + Math.floor(i / 4) * 68 + (hash(Math.floor(t * 24) + i * 3) - 0.5) * jit;
        c.save();
        c.translate(lerp(fx, tx, k), lerp(fy, ty, k));
        c.rotate((1 - k) * 5 + (hash(i * 3) - 0.5) * 0.9);
        neonText(c, g, 0, 0, lerp(120, 62, k), fonts.display, t >= t3 ? NEON.pink : NEON.white, 0.95);
        c.restore();
      });
      // 뚜껑
      if (t >= t3 - 0.05) {
        const lid = easeOutCubic(span01(t, t3 - 0.05, t3 + 0.1));
        const lx = bx - 14 + (1 - lid) * 700;
        c.fillStyle = '#12101c';
        c.beginPath();
        rr(c, lx, by - 14, bw + 28, bh + 28, 20);
        c.fill();
        neon(c, NEON.white, 5, () => {
          c.beginPath();
          rr(c, lx, by - 14, bw + 28, bh + 28, 20);
        });
        // 틈으로 새는 빛
        for (let i = 0; i < 16; i++) {
          const side = i % 4;
          const u = hash(i * 7);
          const gx = side < 2 ? bx + u * bw : side === 2 ? bx - 8 : bx + bw + 8;
          const gy = side === 0 ? by - 8 : side === 1 ? by + bh + 8 : by + u * bh;
          glow(c, gx, gy, 40 + 60 * strain, NEON.pink, strain * (0.5 + 0.5 * hash(Math.floor(t * 18) + i)));
        }
      }
      // 누르는 손바닥
      if (t >= t3 + 0.02) {
        const d = easeOutCubic(span01(t, t3 + 0.02, t3 + 0.14));
        const s = (3.2 - 1.2 * d) * (press ? 1 - 0.04 * pulse(t, 5) : 1);
        c.save();
        c.translate(640, 380);
        c.scale(s, s);
        c.fillStyle = 'rgba(5,4,8,0.82)';
        handPath(c);
        c.fill();
        neon(c, NEON.white, 3 / s * 2.2, () => handPath(c), d);
        c.restore();
      }
    });
    c.restore();
  };

  // ── 32. Up and downなテンション ────────────────────────
  const upDown: SceneFn = (c, f) => {
    const { t } = f;
    const tTen = ct(37, 1);
    const tSou = ct(38, 2);
    fillBg(c);
    glow(c, 640, H, 700, NEON.pink, 0.3 * span01(t, tSou, f.span.end), 360);
    const n = 8;
    const sw = W / n;
    const b = kit.beat();
    const idx = b.index(t);
    const step = (idx + easeOutCubic(clamp(b.frac(t) * 2.2))) * 150;
    for (let i = 0; i < n; i++) {
      const up = i % 2 === 0;
      const inv = ((i + idx) % 2 + 2) % 2 === 0;
      const drop = easeInCubic(span01(t, tSou + i * 0.045, tSou + 0.5 + i * 0.045)) * (H + 160);
      c.save();
      c.beginPath();
      c.rect(i * sw, 0, sw, H);
      c.clip();
      c.translate(0, drop);
      c.fillStyle = inv ? NEON.white : '#07060b';
      c.fillRect(i * sw, -20, sw, H + 40);
      const ink = inv ? '#07060b' : i % 4 === 1 ? NEON.cyan : NEON.white;
      c.fillStyle = ink;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const word = up ? 'UP' : 'DOWN';
      setFont(c, up ? 78 : 46, fonts.display, 400);
      const off = ((up ? -step : step) % 300 + 300) % 300;
      for (let y = -300 + off; y < H + 300; y += 300) {
        c.fillText(word, i * sw + sw / 2, y);
        c.beginPath();
        const ay = y + 150;
        if (up) {
          c.moveTo(i * sw + sw / 2, ay - 36);
          c.lineTo(i * sw + sw / 2 + 40, ay + 30);
          c.lineTo(i * sw + sw / 2 - 40, ay + 30);
        } else {
          c.moveTo(i * sw + sw / 2, ay + 36);
          c.lineTo(i * sw + sw / 2 + 40, ay - 30);
          c.lineTo(i * sw + sw / 2 - 40, ay - 30);
        }
        c.closePath();
        c.fill();
      }
      c.restore();
    }
    // 「テンション」 — 반 박마다 위아래로 튄다
    if (t >= tTen && t < tSou + 0.5) {
      const k = easeOutCubic(span01(t, tTen, tTen + 0.16));
      const out = easeInCubic(span01(t, tSou, tSou + 0.4));
      const bounce = (Math.floor(b.pos(t) * 2) % 2 ? 1 : -1) * 46 * (1 - clamp(((b.pos(t) * 2) % 1) * 1.6) * 0.5);
      c.save();
      c.translate(lerp(W + 700, W / 2, k), 330 + bounce + out * 900);
      c.fillStyle = '#07060b';
      c.fillRect(-720, -92, 1440, 184);
      neonText(c, 'テンション', 0, 4, 150, fonts.display, NEON.cyan, 1);
      c.restore();
    }
  };

  // ── 33. ドバっと噴き出すのは 本音の独り言 ───────────────
  const burst: SceneFn = (c, f) => {
    const { t } = f;
    const tHon = ct(39, 1);
    fillBg(c);
    const words = ['…', '！', '？', 'あのね', 'ほんとは', 'だって', 'でも', 'ねえ', 'ずっと'];
    c.save();
    shake(c, 12 * hit(t, f.span.start, 6), t);
    glow(c, 640, 640, 460 + 200 * pulse(t), NEON.pink, 0.4);
    const bubble = (x: number, y: number, s: number, col: string, word: string, a: number, rot: number) => {
      c.save();
      c.translate(x, y);
      c.rotate(rot);
      c.scale(s, s);
      c.globalAlpha = a;
      const path = () => {
        c.beginPath();
        rr(c, -84, -46, 168, 92, 34);
        c.moveTo(-30, 44);
        c.lineTo(-48, 78);
        c.lineTo(-4, 46);
      };
      c.fillStyle = rgba(col, 0.2);
      path();
      c.fill();
      neon(c, col, 4 / Math.max(0.6, s), path);
      neonText(c, word, 0, 2, word.length > 2 ? 32 : 54, fonts.ja, col, 1, { weight: 900 });
      c.restore();
    };
    const N = 64;
    for (let i = 0; i < N; i++) {
      const born = f.span.start + (i / N) * (f.dur - 0.4);
      const age = t - born;
      if (age <= 0) continue;
      const ang = -Math.PI / 2 + (hash(i * 7) - 0.5) * 1.7;
      const v = 250 + hash(i * 3) * 300;
      const d = v * age * (1 + age * 0.5);
      const x = 640 + Math.cos(ang) * d * 1.25;
      const y = 600 + Math.sin(ang) * d;
      const s = 0.3 + age * 0.75;
      if (y < -200 || x < -260 || x > W + 260) continue;
      bubble(x, y, s, [NEON.pink, NEON.yellow, NEON.cyan][i % 3], words[i % words.length], clamp(age * 5), (hash(i) - 0.5) * 0.5);
    }
    // 뚜껑이 날아간 상자
    c.fillStyle = '#0a0812';
    c.beginPath();
    rr(c, 520, 600, 240, 150, 12);
    c.fill();
    neon(c, NEON.white, 4, () => {
      c.beginPath();
      rr(c, 520, 600, 240, 150, 12);
    });
    const la = f.age;
    c.save();
    c.translate(640 + la * 520, 590 - la * 900 + la * la * 700);
    c.rotate(la * 7);
    neon(c, NEON.white, 4, () => {
      c.beginPath();
      rr(c, -130, -14, 260, 28, 10);
    }, clamp(1.6 - la));
    c.restore();
    // 「本音」 — 화면을 덮는 큰 말풍선
    if (t >= tHon) {
      const k = easeInCubic(span01(t, tHon, f.span.end));
      bubble(640, 330, 0.8 + k * 9, NEON.pink, '本音', clamp((t - tHon) * 6), 0);
      c.fillStyle = rgba(NEON.pink, 0.55 * k);
      c.fillRect(0, 0, W, H);
    }
    c.restore();
  };

  // ── 34. 「別に興味ない」「特に関係ない」 — 무채색 ─────────
  const chatGray: SceneFn = (c, f) => {
    const { t } = f;
    fillBg(c, '#131315');
    const rowsDef = [
      { y: 250, at: ct(40, 0), at2: ct(40, 1), text: '別に興味ない', head: 2 },
      { y: 420, at: ct(41, 0), at2: ct(41, 1), text: '特に関係ない', head: 2 },
    ];
    const crackK = span01(t, f.span.end - 0.45, f.span.end);
    c.save();
    shake(c, 4 * crackK, t);
    zoomAt(c, 1 + f.k * 0.07, 420, 340, () => {
      c.fillStyle = '#1b1b1f';
      c.fillRect(-100, -100, W + 200, 190);
      c.fillStyle = '#2c2c31';
      c.beginPath();
      c.arc(96, 46, 22, 0, TAU);
      c.fill();
      c.fillRect(134, 30, 150, 12);
      c.fillRect(134, 52, 90, 9);
      c.fillStyle = '#56565c';
      setFont(c, 18, fonts.ko, 600);
      c.textAlign = 'right';
      c.fillText('03:28', W - 60, 52);
      rowsDef.forEach((r, ri) => {
        const typingFrom = ri === 0 ? f.span.start + 0.12 : rowsDef[0].at2 + 0.75;
        if (t < typingFrom) return;
        // 무표정한 얼굴
        c.fillStyle = '#34343a';
        c.beginPath();
        c.arc(150, r.y, 38, 0, TAU);
        c.fill();
        c.strokeStyle = '#8a8a92';
        c.lineWidth = 4;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(134, r.y - 6);
        c.lineTo(144, r.y - 6);
        c.moveTo(156, r.y - 6);
        c.lineTo(166, r.y - 6);
        c.moveTo(140, r.y + 12);
        c.lineTo(160, r.y + 12);
        c.stroke();
        setFont(c, 50, fonts.ja, 900);
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        if (t < r.at) {
          c.fillStyle = '#2f2f35';
          c.beginPath();
          rr(c, 214, r.y - 34, 124, 68, 30);
          c.fill();
          for (let i = 0; i < 3; i++) {
            c.fillStyle = '#77777e';
            c.beginPath();
            c.arc(246 + i * 30, r.y - Math.max(0, Math.sin(t * 9 - i * 0.9)) * 9, 6.5, 0, TAU);
            c.fill();
          }
          return;
        }
        const shown = t < r.at2 ? r.head : Math.min(r.text.length, r.head + 1 + Math.floor((t - r.at2) / 0.075));
        const text = `「${r.text.slice(0, shown)}${shown >= r.text.length ? '」' : ''}`;
        const w = c.measureText(`「${r.text}」`).width;
        c.fillStyle = '#2f2f35';
        c.beginPath();
        rr(c, 214, r.y - 50, w + 64, 100, 34);
        c.fill();
        c.fillStyle = '#d4d4da';
        c.fillText(text, 246, r.y + 3);
        if (t > r.at2 + 0.7) {
          c.fillStyle = '#56565c';
          setFont(c, 17, fonts.ko, 600);
          c.fillText('既読', 226 + w + 64, r.y + 36);
        }
        // 말풍선에 금
        if (ri === 1 && crackK > 0) {
          c.strokeStyle = '#e8e8ee';
          c.lineWidth = 3;
          c.lineJoin = 'round';
          c.beginPath();
          const pts: [number, number][] = [[300, r.y - 50], [330, r.y - 18], [312, r.y + 6], [352, r.y + 28], [340, r.y + 50]];
          const nn = (pts.length - 1) * crackK;
          c.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i <= Math.floor(nn); i++) c.lineTo(pts[i][0], pts[i][1]);
          c.stroke();
        }
      });
    });
    c.restore();
  };

  // ── 35. 塞ぎ込んで 舌鋒絶頂へ ───────────────────────────
  // 날 선 말 = 위아래에서 조여 오는 이빨(가운데서 퍼지는 방사 무늬는 쓰지 않는다)
  const spikes: SceneFn = (c, f) => {
    const { t } = f;
    const tZep = ct(42, 1);
    const tZet = ct(42, 2);
    fillBg(c);
    // 끝까지 날아가는 중이게(컷 직전에 화면이 비어 멈추지 않도록)
    const up = easeInCubic(span01(t, tZet, f.span.end + 0.25));
    const thrust = easeOutCubic(span01(t, tZep, tZep + 0.13));
    const grow = easeOutCubic(span01(t, f.span.start, tZep));
    c.save();
    shake(c, 10 * hit(t, tZep, 9), t);
    zoomAt(c, 1.16 - 0.12 * f.k, 640, 430, () => {
      const n = 11;
      const tooth = (x: number, base: number, tip: number, w: number, a: number) => {
        const path = () => {
          c.beginPath();
          c.moveTo(x - w, base);
          c.lineTo(x, tip);
          c.lineTo(x + w, base);
          c.closePath();
        };
        c.fillStyle = rgba(NEON.pink, 0.13);
        path();
        c.fill();
        neon(c, NEON.pink, 3.5, path, a);
      };
      for (let i = 0; i < n; i++) {
        const x = 40 + i * 120;
        const mid = Math.abs(i - 5);
        const rise = up * (1300 + hash(i * 7) * 900);
        // 윗니: 사람 머리 위까지 내려온다
        const topTip = lerp(lerp(-60, 170 + (i % 2) * 40, grow), 300 + (i % 3) * 22 - (mid < 1 ? 40 : 0), thrust);
        tooth(x, -80 - rise, topTip - rise, 64, 0.9);
        // 아랫니: 사람 양옆으로 솟는다
        if (mid >= 1) {
          const botTip = lerp(lerp(H + 60, 620 - (i % 2) * 30, grow), 520 - mid * 6 - (i % 3) * 26, thrust);
          tooth(x + 60, H + 80 - rise, botTip - rise, 64, 0.9);
        }
      }
      const pose = mixPose(POSE.crouch, POSE.lookUp, easeOutCubic(span01(t, tZet, tZet + 0.35)));
      const tremble = (hash(Math.floor(t * 30)) - 0.5) * 6 * thrust * (1 - up);
      figure(c, 640 + tremble, 560, 210, pose, { color: t >= tZet ? NEON.white : NEON.gray, rim: t >= tZet ? NEON.white : undefined, rimBlur: 16 });
    });
    c.restore();
  };

  // ── 36. 合図を奏でて prr prr prr prr ───────────────────
  const ringScene: SceneFn = (c, f) => {
    const { t } = f;
    const tPrr = ct(43, 1);
    fillBg(c);
    if (t < tPrr) {
      const b = kit.beat();
      const p = pulse(t, 8);
      zoomAt(c, 1 + f.k * 0.25, 640, 360, () => {
        dead(c, 4, () => {
          c.beginPath();
          rr(c, 440, 160, 400, 400, 40);
        }, 0.4);
        glow(c, 640, 360, 300 + 120 * p, NEON.yellow, 0.25 + 0.4 * p);
        const s = 1 - 0.08 * p;
        c.fillStyle = rgba(NEON.yellow, 0.16 + 0.3 * p);
        c.beginPath();
        c.arc(640, 360, 118 * s, 0, TAU);
        c.fill();
        neon(c, NEON.yellow, 6, () => ring(c, 640, 360, 118 * s));
        neon(c, NEON.yellow, 3, () => ring(c, 640, 360, 150), 0.6);
        const first = Math.ceil(b.pos(f.span.start - 0.02));
        for (let i = first; i <= Math.floor(b.pos(t)); i++) {
          const age = t - b.timeOf(i);
          neon(c, NEON.yellow, 3.5, () => ring(c, 640, 360, 150 + age * 620), Math.exp(-age * 2));
        }
      });
      return;
    }
    // 네 칸에 박마다 하나씩 울린다
    const cols = [NEON.yellow, NEON.cyan, NEON.pink, NEON.violet];
    for (let q = 0; q < 4; q++) {
      const x = 28 + (q % 2) * (W / 2 - 8);
      const y = 22 + Math.floor(q / 2) * (H / 2 - 6);
      const w = W / 2 - 48;
      const h = H / 2 - 38;
      const at = tPrr + q * per();
      const on = t >= at;
      const frame = () => {
        c.beginPath();
        rr(c, x, y, w, h, 20);
      };
      if (!on) {
        dead(c, 3, frame, 0.3);
        continue;
      }
      const a = hit(t, at, 3);
      c.fillStyle = rgba(cols[q], 0.08 + 0.2 * a);
      frame();
      c.fill();
      neon(c, cols[q], 4, frame);
      const cx = x + w / 2;
      const cy = y + h / 2;
      glow(c, cx, cy, 240, cols[q], 0.25 + 0.5 * a);
      c.save();
      c.translate(cx, cy);
      c.rotate(Math.sin(t * 70 + q) * 0.16 * (0.3 + a));
      neon(c, cols[q], 5, () => {
        c.beginPath();
        rr(c, -42, -76, 84, 152, 16);
        c.moveTo(-14, 56);
        c.lineTo(14, 56);
      });
      c.restore();
      // 진동선
      for (const s of [-1, 1]) {
        for (let k = 1; k <= 3; k++) {
          neon(c, cols[q], 4, () => {
            c.beginPath();
            c.arc(cx, cy, 70 + k * 34 + a * 30, s > 0 ? -0.55 : Math.PI - 0.55, s > 0 ? 0.55 : Math.PI + 0.55);
          }, (0.35 + 0.65 * a) * (1 - k * 0.2));
        }
      }
    }
  };

  // ── 37. yeah — 모든 창에 불이 켜지고, 모여든다 ──────────
  const ringAll: SceneFn = (c, f) => {
    const { t } = f;
    const tAtsu = ct(44, 1);
    fillBg(c);
    const zoom = lerp(1, 0.46, f.k);
    cam(c, zoom, 640, lerp(360, 520, f.k), () => {
      // 옆 건물들
      c.fillStyle = '#0b0915';
      for (const [x, w, h] of [[-900, 520, 900], [-330, 260, 600], [1350, 300, 760], [1700, 520, 520], [-1500, 500, 500], [2280, 400, 880]] as const) {
        c.fillRect(x, 760 - h, w, h + 400);
        for (let k = 0; k < 14; k++) {
          if (hash(k * 7 + x) > 0.5) continue;
          c.fillStyle = rgba(PARTY[k % 4], 0.5);
          c.fillRect(x + 30 + (k % 4) * (w / 4.4), 760 - h + 40 + Math.floor(k / 4) * 110, 40, 56);
          c.fillStyle = '#0b0915';
        }
      }
      c.fillStyle = '#0d0b18';
      c.fillRect(-40, -60, W + 80, 1300);
      const cw = W / 4;
      const chh = H / 4;
      for (let i = 0; i < 16; i++) {
        const q = i % 4;
        const r = Math.floor(i / 4);
        const col = PARTY[(i * 7 + r) % 4];
        const x = q * cw + 12;
        const y = r * chh + 10;
        const leave = span01(t, tAtsu + hash(i * 3) * 0.9, tAtsu + hash(i * 3) * 0.9 + 0.3);
        const a = (1 - 0.8 * leave) * (0.75 + 0.25 * pulse(t));
        c.fillStyle = rgba(col, 0.2 * a + 0.4 * hit(t, f.span.start, 5));
        c.beginPath();
        rr(c, x, y, cw - 24, chh - 20, 10);
        c.fill();
        neon(c, col, 3.5, () => {
          c.beginPath();
          rr(c, x, y, cw - 24, chh - 20, 10);
        }, a);
        if (leave < 1) {
          c.save();
          c.beginPath();
          c.rect(x, y, cw - 24, chh - 20);
          c.clip();
          const pose = mixPose(POSE.down, POSE.armsUp, easeOutCubic(span01(t, f.span.start + (i % 5) * 0.05, f.span.start + 0.3 + (i % 5) * 0.05)));
          figure(c, x + cw / 2 - 12, y + chh + 46 + leave * 200, 230, pose, { color: col });
          c.restore();
        }
      }
      // 거리로 나와 한쪽으로 모이는 불빛
      neon(c, NEON.violet, 4, () => {
        c.beginPath();
        c.moveTo(-2400, 980);
        c.lineTo(3600, 980);
      }, 0.6);
      for (let i = 0; i < 60; i++) {
        const at = tAtsu + hash(i * 5) * 1.2;
        const a = t - at;
        if (a < 0) continue;
        const x = 200 + hash(i * 9) * 900 + a * (260 + hash(i) * 200);
        glow(c, x, 950 - Math.abs(Math.sin(a * 8 + i)) * 14, 30, PARTY[i % 4], 0.9);
      }
    });
  };

  // ── 38. 夜行だ — 불빛을 든 행렬 ────────────────────────
  const parade: SceneFn = (c, f) => {
    const { t } = f;
    fillBg(c, '#05030b');
    // 카메라가 행렬과 같이 오른쪽으로 간다(배경이 왼쪽으로 흐름). 행렬은 화면에서 아주 조금 앞서 나간다 —
    // 오른쪽을 보는 사람이 화면 왼쪽으로 밀리면 뒤로 걷는 것처럼 보인다(2026-11-17 사용자 지적).
    const camX = f.age * 170;
    const drift = f.age * 26;
    // 행렬 가운데를 크게 보다가 물러나며 맨 앞의 아야를 드러낸다
    const reveal = smooth(span01(f.k, 0.3, 0.8));
    c.save();
    zoomAt(c, lerp(1.45, 1, reveal), lerp(380, 640, reveal), lerp(470, 360, reveal), () => paradeBody(c, f, t, camX, drift));
    c.restore();
  };

  const paradeBody = (c: Ctx, f: Parameters<SceneFn>[1], t: number, camX: number, drift: number) => {
    // 먼 건물
    for (let i = 0; i < 12; i++) {
      const x = ((i * 260 - camX * 0.15) % 3120 + 3120) % 3120 - 300;
      const h = 190 + hash(i * 7) * 260;
      c.fillStyle = '#0c0919';
      c.fillRect(x, 590 - h, 200, h);
      for (let k = 0; k < 12; k++) {
        if (hash(i * 31 + k) > 0.45) continue;
        c.fillStyle = rgba(k % 3 ? NEON.violet : NEON.yellow, 0.5);
        c.fillRect(x + 22 + (k % 3) * 56, 590 - h + 26 + Math.floor(k / 3) * 58, 26, 30);
      }
    }
    // 네온 간판
    const signs = ['夜', '行', '踊', '暗', '転'];
    for (let i = 0; i < 7; i++) {
      const x = ((i * 420 - camX * 0.45) % 2940 + 2940) % 2940 - 300;
      const col = [NEON.pink, NEON.cyan, NEON.violet][i % 3];
      const a = flicker(t, i * 13, 0.05);
      neon(c, col, 4, () => {
        c.beginPath();
        rr(c, x, 150 + (i % 2) * 70, 130, 170, 14);
      }, 0.8 * a);
      neonText(c, signs[i % signs.length], x + 65, 238 + (i % 2) * 70, 104, fonts.display, col, a, { fill: 0, tube: 0.04 });
      glow(c, x + 65, 240 + (i % 2) * 70, 220, col, 0.16 * a);
    }
    // 바닥 — 보도 이음매가 카메라 속도로 흐른다
    c.fillStyle = '#04030a';
    c.fillRect(-400, 590, W + 800, 300);
    neon(c, NEON.violet, 3, () => {
      c.beginPath();
      c.moveTo(-400, 590);
      c.lineTo(W + 400, 590);
    }, 0.6);
    c.strokeStyle = rgba(NEON.violet, 0.22);
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const x = ((i * 150 - camX) % 2400 + 2400) % 2400 - 500;
      c.moveTo(x, 600);
      c.lineTo(x - 90, 720);
    }
    c.stroke();
    // 걷는 사람들 — 한 박에 한 걸음, 모두 오른쪽(앞)으로. 뒷줄은 작고 어둡게
    const phase = pos(t) * Math.PI;
    const lead = 900 + drift;
    const cols = [NEON.yellow, NEON.pink, NEON.violet, NEON.cyan];
    for (let row = 1; row >= 0; row--) {
      const scale = row ? 0.72 : 1;
      const ground = row ? 568 : 590;
      for (let i = 0; i < 11; i++) {
        const x = lead - 150 - i * 118 - row * 59 + (hash(i * 7 + row * 31) - 0.5) * 36;
        if (x < -260) continue;
        const h = (190 + hash(i * 3 + row * 11) * 60) * scale;
        const col = cols[(i + row * 2) % 4];
        glow(c, x, ground + 20, 90 * scale, col, row ? 0.12 : 0.2, 18);
        figure(c, x, ground, h, walkPose(phase + i * 1.3 + row * 0.7), {
          color: row ? '#08060f' : '#0d0a1a', rim: rgba(col, row ? 0.3 : 0.55), rimBlur: 8, hold: 'light', holdColor: col,
        });
      }
    }
    // 행렬 맨 앞 — 아야. 물러나며 드러날 때 분홍 조명이 켜진다
    const lit = span01(f.k, 0.55, 0.75);
    if (lit > 0) cone(c, lead + 40, -40, lead, 590, 220, NEON.pink, 0.5 * lit, 16);
    figure(c, lead, 590, 290, walkPose(phase), { skin: 'aya', color: '#07060b', rim: rgba(NEON.pink, 0.35 + 0.65 * lit), rimBlur: 18, hold: 'mic', swing: Math.sin(phase) * 0.5 });
    glow(c, lead, 420, 260, NEON.pink, 0.1 + 0.2 * lit);
  };

  // ── 39. 鳴いていこう — 길게 끄는 소리, 백색으로 ─────────
  const scream: SceneFn = (c, f) => {
    const { t } = f;
    fillBg(c);
    const rise = smooth(span01(t, f.span.start, f.span.start + 1.4));
    const loud = kit.env('rms', t);
    zoomAt(c, 1 + f.k * 0.28, 640, 300, () => {
      // 뒤따르는 불빛들
      for (let i = 0; i < 34; i++) {
        const x = hash(i * 7) * W + Math.sin(t * 0.8 + i) * 30;
        const y = 380 + hash(i * 11) * 300;
        glow(c, x, y, 30 + hash(i * 3) * 50, [NEON.yellow, NEON.pink, NEON.violet][i % 3], 0.3 + 0.2 * Math.sin(t * 3 + i));
      }
      glow(c, 640, 260, 260 + 620 * f.k, NEON.white, 0.2 + 0.6 * f.k * (0.6 + 0.4 * loud), 380 + 500 * f.k);
      glow(c, 640, 300, 420 + 300 * f.k, NEON.pink, 0.3);
      // 마이크에서 솟는 소리의 호
      const b = kit.beat();
      const step = b.period / 2;
      for (let j = Math.floor((t - 2) / step); j * step <= t; j++) {
        const age = t - j * step;
        if (j * step < f.span.start || age > 2) continue;
        neon(c, j % 2 ? NEON.pink : NEON.white, 5, () => {
          c.beginPath();
          c.arc(700, 250, 60 + age * 520, -Math.PI / 2 - 0.75, -Math.PI / 2 + 0.75);
        }, Math.exp(-age * 1.6));
      }
      const pose = mixPose(POSE.mic, POSE.micUp, rise);
      figure(c, 640, 860, 800, pose, { skin: 'aya', color: '#050409', rim: NEON.pink, rimBlur: 26, hold: 'mic', swing: Math.sin(t * 3) * 0.4 + loud * 0.5 });
    });
    const white = easeInCubic(span01(t, f.span.end - 1.0, f.span.end));
    if (white > 0) {
      c.fillStyle = `rgba(246,244,255,${white})`;
      c.fillRect(0, 0, W, H);
    }
  };

  // ── 40. 드롭 2 — 흰 바탕의 검은 군중 ───────────────────
  const jumpCrowd: SceneFn = (c, f) => {
    const { t } = f;
    const ink = '#07060b';
    fillBg(c, NEON.white);
    const b = kit.beat();
    const p = pulse(t, 5);
    const tScream = kit.cues().scream;
    c.save();
    shake(c, 7 * p, t);
    zoomAt(c, 1 + f.k * 0.1, 640, 300, () => {
      // 망점
      c.fillStyle = ink;
      c.beginPath();
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 44; x++) {
          const r = (9 - y) * 1.5 * (0.55 + 0.45 * p);
          c.moveTo(-40 + x * 32 + (y % 2) * 16 + r, 10 + y * 27);
          c.arc(-40 + x * 32 + (y % 2) * 16, 10 + y * 27, r, 0, TAU);
        }
      }
      c.fill();
      // 무대
      c.fillRect(-100, 318, W + 200, 14);
      const hopS = Math.sin(clamp(b.frac(t)) * Math.PI);
      figure(c, 640, 318, 150, { ...POSE.jump, air: 0.25 * hopS }, { skin: 'aya', color: ink, swing: hopS });
      // 고음의 충격파
      const a = t - tScream;
      if (a > 0) {
        c.strokeStyle = ink;
        c.lineWidth = 14 * Math.exp(-a * 1.5);
        c.beginPath();
        c.ellipse(640, 250, 60 + a * 900, (60 + a * 900) * 0.5, 0, 0, TAU);
        c.stroke();
      }
      crowdRows(c, (i, x, y, s) => {
        const hop = Math.pow(Math.sin(clamp(b.frac(t - hash(i) * 0.06)) * Math.PI), 0.8);
        fan(c, x, y - 30 - hop * 62 * s, s * 0.92, { color: ink, rim: NEON.white, raise: 1, sway: Math.sin(t * 6 + i) * 0.5, both: true });
      });
    });
    c.restore();
  };

  // ── 41. 드롭 2 — 「踊」 여덟 컷 ─────────────────────────
  const odoCuts: SceneFn = (c, f) => {
    const { t } = f;
    const b = kit.beat();
    const idx = clamp(Math.floor((t - f.span.start) / b.period + 0.02), 0, 7);
    const fr = clamp((t - f.span.start) / b.period - idx);
    const punch = 1.2 - 0.2 * easeOutCubic(clamp(fr * 4)) + fr * 0.04;
    const plain = (color: string, size: number, x = W / 2, y = 372) => {
      c.fillStyle = color;
      setFont(c, size, fonts.display, 400);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('踊', x, y);
    };
    c.save();
    switch (idx) {
      case 0:
        fillBg(c, '#07060b');
        c.translate(W / 2, H / 2);
        c.scale(punch, punch);
        c.translate(-W / 2, -H / 2);
        neonText(c, '踊', W / 2, 372, 590, fonts.display, NEON.white, 1);
        break;
      case 1:
        fillBg(c, NEON.yellow);
        c.translate(W / 2, H / 2);
        c.rotate(-0.1);
        c.scale(punch, punch);
        c.translate(-W / 2, -H / 2);
        plain('#07060b', 640);
        break;
      case 2:
        fillBg(c, '#07060b');
        c.translate(W / 2, H / 2);
        c.scale(punch, punch);
        c.translate(-W / 2, -H / 2);
        glow(c, W / 2, 360, 620, NEON.pink, 0.3);
        neonText(c, '踊', W / 2, 372, 560, fonts.display, NEON.pink, 1, { fill: 0, tube: 0.022 });
        break;
      case 3: {
        fillBg(c, '#07060b');
        const off = fr * 60;
        for (let r = -1; r < 5; r++) {
          for (let q = -1; q < 9; q++) {
            c.save();
            c.translate(q * 170 + (r % 2 ? 85 : 0) - off, r * 170 + 80);
            if ((q + r) % 2) c.scale(-1, 1);
            plain((q + r) % 3 ? NEON.cyan : NEON.white, 150, 0, 0);
            c.restore();
          }
        }
        break;
      }
      case 4:
        fillBg(c, NEON.violet);
        c.translate(W / 2, H / 2);
        c.scale(punch, punch);
        c.translate(-W / 2, -H / 2);
        plain(NEON.white, 1500, 760, 560);
        break;
      case 5: {
        fillBg(c, '#07060b');
        const m = ledMask('踊', fonts.ja, 40);
        const pitch = 16 * punch;
        led(c, m, W / 2 - (m.w * pitch) / 2, H / 2 - (40 * pitch) / 2, pitch, NEON.yellow, { cols: m.w, off: 0.08 });
        break;
      }
      case 6: {
        fillBg(c, NEON.pink);
        c.beginPath();
        for (let y = -20; y < H + 20; y += 44) c.rect(0, y + fr * 44, W, 24);
        c.clip();
        c.translate(W / 2, H / 2);
        c.scale(punch, punch);
        c.translate(-W / 2, -H / 2);
        plain(NEON.cyan, 640);
        break;
      }
      default: {
        fillBg(c, NEON.white);
        for (let k = 0; k < 9; k++) {
          c.save();
          c.beginPath();
          c.rect(0, k * 80, W, 80);
          c.clip();
          c.translate((hash(k * 7 + Math.floor(fr * 8)) - 0.5) * 130 * (1 - fr * 0.6), 0);
          plain('#07060b', 640);
          c.restore();
        }
      }
    }
    c.restore();
  };

  // ── 42. 드롭 2 — 무대 전광판에 비친 아야 ───────────────
  // 원본 화면을 160×90 점으로 줄여 LED 판처럼 크게 비춘다. 박마다 색이 바뀌며 위에서 아래로 새로 고침,
  // 마디마다 온몸 ↔ 얼굴 가까이. 처음엔 띠마다 시간차(슬릿 스캔)였으나 깨진 화면처럼 보여 바꿈(2026-11-17).
  const LW = 160;
  const LH = 90;
  const SX = 150;
  const SY = 34;
  const SW = 980;
  const SH = (SW * LH) / LW;
  let ledSrc: HTMLCanvasElement | null = null;
  let ledBloom: HTMLCanvasElement | null = null;
  let ledDots: HTMLCanvasElement | null = null;
  const ledCanvases = () => {
    if (!ledSrc || !ledBloom || !ledDots) {
      ledSrc = document.createElement('canvas');
      ledSrc.width = LW;
      ledSrc.height = LH;
      ledBloom = document.createElement('canvas');
      ledBloom.width = 28;
      ledBloom.height = 16;
      // 점 사이를 막는 검은 판 — 점 자리만 둥글게 뚫는다
      ledDots = document.createElement('canvas');
      ledDots.width = Math.ceil(SW);
      ledDots.height = Math.ceil(SH);
      const d = ledDots.getContext('2d')!;
      d.fillStyle = '#040308';
      d.fillRect(0, 0, ledDots.width, ledDots.height);
      d.globalCompositeOperation = 'destination-out';
      const pitch = SW / LW;
      d.beginPath();
      for (let y = 0; y < LH; y++) {
        for (let x = 0; x < LW; x++) {
          const cx = (x + 0.5) * pitch;
          const cy = (y + 0.5) * pitch;
          d.moveTo(cx + pitch * 0.4, cy);
          d.arc(cx, cy, pitch * 0.4, 0, TAU);
        }
      }
      d.fill();
    }
    return { src: ledSrc, bloom: ledBloom, dots: ledDots };
  };

  const ledWall: SceneFn = (c, f) => {
    const { t } = f;
    fillBg(c);
    const b = kit.beat();
    const idx = b.index(t);
    const fr = b.frac(t);
    const p = pulse(t, 5);
    const bar = Math.floor(idx / 4);
    const tint = [null, NEON.pink, null, NEON.cyan][((idx % 4) + 4) % 4];
    const edge = tint ?? NEON.violet;
    const { src, bloom, dots } = ledCanvases();

    // 1) 원본을 점 개수만큼 작게 — 아바타 부분(거의 정사각)을 가운데에, 양옆엔 좌우 반전한 어두운 사본.
    //    마디마다 상반신 ↔ 얼굴 가까이, 두 마디마다 가운데도 좌우 반전
    const s = src.getContext('2d')!;
    s.globalCompositeOperation = 'source-over';
    s.globalAlpha = 1;
    s.fillStyle = '#000';
    s.fillRect(0, 0, LW, LH);
    const flip = Math.floor(bar / 2) % 2 === 1;
    const zoom = bar % 2 ? 1.6 : 1;
    const sq = LH;
    const x0 = (LW - sq) / 2;
    if (!kit.footage(s, f.video, x0, 0, sq, sq, { zoom, cy: zoom > 1 ? 0.47 : undefined, mirror: flip })) noFootage(s, x0, 0, sq, sq, t);
    s.globalAlpha = 0.4;
    kit.footage(s, f.video, x0 - sq, 0, sq, sq, { zoom, cy: zoom > 1 ? 0.47 : undefined, mirror: !flip });
    kit.footage(s, f.video, x0 + sq, 0, sq, sq, { zoom, cy: zoom > 1 ? 0.47 : undefined, mirror: !flip });
    s.globalAlpha = 1;
    if (tint) {
      s.globalCompositeOperation = 'multiply';
      s.fillStyle = tint;
      s.fillRect(0, 0, LW, LH);
      s.globalCompositeOperation = 'lighter';
      s.fillStyle = rgba(tint, 0.18);
      s.fillRect(0, 0, LW, LH);
    }
    // 새로 고침: 박이 떨어지면 아래쪽은 아직 지난 색 — 위에서부터 밝은 줄이 내려가며 바뀐다
    const wipe = clamp(fr / 0.22);
    s.globalCompositeOperation = 'source-over';
    if (wipe < 1) {
      const wy = Math.floor(LH * wipe);
      s.fillStyle = 'rgba(0,0,0,0.55)';
      s.fillRect(0, wy, LW, LH - wy);
      s.fillStyle = 'rgba(255,255,255,0.85)';
      s.fillRect(0, wy - 1, LW, 2);
    }
    const bc = bloom.getContext('2d')!;
    bc.clearRect(0, 0, bloom.width, bloom.height);
    bc.drawImage(src, 0, 0, bloom.width, bloom.height);

    zoomAt(c, 1.02 + f.k * 0.05 + 0.012 * p, 640, 330, () => {
      // 전광판 뒤 무대 빛
      glow(c, 640, SY + SH / 2, 820, edge, 0.18 + 0.12 * p, 200);
      // 2) LED 판: 점 하나하나가 또렷하게(부드럽게 늘이지 않음) → 점 사이 검은 판 → 빛 번짐
      c.save();
      c.imageSmoothingEnabled = false;
      c.drawImage(src, SX, SY, SW, SH);
      c.imageSmoothingEnabled = true;
      c.drawImage(dots, SX, SY, SW, SH);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.2 + 0.1 * p;
      c.drawImage(bloom, SX - 60, SY - 50, SW + 120, SH + 100);
      c.restore();
      // 판 테두리와 받침
      c.strokeStyle = '#1c1828';
      c.lineWidth = 14;
      c.strokeRect(SX - 7, SY - 7, SW + 14, SH + 14);
      neon(c, edge, 3, () => {
        c.beginPath();
        c.rect(SX - 14, SY - 14, SW + 28, SH + 28);
      }, 0.55 + 0.35 * p);
      // 바닥에 비친 전광판 빛
      glow(c, 640, SY + SH + 70, 700, edge, 0.2 + 0.1 * p, 60);
    });

    // 3) 객석 뒤통수 한 줄 — 박에 맞춰 불빛을 든다
    for (let i = 0; i < 10; i++) {
      const x = 40 + i * 136 + (i % 2 ? 22 : 0);
      const hop = Math.pow(Math.sin(clamp(b.frac(t - hash(i) * 0.05)) * Math.PI), 0.9);
      fan(c, x, 760 - hop * 14, 1.55, { color: '#050309', rim: rgba(edge, 0.3), raise: 0.75 + 0.25 * hop, sway: Math.sin(t * 5 + i), light: PARTY[i % 4] });
    }
  };

  // ── 43. 드롭 2 — 군무(캐논), 그리고 전원 차단 ───────────
  const canon: SceneFn = (c, f) => {
    const { t } = f;
    const tOff = f.span.end - per() * 0.85;
    const sy = 1 - 0.996 * easeInCubic(span01(t, tOff, tOff + 0.16));
    const sx = 1 - easeInCubic(span01(t, tOff + 0.14, tOff + 0.32));
    fillBg(c, '#000000');
    if (sx <= 0.001) return;
    c.save();
    c.translate(W / 2, H / 2);
    c.scale(sx, sy);
    c.translate(-W / 2, -H / 2);
    fillBg(c);
    const bp = pos(t);
    const p = pulse(t, 5);
    zoomAt(c, 1 + f.k * 0.08, 640, 400, () => {
      for (let i = 0; i < 9; i++) {
        const x = 60 + i * 145;
        neon(c, PARTY[i % 4], 7, () => {
          c.beginPath();
          c.moveTo(x, 40);
          c.lineTo(x, 360);
        }, ((Math.floor(bp) + i) % 2 ? 1 : 0.15) * (0.5 + 0.5 * p));
      }
      glow(c, 640, 620, 900, NEON.violet, 0.3 + 0.2 * p, 120);
      neon(c, NEON.white, 3, () => {
        c.beginPath();
        c.moveTo(-40, 620);
        c.lineTo(W + 40, 620);
      }, 0.7);
      for (let i = 0; i < 7; i++) {
        const d = Math.abs(i - 3);
        const x = 640 + (i - 3) * 172;
        const pose = danceAt(DANCE2, bp - d, 0.2);
        if (i === 3) figure(c, x, 620, 380, pose, { skin: 'aya', color: NEON.white, ...AYA_LIT, rim: NEON.pink, rimBlur: 20, swing: Math.sin(bp * Math.PI) });
        else figure(c, x, 620, 270 - d * 14, pose, { color: PARTY[(i + 1) % 4], flip: i > 3 });
      }
      confetti(c, t, 90, 43, PARTY, 240);
    });
    c.restore();
    // 꺼지는 화면의 흰 줄
    const line = span01(t, tOff, tOff + 0.16);
    if (line > 0) {
      c.fillStyle = `rgba(255,255,255,${0.9 * line})`;
      c.fillRect(W / 2 - (W / 2) * sx, H / 2 - Math.max(2, (H / 2) * sy), W * sx, Math.max(4, H * sy));
    }
  };

  void fit;
  return {
    blackoutSign, strobeDancer, fullHouse, hands, letGo, eqCity, mosaic, trio, laserTunnel, crack, boxPress, upDown, burst,
    chatGray, spikes, ring: ringScene, ringAll, parade, scream, jumpCrowd, odoCuts, ledWall, canon,
  };
}
