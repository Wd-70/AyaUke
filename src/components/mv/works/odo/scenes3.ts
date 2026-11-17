// 踊 장면 44~56 — 암전(정점) · 마지막 후렴(전부 켜짐) · 종연.
import { TAU, clamp, easeInCubic, easeOutBack, easeOutCubic, hash, lerp, setFont, smooth } from '../../engine';
import { rgba } from '../../paint';
import {
  BG, type Ctx, H, type Kit, NEON, PARTY, type SceneFn, W, cam, chunkT, cone, confetti, dead, fillBg, flicker, glow, hit, led, ledMask,
  neon, neonText, noFootage, ring, rr, shake, span01, zoomAt,
} from './kit';
import { AYA_LIT, byePose, DANCE, DANCE2, danceAt, fan, figure, mixPose, POSE } from './pose';
import { exitSign, seats } from './scenes1';
import { crowdRows, drawSign, rig } from './scenes2';

/** 객석의 불빛 자리 — 켜지는 순서대로. 0번은 한가운데 */
const LIGHTS: { u: number; z: number; rank: number }[] = (() => {
  const out: { u: number; z: number; rank: number }[] = [{ u: 0.52, z: 0.56, rank: 0 }];
  for (let r = 0; r < 11; r++) {
    for (let q = 0; q < 22; q++) {
      out.push({ u: (q + 0.5 + (hash(q * 7 + r * 31) - 0.5) * 0.7) / 22, z: (r + 0.5 + (hash(q * 13 + r * 5) - 0.5) * 0.7) / 11, rank: 1 + hash(q * 17 + r * 101) * 240 });
    }
  }
  return out.sort((a, b) => a.z - b.z);
})();

export function scenes3(kit: Kit): Record<string, SceneFn> {
  const { fonts } = kit;
  const ct = (line: number, chunk = 0) => chunkT(kit.lines(), line, chunk);
  const pulse = (t: number, d = 6) => kit.beat().pulse(t, d);
  const pos = (t: number) => kit.beat().pos(t);
  const per = () => kit.beat().period;

  /** 객석의 불빛들 — count개까지 켜진다. lean은 가운데로 쏠리는 정도 */
  const lightField = (c: Ctx, t: number, count: number, a = 1, color: string = NEON.white, lean = 0) => {
    for (const L of LIGHTS) {
      const on = clamp(count - L.rank);
      if (on <= 0) continue;
      const depth = 0.55 + 0.95 * L.z;
      const x = 640 + (L.u - 0.5) * W * (0.72 + 0.85 * L.z) + Math.sin(t * 1.9 + L.u * 9) * 9 * depth - (L.u - 0.5) * 60 * lean;
      const y = 250 + L.z * L.z * 440 - pulse(t, 5) * 5 * depth;
      const col = L.rank === 0 ? NEON.white : hash(Math.floor(L.rank * 9)) > 0.72 ? NEON.violet : color;
      glow(c, x, y, 26 * depth, col, on * a * (0.7 + 0.3 * Math.sin(t * 3 + L.rank)));
      c.fillStyle = `rgba(255,255,255,${on * a})`;
      c.fillRect(x - 1.6 * depth, y - 1.6 * depth, 3.2 * depth, 3.2 * depth);
    }
  };

  // ── 44. 완전한 어둠, 불빛 하나 ────────────────────────
  const oneLight: SceneFn = (c, f) => {
    const { t } = f;
    fillBg(c, '#000000');
    zoomAt(c, lerp(1.7, 1.4, f.k), 650, 388, () => {
      const born = hit(t, f.span.start, 4);
      glow(c, 650, 388, 240, NEON.white, 0.25 * born);
      lightField(c, t, clamp((t - f.span.start) * 6) + (f.k > 0.72 ? (f.k - 0.72) * 8 : 0));
    });
  };

  // ── 45. 불빛이 늘어 별밭처럼 ──────────────────────────
  const starfield: SceneFn = (c, f) => {
    const { t } = f;
    fillBg(c, '#000000');
    zoomAt(c, lerp(1.4, 1.0, smooth(f.k)), 650, 388, () => {
      glow(c, 640, 460, 700, NEON.violet, 0.12 * f.k, 260);
      lightField(c, t, 3.2 + 237 * f.k * f.k);
    }, f.k * 0.06);
  };

  // ── 46. 半端なら K.O. — 빛기둥 ─────────────────────────
  const beam: SceneFn = (c, f) => {
    const { t } = f;
    const tKO = ct(46, 1);
    const peak = kit.cues().peak;
    const hold = span01(t, peak, peak + 1.9);
    const again = hit(t, peak + 2.9, 2.2);
    const on = t >= tKO ? 1 : 0;
    const loud = kit.env('rms', t);
    fillBg(c, '#000000');
    c.save();
    shake(c, (5 * hold * (1 - hold) * 4 + 6 * hit(t, tKO, 8)) * (0.5 + loud), t);
    zoomAt(c, 1 + f.k * 0.1, 640, 330, () => {
      lightField(c, t, 240, 0.7 - 0.35 * span01(t, f.span.start, tKO) + 0.3 * hold, NEON.white, span01(t, f.span.start, tKO));
      if (!on) {
        // 「半端なら」 — 빛이 오려다 만다
        const tease = flicker(t, 9, 0.5, 20);
        neon(c, NEON.white, 2, () => {
          c.beginPath();
          c.moveTo(640, -40);
          c.lineTo(640, 150 + 200 * span01(t, f.span.start, tKO));
        }, 0.4 * tease);
        return;
      }
      const w = 100 + 380 * hold + 70 * again + (t - tKO) * 14;
      const a = 0.75 + 0.25 * loud;
      cone(c, 640, -60, 640, 610, w * 0.62, NEON.white, 0.55 * a, w * 0.34);
      cone(c, 640, -60, 640, 610, w * 0.3, NEON.white, 0.9 * a, w * 0.2);
      glow(c, 640, 330, 300 + w, NEON.white, 0.22 + 0.3 * hold + 0.3 * hit(t, tKO, 5));
      // 빛을 타고 오르는 알갱이
      for (let i = 0; i < 50; i++) {
        const u = ((t * (0.25 + hash(i) * 0.5) + hash(i * 7)) % 1);
        glow(c, 640 + (hash(i * 3) - 0.5) * w * 0.9, 640 - u * 720, 7 + hash(i * 11) * 9, NEON.white, 0.7 * (1 - u));
      }
      // 「K.O.」 — 쓰러지지 않고 빛으로 솟는다
      const e = span01(t, tKO, peak + 1.9);
      c.save();
      c.translate(640, lerp(540, 150, easeOutCubic(e)));
      const sc = lerp(0.5, 1.5, e) * (1 + 0.5 * hit(t, tKO, 9));
      c.scale(sc, sc);
      neonText(c, 'K.O.', 0, 0, 280, fonts.display, NEON.white, (1 - e * e) * 0.95, { fill: 0, tube: 0.02 });
      c.restore();
      // 원 안의 원본 영상
      const r = (130 + 96 * hold + 16 * again) * easeOutBack(span01(t, tKO, tKO + 0.22));
      c.save();
      c.beginPath();
      c.arc(640, 340, r, 0, TAU);
      c.clip();
      if (!kit.footage(c, f.video, 640 - r, 340 - r, r * 2, r * 2)) noFootage(c, 640 - r, 340 - r, r * 2, r * 2, t);
      c.restore();
      neon(c, NEON.white, 5, () => ring(c, 640, 340, r));
      neon(c, NEON.white, 2.5, () => ring(c, 640, 340, r + 26 + 60 * hold), 0.5);
    });
    c.restore();
  };

  // ── 47. yeah ×6 — 한 번에 한 무리씩 켜진다 ─────────────
  const reveal: SceneFn = (c, f) => {
    const { t } = f;
    const t0 = f.span.start;
    const step = per() / 2;
    const cols = [NEON.violet, NEON.cyan, NEON.yellow, NEON.pink, NEON.green, NEON.white];
    const n = clamp(Math.floor((t - t0) / step) + 1, 0, 6);
    const last = t0 + (n - 1) * step;
    fillBg(c);
    c.save();
    shake(c, 7 * hit(t, last, 10), t);
    zoomAt(c, lerp(1.16, 1, f.k), 640, 320, () => {
      rig(c, t, n, 0.9);
      cone(c, 640, 60, 640, 340, 150, NEON.white, 0.6, 70);
      figure(c, 640, 338, 120, POSE.micUp, { skin: 'aya', color: '#060509', hold: 'mic' });
      // 큰 「YEAH」 — 칠 때마다 색이 바뀐다
      c.save();
      c.translate(640, 250);
      const pk = 1 + 0.22 * hit(t, last, 9);
      c.scale(pk, pk);
      neonText(c, 'YEAH', 0, 0, 250, fonts.display, cols[Math.max(0, n - 1)], 0.9, { fill: 0, tube: 0.022 });
      c.restore();
      const b = kit.beat();
      crowdRows(c, (i, x, y, s) => {
        const g = clamp(Math.floor(((x + 80) / (W + 160)) * 6), 0, 5);
        const lit = g < n;
        const at = t0 + g * step;
        const hop = lit && n >= 6 ? Math.sin(clamp(b.frac(t)) * Math.PI) * 26 * s : 0;
        fan(c, x, y - hop - (lit ? 14 * hit(t, at, 8) : 0), s, {
          color: '#06050a', rim: lit ? rgba(cols[g], 0.85) : rgba(NEON.violet, 0.12), raise: lit ? 1 : 0.15, sway: Math.sin(t * 7 + i), light: lit ? cols[g] : null, both: lit,
        });
      });
    });
    c.restore();
  };

  // ── 48. Woah 踊りだせ 踊りだせ — 전원 ──────────────────
  const everyone: SceneFn = (c, f) => {
    const { t } = f;
    const tOdo = ct(48, 1);
    const b = kit.beat();
    const charge = span01(t, f.span.start, tOdo);
    const dancing = t >= tOdo;
    const first = Math.round(b.pos(tOdo));
    const idx = Math.floor(b.pos(t) + 0.02);
    const p = pulse(t, 5);
    const fl = dancing ? Math.exp(-(t - Math.max(tOdo, b.timeOf(idx))) * 4.5) : 0;
    fillBg(c);
    zoomAt(c, 1.1 - 0.1 * f.k, 640, 420, () => {
      // 뒤의 세로 네온 — Woah 동안 가운데서 바깥으로 하나씩 켜진다
      for (let i = 0; i < 13; i++) {
        const x = 40 + i * 100;
        const on = dancing ? ((idx + i) % 2 ? 1 : 0.25) * (0.6 + 0.4 * p) : clamp(charge * 9 - Math.abs(i - 6));
        neon(c, PARTY[i % 4], 6, () => {
          c.beginPath();
          c.moveTo(x, 30);
          c.lineTo(x, 380);
        }, on);
      }
      for (let i = 0; i < 6; i++) {
        const x = 140 + i * 200;
        cone(c, x, -20, x + Math.sin(t * 1.4 + i * 1.9) * 260, 640, 130, PARTY[i % 4], (0.25 + 0.3 * p) * (dancing ? 1 : charge), 8);
      }
      const colNow = PARTY[((idx % 4) + 4) % 4];
      glow(c, 640, 600, 500 + 500 * charge, NEON.violet, 0.2 + 0.3 * charge, 110);
      if (fl > 0.01) glow(c, 640, 380, 760, colNow, 0.7 * fl, 460);
      neon(c, NEON.white, 3, () => {
        c.beginPath();
        c.moveTo(-60, 600);
        c.lineTo(W + 60, 600);
      }, 0.8);
      const seqAt = (lag: number) => danceAt(DANCE2, b.pos(t) - first - lag, 0.18);
      const raise = mixPose(POSE.stand, POSE.armsUp, smooth(charge));
      // 뒤줄 → 앞줄
      for (let j = 9; j >= 0; j--) {
        const side = j % 2 ? 1 : -1;
        const k = Math.floor(j / 2);
        const x = 640 + side * (170 + k * 108);
        const y = 600 - (k % 2) * 34;
        const col = PARTY[(j + 1) % 4];
        const pose = dancing ? seqAt(0) : mixPose(POSE.stand, POSE.armsUp, smooth(clamp(charge * 1.6 - k * 0.12)));
        figure(c, x, y, 250 - k * 8, pose, { color: col, flip: side > 0 });
      }
      figure(c, 640, 612, 420, dancing ? danceAt(DANCE, b.pos(t) - first, 0.16) : raise, {
        skin: 'aya', color: NEON.white, lit: AYA_LIT, rim: dancing ? colNow : NEON.violet, rimBlur: 22, swing: dancing ? Math.sin(b.pos(t) * Math.PI) : Math.sin(t * 2) * 0.3,
      });
      if (dancing) confetti(c, t, 80, 48, PARTY, 230);
    });
  };

  // ── 49. 孤独は殺菌 満員御礼 — 전광판 ───────────────────
  const ledFull: SceneFn = (c, f) => {
    const { t } = f;
    const tMan = ct(49, 1);
    const cols = 86;
    const rows = 26;
    const pitch = 14;
    const bx = 38;
    const by = 150;
    fillBg(c);
    c.save();
    c.translate(W / 2, H / 2);
    c.transform(1, 0.06, -0.03, 1.12, 0, 0);
    c.scale(1.04 + f.k * 0.06, 1.04 + f.k * 0.06);
    c.translate(-W / 2, -H / 2 - 20);
    c.fillStyle = '#0b0a10';
    c.beginPath();
    rr(c, bx - 34, by - 34, cols * pitch + 68, rows * pitch + 68, 20);
    c.fill();
    // 테두리 전구 — 반 박마다 번갈아
    const phase = Math.floor(pos(t) * 2);
    const bw = cols * pitch + 44;
    const bh = rows * pitch + 44;
    for (let i = 0; i < 68; i++) {
      const u = i / 68;
      const d = u * 2 * (bw + bh);
      const x = d < bw ? d : d < bw + bh ? bw : d < 2 * bw + bh ? 2 * bw + bh - d : 0;
      const y = d < bw ? 0 : d < bw + bh ? d - bw : d < 2 * bw + bh ? bh : 2 * (bw + bh) - d;
      const on = (i + phase) % 2 === 0;
      glow(c, bx - 22 + x, by - 22 + y, on ? 30 : 10, on ? NEON.pink : NEON.yellow, on ? 0.95 : 0.4);
    }
    const m = ledMask('満員御礼', fonts.ja, rows);
    const a = 0.84 + 0.16 * pulse(t);
    led(c, m, bx, by, pitch, NEON.yellow, { cols, off: 0.07, scroll: lerp(-26, m.w - cols + 12, f.k), a });
    const flash = hit(t, tMan, 6);
    if (flash > 0.02) {
      c.fillStyle = rgba(NEON.yellow, 0.4 * flash);
      c.fillRect(bx, by, cols * pitch, rows * pitch);
    }
    glow(c, W / 2, by + (rows * pitch) / 2, 760, NEON.yellow, 0.14 * a, 340);
    c.restore();
    confetti(c, t, 110, 49, PARTY, 260);
  };

  // ── 50. Woah 痛みまで おシェアで — 객석 파도타기 ────────
  const handWave: SceneFn = (c, f) => {
    const { t } = f;
    const tShare = ct(50, 2);
    fillBg(c);
    const link = easeOutCubic(span01(t, tShare, tShare + 0.16));
    const camX = f.age * 80;
    const n = 34;
    const crest = ((f.age * 6.5) % (n * 0.5 + 8)) - 4;
    glow(c, 640, 660, 900, NEON.violet, 0.24, 160);
    // 뒤의 세로 네온 — 물마루가 지나가는 자리가 켜진다
    for (let i = 0; i < 16; i++) {
      const x = ((i * 96 - camX * 0.3) % 1536 + 1536) % 1536 - 120;
      const near = Math.exp(-Math.pow((x - ((crest * 96 - camX) - 120)) / 260, 2));
      neon(c, i % 2 ? NEON.cyan : NEON.violet, 5, () => {
        c.beginPath();
        c.moveTo(x, 40);
        c.lineTo(x, 300);
      }, Math.max(0.1 + 0.75 * near, link * (0.6 + 0.4 * pulse(t))));
    }
    const row = (y: number, h: number, sp: number, a: number, lag: number, par: number) => {
      const hands: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const x = i * sp - camX * par - 120;
        if (x < -140 || x > W + 140) continue;
        const d = i - (crest - lag);
        const up = Math.max(Math.pow(Math.max(0, Math.cos(clamp(d / 3.2, -1, 1) * Math.PI * 0.5)), 2), link);
        const col = i % 2 ? NEON.cyan : NEON.violet;
        const pose = mixPose(POSE.stand, link > 0.5 ? POSE.linked : POSE.armsUp, up);
        figure(c, x, y - up * 14 * (1 - link) - link * pulse(t, 5) * 16, h, { ...pose, air: 0 }, { color: rgba(col, a) });
        hands.push([x, y - h * (0.72 + 0.16 * up)]);
        if (up > 0.5 && !link) glow(c, x, y - h, h * 0.5, col, 0.35 * up * a);
      }
      return hands;
    };
    row(580, 250, 76, 0.4, 2.5, 0.6);
    const hands = row(668, 340, 96, 1, 0, 1);
    neon(c, NEON.white, 3, () => {
      c.beginPath();
      c.moveTo(-40, 670);
      c.lineTo(W + 40, 670);
    }, 0.7);
    // 「おシェアで」 — 맞잡은 손을 따라 빛이 이어진다
    if (link > 0) {
      neon(c, NEON.cyan, 5, () => {
        c.beginPath();
        hands.forEach(([x, y], i) => {
          const yy = y - 8 * Math.sin(t * 8 + i * 0.6) - pulse(t, 5) * 14;
          if (i === 0) c.moveTo(x - 48, yy);
          else c.lineTo(x - 48, yy);
        });
      }, link);
      glow(c, 640, 420, 900, NEON.cyan, 0.3 * hit(t, tShare, 4), 200);
    }
  };

  // ── 51. 今宵も暗転パーティーだ — 간판 뒤에서 ────────────
  const signBack: SceneFn = (c, f) => {
    const { t } = f;
    fillBg(c);
    const bp = pos(t);
    zoomAt(c, 1 + f.k * 0.1, 640, 420, () => {
      // 골목 바닥의 빛 웅덩이와 춤추는 사람들
      glow(c, 400, 640, 380, NEON.pink, 0.4 + 0.2 * pulse(t), 90);
      glow(c, 880, 640, 380, NEON.cyan, 0.4 + 0.2 * pulse(t), 90);
      for (let i = 0; i < 7; i++) {
        const x = 250 + i * 130;
        const pose = danceAt(DANCE2, bp - (i % 3), 0.2);
        if (i === 3) figure(c, x, 660, 190, danceAt(DANCE, bp, 0.18), { skin: 'aya', color: NEON.white, lit: AYA_LIT, rim: NEON.pink, rimBlur: 14, swing: Math.sin(bp * Math.PI) });
        else figure(c, x, 650 - (i % 2) * 20, 150, pose, { color: PARTY[i % 4], flip: i > 3 });
      }
      // 뒤집혀 보이는 간판과 그 뼈대
      c.save();
      c.translate(640, 240);
      c.scale(-0.86, 0.86);
      c.translate(-640, -330);
      c.strokeStyle = 'rgba(30,26,44,0.95)';
      c.lineWidth = 14;
      c.beginPath();
      for (const x of [400, 640, 880]) {
        c.moveTo(x, -200);
        c.lineTo(x, 560);
      }
      c.moveTo(300, 200);
      c.lineTo(980, 200);
      c.moveTo(300, 440);
      c.lineTo(980, 440);
      c.stroke();
      drawSign(c, fonts.display, flicker(t, 1, 0.04), flicker(t, 2, 0.04), 5, t);
      c.restore();
    });
  };

  // ── 52. Woah — 커튼콜 ──────────────────────────────────
  const curtainCall: SceneFn = (c, f) => {
    const { t } = f;
    const up = smooth(span01(f.k, 0, 0.36));
    const bow = smooth(span01(f.k, 0.46, 0.72)) + 0.12 * span01(f.k, 0.72, 1);
    fillBg(c);
    zoomAt(c, 1.06 - 0.06 * f.k, 640, 420, () => {
      glow(c, 640, 600, 900, NEON.yellow, 0.16, 130);
      for (let i = 0; i < 5; i++) {
        const x = 180 + i * 230;
        cone(c, x, -30, 640 + (x - 640) * 0.7, 610, 170, i % 2 ? NEON.yellow : NEON.white, 0.34 + 0.1 * pulse(t), 10);
      }
      neon(c, NEON.white, 3, () => {
        c.beginPath();
        c.moveTo(-60, 600);
        c.lineTo(W + 60, 600);
      }, 0.8);
      const hands: [number, number][] = [];
      for (let i = 0; i < 7; i++) {
        const x = 640 + (i - 3) * 150;
        const pose = mixPose(mixPose(POSE.stand, POSE.linked, up), POSE.bow, clamp(bow));
        const h = i === 3 ? 360 : 270;
        if (i === 3) figure(c, x, 600, h, pose, { skin: 'aya', color: NEON.white, lit: AYA_LIT, rim: NEON.yellow, rimBlur: 18 });
        else figure(c, x, 600, h, pose, { color: PARTY[(i + (i > 3 ? 3 : 0)) % 4] });
        hands.push([x, 600 - h * lerp(0.6, 0.98, up) * (1 - 0.4 * clamp(bow))]);
      }
      void hands;
      // 발치의 조명
      for (let i = 0; i < 15; i++) glow(c, 80 + i * 80, 648, 34, NEON.yellow, 0.6 + 0.3 * Math.sin(t * 6 + i));
      // 양옆의 막
      for (const side of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const x = side < 0 ? -40 + k * 62 : W + 40 - (k + 1) * 62;
          const g = c.createLinearGradient(x, 0, x + 62, 0);
          g.addColorStop(0, '#0b0718');
          g.addColorStop(0.5, '#2a1b4e');
          g.addColorStop(1, '#0b0718');
          c.fillStyle = g;
          c.fillRect(x + Math.sin(t * 1.3 + k) * 3, -40, 64, H + 80);
        }
      }
      confetti(c, t, 50, 52, PARTY, 120, 0.8);
      // 막이 내려오기 시작한다
      const drop = 190 * easeInCubic(span01(f.k, 0.55, 1));
      c.fillStyle = '#120b22';
      c.fillRect(-60, -60, W + 120, 60 + drop);
      neon(c, NEON.yellow, 3, () => {
        c.beginPath();
        c.moveTo(-60, drop);
        c.lineTo(W + 60, drop);
      }, 0.6);
    });
  };

  // ── 53. またのお越しを きっと — 출구 ───────────────────
  const exitBoard: SceneFn = (c, f) => {
    const { t } = f;
    const tKitto = ct(52, 2);
    fillBg(c);
    zoomAt(c, 1 + f.k * 0.1, 640, 400, () => {
      // 문밖의 빛
      glow(c, 640, 430, 420, '#fff3d6', 0.5, 520);
      c.fillStyle = '#fff6e2';
      c.fillRect(540, 250, 200, 350);
      c.save();
      c.globalCompositeOperation = 'lighter';
      const g = c.createLinearGradient(0, 600, 0, H + 60);
      g.addColorStop(0, 'rgba(255,243,214,0.35)');
      g.addColorStop(1, 'rgba(255,243,214,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(540, 600);
      c.lineTo(740, 600);
      c.lineTo(1040, H + 60);
      c.lineTo(240, H + 60);
      c.closePath();
      c.fill();
      c.restore();
      neon(c, NEON.white, 3, () => {
        c.beginPath();
        c.rect(540, 250, 200, 350);
      }, 0.7);
      // 문 위 전광판
      const m = ledMask('またのお越しを　', fonts.ja, 14);
      c.fillStyle = '#0a0c0b';
      c.beginPath();
      rr(c, 400, 100, 480, 124, 12);
      c.fill();
      led(c, m, 416, 112, 7, NEON.green, { cols: 64, off: 0.08, scroll: ((f.age * 38) % m.w) - 20, a: 0.85 + 0.15 * pulse(t) });
      if ((f.age * 38) % m.w > m.w - 44) led(c, m, 416, 112, 7, NEON.green, { cols: 64, scroll: ((f.age * 38) % m.w) - 20 - m.w, a: 0.9 });
      exitSign(c, 990, 162, 0.9, t, flicker(t, 4, 0.04));
      // 빛 속으로 나가는 사람들
      for (let i = 0; i < 9; i++) {
        const u = ((f.age * 0.16 + i / 9) % 1);
        const x = lerp(140 + ((i * 131) % 1000), 640, Math.pow(u, 0.8));
        const y = lerp(760, 600, u);
        const h = lerp(330, 130, u);
        const bob = Math.abs(Math.sin(t * 5 + i * 1.7)) * 0.012;
        const sw = Math.sin(t * 5 + i * 1.7) * 0.25;
        figure(c, x, y, h, { ...POSE.stand, air: bob, la: [-0.18 + sw, -0.1 + sw], ra: [0.18 + sw, 0.1 + sw] }, { color: '#07060b', alpha: 1 - u * u, rim: rgba('#fff3d6', 0.35 * u), rimBlur: 10 });
      }
      // 뒤돌아 손을 흔드는 한 사람
      const turn = easeOutCubic(span01(t, tKitto - 0.1, tKitto + 0.2));
      const pose = mixPose(POSE.stand, byePose(t, 10), turn);
      figure(c, 930, 668, 300, pose, { color: NEON.violet, rim: NEON.violet, rimBlur: 16, flip: true });
      glow(c, 930, 520, 240, NEON.violet, 0.25 * turn);
    });
  };

  // ── 54. Woah 次回までお元気で — 도장 ───────────────────
  const stamp: SceneFn = (c, f) => {
    const { t } = f;
    const tJikai = ct(53, 1);
    const tGenki = ct(53, 2);
    const charge = span01(t, f.span.start, tJikai - 0.1);
    const down = t < tJikai - 0.09 ? 0 : easeInCubic(span01(t, tJikai - 0.09, tJikai));
    const away = easeInCubic(span01(t, tJikai + 0.2, tJikai + 0.7));
    const hgt = (0.35 + 0.65 * charge) * (1 - down);
    const bleed = span01(t, tGenki, f.span.end);
    fillBg(c, '#07060b');
    c.save();
    shake(c, 18 * hit(t, tJikai, 9), t);
    zoomAt(c, 1.02 + f.k * 0.16, 700, 380, () => {
      glow(c, 640, 360, 760, NEON.white, 0.22, 460);
      c.save();
      c.translate(640, 360);
      c.rotate(-0.09);
      // 티켓 반쪽
      c.fillStyle = '#efe6d2';
      c.beginPath();
      c.moveTo(-330, -160);
      c.lineTo(300, -160);
      for (let i = 0; i < 16; i++) c.lineTo(300 + (i % 2 ? 0 : 22), -160 + (i + 1) * 20);
      c.lineTo(-330, 160);
      c.closePath();
      c.fill();
      c.fillStyle = '#17131f';
      setFont(c, 200, fonts.display, 400);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('踊', -210, 6);
      c.textAlign = 'left';
      setFont(c, 30, fonts.display, 400);
      c.fillText('ADMIT ONE', -80, -110);
      setFont(c, 34, fonts.ja, 900);
      c.fillText('暗転パーティー', -80, -62);
      setFont(c, 20, fonts.ko, 700);
      c.fillText(kit.dateLabel ? `Ado · AyaUke cover · ${kit.dateLabel}` : 'Ado · AyaUke cover', -80, 124);
      c.strokeStyle = 'rgba(23,19,31,0.5)';
      c.lineWidth = 2;
      c.setLineDash([8, 8]);
      c.beginPath();
      c.moveTo(-96, -150);
      c.lineTo(-96, 150);
      c.stroke();
      c.setLineDash([]);
      // 「次回」 도장 자국
      if (t >= tJikai) {
        c.save();
        c.translate(120, 36);
        c.rotate(0.14);
        c.globalAlpha = 0.92;
        c.strokeStyle = NEON.pink;
        c.fillStyle = NEON.pink;
        c.lineWidth = 9;
        c.beginPath();
        rr(c, -150, -74, 300, 148, 20);
        c.stroke();
        c.lineWidth = 3;
        c.beginPath();
        rr(c, -136, -60, 272, 120, 12);
        c.stroke();
        setFont(c, 104, fonts.display, 400);
        c.textAlign = 'center';
        c.fillText('次回', 0, 6);
        for (let i = 0; i < 14; i++) {
          c.beginPath();
          c.arc((hash(i * 7) - 0.5) * 420, (hash(i * 13) - 0.5) * 240, 2 + hash(i) * 5, 0, TAU);
          c.fill();
        }
        c.restore();
        glow(c, 120, 36, 240 + 700 * bleed, NEON.pink, 0.35 * hit(t, tJikai, 3) + 0.5 * bleed);
      }
      // 도장(위에서 본 손잡이)과 그 그림자
      if (away < 1) {
        const sx = 120 + away * 900;
        const sy = 36 - away * 700;
        c.fillStyle = `rgba(0,0,0,${0.4 * (1 - hgt * 0.5)})`;
        c.beginPath();
        c.ellipse(sx + hgt * 70, sy + hgt * 90, 120 + hgt * 50, 62 + hgt * 26, 0, 0, TAU);
        c.fill();
        const s = 1 + hgt * 0.55 + away * 0.8;
        c.save();
        c.translate(sx - hgt * 30 + Math.sin(t * 3) * 6 * hgt, sy - hgt * 60);
        c.scale(s, s);
        c.fillStyle = '#231a16';
        c.beginPath();
        rr(c, -150, -74, 300, 148, 22);
        c.fill();
        c.fillStyle = '#3b2b22';
        c.beginPath();
        c.arc(0, 0, 60, 0, TAU);
        c.fill();
        c.fillStyle = '#5a4334';
        c.beginPath();
        c.arc(-12, -14, 30, 0, TAU);
        c.fill();
        c.restore();
      }
      c.restore();
    });
    c.restore();
    if (bleed > 0) {
      c.fillStyle = rgba(NEON.pink, 0.35 * bleed * bleed);
      c.fillRect(0, 0, W, H);
    }
  };

  // ── 55. ここらでバイバイ Let go — 조명이 꺼진다 ─────────
  const lightsOut: SceneFn = (c, f) => {
    const { t } = f;
    const tLet = ct(54, 2);
    const lit = 6 * (1 - span01(t, f.span.start + 0.25, f.span.end - 0.35));
    fillBg(c);
    zoomAt(c, 1.14 - 0.08 * f.k, 640, 330, () => {
      rig(c, t, lit);
      const a = clamp(lit / 6);
      glow(c, 640, 320, 300, NEON.violet, 0.3 * a);
      figure(c, 640, 420, 250, byePose(t, 10), { skin: 'aya', color: '#060509', rim: NEON.violet, rimBlur: 8 + 16 * a, swing: Math.sin(t * 3) * 0.3 });
      crowdRows(c, (i, x, y, s) => {
        const raise = t < tLet ? 0.9 : lerp(0.9, 0.1, span01(t, tLet + hash(i) * 0.4, tLet + 0.9 + hash(i) * 0.4));
        fan(c, x, y, s, { color: '#06050a', rim: rgba(NEON.violet, 0.1 + 0.3 * a), raise, sway: Math.sin(t * 9 + i * 0.7), light: raise > 0.5 ? PARTY[i % 4] : null });
      });
    });
  };

  // ── 56. 종연 — 비상구 표지만 남는다 ────────────────────
  const exitScene: SceneFn = (c, f) => {
    const { t } = f;
    const C = kit.cues();
    fillBg(c, '#000000');
    const k = clamp(f.age / 5.2);
    cam(c, 1.2 + k * 0.16, lerp(760, 820, k), lerp(318, 300, k), () => {
      seats(c, t, NEON.violet, 0.22);
      exitSign(c, 1090, 150, 1, t, flicker(t, 5, 0.07));
      glow(c, 1090, 150, 420, NEON.green, 0.12);
    });
    // 「終演」과 엔딩 타이틀
    const a = clamp((t - C.endTitle) / 1.0);
    if (a > 0) {
      neonText(c, '踊', 400, 300, 200, fonts.display, NEON.white, a * flicker(t, 8, 0.03), { fill: 0, tube: 0.026 });
      neon(c, NEON.white, 2.5, () => {
        c.beginPath();
        c.moveTo(250, 432);
        c.lineTo(550, 432);
      }, a * 0.8);
      neonText(c, '終演', 400, 478, 34, fonts.ja, NEON.green, a * 0.9, { weight: 900 });
      c.save();
      c.globalAlpha = a * 0.8;
      c.fillStyle = NEON.white;
      c.textAlign = 'center';
      setFont(c, 20, fonts.ko, 600);
      c.fillText(kit.dateLabel ? `Ado · AyaUke cover · ${kit.dateLabel}` : 'Ado · AyaUke cover', 400, 536);
      c.restore();
    }
  };

  void dead;
  void BG;
  return {
    oneLight, starfield, beam, reveal, everyone, ledFull, handWave, signBack, curtainCall, exitBoard, stamp, lightsOut, exitSign: exitScene,
  };
}
