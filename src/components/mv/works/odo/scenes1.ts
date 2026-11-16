// 踊 장면 0~20 — 훅 1(개연 준비, 흰빛만) · 절 1(혼자, 보라) · 프리(늘어남, +시안·노랑) · 훅 2(암전 직전까지).
// 번호·내용은 PLAN.md 표와 같다. 컷은 가사 덩어리 시각, 박 연출은 kit.beat().
import { TAU, clamp, easeInCubic, easeOutBack, easeOutCubic, hash, lerp, setFont } from '../../engine';
import { rgba } from '../../paint';
import {
  BG, type Ctx, H, type Kit, NEON, type SceneFn, W, cam, chunkT, cone, dead, fillBg, fit, flicker, glow, hit, led, ledMask,
  neon, neonText, noFootage, ring, rr, shake, span01, zoomAt,
} from './kit';
import { DANCE, POSE, type Pose, danceAt, figure, mixPose, runPose } from './pose';

/** 꺾은선의 앞 k만큼만(그려지는 선) */
function partial(c: Ctx, pts: [number, number][], k: number) {
  const n = (pts.length - 1) * clamp(k);
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= Math.floor(n); i++) c.lineTo(pts[i][0], pts[i][1]);
  const i = Math.floor(n);
  if (i < pts.length - 1) {
    const f = n - i;
    c.lineTo(lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f));
  }
}

/** 객석(무대에서 바라본 정면) — 0번 줄이 맨 앞. sit가 있으면 그 줄 뒤에 사람을 그린다. 56번 장면도 쓴다 */
export const seats = (c: Ctx, t: number, color: string, a: number, person?: (row: number, x: number, y: number, s: number) => void) => {
  for (let i = 5; i >= 0; i--) {
    const d = i / 5;
    const s = lerp(1.05, 0.42, Math.pow(d, 0.85));
    const y = lerp(650, 292, Math.pow(d, 0.8));
    const n = 7 + i * 2;
    if (person) person(i, W / 2, y, s);
    c.fillStyle = '#07060c';
    const path = () => {
      c.beginPath();
      for (let k = 0; k < n; k++) {
        const x = W / 2 + (k - (n - 1) / 2) * 176 * s;
        rr(c, x - 70 * s, y - 118 * s, 140 * s, 132 * s, 26 * s);
      }
    };
    path();
    c.fill();
    neon(c, color, 2.2 * Math.max(0.6, s), path, a * lerp(0.75, 0.22, d));
  }
};

/** 비상구 표지 — 초록 틀 안의 달리는 사람 */
export const exitSign = (c: Ctx, x: number, y: number, s: number, t: number, a: number, runner = true) => {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = rgba(NEON.green, 0.1 * a);
  c.beginPath();
  rr(c, -80, -44, 160, 88, 10);
  c.fill();
  neon(c, NEON.green, 4, () => {
    c.beginPath();
    rr(c, -80, -44, 160, 88, 10);
  }, a);
  neon(c, NEON.green, 3, () => {
    c.beginPath();
    c.rect(-64, -32, 40, 64);
  }, a * 0.9);
  neon(c, NEON.green, 3, () => {
    c.beginPath();
    c.moveTo(34, 0);
    c.lineTo(64, 0);
    c.moveTo(52, -12);
    c.lineTo(64, 0);
    c.lineTo(52, 12);
  }, a * 0.9);
  if (runner) {
    c.globalAlpha *= a;
    figure(c, 6, 32, 62, runPose(1.1), { color: NEON.green });
  }
  c.restore();
  glow(c, x, y, 190 * s, NEON.green, 0.22 * a);
  void t;
};

export function scenes1(kit: Kit): Record<string, SceneFn> {
  const { fonts } = kit;
  const ct = (line: number, chunk = 0) => chunkT(kit.lines(), line, chunk);
  const pulse = (t: number, d = 6) => kit.beat().pulse(t, d);
  const pos = (t: number) => kit.beat().pos(t);
  const per = () => kit.beat().period;

  // ── 0. 네온 제목 ─────────────────────────────────────
  const neonTitle: SceneFn = (c, f) => {
    const { t } = f;
    fillBg(c);
    const on = t > 0.8 ? 1 : (hash(Math.floor(t * 32)) > 0.5 ? 1 : 0.12) * clamp(t / 0.15);
    zoomAt(c, 1 + t * 0.07, W / 2, 330, () => {
      glow(c, W / 2, 330, 420, NEON.white, 0.1 * on);
      neonText(c, '踊', W / 2, 322, 250, fonts.display, NEON.white, on, { fill: 0, tube: 0.026 });
      neon(c, NEON.white, 2.5, () => {
        c.beginPath();
        c.moveTo(470, 492);
        c.lineTo(810, 492);
      }, on * 0.8);
      c.save();
      c.globalAlpha = 0.75 * on;
      c.fillStyle = NEON.white;
      c.textAlign = 'center';
      setFont(c, 20, fonts.ko, 600);
      c.fillText('Ado · AyaUke cover', W / 2, 530);
      c.restore();
    });
  };

  // ── 1. 半端なら K.O. / ふわふわしたいならどうぞ ────────
  const halfKO: SceneFn = (c, f) => {
    const { t } = f;
    const tH = f.span.start;
    const tKO = ct(1, 1);
    const tFu = ct(2, 0);
    const tDo = ct(2, 1);
    fillBg(c);
    c.save();
    shake(c, 16 * hit(t, tKO, 9) + 7 * hit(t, tKO + 0.55, 10), t);
    zoomAt(c, 1 + f.age * 0.012, W / 2, H / 2, () => {
      // 「半端」 — 위 반쪽만 보인다. K.O.가 떨어지면 납작하게 눌려 사라진다
      const crush = span01(t, tKO - 0.02, tKO + 0.09);
      if (crush < 1) {
        const rise = 1 - easeOutCubic(span01(t, tH, tH + 0.22));
        c.save();
        c.beginPath();
        c.rect(0, 0, W, 372);
        c.clip();
        c.translate(W / 2, 372);
        c.scale(1, 1 - crush);
        neonText(c, '半端', 0, rise * 150 - 8, 500, fonts.display, NEON.white, 1 - crush * 0.5, { baseline: 'middle' });
        c.restore();
        neon(c, NEON.white, 3, () => {
          c.beginPath();
          c.moveTo(120, 374);
          c.lineTo(W - 120, 374);
        }, 0.9 - crush * 0.9);
      }
      // 「K.O.」 — 위에서 내리꽂히고, 한 박 뒤 글자가 차례로 뒤로 넘어진다
      if (t > tKO - 0.13 && t < tFu + 0.35) {
        const size = 330;
        setFont(c, size, fonts.display, 400);
        const glyphs = ['K', '.', 'O', '.'];
        const widths = glyphs.map((g) => c.measureText(g).width);
        const total = widths.reduce((a, b) => a + b, 0);
        let x = W / 2 - total / 2;
        const floor = 545;
        const drop = 1 - easeInCubic(span01(t, tKO - 0.13, tKO));
        const out = span01(t, tFu - 0.1, tFu + 0.3);
        glyphs.forEach((g, i) => {
          const fall = easeInCubic(span01(t, tKO + 0.5 + i * 0.09, tKO + 0.78 + i * 0.09));
          const bounce = Math.sin(span01(t, tKO + 0.78 + i * 0.09, tKO + 1.1 + i * 0.09) * Math.PI) * 0.05;
          c.save();
          c.translate(x + widths[i] / 2, floor - drop * 760 + out * 260);
          c.transform(1, 0, -0.5 * fall, 1 - 0.9 * fall + bounce, 0, 0);
          neonText(c, g, 0, 0, size, fonts.display, NEON.white, (1 - fall * 0.55) * (1 - out), { baseline: 'alphabetic' });
          c.restore();
          x += widths[i];
        });
        // 떨어진 자리의 먼지
        const dust = hit(t, tKO, 3.2);
        if (dust > 0.02) {
          for (let i = 0; i < 14; i++) {
            const a = t - tKO;
            const dx = (hash(i * 7) - 0.5) * 2;
            glow(c, W / 2 + dx * (260 + a * 420), floor + 6 - a * 60 * hash(i * 3), 46 + a * 90, NEON.white, 0.16 * dust);
          }
        }
        neon(c, NEON.white, 3, () => {
          c.beginPath();
          c.moveTo(60, floor + 8);
          c.lineTo(W - 60, floor + 8);
        }, 0.7 * (1 - out));
      }
      // 「ふわふわ」 풍선 → 「どうぞ」에 차례로 터진다
      if (t > tFu - 0.05) {
        const letters = ['ふ', 'わ', 'ふ', 'わ'];
        letters.forEach((g, i) => {
          const born = tFu + i * 0.2;
          const popAt = tDo + i * 0.085;
          const up = easeOutCubic(span01(t, born, born + 1.1));
          const bx = 250 + i * 262 + Math.sin(t * 1.7 + i * 1.9) * 16;
          const by = lerp(H + 130, 300 + (i % 2) * 54, up) + Math.sin(t * 2.3 + i) * 12;
          if (t < born) return;
          if (t < popAt) {
            const r = 84 + Math.sin(t * 3 + i) * 3;
            neon(c, NEON.white, 3.5, () => ring(c, bx, by, r, r * 1.08));
            neon(c, NEON.white, 1.6, () => {
              c.beginPath();
              c.moveTo(bx, by + r * 1.08);
              c.bezierCurveTo(bx - 18, by + r + 60, bx + 18, by + r + 110, bx - 4, by + r + 170);
            }, 0.6);
            neonText(c, g, bx, by + 2, 96, fonts.ja, NEON.white, 1, { weight: 900 });
          } else {
            const a = t - popAt;
            const p = Math.exp(-a * 5);
            neon(c, NEON.white, 3, () => ring(c, bx, by, 84 + a * 420), p);
            for (let k = 0; k < 9; k++) {
              const ang = (k / 9) * TAU + i;
              const d0 = 70 + a * 520;
              neon(c, NEON.white, 3, () => {
                c.beginPath();
                c.moveTo(bx + Math.cos(ang) * d0, by + Math.sin(ang) * d0);
                c.lineTo(bx + Math.cos(ang) * (d0 + 34), by + Math.sin(ang) * (d0 + 34) + a * a * 300);
              }, p);
            }
          }
        });
        if (t >= tDo + 0.1) {
          const k = easeOutBack(span01(t, tDo + 0.1, tDo + 0.32));
          c.save();
          c.translate(W / 2, 372);
          c.scale(0.6 + 0.4 * k + (t - tDo) * 0.06, 0.6 + 0.4 * k + (t - tDo) * 0.06);
          neonText(c, 'どうぞ', 0, 0, 250, fonts.display, NEON.white, clamp(k) * (0.82 + 0.18 * pulse(t)));
          c.restore();
          // 「어서」 — 오른쪽으로 달리는 화살표
          for (let i = 0; i < 9; i++) {
            const x = (((t - tDo) * 520 + i * 170) % 1530) - 120;
            neon(c, NEON.white, 5, () => {
              c.beginPath();
              c.moveTo(x - 22, 560);
              c.lineTo(x + 6, 590);
              c.lineTo(x - 22, 620);
            }, clamp(k) * (0.35 + 0.65 * pulse(t - i * 0.03)));
          }
        }
      }
    });
    c.restore();
  };

  // ── 2. 開演準備しちゃおうか — 스위치와 스포트라이트 ─────
  const switches: SceneFn = (c, f) => {
    const { t } = f;
    const t0 = f.span.start;
    fillBg(c);
    const spots: [number, number, number][] = [[520, 250, 118], [900, 220, 104], [690, 480, 128], [1060, 470, 110]];
    zoomAt(c, 1 + f.k * 0.12, 700, 360, () => {
      // 무대 바닥: 마룻널과 테이프 표시
      c.strokeStyle = 'rgba(246,244,255,0.07)';
      c.lineWidth = 1.5;
      c.beginPath();
      for (let y = -40; y < H + 60; y += 46) {
        c.moveTo(280, y);
        c.lineTo(W + 80, y);
      }
      c.stroke();
      dead(c, 3, () => {
        c.beginPath();
        c.rect(330, 60, 880, 600);
      }, 0.22);
      c.strokeStyle = 'rgba(246,244,255,0.5)';
      c.lineWidth = 5;
      c.beginPath();
      for (const [x, y] of [[640, 360], [790, 360], [940, 360]] as const) {
        c.moveTo(x - 14, y);
        c.lineTo(x + 14, y);
        c.moveTo(x, y - 14);
        c.lineTo(x, y + 14);
      }
      c.stroke();
      spots.forEach(([x, y, r], i) => {
        const at = t0 + i * per();
        if (t < at) {
          dead(c, 2, () => ring(c, x, y, r), 0.12);
          return;
        }
        const k = easeOutCubic(span01(t, at, at + 0.14));
        const a = (0.75 + 0.25 * pulse(t)) * k;
        glow(c, x, y, r * 2.1 * (0.6 + 0.4 * k), NEON.white, 0.5 * a + 0.5 * hit(t, at, 8));
        c.fillStyle = rgba(NEON.white, 0.13 * a);
        c.beginPath();
        c.arc(x, y, r * k, 0, TAU);
        c.fill();
        neon(c, NEON.white, 2.5, () => ring(c, x, y, r * k), a);
      });
      // 분전반
      c.fillStyle = '#0d0b14';
      c.beginPath();
      rr(c, 70, 110, 190, 500, 16);
      c.fill();
      dead(c, 3, () => {
        c.beginPath();
        rr(c, 70, 110, 190, 500, 16);
      }, 0.5);
      for (let i = 0; i < 4; i++) {
        const at = t0 + i * per();
        const k = t < at ? 0 : easeOutBack(span01(t, at, at + 0.13));
        const y = 180 + i * 112;
        const draw = () => {
          c.beginPath();
          rr(c, 122, y - 34, 86, 68, 12);
        };
        if (k > 0) neon(c, NEON.white, 3, draw, 0.9);
        else dead(c, 3, draw, 0.3);
        // 손잡이: 내려가 있다가(꺼짐) 위로 올라간다(켜짐)
        c.save();
        c.translate(165, y);
        c.rotate(lerp(Math.PI * 0.82, Math.PI * 0.18, k) - Math.PI / 2);
        c.translate(-165, -y);
        if (k > 0) {
          neon(c, NEON.white, 7, () => {
            c.beginPath();
            c.moveTo(165, y);
            c.lineTo(205, y);
          });
        } else {
          dead(c, 7, () => {
            c.beginPath();
            c.moveTo(165, y);
            c.lineTo(205, y);
          }, 0.4);
        }
        c.restore();
        glow(c, 165, y, 80, NEON.white, 0.5 * hit(t, at, 7));
      }
    }, 0.02 - f.k * 0.05);
  };

  // ── 3. 泣いても笑っても愛してね — 두 얼굴 간판 ──────────
  const faces: SceneFn = (c, f) => {
    const { t } = f;
    const tLaugh = ct(4, 1);
    const tLove = ct(4, 2);
    fillBg(c);
    const face = (cx: number, cy: number, laugh: boolean, a: number) => {
      const parts: (() => void)[] = [
        () => ring(c, cx, cy, 168),
        // 눈
        () => {
          c.beginPath();
          for (const s of [-1, 1]) {
            if (laugh) {
              c.moveTo(cx + s * 66 - 30, cy - 22);
              c.lineTo(cx + s * 66, cy - 58);
              c.lineTo(cx + s * 66 + 30, cy - 22);
            } else {
              c.moveTo(cx + s * 66 - 30, cy - 52);
              c.quadraticCurveTo(cx + s * 66, cy - 22, cx + s * 66 + 30, cy - 52);
            }
          }
        },
        // 입
        () => {
          c.beginPath();
          if (laugh) {
            c.moveTo(cx - 78, cy + 28);
            c.lineTo(cx + 78, cy + 28);
            c.quadraticCurveTo(cx, cy + 150, cx - 78, cy + 28);
          } else {
            c.moveTo(cx - 62, cy + 92);
            c.quadraticCurveTo(cx, cy + 36, cx + 62, cy + 92);
          }
        },
      ];
      for (const p of parts) {
        dead(c, 7, p, 0.2);
        neon(c, NEON.white, 7, p, a);
      }
      if (!laugh && a > 0.3) {
        // 눈물이 떨어진다
        for (const s of [-1, 1]) {
          const d = ((t * 1.3 + (s > 0 ? 0.45 : 0)) % 1) * 96;
          neon(c, NEON.white, 5, () => {
            c.beginPath();
            c.moveTo(cx + s * 66, cy - 18 + d);
            c.lineTo(cx + s * 66, cy + 4 + d);
          }, a * (1 - d / 96));
        }
      }
      glow(c, cx, cy, 330, NEON.white, 0.16 * a);
    };
    const beatA = 0.72 + 0.28 * pulse(t);
    const both = t >= tLove;
    const cryOn = both ? 1 : t < tLaugh ? 1 : 0.06;
    const laughOn = both ? 1 : t >= tLaugh ? 1 : 0.06;
    c.save();
    // 비스듬히 올려다본다
    c.translate(W / 2, H / 2);
    c.transform(1, -0.085, 0.05, 1, 0, 0);
    c.scale(1.02 + f.k * 0.1, 1.02 + f.k * 0.1);
    c.translate(-W / 2 - 30 + f.k * 60, -H / 2 + 14 - f.k * 26);
    // 간판을 매단 줄
    c.strokeStyle = 'rgba(246,244,255,0.18)';
    c.lineWidth = 3;
    c.beginPath();
    for (const x of [300, 480, 800, 980]) {
      c.moveTo(x, -300);
      c.lineTo(x, 190);
    }
    c.stroke();
    face(390, 345, false, cryOn * beatA * flicker(t, 3, both ? 0.02 : 0.06));
    face(890, 345, true, laughOn * beatA * flicker(t, 11, both ? 0.02 : 0.06));
    // 「愛してね」 — 가운데 하트
    const heart = () => {
      c.beginPath();
      c.moveTo(640, 392);
      c.bezierCurveTo(566, 338, 596, 270, 640, 312);
      c.bezierCurveTo(684, 270, 714, 338, 640, 392);
    };
    dead(c, 6, heart, 0.18);
    if (both) {
      const k = easeOutBack(span01(t, tLove, tLove + 0.2));
      c.save();
      c.translate(640, 340);
      c.scale(0.7 + 0.3 * k + 0.1 * pulse(t), 0.7 + 0.3 * k + 0.1 * pulse(t));
      c.translate(-640, -340);
      neon(c, NEON.white, 6, heart, clamp(k));
      c.restore();
      glow(c, 640, 340, 190, NEON.white, 0.3 * hit(t, tLove, 4));
    }
    c.restore();
  };

  // ── 4. ほら Say NO ───────────────────────────────────
  const sayNo: SceneFn = (c, f) => {
    const { t } = f;
    const tNo = ct(5, 1);
    fillBg(c);
    const on = t < tNo ? 0 : (t - tNo < 0.16 ? (hash(Math.floor(t * 40)) > 0.4 ? 1 : 0.2) : 1) * (0.8 + 0.2 * pulse(t));
    c.save();
    c.translate(W / 2, 300);
    c.scale(1 + f.k * 0.08, 1.3 + f.k * 0.1);
    const size = 400;
    if (on > 0) {
      glow(c, 0, 0, 620, NEON.white, 0.2 * on + 0.3 * hit(t, tNo, 5), 330);
      neonText(c, 'NO', 0, 0, size, fonts.display, NEON.white, on, { fill: 0, tube: 0.03 });
    } else {
      c.save();
      setFont(c, size, fonts.display, 400);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.strokeStyle = 'rgba(143,138,168,0.22)';
      c.lineWidth = 10;
      c.lineJoin = 'round';
      c.strokeText('NO', 0, 0);
      c.restore();
    }
    c.restore();
    // 아래에서 올라오는 손들(아직 듬성듬성)
    const xs = [150, 395, 610, 870, 1105];
    xs.forEach((x, i) => {
      const up = easeOutCubic(span01(t, f.span.start + i * 0.05, f.span.start + 0.4 + i * 0.05));
      const top = lerp(H + 120, 470 + (i % 2) * 54 + hash(i) * 30, up) - pulse(t, 5) * (on > 0 ? 44 : 14);
      const sway = Math.sin(t * 2 + i) * 10;
      // 팔과 편 손 — 밝은 색으로 한 번, 조금 가늘게 검정으로 한 번(윤곽만 빛난다)
      const hand = (grow: number, color: string) => {
        c.strokeStyle = color;
        c.fillStyle = color;
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.lineWidth = 50 + grow;
        c.beginPath();
        c.moveTo(x - sway * 2, H + 60);
        c.lineTo(x + sway, top + 70);
        c.stroke();
        c.beginPath();
        c.ellipse(x + sway, top + 34, 40 + grow / 2, 46 + grow / 2, 0, 0, TAU);
        c.fill();
        c.lineWidth = 17 + grow;
        c.beginPath();
        for (let k = 0; k < 4; k++) {
          const fx = x + sway + (k - 1.5) * 21;
          c.moveTo(fx, top + 20);
          c.lineTo(fx + (k - 1.5) * 5, top - 44 - (k === 1 || k === 2 ? 14 : 0));
        }
        c.moveTo(x + sway - 38, top + 44);
        c.lineTo(x + sway - 66, top + 10);
        c.stroke();
      };
      hand(10, rgba(NEON.white, 0.12 + 0.45 * on));
      hand(0, '#07060b');
    });
  };

  // ── 5. 低音響かせろ — 우퍼 ────────────────────────────
  const woofer: SceneFn = (c, f) => {
    const { t } = f;
    const tHibi = ct(6, 1);
    const tBreak = kit.bar(10) + per();
    const live = t < tBreak ? 1 : 0;
    const p = pulse(t, 7) * live;
    const loud = t >= tHibi ? 1 : 0.55;
    fillBg(c);
    c.save();
    shake(c, 9 * p * (t >= tHibi ? 1 : 0.3), t);
    zoomAt(c, 1 + f.k * 0.24, 640, 350, () => {
      const cx = 640;
      const cy = 350;
      const dim = t < tBreak ? 1 : 1 - 0.7 * span01(t, tBreak, tBreak + 1.6);
      dead(c, 4, () => {
        c.beginPath();
        rr(c, cx - 320, cy - 320, 640, 640, 30);
      }, 0.3);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        dead(c, 3, () => ring(c, cx + sx * 285, cy + sy * 285, 10), 0.4);
      }
      neon(c, NEON.white, 5, () => ring(c, cx, cy, 268), 0.9 * dim);
      const s = 1 + 0.11 * p * loud;
      neon(c, NEON.white, 3, () => ring(c, cx, cy, 214 * s), 0.6 * dim);
      neon(c, NEON.white, 3, () => ring(c, cx, cy, 158 * s * s), 0.7 * dim);
      c.fillStyle = '#0b0912';
      c.beginPath();
      c.arc(cx, cy, 78 * s * s * s, 0, TAU);
      c.fill();
      neon(c, NEON.white, 5, () => ring(c, cx, cy, 78 * s * s * s), dim);
      glow(c, cx, cy, 300 + 160 * p, NEON.white, (0.1 + 0.22 * p * loud) * dim);
      // 박마다 퍼지는 고리 — 브레이크 뒤에도 마지막 고리는 어둠 속으로 계속 퍼진다
      const b = kit.beat();
      const first = Math.ceil(b.pos(f.span.start - 0.05));
      const last = Math.min(Math.floor(b.pos(t)), Math.floor(b.pos(tBreak - 0.05)));
      for (let i = Math.max(first, last - 7); i <= last; i++) {
        const age = t - b.timeOf(i);
        if (age < 0) continue;
        const strong = b.timeOf(i) >= tHibi - 0.1;
        neon(c, NEON.white, strong ? 4 : 2.5, () => ring(c, cx, cy, 270 + age * (strong ? 560 : 380)), Math.exp(-age * 1.5) * (strong ? 1 : 0.6));
      }
    });
    c.restore();
  };

  // ── 6. 빈 객석의 한 사람 ──────────────────────────────
  const emptySeats: SceneFn = (c, f) => {
    const { t } = f;
    fillBg(c);
    cam(c, 1 + f.k * 0.2, lerp(640, 760, f.k), lerp(372, 318, f.k), () => {
      glow(c, 640, 60, 560, NEON.violet, 0.14, 260);
      // 뒷벽과 통로 불빛
      c.fillStyle = rgba(NEON.violet, 0.5);
      for (let i = 0; i < 9; i++) {
        c.globalAlpha = 0.25 + 0.2 * Math.sin(t * 2 + i);
        c.fillRect(120 + i * 130, 236, 14, 4);
      }
      c.globalAlpha = 1;
      exitSign(c, 1090, 150, 1, t, flicker(t, 5, 0.05));
      seats(c, t, NEON.violet, 0.8 + 0.2 * pulse(t, 4), (row, cx, y, s) => {
        if (row !== 2) return;
        // 턱을 괴고 앉은 한 사람 — 박에 맞춰 고개만 까딱
        const nod = pulse(t, 5) * 0.07;
        const pose: Pose = { ...POSE.stand, ra: [0.55, 2.62], la: [-0.25, 0.5], head: 0.24 + nod, lean: 0.06 };
        figure(c, cx + 176 * s, y + 96 * s, 360 * s, pose, { color: NEON.violet, rim: NEON.violet, rimBlur: 14 });
      });
      // 한숨
      const sigh = (t * 0.55) % 1;
      c.fillStyle = rgba(NEON.violet, 0.7 * (1 - sigh));
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.arc(800 + i * 20 + sigh * 30, 300 - sigh * 46 - i * 6, 4.5, 0, TAU);
        c.fill();
      }
    });
  };

  // ── 7. ロンリー論理のノート ───────────────────────────
  const notebook: SceneFn = (c, f) => {
    const { t, k } = f;
    fillBg(c, '#0a0812');
    cam(c, 1.12 + k * 0.2, 660 + k * 40, 360, () => {
      // 모눈
      c.strokeStyle = rgba(NEON.violet, 0.16);
      c.lineWidth = 1.2;
      c.beginPath();
      for (let x = -200; x < W + 240; x += 40) {
        c.moveTo(x, -200);
        c.lineTo(x, H + 200);
      }
      for (let y = -200; y < H + 240; y += 40) {
        c.moveTo(-200, y);
        c.lineTo(W + 240, y);
      }
      c.stroke();
      // 스프링
      for (let y = -160; y < H + 200; y += 56) dead(c, 5, () => ring(c, 150, y, 15, 9), 0.5);
      // 혼자 빙빙 도는 화살표
      const loop: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const a = -Math.PI / 2 + (i / 60) * TAU * 1.9;
        const r = 96 - i * 0.7;
        loop.push([470 + Math.cos(a) * r, 330 + Math.sin(a) * r * 0.86]);
      }
      const k1 = span01(k, 0, 0.5);
      neon(c, NEON.violet, 4, () => partial(c, loop, k1));
      const tip = loop[Math.min(60, Math.floor(k1 * 60))];
      if (k1 < 1) glow(c, tip[0], tip[1], 40, NEON.white, 0.9);
      else {
        neon(c, NEON.violet, 4, () => {
          c.beginPath();
          c.moveTo(tip[0] - 16, tip[1] - 14);
          c.lineTo(tip[0], tip[1]);
          c.lineTo(tip[0] + 18, tip[1] - 12);
        });
      }
      // 혼자 = 혼자
      const k2 = span01(k, 0.28, 0.6);
      if (k2 > 0) neonText(c, 'A = A', 820, 250, 70, fonts.ja, NEON.violet, 1, { weight: 900, fill: 0, tube: 0.05 });
      if (k2 > 0 && k2 < 1) {
        c.fillStyle = '#0a0812';
        c.fillRect(700 + k2 * 250, 200, 260, 100);
      }
      // 지운 줄
      const zig: [number, number][] = [];
      for (let i = 0; i <= 26; i++) zig.push([700 + i * 11, 420 + (i % 2 ? 26 : -26) + hash(i) * 8]);
      const k3 = span01(k, 0.5, 0.95);
      neonText(c, 'ほんとは', 845, 420, 54, fonts.ja, NEON.violet, 0.4 * clamp(k * 3), { weight: 900 });
      neon(c, NEON.violet, 5, () => partial(c, zig, k3), k3 > 0 ? 1 : 0);
      if (k3 > 0 && k3 < 1) {
        const p = zig[Math.floor(k3 * 26)];
        glow(c, p[0], p[1], 40, NEON.white, 0.9);
      }
      // 구석의 작은 사람
      figure(c, 1000, 600, 110, POSE.down, { color: rgba(NEON.violet, 0.55) });
      void t;
    }, -0.07 + k * 0.09);
  };

  // ── 8. ハンディー本気脱走 — 표지에서 뛰쳐나옴 ──────────
  const escape: SceneFn = (c, f) => {
    const { t } = f;
    fillBg(c);
    const run = f.age * 620;
    glow(c, 640, 360, 620, NEON.violet, 0.1);
    // 뒤로 흘러가는 객석 그림자와 속도선
    for (let i = 0; i < 10; i++) {
      const x = ((i * 190 - run * 0.5) % 1900 + 1900) % 1900 - 300;
      c.fillStyle = rgba(NEON.violet, 0.1);
      c.beginPath();
      rr(c, x, 420, 120, 150, 26);
      c.fill();
    }
    for (let i = 0; i < 26; i++) {
      const y = 90 + hash(i * 7) * 500;
      const x = ((hash(i * 13) * 1700 - run * (1.2 + hash(i) * 1.4)) % 1700 + 1700) % 1700 - 200;
      neon(c, i % 5 ? NEON.violet : NEON.green, 2, () => {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + 90 + hash(i * 3) * 120, y);
      }, 0.35);
    }
    // 바닥
    neon(c, NEON.violet, 3, () => {
      c.beginPath();
      c.moveTo(-20, 600);
      c.lineTo(W + 20, 600);
    }, 0.7);
    c.strokeStyle = rgba(NEON.violet, 0.4);
    c.lineWidth = 3;
    c.setLineDash([46, 60]);
    c.lineDashOffset = run;
    c.beginPath();
    c.moveTo(-20, 628);
    c.lineTo(W + 20, 628);
    c.stroke();
    c.setLineDash([]);
    // 깨진 표지(왼쪽으로 멀어진다)
    const sx = 290 - run * 0.78;
    if (sx > -400) {
      exitSign(c, sx, 330, 2.4, t, 0.9, false);
      for (let i = 0; i < 9; i++) {
        const a = f.age;
        const px = sx + 190 + a * (240 + hash(i) * 520);
        const py = 250 + hash(i * 5) * 170 + a * a * 500 * hash(i * 9);
        neon(c, NEON.green, 4, () => {
          c.beginPath();
          c.moveTo(px, py);
          c.lineTo(px + 24 * Math.cos(i + a * 9), py + 24 * Math.sin(i + a * 9));
        }, Math.exp(-a * 1.6));
      }
    }
    // 달리는 사람 — 한 박에 두 걸음, 잔상
    const phase = pos(t) * TAU;
    const x = 500 + 200 * f.k;
    for (let g = 3; g >= 1; g--) {
      figure(c, x - g * 52, 600, 330, runPose(phase - g * 0.55), { color: rgba(NEON.green, 0.16 - g * 0.035) });
    }
    figure(c, x, 600, 330, runPose(phase), { color: NEON.green, rim: NEON.green, rimBlur: 22 });
  };

  // ── 9. やんなっちゃって泥に / Bad ご法度だろうが ─────────
  const mud: SceneFn = (c, f) => {
    const { t } = f;
    const t0 = f.span.start;
    const tMud = ct(11, 1);
    const tBad = ct(12, 0);
    const tGo = ct(12, 1);
    fillBg(c);
    c.save();
    shake(c, 12 * hit(t, tBad, 8) + 12 * hit(t, tGo, 8), t);
    // 걸음이 점점 느려진다
    const T1 = tMud + 0.8;
    const w = TAU / per();
    const u = Math.min(t, T1) - t0;
    const phase = w * (u - (0.85 * u * u) / (2 * (T1 - t0))) + (t > T1 ? 0.15 * w * (t - T1) : 0);
    const sinkY = 170 * span01(t, tMud - 0.5, tBad + 1.4);
    const surface = 548 - 30 * span01(t, tMud, tBad + 1.2);
    zoomAt(c, 1.04 + f.k * 0.16, 620, 560, () => {
      glow(c, 640, 620, 700, NEON.violet, 0.16, 300);
      figure(c, 620, 600 + sinkY, 560, runPose(phase), { color: NEON.violet, rim: NEON.violet, rimBlur: 24 });
      // 검은 액체 — 사람 다리를 덮는다
      const edge = (x: number) => surface + Math.sin(x * 0.012 + t * 2.4) * 7 + Math.sin(x * 0.031 - t * 3.1) * 4;
      c.fillStyle = '#030206';
      c.beginPath();
      c.moveTo(-100, H + 200);
      for (let x = -100; x <= W + 100; x += 20) c.lineTo(x, edge(x));
      c.lineTo(W + 100, H + 200);
      c.closePath();
      c.fill();
      neon(c, NEON.violet, 3.5, () => {
        c.beginPath();
        c.moveTo(-100, edge(-100));
        for (let x = -80; x <= W + 100; x += 20) c.lineTo(x, edge(x));
      }, 0.85);
      // 발 디딜 때마다 퍼지는 물결
      for (let i = 0; i < 4; i++) {
        const a = ((phase / Math.PI + i * 0.5) % 2) / 2;
        neon(c, NEON.violet, 2.5, () => ring(c, 620 + (i % 2 ? 70 : -60), surface + 10, 40 + a * 260, 8 + a * 40), (1 - a) * 0.8);
      }
    }, 0.03);
    // 경고 테이프
    const tape = (ang: number, at: number, text: string, dirn: number) => {
      if (t < at) return;
      const slide = 1 - easeOutCubic(span01(t, at, at + 0.13));
      const snap = easeInCubic(span01(t, f.span.end - 0.28, f.span.end));
      c.save();
      c.translate(W / 2, H / 2 - 20);
      c.rotate(ang);
      for (const half of [-1, 1]) {
        c.save();
        c.translate(dirn * slide * 1500 + half * snap * 1100, 0);
        c.beginPath();
        c.rect(half < 0 ? -1100 : 0, -50, 1100, 100);
        c.clip();
        c.fillStyle = NEON.yellow;
        c.fillRect(-1100, -46, 2200, 92);
        c.fillStyle = '#0a0908';
        for (let x = -1140; x < 1140; x += 56) {
          for (const y of [-46, 30]) {
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x + 28, y);
            c.lineTo(x + 16, y + 16);
            c.lineTo(x - 12, y + 16);
            c.closePath();
            c.fill();
          }
        }
        setFont(c, 50, fonts.display, 400);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const off = ((t * 120 * dirn) % 330 + 330) % 330;
        for (let x = -1320 + off; x < 1200; x += 330) c.fillText(text, x, 2);
        c.restore();
      }
      c.restore();
    };
    tape(0.42, tBad, 'BAD', 1);
    tape(-0.42, tGo, 'ご法度', -1);
    glow(c, W / 2, H / 2, 700, NEON.yellow, 0.25 * (hit(t, tBad, 7) + hit(t, tGo, 7)));
    c.restore();
  };

  // ── 10. 溺れて堕ちて / そろそろいっか ───────────────────
  const sink: SceneFn = (c, f) => {
    const { t } = f;
    const tOchi = ct(13, 1);
    const tSoro = ct(14, 0);
    const tKick = tSoro + 0.5;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#190f33');
    g.addColorStop(1, BG);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // 내려간 깊이(화면이 따라 내려가므로 물속 것들은 위로 흐른다)
    const fallen = (t - f.span.start) * 260 + Math.max(0, t - tOchi) * 420 - Math.max(0, t - tSoro) * 500 * clamp((t - tSoro) / 0.4);
    const depth = Math.max(0, fallen);
    // 위에서 드는 빛줄기 — 깊어질수록 흐려진다
    for (let i = 0; i < 4; i++) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = rgba(NEON.violet, 0.07 * (1 - 0.8 * f.k));
      c.beginPath();
      const x = 200 + i * 290 + Math.sin(t * 0.6 + i) * 40;
      c.moveTo(x, -20);
      c.lineTo(x + 90, -20);
      c.lineTo(x - 120, H);
      c.lineTo(x - 300, H);
      c.closePath();
      c.fill();
      c.restore();
    }
    // 깊이 눈금
    c.strokeStyle = rgba(NEON.violet, 0.4);
    c.fillStyle = rgba(NEON.violet, 0.55);
    c.lineWidth = 2;
    setFont(c, 16, fonts.ko, 600);
    for (let i = 0; i < 12; i++) {
      const y = ((i * 90 - depth) % 1080 + 1080) % 1080 - 180;
      c.beginPath();
      c.moveTo(40, y);
      c.lineTo(i % 2 ? 62 : 84, y);
      c.stroke();
    }
    // 기포
    for (let i = 0; i < 46; i++) {
      const sp = 0.6 + hash(i * 3) * 1.2;
      const y = ((hash(i * 7) * 900 - depth * sp - t * 60) % 900 + 900) % 900 - 90;
      const x = hash(i * 11) * W + Math.sin(t * 2 + i) * 14;
      neon(c, NEON.violet, 1.6, () => ring(c, x, y, 3 + hash(i) * 9), 0.5);
    }
    // 바닥
    const floorUp = easeOutCubic(span01(t, tSoro - 0.15, tSoro + 0.3));
    const floorY = lerp(H + 160, 610, floorUp) + (t > tKick ? (t - tKick) * (t - tKick) * 5200 : 0);
    if (floorUp > 0) {
      c.fillStyle = '#020104';
      c.fillRect(-50, floorY, W + 100, 400);
      neon(c, NEON.violet, 3, () => {
        c.beginPath();
        c.moveTo(-50, floorY);
        c.lineTo(W + 50, floorY);
      }, 0.8);
    }
    // 가라앉는 사람 → 바닥을 딛고 → 박차 오른다
    const land = span01(t, tSoro, tSoro + 0.28);
    const kick = span01(t, tKick, tKick + 0.14);
    let pose = mixPose(POSE.sink, { ...POSE.sink, la: [-2.0, -2.5], ra: [2.5, 3.0], ll: [-0.5, -0.2], rl: [0.1, 0.5] }, 0.5 + 0.5 * Math.sin(t * 2.6));
    pose = mixPose(pose, POSE.crouch, easeOutCubic(land));
    pose = mixPose(pose, POSE.jump, easeOutCubic(kick));
    const tilt = Math.sin(t * 1.2) * 0.25 + 0.5 * span01(t, tOchi, tOchi + 0.5);
    const fy = floorUp > 0 ? Math.min(lerp(430, floorY, land), floorY) : 430 + Math.sin(t * 1.8) * 14;
    c.save();
    c.translate(640, fy - (kick > 0 ? 0 : 0));
    c.rotate(tilt * (1 - land));
    figure(c, 0, 0, 300, pose, { color: NEON.violet, rim: NEON.violet, rimBlur: 20 });
    c.restore();
    if (kick > 0) {
      for (let i = 0; i < 14; i++) {
        const a = t - tKick;
        neon(c, NEON.violet, 2, () => ring(c, 640 + (hash(i) - 0.5) * 300 * (1 + a * 2), fy + 10 + a * 900 * (0.4 + hash(i * 5)), 4 + hash(i * 3) * 10), 0.7);
      }
    }
  };

  // ── 11. もっと頑張って — 이퀄라이저 계단 ────────────────
  const eqStairs: SceneFn = (c, f) => {
    const { t } = f;
    fillBg(c);
    const barX = (i: number) => i * 92;
    const top = (i: number) => -i * 46 - 40 * kit.env('rms', t - i * 0.03) - 14 * Math.sin(t * 6 + i);
    const hop = (t - f.span.start) / (per() / 2);
    const i0 = Math.floor(hop);
    const fr = hop - i0;
    const fx = lerp(barX(i0), barX(i0 + 1), fr) + 38;
    const fy = lerp(top(i0), top(i0 + 1), fr) - Math.sin(fr * Math.PI) * 74;
    c.save();
    c.translate(520 - (barX(hop) + 38), 430 + hop * 46);
    glow(c, fx, fy - 60, 380, NEON.violet, 0.16);
    for (let i = i0 - 7; i < i0 + 12; i++) {
      const x = barX(i);
      const y = top(i);
      const passed = i <= i0;
      c.fillStyle = rgba(NEON.violet, passed ? 0.5 : 0.2);
      c.beginPath();
      for (let yy = y; yy < y + 900; yy += 18) c.rect(x, yy, 76, 13);
      c.fill();
      neon(c, NEON.violet, 4, () => {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + 76, y);
      }, passed ? 1 : 0.45);
      if (i === i0) glow(c, x + 38, y, 110, NEON.white, 0.6 * (1 - fr));
    }
    figure(c, fx, fy, 150, mixPose(POSE.low, POSE.jump, Math.sin(fr * Math.PI)), { color: NEON.white, rim: NEON.violet, rimBlur: 16 });
    c.restore();
  };

  // ── 12. もっと頑張って繋がろう — 잭을 꽂는다 ────────────
  const plug: SceneFn = (c, f) => {
    const { t } = f;
    const tPlug = ct(16, 2);
    const lit = span01(t, tPlug, tPlug + 0.55);
    fillBg(c);
    c.save();
    shake(c, 10 * hit(t, tPlug, 9), t);
    c.translate(-300 * easeInCubic(lit) - f.k * 40, 0);
    const sx = 760;
    const sy = 360;
    // 벽 패널
    c.fillStyle = '#0c0a14';
    c.beginPath();
    rr(c, sx - 70, 150, 360, 420, 22);
    c.fill();
    dead(c, 3, () => {
      c.beginPath();
      rr(c, sx - 70, 150, 360, 420, 22);
    }, 0.45);
    for (const [x, y] of [[sx - 44, 176], [sx + 264, 176], [sx - 44, 544], [sx + 264, 544]] as const) dead(c, 2, () => ring(c, x, y, 7), 0.5);
    const on = t >= tPlug ? 1 : 0;
    neon(c, on ? NEON.cyan : NEON.violet, 4, () => ring(c, sx, sy, 34), on ? 1 : 0.5);
    c.fillStyle = '#020104';
    c.beginPath();
    c.arc(sx, sy, 20, 0, TAU);
    c.fill();
    // 표시등
    glow(c, sx + 200, 220, 40, NEON.cyan, on * (0.6 + 0.4 * pulse(t)));
    dead(c, 3, () => ring(c, sx + 200, 220, 9), 0.5);
    // 잭 — 박마다 조금씩 다가가다 「繋がろう」에 꽂힌다
    const step = Math.min(3, Math.floor((t - f.span.start) / per()));
    const approach = t < tPlug ? clamp(step * 0.16 + 0.1 * easeOutCubic(span01(t, f.span.start + step * per(), f.span.start + step * per() + 0.15)) + 0.4 * easeInCubic(span01(t, tPlug - 0.22, tPlug))) : 1;
    const tipX = lerp(330, sx + 6, approach);
    const violetA = 1 - on;
    const cable = () => {
      c.beginPath();
      c.moveTo(-400, sy + 150);
      c.bezierCurveTo(tipX - 520, sy + 150, tipX - 420, sy, tipX - 250, sy);
    };
    neon(c, NEON.violet, 12, cable, 0.5 * violetA + 0.001);
    neon(c, NEON.cyan, 12, cable, 0.9 * on);
    const col = on ? NEON.cyan : NEON.violet;
    neon(c, col, 4, () => {
      c.beginPath();
      rr(c, tipX - 250, sy - 30, 150, 60, 14);
    });
    neon(c, col, 4, () => {
      c.beginPath();
      c.rect(tipX - 100, sy - 9, 92, 18);
      c.moveTo(tipX - 60, sy - 9);
      c.lineTo(tipX - 60, sy + 9);
      c.moveTo(tipX - 34, sy - 9);
      c.lineTo(tipX - 34, sy + 9);
    });
    glow(c, sx, sy, 260, NEON.cyan, hit(t, tPlug, 5));
    // 불이 선을 따라 달려 나간다
    const path: [number, number][] = [[sx + 34, sy], [sx + 150, sy], [sx + 150, 470], [sx + 420, 470], [sx + 420, 250], [sx + 700, 250], [sx + 700, 380], [sx + 1200, 380]];
    dead(c, 5, () => partial(c, path, 1), 0.3);
    if (on) {
      neon(c, NEON.cyan, 5, () => partial(c, path, lit));
      const n = (path.length - 1) * lit;
      const i = Math.min(path.length - 2, Math.floor(n));
      const hx = lerp(path[i][0], path[i + 1][0], n - i);
      const hy = lerp(path[i][1], path[i + 1][1], n - i);
      glow(c, hx, hy, 90, NEON.white, 0.95);
      path.slice(1, -1).forEach((p, k) => {
        if (lit * (path.length - 1) > k + 1) glow(c, p[0], p[1], 50, NEON.cyan, 0.8);
      });
    }
    c.restore();
  };

  // ── 13. ひとりよりふたり 増えたら安心 — 칸이 늘어난다 ────
  const multiply: SceneFn = (c, f) => {
    const { t } = f;
    const stages = [f.span.start, ct(17, 1), ct(18, 0), ct(18, 1)];
    let st = 0;
    for (let i = 0; i < 4; i++) if (t >= stages[i]) st = i;
    const cols = [1, 2, 2, 4][st];
    const rows = [1, 1, 2, 2][st];
    const pop = easeOutBack(span01(t, stages[st], stages[st] + 0.2));
    const merge = easeInCubic(span01(t, f.span.end - 0.45, f.span.end));
    fillBg(c);
    const mx = 44;
    const my = 36;
    const gap = 16 * (1 - merge);
    const cw = (W - mx * 2 - gap * (cols - 1)) / cols;
    const chh = (H - my * 2 - 110 - gap * (rows - 1)) / rows;
    const p = pos(t);
    for (let r = 0; r < rows; r++) {
      for (let q = 0; q < cols; q++) {
        const i = r * cols + q;
        const col = (q + r) % 2 ? NEON.cyan : NEON.violet;
        const x = mx + q * (cw + gap);
        const y = my + r * (chh + gap);
        c.save();
        c.translate(x + cw / 2, y + chh / 2);
        c.scale(0.9 + 0.1 * pop, 0.9 + 0.1 * pop);
        c.translate(-cw / 2, -chh / 2);
        c.fillStyle = rgba(col, 0.07 + 0.08 * pulse(t));
        c.beginPath();
        rr(c, 0, 0, cw, chh, 18);
        c.fill();
        glow(c, cw / 2, chh * 0.62, Math.min(cw, chh) * 0.7, col, 0.22);
        neon(c, col, 4, () => {
          c.beginPath();
          rr(c, 0, 0, cw, chh, 18);
        }, (1 - merge) * (0.8 + 0.2 * pulse(t)) + hit(t, stages[st], 6) * 0.3);
        const seq = DANCE.slice(i % 8).concat(DANCE.slice(0, i % 8));
        figure(c, cw / 2, chh * 0.93, chh * 0.78, danceAt(seq, p), { color: col, flip: i % 2 === 1 });
        c.restore();
      }
    }
  };

  // ── 14. Alright 任せて / Don't mind 波あり難題 ──────────
  /** 파형 파도 — 15번도 쓴다. y(x)는 물마루 선 */
  const waveBars = (c: Ctx, t: number, y: (x: number) => number, a = 1) => {
    c.save();
    const grad = c.createLinearGradient(0, 200, 0, H);
    grad.addColorStop(0, rgba(NEON.cyan, 0.5 * a));
    grad.addColorStop(1, rgba(NEON.violet, 0.28 * a));
    c.fillStyle = grad;
    c.beginPath();
    for (let x = -10; x < W + 10; x += 12) {
      const top = y(x);
      c.rect(x, top, 8, H + 40 - top);
    }
    c.fill();
    c.restore();
    neon(c, NEON.cyan, 3.5, () => {
      c.beginPath();
      c.moveTo(-10, y(-10));
      for (let x = 2; x <= W + 10; x += 12) c.lineTo(x, y(x));
    }, a);
  };

  const wave: SceneFn = (c, f) => {
    const { t } = f;
    const tMa = ct(20, 1);
    const tDm = ct(21, 0);
    const tNami = ct(21, 1);
    fillBg(c);
    c.save();
    shake(c, 9 * (hit(t, f.span.start, 9) + hit(t, tDm, 9)), t);
    const crest = lerp(W + 420, 520, f.k);
    const surge = 1 + 0.25 * (hit(t, tMa, 4) + hit(t, tNami, 4));
    const y = (x: number) =>
      560 - 40 * kit.env('rms', t - (W - x) * 0.0011) * surge - 360 * surge * Math.exp(-Math.pow((x - crest) / 300, 2)) + Math.sin(x * 0.02 + t * 7) * 8;
    glow(c, crest, 300, 520, NEON.cyan, 0.16);
    waveBars(c, t, y);
    const stencil = (text: string, x: number, yy: number, size: number, at: number, rot: number, outAt: number) => {
      if (t < at) return;
      const k = easeOutCubic(span01(t, at, at + 0.12));
      const out = easeInCubic(span01(t, outAt, outAt + 0.12));
      c.save();
      c.translate(x - out * 1300, yy);
      c.rotate(rot);
      c.scale(1.7 - 0.7 * k, 1.7 - 0.7 * k);
      size = fit(c, text, fonts.display, size, 760);
      neonText(c, text, 0, 0, size, fonts.display, NEON.yellow, 1);
      // 스텐실 틈
      c.fillStyle = BG;
      for (const off of [-0.2, 0.16]) c.fillRect(-size * 4, size * off, size * 8, size * 0.035);
      c.restore();
    };
    stencil('ALRIGHT', 450, 190, 150, f.span.start, -0.05, tDm - 0.1);
    stencil("DON'T MIND", 700, 215, 140, tDm, 0.04, 999);
    c.restore();
  };

  // ── 15. みんなで乗っかっちゃえば — 파도타기 ─────────────
  const surf: SceneFn = (c, f) => {
    const { t } = f;
    const tAn = ct(23, 0);
    const tIc = ct(23, 1);
    fillBg(c);
    const speed = 420 + 380 * span01(t, tAn, tAn + 0.3);
    const scroll = f.age * 420 + Math.max(0, t - tAn) * 380;
    void speed;
    // 뒤로 흘러가는 불빛
    for (let i = 0; i < 40; i++) {
      const x = ((hash(i * 7) * 1600 - scroll * (0.3 + hash(i) * 0.9)) % 1600 + 1600) % 1600 - 160;
      const yy = 40 + hash(i * 11) * 360;
      glow(c, x, yy, 10 + hash(i * 3) * 16, [NEON.violet, NEON.cyan, NEON.yellow][i % 3], 0.5);
    }
    const lift = 420 * easeInCubic(span01(t, tIc - 0.1, f.span.end));
    const crestX = 430 + Math.sin(t * 0.9) * 30;
    const y = (x: number) =>
      520 - lift - (190 + lift * 0.4) * Math.exp(-Math.pow((x - crestX) / 340, 2)) + Math.sin(x * 0.013 + t * 6) * 16 - 26 * kit.env('rms', t - x * 0.0006);
    glow(c, crestX, 330 - lift, 460, NEON.cyan, 0.14);
    waveBars(c, t, y);
    // 물보라
    for (let i = 0; i < 26; i++) {
      const a = ((t * (0.8 + hash(i)) + hash(i * 5)) % 1);
      glow(c, crestX - 40 - a * 380 * hash(i * 3 + 1), y(crestX) - 20 - a * 150 * hash(i * 7) + a * a * 120, 9, NEON.white, 0.7 * (1 - a));
    }
    // 파도 앞면을 타는 무리
    for (let i = 0; i < 8; i++) {
      const x = 590 + i * 76 + Math.sin(t * 1.4 + i * 1.3) * 16;
      const slope = (y(x + 12) - y(x - 12)) / 24;
      const col = [NEON.violet, NEON.cyan, NEON.yellow][i % 3];
      c.save();
      c.translate(x, y(x) + 4);
      c.rotate(Math.atan(slope) * 0.8);
      // 보드
      neon(c, col, 5, () => {
        c.beginPath();
        c.moveTo(-44, 0);
        c.lineTo(46, 0);
      });
      const pose = mixPose(POSE.surf, { ...POSE.surf, la: [-1.9, -2.4], ra: [1.8, 1.5], lean: 0.05 }, 0.5 + 0.5 * Math.sin(t * 4 + i * 2));
      figure(c, 0, -3, 118 + (i % 3) * 8, pose, { color: col });
      c.restore();
    }
  };

  // ── 16. 전광판: 半端なら K.O. / ふわふわしたいならどうぞ ──
  const ledKO: SceneFn = (c, f) => {
    const { t } = f;
    const tH = f.span.start;
    const tKO = ct(24, 1);
    const tFu = ct(25, 0);
    const tDo = ct(25, 1);
    const cols = 92;
    const rows = 22;
    const pitch = 13;
    const bx = 42;
    const by = 196;
    fillBg(c);
    c.save();
    shake(c, 12 * hit(t, tKO, 9), t);
    c.translate(W / 2, H / 2);
    c.transform(1, -0.075, 0.02, 1, 0, 0);
    c.scale(1 + f.k * 0.07, 1 + f.k * 0.07);
    c.translate(-W / 2 + 14 - f.k * 30, -H / 2 + 10);
    // 판
    c.fillStyle = '#0b0a10';
    c.beginPath();
    rr(c, bx - 26, by - 26, cols * pitch + 52, rows * pitch + 52, 18);
    c.fill();
    dead(c, 3, () => {
      c.beginPath();
      rr(c, bx - 26, by - 26, cols * pitch + 52, rows * pitch + 52, 18);
    }, 0.6);
    const amber = NEON.yellow;
    const a = 0.82 + 0.18 * pulse(t);
    const blank = ledMask(' ', fonts.ja, rows);
    led(c, blank, bx, by, pitch, amber, { cols, off: 0.07, a: 0 });
    if (t < tKO) {
      const m = ledMask('半端なら', fonts.ja, rows);
      const target = (m.w - cols) / 2;
      led(c, m, bx, by, pitch, amber, { cols, scroll: lerp(-cols, target, easeOutCubic(span01(t, tH, tKO - 0.1))), a });
    } else if (t < tFu) {
      // 「K.O.」 — 한 박 버티다가 점이 와르르 쏟아진다
      const m = ledMask('K.O.', fonts.display, rows, 400);
      const ox = Math.floor((cols - m.w) / 2);
      const tFall = tKO + per();
      const floor = by + rows * pitch + 150;
      const on = new Path2D();
      const g = 2600;
      for (let r = 0; r < m.h; r++) {
        for (let q = 0; q < m.w; q++) {
          if (!m.bits[r * m.w + q]) continue;
          const x0 = bx + (ox + q) * pitch;
          const y0 = by + r * pitch;
          const tau = t - tFall - hash(q * 31 + r * 7) * 0.4 - (m.h - r) * 0.008;
          let x = x0;
          let y = y0;
          if (tau > 0) {
            const dist = floor - y0;
            const tf = Math.sqrt((2 * dist) / g);
            x += (hash(q * 13 + r) - 0.5) * 150 * Math.min(tau, tf + 0.5);
            if (tau < tf) y = y0 + 0.5 * g * tau * tau;
            else {
              const t2 = tau - tf;
              const v0 = g * tf * 0.32;
              y = floor - Math.max(0, v0 * t2 - 0.5 * g * t2 * t2);
            }
          }
          on.rect(x, y, pitch * 0.62, pitch * 0.62);
        }
      }
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = rgba(amber, 0.95);
      c.fill(on);
      c.restore();
      const flash = hit(t, tKO, 7);
      if (flash > 0.02) {
        c.fillStyle = rgba(amber, 0.5 * flash);
        c.fillRect(bx, by, cols * pitch, rows * pitch);
      }
    } else if (t < tDo) {
      const m = ledMask('ふわふわしたいなら', fonts.ja, rows);
      const scroll = lerp(-cols * 0.9, m.w - cols * 0.25, span01(t, tFu, tDo));
      led(c, m, bx, by, pitch, amber, { cols, scroll, a, wave: (q) => Math.sin(q * 0.22 + t * 6.5) * 2.4 });
    } else {
      const m = ledMask('どうぞ >>> どうぞ >>> どうぞ >>> どうぞ >>> ', fonts.ja, rows);
      const loop = m.w / 4;
      const scroll = loop * 2 - (((t - tDo) * 46) % loop);
      led(c, m, bx, by, pitch, amber, { cols, scroll, a });
    }
    glow(c, W / 2, by + (rows * pitch) / 2, 700, amber, 0.12 * a, 300);
    c.restore();
  };

  // ── 17. 開演準備しちゃおうか — 막 뒤 ───────────────────
  const curtain: SceneFn = (c, f) => {
    const { t } = f;
    const t0 = f.span.start;
    const tShi = ct(26, 1);
    const pull1 = easeOutCubic(span01(t, t0, t0 + 0.28));
    const pull2 = easeOutCubic(span01(t, tShi, tShi + 0.32));
    const gap = 8 + 34 * pull1 + 150 * pull2 + f.k * 40;
    const sx = 850 - f.k * 60;
    fillBg(c, '#060410');
    // 틈으로 쏟아지는 빛
    glow(c, sx, 360, 240 + gap * 2.2, NEON.white, 0.5, 620);
    c.fillStyle = '#ffffff';
    c.fillRect(sx - gap / 2, -20, gap, H + 40);
    c.save();
    c.globalCompositeOperation = 'lighter';
    const lg = c.createLinearGradient(sx, 0, sx - 700, 0);
    lg.addColorStop(0, rgba(NEON.white, 0.3));
    lg.addColorStop(1, rgba(NEON.violet, 0));
    c.fillStyle = lg;
    c.beginPath();
    c.moveTo(sx - gap / 2, 0);
    c.lineTo(sx - gap / 2, H);
    c.lineTo(sx - 520 - gap * 3, H);
    c.lineTo(sx - 60 - gap, 0);
    c.closePath();
    c.fill();
    c.restore();
    for (let i = 0; i < 30; i++) {
      const x = sx - 20 - hash(i * 7) * 420;
      const y = ((hash(i * 3) * H + t * (14 + hash(i) * 26)) % H);
      glow(c, x + Math.sin(t + i) * 12, y, 5, NEON.white, 0.5 * (1 - (sx - x) / 460));
    }
    // 막 주름(틈 양쪽으로 갈라진다)
    const folds = (from: number, to: number, shift: number) => {
      for (let x = from; x < to; x += 74) {
        const sway = Math.sin(t * 1.5 + x * 0.01) * 5;
        const g2 = c.createLinearGradient(x + shift, 0, x + shift + 74, 0);
        g2.addColorStop(0, '#0b0718');
        g2.addColorStop(0.5, '#2a1b4e');
        g2.addColorStop(1, '#0b0718');
        c.fillStyle = g2;
        c.fillRect(x + shift + sway, -20, 76, H + 40);
      }
    };
    folds(sx - gap / 2 - 74 * 14, sx - gap / 2, 0);
    folds(sx + gap / 2, sx + gap / 2 + 74 * 8, 0);
    neon(c, NEON.white, 2.5, () => {
      c.beginPath();
      c.moveTo(sx - gap / 2, -20);
      c.lineTo(sx - gap / 2, H + 20);
      c.moveTo(sx + gap / 2, -20);
      c.lineTo(sx + gap / 2, H + 20);
    }, 0.8);
    // 로프와 당기는 손
    const handY = 250 + 90 * pull1 + 120 * pull2 - 30 * Math.sin(span01(t, t0 + 0.3, tShi) * Math.PI);
    c.strokeStyle = '#c9b68a';
    c.lineWidth = 9;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(430, -20);
    c.lineTo(430, handY + 150);
    c.stroke();
    c.fillStyle = '#c9b68a';
    c.beginPath();
    c.moveTo(416, handY + 150);
    c.lineTo(444, handY + 150);
    c.lineTo(452, handY + 210);
    c.lineTo(408, handY + 210);
    c.closePath();
    c.fill();
    const arm = (w: number, color: string) => {
      c.strokeStyle = color;
      c.fillStyle = color;
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(210, H + 60);
      c.lineTo(330, handY + 190);
      c.lineTo(424, handY + 14);
      c.stroke();
      c.beginPath();
      c.arc(430, handY, w * 0.62, 0, TAU);
      c.fill();
    };
    arm(62, rgba(NEON.violet, 0.5));
    arm(52, '#05040a');
  };

  // ── 18. 泣いても笑っても愛してね — 분장실 거울 ──────────
  const mirror: SceneFn = (c, f) => {
    const { t } = f;
    const t0 = f.span.start;
    const tAi = ct(27, 2);
    fillBg(c, '#07050d');
    zoomAt(c, 1 + f.k * 0.12, 640, 300, () => {
      // 벽
      c.strokeStyle = 'rgba(180,107,255,0.07)';
      c.lineWidth = 2;
      c.beginPath();
      for (let x = 40; x < W; x += 70) {
        c.moveTo(x, 0);
        c.lineTo(x, 540);
      }
      c.stroke();
      const mx = 380;
      const my = 70;
      const mw = 520;
      const mh = 420;
      const love = t >= tAi ? 1 : 0;
      glow(c, 640, my + mh / 2, 620, NEON.yellow, 0.1 + 0.1 * span01(t, t0, tAi), 420);
      glow(c, 640, my + mh / 2, 560, NEON.pink, love * (0.14 + 0.1 * pulse(t)), 400);
      // 거울 속 — 원본 영상
      c.save();
      c.beginPath();
      rr(c, mx, my, mw, mh, 26);
      c.clip();
      if (!kit.footage(c, f.video, mx, my, mw, mh)) noFootage(c, mx, my, mw, mh, t);
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(255,255,255,0.07)';
      c.beginPath();
      c.moveTo(mx + 60, my);
      c.lineTo(mx + 190, my);
      c.lineTo(mx + 20, my + mh);
      c.lineTo(mx - 110, my + mh);
      c.closePath();
      c.fill();
      c.restore();
      neon(c, love ? NEON.pink : NEON.yellow, 4, () => {
        c.beginPath();
        rr(c, mx, my, mw, mh, 26);
      }, 0.9);
      // 전구 — 박을 따라 하나씩 켜진다
      const bulbs: [number, number][] = [];
      for (let i = 0; i < 7; i++) bulbs.push([mx - 34, my + mh - 20 - i * (mh - 40) / 6]);
      for (let i = 0; i < 9; i++) bulbs.push([mx - 10 + i * (mw + 20) / 8, my - 34]);
      for (let i = 0; i < 7; i++) bulbs.push([mx + mw + 34, my + 20 + i * (mh - 40) / 6]);
      const litN = bulbs.length * span01(t, t0, tAi - 0.05);
      bulbs.forEach(([x, y], i) => {
        const on = clamp(litN - i);
        dead(c, 3, () => ring(c, x, y, 15), 0.5);
        if (on > 0) {
          const a = on * (0.75 + 0.25 * pulse(t)) + love * 0.2;
          glow(c, x, y, 62, NEON.yellow, a);
          c.fillStyle = rgba('#fff7d6', Math.min(1, a));
          c.beginPath();
          c.arc(x, y, 13, 0, TAU);
          c.fill();
        }
      });
      // 화장대
      c.fillStyle = '#0d0a16';
      c.fillRect(-100, 540, W + 200, 300);
      neon(c, NEON.yellow, 2, () => {
        c.beginPath();
        c.moveTo(-100, 540);
        c.lineTo(W + 100, 540);
      }, 0.35);
      c.fillStyle = '#17122a';
      for (const [x, w2, h2] of [[250, 26, 70], [300, 40, 44], [960, 22, 90], [1010, 60, 30]] as const) {
        c.beginPath();
        rr(c, x, 540 - h2, w2, h2, 8);
        c.fill();
      }
      // 「愛してね」 하트
      if (love) {
        const k = easeOutBack(span01(t, tAi, tAi + 0.22));
        for (const [hx, hy, s] of [[310, 150, 1], [985, 210, 0.7], [240, 330, 0.55]] as const) {
          c.save();
          c.translate(hx, hy - (t - tAi) * 26);
          c.scale(s * k * (1 + 0.12 * pulse(t)), s * k * (1 + 0.12 * pulse(t)));
          neon(c, NEON.pink, 5, () => {
            c.beginPath();
            c.moveTo(0, 34);
            c.bezierCurveTo(-56, -6, -32, -56, 0, -24);
            c.bezierCurveTo(32, -56, 56, -6, 0, 34);
          });
          c.restore();
        }
      }
    });
    // 전구가 다 켜지며 하얗게
    const white = easeInCubic(span01(t, f.span.end - 0.3, f.span.end));
    if (white > 0) {
      c.fillStyle = `rgba(255,250,235,${0.8 * white})`;
      c.fillRect(0, 0, W, H);
    }
  };

  // ── 19. ほら Say NO — 객석 부감 ────────────────────────
  const crowdNo: SceneFn = (c, f) => {
    const { t } = f;
    const tNo = ct(28, 1);
    fillBg(c);
    const m = ledMask('N O', fonts.ja, 17);
    const cols = 46;
    const rows = 25;
    const sp = 27;
    const ox = Math.floor((cols - m.w) / 2);
    const oy = 4;
    cam(c, lerp(1.34, 1.06, f.k), W / 2, H / 2, () => {
      const heads = new Path2D();
      for (let r = 0; r < rows; r++) {
        for (let q = 0; q < cols; q++) {
          const x = 32 + q * sp + (hash(q * 7 + r * 131) - 0.5) * 8;
          const y = 36 + r * sp + (hash(q * 17 + r * 13) - 0.5) * 8;
          heads.moveTo(x + 8, y);
          heads.arc(x, y, 8, 0, TAU);
          const inMask = q >= ox && q < ox + m.w && r >= oy && r < oy + m.h && m.bits[(r - oy) * m.w + (q - ox)];
          if (inMask) {
            const on = t >= tNo + q * 0.006 ? 1 : hash(q * 3 + r * 5 + Math.floor(t * 7)) > 0.92 ? 0.7 : 0;
            if (on > 0) {
              const wob = 0.75 + 0.25 * Math.sin(t * 6 + q * 0.4 + r * 0.3);
              glow(c, x, y, 22 + 8 * pulse(t), NEON.cyan, on * wob);
              c.fillStyle = '#eaffff';
              c.fillRect(x - 2, y - 2, 4, 4);
            }
          } else if (t >= tNo && hash(q * 29 + r * 3) > 0.8) {
            glow(c, x, y, 13, NEON.violet, 0.5 + 0.3 * Math.sin(t * 5 + q + r));
          }
        }
      }
      c.fillStyle = 'rgba(246,244,255,0.085)';
      c.fill(heads);
      glow(c, W / 2, H / 2 - 20, 520, NEON.cyan, 0.2 * hit(t, tNo, 3) + (t >= tNo ? 0.06 : 0));
    }, lerp(-0.13, 0.03, f.k));
  };

  // ── 20. 低音響かせろ — 스피커 벽, 그리고 차단기 ─────────
  const speakerWall: SceneFn = (c, f) => {
    const { t } = f;
    const tHibi = ct(29, 1);
    const tBreak = kit.bar(36);
    fillBg(c);
    if (t < tBreak) {
      const p = pulse(t, 7);
      const loud = t >= tHibi ? 1 : 0.5;
      c.save();
      shake(c, 10 * p * loud, t);
      zoomAt(c, 1 + f.k * 0.22, 640, 520, () => {
        const b = kit.beat();
        const scales = [0.66, 0.84, 1.08];
        let y = 40;
        scales.forEach((s, r) => {
          const cw = 250 * s;
          const chh = 205 * s;
          const n = 7;
          for (let q = 0; q < n; q++) {
            const x = W / 2 + (q - (n - 1) / 2) * (cw + 10 * s) - cw / 2;
            const pump = 1 + 0.13 * loud * b.pulse(t - Math.abs(q - 3) * 0.03 - r * 0.02, 7);
            dead(c, 3 * s, () => {
              c.beginPath();
              rr(c, x, y, cw, chh, 12 * s);
            }, 0.34);
            const cx = x + cw / 2;
            const col = t >= tHibi ? ((q + r) % 2 ? NEON.violet : NEON.white) : NEON.white;
            neon(c, col, 3.2 * s, () => ring(c, cx - cw * 0.14, y + chh * 0.55, 62 * s * pump), 0.7 + 0.3 * p);
            neon(c, col, 2.4 * s, () => ring(c, cx - cw * 0.14, y + chh * 0.55, 26 * s * pump * pump), 0.8);
            neon(c, col, 2.4 * s, () => ring(c, cx + cw * 0.3, y + chh * 0.3, 24 * s * pump), 0.7);
          }
          y += chh + 10 * s;
        });
        glow(c, 640, 400, 760, NEON.violet, (0.08 + 0.18 * p) * loud, 420);
        if (t >= tHibi) {
          const first = Math.ceil(b.pos(tHibi - 0.05));
          const last = Math.floor(b.pos(t));
          for (let i = Math.max(first, last - 5); i <= last; i++) {
            const age = t - b.timeOf(i);
            neon(c, NEON.white, 3.5, () => ring(c, 640, 400, 80 + age * 760, (80 + age * 760) * 0.62), Math.exp(-age * 2));
          }
        }
      });
      c.restore();
      return;
    }
    // 차단기를 내린다 → 암전
    const a = t - tBreak;
    const k = easeInCubic(span01(a, 0, 0.11));
    const die = 1 - span01(a, 0.12, 0.75);
    c.save();
    shake(c, 14 * hit(t, tBreak + 0.11, 12), t);
    zoomAt(c, 1.1 + a * 0.08, 640, 360, () => {
      const box = () => {
        c.beginPath();
        rr(c, 470, 110, 340, 500, 24);
      };
      dead(c, 4, box, 0.3 * die + 0.05);
      neon(c, NEON.white, 4, box, 0.8 * die * flicker(t, 2, 0.3));
      neonText(c, 'ON', 640, 190, 46, fonts.display, NEON.white, (1 - k) * die, { fill: 0, tube: 0.05 });
      neonText(c, 'OFF', 640, 540, 46, fonts.display, NEON.white, 0.25 + 0.5 * k * die, { fill: 0, tube: 0.05 });
      const ang = lerp(-0.55, 0.55, k);
      const hx = 640 + Math.sin(ang) * 20;
      const hy = 365 - Math.cos(ang * 2.6) * 110 * (k < 0.5 ? 1 : -1) * 0 + lerp(-110, 110, k);
      neon(c, NEON.white, 16, () => {
        c.beginPath();
        c.moveTo(640, 365);
        c.lineTo(hx, hy);
      }, 0.3 + 0.7 * die);
      neon(c, NEON.white, 6, () => ring(c, hx, hy, 26), 0.3 + 0.7 * die);
      // 불꽃
      for (let i = 0; i < 16; i++) {
        const sa = a - 0.11;
        if (sa < 0) break;
        const ang2 = hash(i * 7) * TAU;
        const d = sa * (260 + hash(i) * 520);
        neon(c, NEON.yellow, 2.5, () => {
          c.beginPath();
          c.moveTo(640 + Math.cos(ang2) * d, 470 + Math.sin(ang2) * d + sa * sa * 700);
          c.lineTo(640 + Math.cos(ang2) * (d + 16), 470 + Math.sin(ang2) * (d + 16) + sa * sa * 760);
        }, Math.exp(-sa * 2.6));
      }
    });
    c.restore();
  };

  void cone;
  return {
    neonTitle, halfKO, switches, faces, sayNo, woofer, emptySeats, notebook, escape, mud, sink, eqStairs, plug, multiply,
    wave, surf, ledKO, curtain, mirror, crowdNo, speakerWall,
  };
}
