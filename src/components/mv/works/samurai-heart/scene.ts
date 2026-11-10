// 사무라이 하트 MV 렌더러.
// 콘셉트: 무채색 군중 속 홀로 붉은 "나" → 후렴마다 붉은 마음(사무라이 하트)이 번지고,
// 마지막엔 군중 전체가 붉게 물든다. 먹·붓 질감 + 주홍(RED) + 아야의 라벤더(LAV).
// 주의: 붉은 원 + 방사형 줄무늬 조합은 쓰지 않는다(욱일기 연상). 집중선은 흰색, 원은 붓 원상(圓相) 링으로만.
import type { MvLyricLine, MvRenderer } from '../../types';
import {
  TAU, beatGrid, blotPath, brushPath, chunksShown, clamp, decodeEnvelope, easeInCubic, easeOutBack,
  easeOutCubic, easeOutExpo, fitSize, hash, invLerp, keyframes, lerp, lineAt, noise1, rng, sectionAt,
  setFont, smooth, splatter,
} from '../../engine';
import { ENVELOPE } from './envelope';
import { BEAT_PERIOD, BEAT_PHASE, CHROMA_KEYS, LYRICS, RAPID_RANGE, RAPID_WORDS, SECTIONS, SLASHES } from './timeline';

type Ctx = CanvasRenderingContext2D;

export const W = 1280;
export const H = 720;

const INK = '#0c0a10';
const PAPER = '#f2ebe0';
const RED = '#e3383f';
const RED_DEEP = '#7a1420';
const LAV = '#b9a0ea';
const LAV_DEEP = '#2b1d42';

export interface SceneFonts {
  /** 굵은 일본어/영문 디스플레이 (Dela Gothic One) */
  display: string;
  /** 붓글씨 (Yuji Syuku) */
  brush: string;
  /** 한국어 번역 */
  ko: string;
}

interface Figure {
  x0: number;
  dir: number;
  speed: number;
  phase: number;
  hScale: number;
  seed: number;
}

interface Layer {
  ground: number;
  h: number;
  speed: number;
  color: string;
  figures: Figure[];
}

interface Shard {
  pts: [number, number][];
  cx: number;
  cy: number;
  vx: number;
  vy: number;
  vr: number;
}

const FLASHES = [40.3, 95.55, 150.65, 171.85];

/**
 * 구간 안 속도 배율 — 말이 빨라지면 군중도 빨리 감기(k>1), 「勘違い」에서 정지,
 * 立ち止まり에서 멈추고 조용한 후렴에서 느려진다.
 */
const CROWD_TIME_WINDOWS: { a: number; b: number; k: number }[] = [
  { a: 23.1, b: 26.45, k: 2.6 },
  { a: 26.45, b: 27.75, k: 0 },
  { a: 27.75, b: 31.7, k: 1.7 },
  { a: 79.6, b: 81.2, k: 0 },
  { a: 133.75, b: 150.65, k: 0.25 },
];

const inRapid = (t: number) => t >= RAPID_RANGE[0] && t < RAPID_RANGE[1];

/** 빠른 구간에서 마지막으로 터진 단어와 그 경과 시간 */
function lastRapidWord(t: number) {
  if (!inRapid(t)) return null;
  for (let i = RAPID_WORDS.length - 1; i >= 0; i--) {
    if (t >= RAPID_WORDS[i].t) return { word: RAPID_WORDS[i], age: t - RAPID_WORDS[i].t };
  }
  return null;
}

/** 「とんだ勘違いだよ」에서 시간이 멈춘 듯한 정적 (0~1) */
function freezeAmount(t: number) {
  return clamp((t - 26.45) / 0.08) * (1 - clamp((t - 27.55) / 0.25));
}

function crowdTime(t: number) {
  let out = t;
  for (const w of CROWD_TIME_WINDOWS) out -= (1 - w.k) * clamp(t - w.a, 0, w.b - w.a);
  return out;
}

export function createSamuraiHeartRenderer(fonts: SceneFonts): MvRenderer {
  const env = decodeEnvelope(ENVELOPE);
  const beat = beatGrid(BEAT_PERIOD, BEAT_PHASE);

  // ── 정적 자산(한 번만 생성) ────────────────────────
  const r = rng(20260826);
  const layers: Layer[] = [
    { ground: 470, h: 66, speed: 26, color: '#4a4454', figures: [] },
    { ground: 548, h: 118, speed: 46, color: '#2f2a38', figures: [] },
    { ground: 790, h: 300, speed: 92, color: '#131118', figures: [] },
  ];
  layers.forEach((layer, li) => {
    const n = [30, 17, 4][li];
    for (let i = 0; i < n; i++) {
      layer.figures.push({
        x0: r() * (W + 300),
        dir: r() < 0.5 ? -1 : 1,
        speed: 0.7 + r() * 0.6,
        phase: r() * TAU,
        hScale: 0.86 + r() * 0.28,
        seed: li * 100 + i,
      });
    }
  });

  const buildings = Array.from({ length: 22 }, (_, i) => {
    const w = 50 + r() * 90;
    return { x: (i / 22) * (W + 120) - 60 + r() * 20, w, h: 120 + r() * 260, seed: i };
  });

  const IMPACT: [number, number] = [868, 338];
  const shards: Shard[] = (() => {
    const out: Shard[] = [];
    const radii = [0, 70, 170, 330, 760];
    const sectors = 13;
    const angles = Array.from({ length: sectors }, (_, i) => ((i + r() * 0.6) / sectors) * TAU).sort((a, b) => a - b);
    for (let ri = 0; ri < radii.length - 1; ri++) {
      for (let si = 0; si < sectors; si++) {
        const a0 = angles[si];
        const a1 = angles[(si + 1) % sectors] + (si === sectors - 1 ? TAU : 0);
        const r0 = radii[ri] * (0.85 + r() * 0.3);
        const r1 = radii[ri + 1] * (0.85 + r() * 0.3);
        const pts: [number, number][] = [
          [IMPACT[0] + Math.cos(a0) * r0, IMPACT[1] + Math.sin(a0) * r0],
          [IMPACT[0] + Math.cos(a0) * r1, IMPACT[1] + Math.sin(a0) * r1],
          [IMPACT[0] + Math.cos(a1) * r1, IMPACT[1] + Math.sin(a1) * r1],
          [IMPACT[0] + Math.cos(a1) * r0, IMPACT[1] + Math.sin(a1) * r0],
        ];
        const cx = pts.reduce((s, p) => s + p[0], 0) / 4;
        const cy = pts.reduce((s, p) => s + p[1], 0) / 4;
        const dist = Math.hypot(cx - IMPACT[0], cy - IMPACT[1]) || 1;
        const sp = 500 + r() * 900;
        out.push({ pts, cx, cy, vx: ((cx - IMPACT[0]) / dist) * sp, vy: ((cy - IMPACT[1]) / dist) * sp - 200, vr: (r() - 0.5) * 9 });
      }
    }
    return out;
  })();

  const cracks = Array.from({ length: 11 }, (_, i) => {
    const a = (i / 11) * TAU + r() * 0.4;
    const pts: [number, number][] = [[IMPACT[0], IMPACT[1]]];
    let x = IMPACT[0];
    let y = IMPACT[1];
    let ang = a;
    const len = 160 + r() * 380;
    for (let s = 0; s < 9; s++) {
      ang += (r() - 0.5) * 0.5;
      x += Math.cos(ang) * (len / 9);
      y += Math.sin(ang) * (len / 9);
      pts.push([x, y]);
    }
    return { pts, wave: i % 2 };
  });

  // 캔버스 자산은 첫 render에서 생성(SSR 안전)
  let buffer: HTMLCanvasElement | null = null;
  let fbuf: HTMLCanvasElement | null = null;
  let grain: CanvasPattern | null = null;
  let vignette: HTMLCanvasElement | null = null;

  function ensureAssets(main: Ctx) {
    const cw = main.canvas.width;
    const ch = main.canvas.height;
    if (!buffer) buffer = document.createElement('canvas');
    if (buffer.width !== cw || buffer.height !== ch) {
      buffer.width = cw;
      buffer.height = ch;
    }
    if (!fbuf) fbuf = document.createElement('canvas');
    if (!grain) {
      const g = document.createElement('canvas');
      g.width = g.height = 200;
      const gc = g.getContext('2d')!;
      const img = gc.createImageData(200, 200);
      const gr = rng(7);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = gr() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      gc.putImageData(img, 0, 0);
      grain = main.createPattern(g, 'repeat');
    }
    if (!vignette) {
      vignette = document.createElement('canvas');
      vignette.width = 640;
      vignette.height = 360;
      const vc = vignette.getContext('2d')!;
      const grd = vc.createRadialGradient(320, 180, 120, 320, 180, 400);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.72)');
      vc.fillStyle = grd;
      vc.fillRect(0, 0, 640, 360);
    }
    return buffer.getContext('2d')!;
  }

  // ── 원본 영상(아야) ─────────────────────────────────

  const footageReady = (v: HTMLVideoElement | null): v is HTMLVideoElement =>
    !!v && v.readyState >= 2 && v.videoWidth > 0;

  /**
   * 원본 방송 화면에서 아바타 부분만 잘라 그린다(왼쪽 채팅창 제외).
   * chroma 0이면 흑백, tint로 색을 얹는다.
   */
  function drawFootage(
    c: Ctx, video: HTMLVideoElement, x: number, y: number, w: number, h: number,
    opts: { chroma: number; tint?: string; tintAlpha?: number; zoom?: number; alpha?: number },
  ) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const zoom = opts.zoom ?? 1;
    const regionX = vw * 0.285;
    const regionW = vw * 0.555;
    const faceX = vw * 0.555;
    const faceY = vh * 0.42;
    const aspect = w / h;
    let sw: number;
    let sh: number;
    if (aspect > regionW / vh) {
      sw = regionW;
      sh = regionW / aspect;
    } else {
      sh = vh;
      sw = vh * aspect;
    }
    sw /= zoom;
    sh /= zoom;
    const sx = clamp(faceX - sw / 2, regionX, regionX + regionW - sw);
    const sy = clamp(faceY - sh / 2, 0, vh - sh);

    const f = fbuf!;
    const scale = c.getTransform().a;
    const fw = Math.max(2, Math.min(900, Math.round(w * scale)));
    const fh = Math.max(2, Math.round((fw * h) / w));
    if (f.width !== fw || f.height !== fh) {
      f.width = fw;
      f.height = fh;
    }
    const fc = f.getContext('2d')!;
    fc.globalCompositeOperation = 'source-over';
    fc.globalAlpha = 1;
    fc.drawImage(video, sx, sy, sw, sh, 0, 0, fw, fh);
    if (opts.chroma < 1) {
      fc.globalCompositeOperation = 'saturation';
      fc.fillStyle = `rgba(128,128,128,${1 - opts.chroma})`;
      fc.fillRect(0, 0, fw, fh);
    }
    if (opts.tint && (opts.tintAlpha ?? 0) > 0) {
      fc.globalCompositeOperation = 'multiply';
      fc.globalAlpha = opts.tintAlpha ?? 0;
      fc.fillStyle = opts.tint;
      fc.fillRect(0, 0, fw, fh);
    }
    fc.globalCompositeOperation = 'source-over';
    fc.globalAlpha = 1;
    c.save();
    c.globalAlpha *= opts.alpha ?? 1;
    c.drawImage(f, x, y, w, h);
    c.restore();
  }

  // ── 그리기 부품 ─────────────────────────────────────

  function heartPoint(cx: number, cy: number, size: number) {
    return (u: number): [number, number] => {
      const th = Math.PI + u * TAU * 0.97;
      const x = 16 * Math.pow(Math.sin(th), 3);
      const y = 13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th);
      return [cx + (x / 17) * size, cy - (y / 17) * size];
    };
  }

  function ensoPoint(cx: number, cy: number, radius: number, start: number) {
    return (u: number): [number, number] => {
      const a = start + u * TAU * 0.9;
      const rr = radius * (1 + 0.03 * Math.sin(u * 9));
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
    };
  }

  function figure(c: Ctx, x: number, ground: number, h: number, color: string, walk: number, bob = 0) {
    const rr = h * 0.105;
    const top = ground - h + bob;
    c.fillStyle = color;
    c.strokeStyle = color;
    c.beginPath();
    c.arc(x, top + rr, rr, 0, TAU);
    c.fill();
    const sh = top + rr * 2.25;
    const hip = ground - h * 0.42 + bob;
    const sw = h * 0.16;
    const hw = h * 0.11;
    c.beginPath();
    c.moveTo(x - sw * 0.6, sh);
    c.lineTo(x + sw * 0.6, sh);
    c.quadraticCurveTo(x + sw, sh, x + sw, sh + rr * 0.7);
    c.lineTo(x + hw, hip);
    c.lineTo(x - hw, hip);
    c.lineTo(x - sw, sh + rr * 0.7);
    c.quadraticCurveTo(x - sw, sh, x - sw * 0.6, sh);
    c.fill();
    const st = Math.sin(walk) * h * 0.09;
    c.lineWidth = h * 0.075;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x - hw * 0.45, hip);
    c.lineTo(x - hw * 0.45 + st, ground - c.lineWidth / 2);
    c.moveTo(x + hw * 0.45, hip);
    c.lineTo(x + hw * 0.45 - st, ground - c.lineWidth / 2);
    c.stroke();
  }

  function drawSky(c: Ctx, top: string, bottom: string, yOffset = 0) {
    const g = c.createLinearGradient(0, -400 + yOffset, 0, 480 + yOffset);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }

  function drawSkyline(c: Ctx, t: number, color: string, windowAlpha: number) {
    for (const b of buildings) {
      c.fillStyle = color;
      c.fillRect(b.x, 470 - b.h, b.w, b.h);
      if (windowAlpha <= 0) continue;
      const wr = rng(b.seed * 31 + 3);
      for (let wy = 470 - b.h + 14; wy < 456; wy += 18) {
        for (let wx = b.x + 8; wx < b.x + b.w - 10; wx += 16) {
          const lit = wr();
          if (lit > 0.32) continue;
          const flick = 0.6 + 0.4 * noise1(t * 0.3 + lit * 50, b.seed);
          c.fillStyle = `rgba(185,160,234,${windowAlpha * flick * 0.55})`;
          c.fillRect(wx, wy, 6, 8);
        }
      }
    }
  }

  /**
   * 군중. redJoin(0~1)만큼의 사람이 붉게 물든다(마지막 후렴 서사).
   * hero: 화면의 붉은 "나". null이면 그리지 않음.
   */
  function drawCrowd(
    c: Ctx, t: number,
    opts: { redJoin?: number; hero?: { x: number; glow: number; walk?: number } | null; alpha?: number; layers?: number[] },
  ) {
    const ct = crowdTime(t);
    const show = opts.layers ?? [0, 1, 2];
    const draw = (li: number) => {
      const layer = layers[li];
      for (const f of layer.figures) {
        const span = W + 300;
        const raw = f.x0 + f.dir * layer.speed * f.speed * ct;
        const x = ((raw % span) + span) % span - 150;
        const walk = ct * f.speed * 6.5 + f.phase;
        const isRed = (opts.redJoin ?? 0) > hash(f.seed * 13 + 1);
        const color = isRed ? [RED, '#b52a35', '#5e1219'][li] : layer.color;
        c.globalAlpha = opts.alpha ?? 1;
        figure(c, x, layer.ground, layer.h * f.hScale, color, walk, Math.abs(Math.sin(walk)) * -layer.h * 0.02);
      }
    };
    if (show.includes(0)) draw(0);
    if (show.includes(1)) draw(1);
    if (opts.hero) {
      const { x, glow } = opts.hero;
      if (glow > 0) {
        const g = c.createRadialGradient(x, 470, 10, x, 470, 160);
        g.addColorStop(0, `rgba(227,56,63,${0.45 * glow})`);
        g.addColorStop(1, 'rgba(227,56,63,0)');
        c.fillStyle = g;
        c.fillRect(x - 170, 300, 340, 340);
      }
      c.globalAlpha = 1;
      figure(c, x, 556, 150, RED, opts.hero.walk ?? 0);
    }
    if (show.includes(2)) draw(2);
    c.globalAlpha = 1;
  }

  /** 집중선 — 화면 가장자리에서 중심을 향하는 흰 선. 비트마다 새로 뽑는다 */
  function focusLines(c: Ctx, t: number, cx: number, cy: number, alpha: number) {
    if (alpha <= 0) return;
    const lr = rng(beat.index(t) * 17 + 5);
    c.save();
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 110; i++) {
      const a = lr() * TAU;
      const r0 = 430 + lr() * 180;
      const r1 = 980;
      const wdt = 0.004 + lr() * 0.01;
      c.globalAlpha = alpha * (0.25 + lr() * 0.6);
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      c.lineTo(cx + Math.cos(a - wdt) * r1, cy + Math.sin(a - wdt) * r1);
      c.lineTo(cx + Math.cos(a + wdt) * r1, cy + Math.sin(a + wdt) * r1);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  /** 마디마다 화면을 가로지르는 붓 획 */
  function barStrokes(c: Ctx, t: number, color: string, alpha: number) {
    const bi = Math.floor(beat.pos(t) / 4);
    for (let k = 0; k < 2; k++) {
      const idx = bi - k;
      const start = beat.timeOf(idx * 4);
      const age = t - start;
      if (age < 0) continue;
      const fade = 1 - invLerp(beat.period * 3, beat.period * 8, age);
      if (fade <= 0) continue;
      const hr = rng(idx * 97 + 11);
      const y0 = 120 + hr() * 480;
      const y1 = y0 + (hr() - 0.5) * 420;
      const cy = (y0 + y1) / 2 + (hr() - 0.5) * 200;
      const p = (u: number): [number, number] => {
        const x = lerp(-80, W + 80, u);
        const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1;
        return [x, y];
      };
      brushPath(c, p, 70 + hr() * 60, easeOutExpo(clamp(age / 0.28)), idx * 7, color, alpha * fade * 0.85);
    }
  }

  function beatSplatter(c: Ctx, t: number, color: string, alpha: number) {
    const bi = beat.index(t);
    for (let k = 0; k < 3; k++) {
      const idx = bi - k;
      if (hash(idx * 3 + 1) > 0.45) continue;
      const age = t - beat.timeOf(idx);
      const fade = 1 - clamp(age / (beat.period * 3));
      if (fade <= 0) continue;
      const hr = rng(idx * 41);
      splatter(c, 80 + hr() * (W - 160), 80 + hr() * (H - 160), 60 + 80 * easeOutCubic(clamp(age * 8)), 26, idx, color, alpha * fade);
    }
  }

  // ── 가사 ────────────────────────────────────────────

  function textShadow(c: Ctx, blur: number, color = 'rgba(0,0,0,0.85)') {
    c.shadowColor = color;
    c.shadowBlur = blur;
    c.shadowOffsetX = 0;
    c.shadowOffsetY = 2;
  }

  function koLine(c: Ctx, text: string | undefined, x: number, y: number, alpha: number, align: CanvasTextAlign = 'left') {
    if (!text || alpha <= 0) return;
    c.save();
    c.globalAlpha = alpha;
    setFont(c, 21, fonts.ko, 600);
    c.textAlign = align;
    c.textBaseline = 'alphabetic';
    textShadow(c, 10);
    c.fillStyle = 'rgba(255,255,255,0.88)';
    c.fillText(text, x, y);
    c.restore();
  }

  /** 절(verse) 스타일 — 왼쪽 아래 자막, 덩어리별로 왼→오 와이프 */
  function captionLyric(c: Ctx, t: number, line: MvLyricLine, accent: string) {
    const out = clamp((line.end + 0.35 - t) / 0.35);
    const shown = chunksShown(line, t);
    const size = fitSize(c, line.ja.map((j) => j.text).join(''), fonts.display, 40, 1040);
    c.save();
    setFont(c, size, fonts.display);
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    let x = 64;
    const y = 628;
    // 줄 시작 표시 — 붉은 붓 점
    brushPath(c, (u) => [44 + u * 4, y - size * 0.75 + u * size * 0.8], 9, clamp((t - line.t) * 6), 3, accent, out);
    for (let i = 0; i < line.ja.length; i++) {
      const ch = line.ja[i];
      const w = c.measureText(ch.text).width;
      if (i < shown) {
        const k = easeOutCubic(clamp((t - ch.t) / 0.28));
        c.save();
        c.beginPath();
        c.rect(x - 4, y - size * 1.3, (w + 8) * k, size * 1.8);
        c.clip();
        c.globalAlpha = out;
        textShadow(c, 14);
        c.fillStyle = PAPER;
        c.fillText(ch.text, x + (1 - k) * 18, y);
        c.restore();
      }
      x += w;
    }
    c.restore();
    koLine(c, line.ko, 66, 668, out * clamp((t - line.t) * 3));
  }

  /** 말이 빨라지는 구간 — 단어가 군중 위로 연달아 터지고, 「勘違いだよ」는 가운데 크게 */
  function rapidLyric(c: Ctx, t: number, line: MvLyricLine) {
    const out = clamp((line.end + 0.35 - t) / 0.35);
    const words = RAPID_WORDS.map((w, i) => ({ ...w, i })).filter((w) => w.t >= line.t - 0.01 && w.t <= line.end && t >= w.t);
    const last = words[words.length - 1];
    // 「勘違いだよ」가 터지면 앞 단어들은 바깥으로 튕겨 나간다
    const punch = words.find((w) => w.punch);
    const blast = punch ? easeOutCubic(clamp((t - punch.t) / 0.35)) : 0;
    for (const w of words) {
      const age = t - w.t;
      const k = clamp(age / 0.12);
      c.save();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      if (w.punch) {
        const sc = lerp(1.9, 1, easeOutBack(k));
        c.translate(w.x, w.y);
        c.rotate(-0.05);
        c.scale(sc, sc);
        c.globalAlpha = out * clamp(age / 0.04);
        setFont(c, 120, fonts.display);
        c.lineWidth = 15;
        c.strokeStyle = INK;
        c.strokeText(w.text, 0, 0);
        c.fillStyle = RED;
        c.fillText(w.text, 0, 0);
        c.lineWidth = 2.5;
        c.strokeStyle = PAPER;
        c.strokeText(w.text, 0, 0);
        c.restore();
        continue;
      }
      const latest = w === last;
      const size = latest ? 64 : 48;
      setFont(c, size, fonts.display);
      const half = c.measureText(w.text).width / 2;
      let x = clamp(w.x, half + 30, W - half - 30);
      let y = w.y;
      if (blast > 0) {
        const dx = x - 640;
        const dy = y - 245;
        const d = Math.hypot(dx, dy) || 1;
        x += (dx / d) * 320 * blast;
        y += (dy / d) * 320 * blast;
      }
      const sc = lerp(1.7, 1, easeOutBack(k));
      c.translate(x, y);
      c.rotate((hash(w.i * 13) - 0.5) * 0.22);
      c.scale(sc, sc);
      c.globalAlpha = out * clamp(age / 0.04) * (latest ? 1 : 0.5) * (1 - blast);
      c.lineWidth = size * 0.14;
      c.strokeStyle = INK;
      c.strokeText(w.text, 0, 0);
      c.fillStyle = latest ? '#ffffff' : PAPER;
      c.fillText(w.text, 0, 0);
      c.restore();
    }
    koLine(c, line.ko, 66, 668, out * clamp((t - line.t) * 3));
  }

  /** 조용한 후렴 — 가운데, 글자 하나씩 */
  function quietLyric(c: Ctx, t: number, line: MvLyricLine) {
    const out = clamp((line.end + 0.35 - t) / 0.35);
    const full = line.ja.map((j) => j.text).join('');
    const size = fitSize(c, full, fonts.display, 44, 1000);
    c.save();
    setFont(c, size, fonts.display);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    const gap = size * 0.4;
    const total = c.measureText(full).width + gap * (line.ja.length - 1);
    let x = W / 2 - total / 2;
    textShadow(c, 18, 'rgba(0,0,0,0.9)');
    for (const ch of line.ja) {
      const chars = Array.from(ch.text);
      chars.forEach((g, gi) => {
        const at = ch.t + gi * 0.06;
        const k = clamp((t - at) / 0.3);
        const w = c.measureText(g).width;
        if (k > 0) {
          c.globalAlpha = out * k;
          c.fillStyle = '#ffffff';
          c.fillText(g, x, 600 - (1 - easeOutCubic(k)) * 10);
        }
        x += w;
      });
      x += gap;
    }
    c.restore();
    koLine(c, line.ko, W / 2, 646, out * clamp((t - line.t) * 2), 'center');
  }

  function stamp(c: Ctx, text: string, x: number, y: number, size: number, age: number, rot: number, alpha: number) {
    const k = clamp(age / 0.14);
    const sc = lerp(1.9, 1, easeOutBack(k));
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.scale(sc, sc);
    c.globalAlpha = alpha * clamp(age / 0.05);
    setFont(c, size, fonts.display);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = size * 0.12;
    c.strokeStyle = INK;
    c.strokeText(text, 0, 0);
    c.fillStyle = RED;
    c.fillText(text, 0, 0);
    c.lineWidth = size * 0.025;
    c.strokeStyle = PAPER;
    c.strokeText(text, 0, 0);
    c.restore();
  }

  /** 세로쓰기 붓글씨 */
  function verticalBrush(c: Ctx, text: string, x: number, top: number, size: number, t0: number, t: number, color: string) {
    const chars = Array.from(text);
    c.save();
    setFont(c, size, fonts.brush);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    chars.forEach((g, i) => {
      const k = clamp((t - t0 - i * 0.045) / 0.22);
      if (k <= 0) return;
      const y = top + i * size * 0.98 + size / 2;
      c.save();
      c.translate(x, y);
      if (g === 'ー') c.rotate(Math.PI / 2);
      const sc = lerp(1.6, 1, easeOutCubic(k));
      c.scale(sc, sc);
      c.globalAlpha = k;
      textShadow(c, 0);
      c.fillStyle = INK;
      c.fillText(g, 5, 5);
      c.fillStyle = color;
      c.fillText(g, 0, 0);
      c.restore();
    });
    c.restore();
  }

  /** 후렴 키네틱 타이포 */
  function kineticLyric(
    c: Ctx, t: number, line: MvLyricLine,
    layout: { cx: number; cy: number; maxW: number; vertX: number; koX: number; koAlign: CanvasTextAlign },
  ) {
    const out = clamp((line.end + 0.35 - t) / 0.35);
    const shown = chunksShown(line, t);
    if (shown === 0) return;
    const chunks = line.ja.slice(0, shown);
    const active = chunks[shown - 1];
    const heys = chunks.filter((ch) => ch.text === 'Hey!!');
    const words = chunks.filter((ch) => ch.text !== 'Hey!!' && ch.text !== 'サムライハート');
    const samurai = chunks.find((ch) => ch.text === 'サムライハート');

    // Hey!! 도장 — 다음 말이 나오면 작아지며 맨 위 줄로 물러난다
    const heyRetire = easeOutCubic(active.text === 'Hey!!' ? 0 : clamp((t - active.t) / 0.25));
    heys.forEach((h, i) => {
      const age = t - h.t;
      const left = i % 2 === 0;
      const x = lerp(layout.cx + (left ? -layout.maxW * 0.22 : layout.maxW * 0.2), layout.cx + (left ? -layout.maxW * 0.36 : -layout.maxW * 0.36 + 200), heyRetire);
      const y = lerp(layout.cy + (left ? -40 : 80), 92, heyRetire);
      const size = lerp(140, 54, heyRetire);
      stamp(c, 'Hey!!', x, y, size, age, left ? -0.12 : 0.09, out * (1 - heyRetire * 0.4));
    });

    // 본문: 마지막 덩어리는 크게 쾅, 앞 덩어리는 위에 작게
    if (words.length) {
      const main = words[words.length - 1];
      const age = t - main.t;
      const prev = words.slice(0, -1);
      c.save();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      prev.forEach((p, i) => {
        setFont(c, 44, fonts.display);
        c.globalAlpha = out * 0.7;
        textShadow(c, 12);
        c.fillStyle = PAPER;
        c.fillText(p.text, layout.cx, layout.cy - 100 - (prev.length - 1 - i) * 54);
      });
      const size = fitSize(c, main.text, fonts.display, 124, layout.maxW);
      const k = clamp(age / 0.16);
      const sc = lerp(1.4, 1, easeOutExpo(k));
      // 잔상
      for (let g = 2; g >= 1; g--) {
        c.save();
        c.translate(layout.cx, layout.cy + 30);
        c.scale(sc + g * 0.06 * (1 - k * 0.6), sc + g * 0.06 * (1 - k * 0.6));
        setFont(c, size, fonts.display);
        c.globalAlpha = out * 0.18 * (1 - k * 0.5);
        c.fillStyle = RED;
        c.fillText(main.text, 0, 0);
        c.restore();
      }
      c.translate(layout.cx, layout.cy + 30);
      c.scale(sc, sc);
      setFont(c, size, fonts.display);
      c.globalAlpha = out * clamp(age / 0.04);
      c.lineJoin = 'round';
      c.lineWidth = size * 0.1;
      c.strokeStyle = INK;
      textShadow(c, 24, 'rgba(0,0,0,0.6)');
      c.strokeText(main.text, 0, 0);
      c.shadowBlur = 0;
      c.fillStyle = '#ffffff';
      c.fillText(main.text, 0, 0);
      c.restore();
    }

    if (samurai) verticalBrush(c, 'サムライハート', layout.vertX, 54, 84, samurai.t, t, PAPER);

    koLine(c, line.ko, layout.koX, 680, out * clamp((t - line.t) * 3), layout.koAlign);
  }

  // ── 장면 ────────────────────────────────────────────

  function sceneTitle(c: Ctx, t: number, poster: boolean) {
    c.fillStyle = INK;
    c.fillRect(0, 0, W, H);
    // 먹 번짐
    const blooms = [
      { at: 0.6, x: 380, y: 300, rad: 420, col: LAV_DEEP, a: 0.9 },
      { at: 2.4, x: 930, y: 420, rad: 360, col: RED_DEEP, a: 0.85 },
      { at: 5.0, x: 640, y: 360, rad: 250, col: '#3d2a5c', a: 0.6 },
    ];
    blooms.forEach((b, i) => {
      const k = poster ? 1 : easeOutCubic(clamp((t - b.at) / 5));
      if (k <= 0) return;
      c.save();
      c.globalAlpha = b.a * k;
      blotPath(c, b.x, b.y, b.rad * (0.3 + 0.7 * k), 900 + i, 0.22, t * 0.4);
      const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.rad);
      g.addColorStop(0, b.col);
      g.addColorStop(1, 'rgba(12,10,16,0)');
      c.fillStyle = g;
      c.fill();
      c.restore();
    });
    const tk = poster ? 1 : clamp((t - 2.2) / 1.2);
    if (tk > 0) {
      // 원상 + 제목
      brushPath(c, ensoPoint(640, 330, 210, -1.9), 34, poster ? 1 : easeOutCubic(clamp((t - 1.6) / 1.6)), 77, RED, 0.9);
      c.save();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.globalAlpha = tk;
      setFont(c, 104, fonts.brush);
      textShadow(c, 30, 'rgba(0,0,0,0.9)');
      c.fillStyle = PAPER;
      c.fillText('サムライハート', 640, 318);
      setFont(c, 30, fonts.display);
      c.fillStyle = LAV;
      c.fillText('Some Like It Hot!!', 640, 410);
      c.restore();
    }
    const ck = poster ? 1 : clamp((t - 4.5) / 1);
    if (ck > 0) {
      c.save();
      c.globalAlpha = ck * 0.85;
      c.textAlign = 'center';
      setFont(c, 18, fonts.ko, 500);
      c.fillStyle = PAPER;
      if ('letterSpacing' in c) (c as Ctx & { letterSpacing: string }).letterSpacing = '6px';
      c.fillText('AyaUke  COVER  ·  SPYAIR', 640, 580);
      c.restore();
    }
    // 1절로 넘어가며 잉크가 화면을 덮는다
    if (!poster && t > 13.4) {
      const k = easeInCubic(clamp((t - 13.4) / 1.5));
      c.save();
      blotPath(c, 640, 360, 900 * k, 4242, 0.2, t);
      c.fillStyle = INK;
      c.fill();
      c.restore();
    }
  }

  function sceneCity(c: Ctx, t: number, sec: string) {
    // 하늘을 올려다보는 틸트 (虚しくって 見上げる空)
    const tilt = sec === 'pre1' ? smooth(invLerp(34.0, 34.9, t)) * (1 - smooth(invLerp(37.6, 38.6, t))) : 0;
    const off = tilt * 360;
    const dusk = sec === 'verse2';
    drawSky(c, dusk ? '#1d1430' : '#0b0a12', dusk ? '#5a3b52' : '#272233', off);
    // 달
    if (off > 0) {
      c.save();
      c.globalAlpha = tilt;
      const g = c.createRadialGradient(900, 160 - (1 - tilt) * 120, 10, 900, 160 - (1 - tilt) * 120, 150);
      g.addColorStop(0, 'rgba(240,232,255,0.95)');
      g.addColorStop(0.35, 'rgba(200,180,240,0.3)');
      g.addColorStop(1, 'rgba(200,180,240,0)');
      c.fillStyle = g;
      c.fillRect(700, 0, 400, 360);
      c.restore();
    }
    c.save();
    c.translate(0, off);
    drawSkyline(c, t, dusk ? '#241a2e' : '#17141d', dusk ? 0.6 : 1);
    // DAY BY DAY 티커
    if (dusk && t < 78.2) {
      c.save();
      setFont(c, 150, fonts.display);
      c.textBaseline = 'middle';
      c.lineWidth = 2;
      c.strokeStyle = 'rgba(255,236,250,0.2)';
      const txt = 'DAY BY DAY  ';
      const tw = c.measureText(txt).width;
      const sx = -(((t - 69.5) * 120) % tw);
      for (let x = sx; x < W; x += tw) c.strokeText(txt, x, 300);
      c.restore();
    }
    c.fillStyle = dusk ? '#1a1320' : '#121017';
    c.fillRect(0, 470, W, 400);

    // 孤独 — 군중 뒤로 커지는 거대한 붓글씨
    if (sec === 'pre1' && t > 38.0) {
      const k = clamp((t - 38.0) / 2.3);
      c.save();
      c.globalAlpha = 0.2 + 0.25 * k;
      setFont(c, 330 + 80 * k, fonts.brush);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = LAV;
      c.fillText('孤独', 640, 330);
      c.restore();
    }

    // 발자국 (確かめた足跡)
    if (sec === 'verse2' && t > 81.0) {
      for (let i = 0; i < 12; i++) {
        const at = 81.2 + i * 0.13;
        const k = clamp((t - at) / 0.2);
        if (k <= 0) continue;
        const x = 140 + i * 52;
        const y = 566 + (i % 2) * 12;
        c.save();
        c.globalAlpha = k * 0.85;
        c.fillStyle = RED;
        c.beginPath();
        c.ellipse(x, y, 9, 15, 1.35, 0, TAU);
        c.fill();
        c.beginPath();
        c.ellipse(x + 16, y - 2, 5, 6, 0, 0, TAU);
        c.fill();
        c.restore();
      }
    }

    // 나(붉은 사람) — 2절 끝에 조금 걸어 나간다(歩けてるかも)
    let heroX = 760;
    let heroWalk = 0;
    if (sec === 'verse2') {
      const k = invLerp(85.4, 86.9, t);
      heroX += 80 * smooth(k);
      heroWalk = k > 0 && k < 1 ? t * 9 : 0;
    }
    const rapidHit = lastRapidWord(t);
    const glow = sec === 'pre1'
      ? invLerp(38, 40.3, t)
      : rapidHit
        ? 0.3 + 0.6 * Math.exp(-rapidHit.age * 5)
        : 0.25 + 0.2 * beat.pulse(t, 5);
    drawCrowd(c, t, { hero: { x: heroX, glow, walk: heroWalk } });

    // 캐치볼 — 닿지 않는 대화
    if (sec === 'pre1' && t > 35.8 && t < 38.6) {
      const k = clamp((t - 35.8) / 1.5);
      let bx = lerp(300, 650, k);
      let by = 430 - Math.sin(k * Math.PI) * 220 + (k > 0.75 ? (k - 0.75) * 500 : 0);
      if (t > 37.3) {
        const b = t - 37.3;
        bx = 650 + b * 120;
        by = 520 - Math.abs(Math.sin(b * 7)) * 50 * Math.exp(-b * 2);
      }
      c.save();
      c.fillStyle = PAPER;
      c.globalAlpha = 1 - clamp((t - 38.1) / 0.5);
      c.beginPath();
      c.arc(bx, by, 10, 0, TAU);
      c.fill();
      c.restore();
    }
    c.restore();

    // 빗줄기 — 프리코러스 고조
    const rain = sec === 'pre1' ? 0.25 + 0.75 * invLerp(31.8, 40.3, t) : sec === 'verse1' ? (inRapid(t) ? 0.4 : 0.12) : 0;
    if (rain > 0) {
      const rr = rng(55);
      c.save();
      c.strokeStyle = 'rgba(200,190,230,0.35)';
      c.lineWidth = 1.2;
      c.beginPath();
      const n = Math.round(160 * rain);
      for (let i = 0; i < n; i++) {
        const x0 = rr() * (W + 200);
        const sp = 900 + rr() * 700;
        const y = ((rr() * 900 + t * sp) % 900) - 100;
        const x = x0 - y * 0.18;
        c.moveTo(x, y);
        c.lineTo(x - 8 * (1 + rain), y + 40 * (1 + rain));
      }
      c.stroke();
      c.restore();
    }
  }

  function sceneGlass(c: Ctx, t: number, video: HTMLVideoElement | null, chroma: number) {
    drawSky(c, '#120e1a', '#2b2238');
    // 건물 외벽 유리창 격자
    const cols = [40, 330, 620, 1000];
    const rows = [30, 290, 550];
    for (let i = 0; i < cols.length - 1; i++) {
      for (let j = 0; j < rows.length - 1; j++) {
        const x = cols[i];
        const y = rows[j];
        const w = cols[i + 1] - x - 16;
        const h = rows[j + 1] - y - 16;
        const g = c.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, '#2a2338');
        g.addColorStop(1, '#141019');
        c.fillStyle = g;
        c.fillRect(x, y, w, h);
      }
    }
    // 가운데 큰 창 — 비친 "나"(아야)
    const px = 620;
    const py = 30;
    const pw = 620;
    const ph = 600;
    c.save();
    c.beginPath();
    c.rect(px, py, pw, ph);
    c.clip();
    c.fillStyle = '#1b1526';
    c.fillRect(px, py, pw, ph);
    const reveal = easeOutCubic(clamp((t - 87.2) / 1.6));
    if (footageReady(video)) {
      drawFootage(c, video, px, py, pw, ph, { chroma: chroma * 0.5, tint: LAV, tintAlpha: 0.55, alpha: 0.25 + 0.6 * reveal, zoom: 1.05 });
    } else {
      brushPath(c, heartPoint(px + pw / 2, py + ph / 2, 170), 30, reveal, 61, LAV, 0.7);
    }
    // 유리 반사광
    const sweep = ((t - 87) * 0.35) % 1.4;
    const sxp = px - 300 + sweep * (pw + 600);
    const sg = c.createLinearGradient(sxp, py, sxp + 220, py + ph);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.16)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sg;
    c.fillRect(px, py, pw, ph);
    c.restore();
    c.strokeStyle = '#0a080d';
    c.lineWidth = 14;
    c.strokeRect(px, py, pw, ph);

    // 금 가는 유리 (ムカつくんだ → 無関心な世界も)
    const waves = [91.3, 93.5];
    c.save();
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 2;
    c.lineCap = 'round';
    for (const cr of cracks) {
      const k = easeOutExpo(clamp((t - waves[cr.wave]) / 0.35));
      if (k <= 0) continue;
      const n = Math.max(1, Math.floor((cr.pts.length - 1) * k));
      c.beginPath();
      c.moveTo(cr.pts[0][0], cr.pts[0][1]);
      for (let i = 1; i <= n; i++) c.lineTo(cr.pts[i][0], cr.pts[i][1]);
      c.stroke();
    }
    c.restore();
  }

  function drawShards(c: Ctx, t: number) {
    const s = t - 95.55;
    if (s < 0 || s > 1.2) return;
    c.save();
    for (const sh of shards) {
      const dx = sh.vx * s;
      const dy = sh.vy * s + 900 * s * s;
      const rot = sh.vr * s;
      c.save();
      c.translate(sh.cx + dx, sh.cy + dy);
      c.rotate(rot);
      c.globalAlpha = 1 - clamp(s / 1.2);
      c.beginPath();
      sh.pts.forEach(([x, y], i) => (i ? c.lineTo(x - sh.cx, y - sh.cy) : c.moveTo(x - sh.cx, y - sh.cy)));
      c.closePath();
      c.fillStyle = 'rgba(185,160,234,0.28)';
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.lineWidth = 1.5;
      c.stroke();
      c.restore();
    }
    c.restore();
  }

  /** 후렴 공용 무대 */
  function sceneChorus(
    c: Ctx, t: number, sec: string, video: HTMLVideoElement | null, chroma: number,
    secStart: number,
  ) {
    const low = env('low', t);
    const finalish = sec === 'final' || sec === 'finale';
    const cx = 935;
    const cy = 350;
    const bg = c.createRadialGradient(cx, cy, 40, cx, cy, 900);
    bg.addColorStop(0, finalish ? '#5a1626' : sec === 'chorus2' ? '#3a1840' : '#3b1222');
    bg.addColorStop(0.55, finalish ? '#22101a' : '#170d1c');
    bg.addColorStop(1, INK);
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    focusLines(c, t, cx, cy, 0.35 + 0.4 * low);
    barStrokes(c, t, sec === 'chorus2' ? LAV : RED, 0.55);
    beatSplatter(c, t, sec === 'chorus2' ? LAV : RED, 0.6);

    // 원상(圓相) + 아야
    const intro = easeOutCubic(clamp((t - secStart) / 1.3));
    const pulse = beat.pulse(t, 7);
    const radius = 232 + pulse * 10 + low * 8;
    brushPath(c, ensoPoint(cx, cy, radius + 26, -1.7 + t * 0.15), 46, intro, 12 + Math.floor(secStart), RED, 0.95);
    c.save();
    blotPath(c, cx, cy, radius * intro, 5150, 0.1, t * 1.4);
    c.clip();
    if (footageReady(video)) {
      drawFootage(c, video, cx - radius * 1.2, cy - radius * 1.2, radius * 2.4, radius * 2.4, {
        chroma, tint: RED, tintAlpha: 0.35 * (1 - chroma), zoom: 1 + pulse * 0.03,
      });
    } else {
      c.fillStyle = '#1a0f18';
      c.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      brushPath(c, heartPoint(cx, cy + 10, 130 + pulse * 8), 34, intro, 33, LAV, 0.85);
    }
    c.restore();

    // 마지막 후렴: 관객이 함께 붉게 — "혼자가 아니다"
    if (finalish) {
      const join = sec === 'final' ? invLerp(150.65, 166, t) : 1;
      const bob = beat.pulse(t, 5);
      const ar = rng(808);
      for (let i = 0; i < 26; i++) {
        const x = (i / 25) * (W + 80) - 40 + (ar() - 0.5) * 30;
        const h = 150 + ar() * 70;
        const red = join > ar();
        const jump = bob * (8 + ar() * 16);
        figure(c, x, H + 128 - jump, h, red ? (i % 3 === 0 ? LAV : RED) : '#2a2430', 0);
        if (red && ar() < 0.5) {
          // 손 들기
          c.save();
          c.strokeStyle = red ? (i % 3 === 0 ? LAV : RED) : '#2a2430';
          c.lineWidth = h * 0.07;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(x + h * 0.12, H + 128 - jump - h * 0.72);
          c.lineTo(x + h * 0.2, H + 128 - jump - h * 1.05 - bob * 10);
          c.stroke();
          c.restore();
        }
      }
    }

    if (sec === 'chorus2') drawShards(c, t);
  }

  function scenePost(c: Ctx, t: number, video: HTMLVideoElement | null, chroma: number) {
    c.fillStyle = '#b8222d';
    c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, 'rgba(12,10,16,0)');
    g.addColorStop(1, 'rgba(12,10,16,0.75)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    barStrokes(c, t, INK, 0.8);
    beatSplatter(c, t, INK, 0.7);
    // 세로 필름 패널
    const px = 90;
    const py = 70;
    const pw = 360;
    const ph = 580;
    c.fillStyle = INK;
    c.fillRect(px - 12, py - 12, pw + 24, ph + 24);
    if (footageReady(video)) {
      drawFootage(c, video, px, py, pw, ph, { chroma, tint: RED, tintAlpha: 0.3, zoom: 1.1 + beat.pulse(t, 6) * 0.04 });
    } else {
      c.fillStyle = '#2a1018';
      c.fillRect(px, py, pw, ph);
      brushPath(c, heartPoint(px + pw / 2, py + ph / 2, 110), 28, 1, 9, RED, 0.9);
    }
    for (let i = 0; i < 9; i++) {
      c.fillStyle = PAPER;
      c.fillRect(px - 8, py + 10 + i * 64, 5, 26);
      c.fillRect(px + pw + 3, py + 10 + i * 64, 5, 26);
    }
  }

  function sceneInterlude(c: Ctx, t: number, video: HTMLVideoElement | null, chroma: number) {
    const k = t - 113.2;
    drawSky(c, '#150f22', '#3a2a58');
    // 보케
    const br = rng(313);
    for (let i = 0; i < 22; i++) {
      const x = br() * W;
      const y = br() * H;
      const rad = 20 + br() * 70;
      const a = 0.05 + 0.08 * (0.5 + 0.5 * Math.sin(t * (0.3 + br()) + i));
      c.fillStyle = `rgba(185,160,234,${a})`;
      c.beginPath();
      c.arc(x + Math.sin(t * 0.2 + i) * 20, y, rad, 0, TAU);
      c.fill();
    }
    // 아야 — 크게
    const x = 330;
    const y = 50;
    const w = 620;
    const h = 620;
    const fade = easeOutCubic(clamp(k / 1.5)) * (1 - clamp((t - 132.6) / 1.1));
    c.save();
    blotPath(c, x + w / 2, y + h / 2, 300 + 6 * Math.sin(t * 0.8), 2026, 0.07, t * 0.3);
    c.clip();
    if (footageReady(video)) {
      drawFootage(c, video, x, y, w, h, { chroma, tint: LAV, tintAlpha: 0.2, alpha: fade, zoom: 1 + k * 0.006 });
    } else {
      c.globalAlpha = fade;
      c.fillStyle = '#22183a';
      c.fillRect(x, y, w, h);
      brushPath(c, heartPoint(x + w / 2, y + h / 2, 150), 34, clamp(k / 2), 71, LAV, 0.8);
    }
    c.restore();
    brushPath(c, ensoPoint(x + w / 2, y + h / 2, 318, -2.2 + k * 0.05), 22, easeOutCubic(clamp(k / 2.4)) * (1 - clamp((t - 132.6) / 1.1)), 404, LAV, 0.7);
    // 등꽃 꽃잎 (아야 방송 배경의 등나무)
    const pr = rng(616);
    c.save();
    for (let i = 0; i < 70; i++) {
      const x0 = pr() * (W + 200) - 100;
      const sp = 40 + pr() * 60;
      const ph = pr() * 1000;
      const yy = ((ph + t * sp) % (H + 60)) - 30;
      const xx = x0 + Math.sin(t * 0.9 + i) * 30;
      const rot = t * (pr() - 0.5) * 3 + i;
      c.save();
      c.translate(xx, yy);
      c.rotate(rot);
      c.globalAlpha = 0.55 + pr() * 0.4;
      c.fillStyle = i % 4 === 0 ? '#ffffff' : LAV;
      c.beginPath();
      c.ellipse(0, 0, 7, 3.5, 0, 0, TAU);
      c.fill();
      c.restore();
    }
    c.restore();
    // 크레딧
    const credits = [
      { at: 115.5, out: 121.5, a: 'Vocal', b: 'AyaUke' },
      { at: 122.0, out: 128.0, a: 'Original', b: 'SPYAIR「サムライハート (Some Like It Hot!!)」' },
      { at: 128.4, out: 132.8, a: 'Live', b: '2026.08.26 노래방송' },
    ];
    for (const cr of credits) {
      const a = clamp((t - cr.at) / 0.8) * (1 - clamp((t - cr.out) / 0.8));
      if (a <= 0) continue;
      c.save();
      c.globalAlpha = a;
      textShadow(c, 12);
      setFont(c, 15, fonts.ko, 600);
      c.fillStyle = LAV;
      if ('letterSpacing' in c) (c as Ctx & { letterSpacing: string }).letterSpacing = '4px';
      c.fillText(cr.a.toUpperCase(), 64, 620);
      (c as Ctx & { letterSpacing?: string }).letterSpacing = '0px';
      setFont(c, 26, fonts.ko, 700);
      c.fillStyle = PAPER;
      c.fillText(cr.b, 64, 656);
      c.restore();
    }
  }

  function sceneQuiet(c: Ctx, t: number) {
    c.fillStyle = '#08070b';
    c.fillRect(0, 0, W, H);
    const build = invLerp(146.3, 150.6, t);
    // 군중 — 어둠 속 멈춘 실루엣
    drawCrowd(c, t, { alpha: 0.45, hero: null, layers: [0, 1] });
    // 스포트라이트 (흰색)
    const sp = 0.35 + 0.45 * build;
    const g = c.createLinearGradient(640, 0, 640, 560);
    g.addColorStop(0, `rgba(255,250,240,${sp * 0.5})`);
    g.addColorStop(1, `rgba(255,250,240,${sp * 0.1})`);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(600, -10);
    c.lineTo(680, -10);
    c.lineTo(800, 570);
    c.lineTo(480, 570);
    c.closePath();
    c.fill();
    c.fillStyle = `rgba(255,250,240,${sp * 0.25})`;
    c.beginPath();
    c.ellipse(640, 560, 170, 26, 0, 0, TAU);
    c.fill();
    figure(c, 640, 556, 150, RED, 0);
    // 하트 고동
    const hb = beat.pulse(t, 8) * (0.3 + build);
    c.save();
    c.globalAlpha = 0.5 + 0.5 * build;
    const hp = heartPoint(640, 445, 14 + hb * 6);
    c.fillStyle = RED;
    c.beginPath();
    for (let i = 0; i <= 40; i++) {
      const [x, y] = hp(i / 40);
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.fill();
    c.restore();
    // 떠오르는 빛 알갱이 — 고조될수록 빨라진다
    const pr = rng(919);
    const speed = 30 + build * 260;
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 90; i++) {
      const x = pr() * W;
      const base = pr() * 1000;
      const y = H - ((base + (t - 133.75) * speed * (0.5 + pr())) % (H + 40));
      c.globalAlpha = (0.15 + pr() * 0.4) * (0.6 + build);
      c.fillRect(x, y, 2, 2 + build * 14);
    }
    c.globalAlpha = 1;
    // 위에서 내려오는 흰 빛줄기 (本当の声を)
    if (build > 0) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      const lr = rng(5);
      for (let i = 0; i < 7; i++) {
        const x = 200 + lr() * 880;
        const w = 30 + lr() * 90;
        c.globalAlpha = build * (0.08 + 0.1 * lr());
        c.fillStyle = '#fff6ea';
        c.beginPath();
        c.moveTo(x, -10);
        c.lineTo(x + w, -10);
        c.lineTo(x + w * 2.4 - 200, H + 10);
        c.lineTo(x - 200, H + 10);
        c.closePath();
        c.fill();
      }
      c.restore();
    }
  }

  function sceneBreak(c: Ctx, t: number) {
    c.fillStyle = '#050407';
    c.fillRect(0, 0, W, H);
    const k = t - 168.6;
    const swell = easeInCubic(clamp((t - 171.2) / 0.65));
    const size = 18 + beat.pulse(t, 6) * 8 + swell * 400;
    const hp = heartPoint(640, 360, size);
    c.save();
    c.globalAlpha = clamp(k / 0.5);
    c.fillStyle = RED;
    c.shadowColor = RED;
    c.shadowBlur = 30;
    c.beginPath();
    for (let i = 0; i <= 48; i++) {
      const [x, y] = hp(i / 48);
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.fill();
    c.restore();
  }

  function sceneEnding(c: Ctx, t: number) {
    const k = clamp((t - 188.0) / 0.6);
    if (k <= 0) return;
    c.save();
    c.globalAlpha = k;
    c.fillStyle = 'rgba(12,10,16,0.72)';
    c.fillRect(0, 0, W, H);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    brushPath(c, (u) => [lerp(330, 950, u), 420 + Math.sin(u * 3) * 8], 40, easeOutCubic(k), 1212, RED, 0.9);
    setFont(c, 120, fonts.brush);
    textShadow(c, 30, 'rgba(0,0,0,0.9)');
    c.fillStyle = PAPER;
    c.fillText('サムライハート', 640, 330);
    setFont(c, 34, fonts.display);
    c.fillStyle = PAPER;
    c.fillText('AyaUke', 640, 428);
    c.restore();
  }

  function poster(c: Ctx) {
    sceneTitle(c, 8, true);
    c.save();
    c.textAlign = 'center';
    setFont(c, 20, fonts.ko, 600);
    c.fillStyle = 'rgba(242,235,224,0.8)';
    c.fillText('▶  아래 플레이어에서 재생하면 MV가 시작됩니다', 640, 640);
    c.restore();
  }

  // ── 메인 ────────────────────────────────────────────

  return {
    render(main, frame) {
      const b = ensureAssets(main);
      const s = main.canvas.width / W;
      b.setTransform(s, 0, 0, s, 0, 0);
      b.globalAlpha = 1;
      b.globalCompositeOperation = 'source-over';
      b.shadowBlur = 0;

      const t = frame.t;
      if (t === null) {
        poster(b);
        main.setTransform(1, 0, 0, 1, 0, 0);
        main.drawImage(buffer!, 0, 0);
        return;
      }

      const video = footageReady(frame.footage) ? frame.footage : null;
      const sec = sectionAt(SECTIONS, t);
      const chroma = keyframes(CHROMA_KEYS, t);
      const line = lineAt(LYRICS, t);

      switch (sec.id) {
        case 'intro':
          sceneTitle(b, t, false);
          break;
        case 'verse1':
        case 'pre1':
        case 'verse2':
          sceneCity(b, t, sec.id);
          break;
        case 'glass':
          sceneGlass(b, t, video, chroma);
          break;
        case 'chorus1':
        case 'chorus2':
        case 'final':
        case 'finale':
          sceneChorus(b, t, sec.id, video, chroma, sec.start);
          break;
        case 'post1':
          scenePost(b, t, video, chroma);
          break;
        case 'interlude':
          sceneInterlude(b, t, video, chroma);
          break;
        case 'quiet':
          sceneQuiet(b, t);
          break;
        case 'break':
          sceneBreak(b, t);
          break;
        case 'outro':
          b.fillStyle = INK;
          b.fillRect(0, 0, W, H);
          break;
      }

      const freeze = sec.id === 'verse1' ? freezeAmount(t) : 0;
      if (freeze > 0) {
        b.fillStyle = `rgba(8,6,12,${0.45 * freeze})`;
        b.fillRect(0, 0, W, H);
      }

      if (line && !(sec.id === 'finale' && t >= 187.9)) {
        if (sec.id === 'quiet') quietLyric(b, t, line);
        else if (['chorus1', 'chorus2', 'final', 'finale', 'post1'].includes(sec.id)) {
          const post = sec.id === 'post1';
          kineticLyric(b, t, line, post
            ? { cx: 900, cy: 330, maxW: 560, vertX: 1170, koX: 900, koAlign: 'center' }
            : { cx: 360, cy: 340, maxW: 580, vertX: 600, koX: 360, koAlign: 'center' });
        } else if (sec.id === 'verse1' && inRapid(t)) rapidLyric(b, t, line);
        else captionLyric(b, t, line, RED);
      }
      if (sec.id === 'finale') sceneEnding(b, t);

      // ── 합성: 흔들림 + 칼베기 분할 ──
      const low = env('low', t);
      const loud = ['chorus1', 'chorus2', 'final', 'finale', 'post1'].includes(sec.id);
      let shake = loud ? Math.pow(low, 2) * 9 : 0;
      // 빠른 구간: 단어마다 카메라가 툭툭 밀고 들어온다
      const rapidHit = lastRapidWord(t);
      const punchZoom = rapidHit ? (rapidHit.word.punch ? 0.08 : 0.03) * Math.exp(-rapidHit.age * 9) : 0;
      if (rapidHit?.word.punch) shake += 12 * Math.exp(-rapidHit.age * 8);
      let slash: { age: number; idx: number } | null = null;
      for (let i = SLASHES.length - 1; i >= 0; i--) {
        const age = t - SLASHES[i];
        if (age >= 0 && age < 0.6) {
          slash = { age, idx: i };
          break;
        }
      }
      if (slash) shake += 14 * Math.exp(-slash.age * 9);
      const sx = noise1(t * 28, 1) * shake;
      const sy = noise1(t * 28, 2) * shake;

      main.setTransform(1, 0, 0, 1, 0, 0);
      main.globalAlpha = 1;
      main.globalCompositeOperation = 'source-over';
      main.fillStyle = '#000';
      main.fillRect(0, 0, main.canvas.width, main.canvas.height);
      const over = 1 + (shake > 0 ? 0.03 : 0) + punchZoom;
      const ow = main.canvas.width * over;
      const oh = main.canvas.height * over;
      const ox = (main.canvas.width - ow) / 2 + sx * s;
      const oy = (main.canvas.height - oh) / 2 + sy * s;

      if (slash) {
        const ang = -0.42 + (hash(slash.idx * 5) - 0.5) * 0.5;
        const nx = -Math.sin(ang);
        const ny = Math.cos(ang);
        const open = slash.age < 0.07 ? 0 : 26 * Math.exp(-(slash.age - 0.07) * 6) * s;
        const cx = main.canvas.width / 2;
        const cy = main.canvas.height / 2;
        const far = main.canvas.width * 2;
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        for (const side of [1, -1]) {
          main.save();
          main.beginPath();
          main.moveTo(cx - dx * far, cy - dy * far);
          main.lineTo(cx + dx * far, cy + dy * far);
          main.lineTo(cx + dx * far + nx * far * side, cy + dy * far + ny * far * side);
          main.lineTo(cx - dx * far + nx * far * side, cy - dy * far + ny * far * side);
          main.closePath();
          main.clip();
          main.drawImage(buffer!, ox + nx * open * side + dx * open * side * 0.6, oy + ny * open * side + dy * open * side * 0.6, ow, oh);
          main.restore();
        }
        // 칼날 빛
        const la = slash.age < 0.07 ? slash.age / 0.07 : Math.exp(-(slash.age - 0.07) * 7);
        const reach = easeOutExpo(clamp(slash.age / 0.08));
        main.save();
        main.globalAlpha = la;
        main.strokeStyle = '#ffffff';
        main.shadowColor = '#ffffff';
        main.shadowBlur = 24 * s;
        main.lineWidth = 4 * s;
        main.beginPath();
        main.moveTo(cx - dx * far, cy - dy * far);
        main.lineTo(cx - dx * far + dx * far * 2 * reach, cy - dy * far + dy * far * 2 * reach);
        main.stroke();
        main.restore();
      } else {
        main.drawImage(buffer!, ox, oy, ow, oh);
      }

      // 섬광
      let flash = 0;
      for (const f of FLASHES) {
        const a = t - f;
        if (a >= 0 && a < 1) flash = Math.max(flash, Math.exp(-a * 5));
      }
      flash = Math.max(flash, Math.pow(invLerp(149.9, 150.65, t), 2) * (t < 150.65 ? 1 : 0));
      if (flash > 0.01) {
        main.globalAlpha = flash * 0.85;
        main.fillStyle = '#fffaf2';
        main.fillRect(0, 0, main.canvas.width, main.canvas.height);
        main.globalAlpha = 1;
      }

      // 비네트 + 필름 그레인
      main.drawImage(vignette!, 0, 0, main.canvas.width, main.canvas.height);
      if (grain) {
        main.save();
        const jitter = Math.floor(t * 24);
        main.translate((hash(jitter) * 200) | 0, (hash(jitter + 9) * 200) | 0);
        main.globalAlpha = 0.07;
        main.globalCompositeOperation = 'overlay';
        main.fillStyle = grain;
        main.fillRect(-200, -200, main.canvas.width + 400, main.canvas.height + 400);
        main.restore();
      }

      // 시작/끝 페이드
      const fade = Math.max(1 - clamp(t / 0.6), clamp((t - 190.4) / 1.2));
      if (fade > 0) {
        main.globalAlpha = fade;
        main.fillStyle = '#000';
        main.fillRect(0, 0, main.canvas.width, main.canvas.height);
        main.globalAlpha = 1;
      }
    },
  };
}
