// 踊 MV 렌더러 — 지금은 뼈대(콘티 영상) 단계.
// 콘셉트(PLAN.md): 오늘 밤 한 번의 공연 — 암전 속에서 박자마다 불이 켜진다. 바탕은 검정, 빛의 색은 아껴서 늘린다.
// 장면마다 DRAW에 그리는 함수를 채워 나가고, 아직 없는 장면은 콘티(그 장면의 빛 색 + 기법 힌트 + 장면 설명 + 마디·박 표시)로 그린다.
import type { MvClipContext, MvLyricLine, MvRenderer } from '../../types';
import { TAU, beatGrid, chunksShown, clamp, decodeEnvelope, fitSize, hash, lineAt, setFont } from '../../engine';
import { ENVELOPE } from './envelope';
import { BEAT_PERIOD, BEAT_PHASE, CUES, type Cues, type Glow, LYRICS, type SceneSpan, scenesOf } from './timeline';

type Ctx = CanvasRenderingContext2D;

export const W = 1280;
export const H = 720;

/** 빛의 색 */
export const GLOW: Record<Glow, string> = {
  white: '#f6f4ff',
  violet: '#b46bff',
  cyan: '#35e0ff',
  yellow: '#ffe14a',
  pink: '#ff4f9a',
  green: '#3dff8f',
  gray: '#8a8a92',
};

export interface SceneFonts {
  /** 일본어 가사 자막 (Zen Kaku Gothic New 900) */
  ja: string;
  /** 큰 글자·제목 (Dela Gothic One) */
  display: string;
  /** 한국어 번역·콘티 설명 */
  ko: string;
}

/** 장면 함수가 받는 것 */
export interface SceneFrame {
  t: number;
  /** 장면 안 진행 0→1 (겹쳐 사라지는 동안엔 1을 넘어 계속 간다) */
  k: number;
  /** 장면 시작 후 초 */
  age: number;
  span: SceneSpan;
  video: HTMLVideoElement | null;
  beat: ReturnType<typeof beatGrid>;
  C: Cues;
}

type SceneFn = (c: Ctx, f: SceneFrame) => void;

export function createOdoRenderer(clip: MvClipContext, fonts: SceneFonts): MvRenderer {
  const rawEnv = decodeEnvelope(ENVELOPE);
  let lines = LYRICS;
  let C: Cues = CUES;
  let scenes = scenesOf(C);
  let beat = beatGrid(BEAT_PERIOD, BEAT_PHASE + C.beatOffset);
  const env = (ch: Parameters<typeof rawEnv>[0], t: number) => rawEnv(ch, t);

  function derive() {
    scenes = scenesOf(C);
    beat = beatGrid(BEAT_PERIOD, BEAT_PHASE + C.beatOffset);
  }

  const sceneAt = (t: number) => scenes.find((s) => t >= s.start && t < s.end) ?? scenes[scenes.length - 1];

  // ── 원본 영상(아야) ─────────────────────────────────

  const footageReady = (v: HTMLVideoElement | null): v is HTMLVideoElement =>
    !!v && v.readyState >= 2 && v.videoWidth > 0;

  /** 방송 화면에서 아바타 부분(왼쪽 채팅 제외, x 0.285~0.84)만 (x,y,w,h)에 꽉 채워 그린다 */
  function drawFootage(c: Ctx, video: HTMLVideoElement, x: number, y: number, w: number, h: number) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const rx = vw * 0.285;
    const rw = vw * 0.555;
    let sw = rw;
    let sh = rw / (w / h);
    if (sh > vh) {
      sh = vh;
      sw = vh * (w / h);
    }
    const sx = rx + (rw - sw) / 2;
    const sy = Math.max(0, (vh - sh) * 0.3);
    c.drawImage(video, sx, sy, sw, sh, x, y, w, h);
  }

  // ── 공용 그리기 ─────────────────────────────────────

  /** 부드러운 빛 덩이 — 가장자리는 같은 색의 투명으로(검정 투명이면 회색 띠가 생긴다) */
  function blob(c: Ctx, x: number, y: number, r: number, color: string, alpha: number) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, `${color}00`);
    c.globalAlpha = alpha;
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.globalAlpha = 1;
  }

  /** 박에 맞춰 팔을 번갈아 드는 막대 사람(콘티용) */
  function stick(c: Ctx, x: number, y: number, s: number, color: string, t: number, seed: number) {
    const step = beat.index(t) + seed;
    const bounce = beat.pulse(t, 5) * 10 * s;
    const up = step % 2 === 0;
    c.save();
    c.translate(x, y - bounce);
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = 9 * s;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(0, -118 * s, 17 * s, 0, TAU);
    c.fill();
    c.beginPath();
    c.moveTo(0, -92 * s);
    c.lineTo(0, -34 * s);
    c.moveTo(0, -34 * s);
    c.lineTo(-20 * s, 0);
    c.moveTo(0, -34 * s);
    c.lineTo(20 * s, 0);
    c.moveTo(0, -82 * s);
    c.lineTo(-34 * s, up ? -122 * s : -52 * s);
    c.moveTo(0, -82 * s);
    c.lineTo(34 * s, up ? -52 * s : -122 * s);
    c.stroke();
    c.restore();
  }

  // ── 장면 ────────────────────────────────────────────

  /** 완성한 장면은 여기에 id로 넣는다. 없으면 콘티로 그린다 */
  const DRAW: Partial<Record<string, SceneFn>> = {};

  /** 콘티: 검정 바탕 + 그 장면의 빛 색 + 기법 힌트 + 장면 번호·설명·구도 + 마디·박 */
  function storyboard(c: Ctx, f: SceneFrame) {
    const { def, index } = f.span;
    const { t } = f;
    const inverted = def.id === 'jumpCrowd';
    const colors = def.glow.map((g) => GLOW[g]);
    const main = colors[0];
    const pulse = beat.pulse(t, 5);
    const low = env('low', t);

    c.fillStyle = inverted ? '#f6f4ff' : '#050408';
    c.fillRect(0, 0, W, H);

    // 빛: 색마다 한 덩이, 박에 맞춰 밝아진다
    if (!inverted) {
      colors.forEach((col, i) => {
        const x = W * ((i + 0.5) / colors.length) + Math.sin(f.age * 0.5 + i * 2) * 60;
        const y = H * 0.48 + Math.cos(f.age * 0.4 + i) * 40;
        blob(c, x, y, 300 + low * 120, col, 0.1 + 0.22 * pulse);
      });
    }

    const ink = inverted ? '#0b0a10' : main;

    if (def.tech.includes('미터')) {
      const n = 40;
      const bw = W / n;
      for (let i = 0; i < n; i++) {
        const v = clamp(env(i % 3 === 0 ? 'low' : i % 3 === 1 ? 'rms' : 'high', t - i * 0.03));
        c.globalAlpha = 0.5;
        c.fillStyle = colors[i % colors.length];
        c.fillRect(i * bw + 3, H - 90 - v * 300, bw - 6, v * 300);
      }
      c.globalAlpha = 1;
    }
    if (def.tech.includes('분할')) {
      c.strokeStyle = ink;
      c.globalAlpha = 0.35;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(W / 2, 130);
      c.lineTo(W / 2, H - 110);
      c.moveTo(60, H / 2);
      c.lineTo(W - 60, H / 2);
      c.stroke();
      c.globalAlpha = 1;
    }
    if (def.tech.includes('전광판')) {
      c.fillStyle = main;
      for (let y = 0; y < 7; y++)
        for (let x = 0; x < 80; x++) {
          c.globalAlpha = hash(x * 13 + y * 7 + Math.floor(t * 8)) > 0.55 ? 0.8 : 0.12;
          c.beginPath();
          c.arc(48 + x * 15, 190 + y * 15, 4.5, 0, TAU);
          c.fill();
        }
      c.globalAlpha = 1;
    }
    if (def.tech.includes('입자')) {
      for (let i = 0; i < 60; i++) {
        const x = hash(index * 31 + i * 7) * W;
        const y = (hash(index * 17 + i * 11) * (H + 40) + t * (90 + hash(i) * 140)) % (H + 40) - 20;
        c.globalAlpha = 0.7;
        c.fillStyle = colors[i % colors.length];
        c.fillRect(x, y, 7, 11);
      }
      c.globalAlpha = 1;
    }
    if (def.tech.includes('영상')) {
      const fw = 460;
      const fh = 300;
      const fx = W / 2 - fw / 2;
      const fy = 190;
      c.fillStyle = main;
      c.globalAlpha = 0.35 + 0.5 * pulse;
      c.fillRect(fx - 6, fy - 6, fw + 12, fh + 12);
      c.globalAlpha = 1;
      if (f.video) drawFootage(c, f.video, fx, fy, fw, fh);
      else {
        c.fillStyle = '#1c1626';
        c.fillRect(fx, fy, fw, fh);
      }
    }
    const people = def.tech.includes('댄서') ? 3 : def.tech.includes('픽토') ? 1 : def.tech.includes('실루엣') ? 5 : 0;
    for (let i = 0; i < people; i++) {
      const x = W / 2 + (i - (people - 1) / 2) * (people > 3 ? 150 : 210);
      stick(c, x, H - 150, people > 3 ? 0.9 : 1.3, inverted ? '#0b0a10' : colors[i % colors.length], t, i);
    }
    if (def.tech.includes('타이포')) {
      // 지금 부르는 덩어리를 크게 — 덩어리가 바뀌는 순간 튄다
      const line = lineAt(lines, t);
      if (line) {
        const n = chunksShown(line, t);
        const ch = line.ja[Math.max(0, n - 1)];
        const pop = 1 + 0.25 * Math.exp(-(t - ch.t) * 9);
        const text = ch.text.trim();
        const size = fitSize(c, text, fonts.display, 150, 1000, 400);
        c.save();
        c.translate(W / 2, 400);
        c.scale(pop, pop);
        setFont(c, size, fonts.display, 400);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.globalAlpha = 0.9;
        c.fillStyle = ink;
        c.fillText(text, 0, 0);
        c.restore();
      }
    }
    if (def.tech.includes('네온')) {
      c.save();
      c.strokeStyle = main;
      c.shadowColor = main;
      c.shadowBlur = 24;
      c.lineWidth = 4;
      c.globalAlpha = hash(Math.floor(t * 24) + index) > 0.12 ? 0.9 : 0.25;
      c.strokeRect(34, 24, W - 68, 108);
      c.restore();
    }
    if (def.tech.includes('빛') && !inverted) {
      c.globalAlpha = 0.14 * pulse;
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
    }

    // 장면 번호·설명
    c.save();
    c.fillStyle = inverted ? 'rgba(11,10,16,0.9)' : 'rgba(246,244,255,0.92)';
    c.textBaseline = 'top';
    setFont(c, 64, fonts.ko, 800);
    c.globalAlpha = 0.4;
    c.fillText(String(index).padStart(2, '0'), 52, 40);
    c.globalAlpha = 1;
    setFont(c, 24, fonts.ko, 700);
    c.fillText(def.what, 148, 46, W - 330);
    setFont(c, 18, fonts.ko, 500);
    c.globalAlpha = 0.75;
    c.fillText(`${def.shot}  ·  ${def.tech.join(' + ') || '—'}  ·  ${def.id}`, 148, 84, W - 330);

    // 마디·박 표시(마디 첫 박은 크게) + 장면 진행 막대
    const idx = beat.index(t);
    const inBar = ((idx % 4) + 4) % 4;
    setFont(c, 18, fonts.ko, 700);
    c.textAlign = 'right';
    c.globalAlpha = 0.8;
    c.fillText(`마디 ${Math.floor(idx / 4)} · 박 ${inBar + 1}`, W - 84, 48);
    c.globalAlpha = 0.3 + 0.7 * pulse;
    c.beginPath();
    c.arc(W - 58, 58, inBar === 0 ? 13 : 7, 0, TAU);
    c.fill();
    c.globalAlpha = 0.4;
    c.fillRect(0, H - 4, W * clamp(f.k), 4);
    c.restore();
  }

  // ── 가사 ────────────────────────────────────────────

  /** 아래 가운데 자막 — 덩어리가 순서대로 튀어나오고, 한국어는 그 아래. 흰 바탕 장면에서도 읽히게 검은 테두리 */
  function caption(c: Ctx, t: number, line: MvLyricLine) {
    const out = clamp((line.end + 0.25 - t) / 0.25);
    const shown = chunksShown(line, t);
    const full = line.ja.map((j) => j.text).join('');
    const size = fitSize(c, full, fonts.ja, 42, 1100, 900);
    c.save();
    setFont(c, size, fonts.ja, 900);
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    c.lineJoin = 'round';
    let x = W / 2 - c.measureText(full).width / 2;
    const y = 630;
    for (let i = 0; i < line.ja.length; i++) {
      const ch = line.ja[i];
      const w = c.measureText(ch.text).width;
      if (i < shown) {
        const k = clamp((t - ch.t) / 0.12);
        c.globalAlpha = out * k;
        c.lineWidth = 7;
        c.strokeStyle = 'rgba(5,4,8,0.85)';
        c.strokeText(ch.text, x, y - (1 - k) * 14);
        c.fillStyle = '#ffffff';
        c.fillText(ch.text, x, y - (1 - k) * 14);
      }
      x += w;
    }
    if (line.ko) {
      c.globalAlpha = out * clamp((t - line.t) * 6);
      setFont(c, 21, fonts.ko, 700);
      c.textAlign = 'center';
      c.lineWidth = 5;
      c.strokeStyle = 'rgba(5,4,8,0.85)';
      c.strokeText(line.ko, W / 2, 670);
      c.fillStyle = 'rgba(255,255,255,0.92)';
      c.fillText(line.ko, W / 2, 670);
    }
    c.restore();
  }

  // ── 제목·엔딩 ───────────────────────────────────────

  function titleCard(c: Ctx, alpha: number, date: boolean, color = GLOW.pink) {
    c.save();
    c.globalAlpha = alpha;
    c.textAlign = 'center';
    c.shadowColor = color;
    c.shadowBlur = 34;
    c.fillStyle = '#fff5fb';
    setFont(c, 150, fonts.display, 400);
    c.fillText('踊', W / 2, 372);
    c.shadowBlur = 0;
    setFont(c, 22, fonts.ko, 600);
    c.fillStyle = 'rgba(246,244,255,0.85)';
    c.fillText(date && clip.sungDateLabel ? `Ado · AyaUke cover · ${clip.sungDateLabel}` : 'Ado · AyaUke cover', W / 2, 432);
    c.restore();
  }

  function poster(c: Ctx) {
    c.fillStyle = '#050408';
    c.fillRect(0, 0, W, H);
    blob(c, W / 2, 330, 420, GLOW.violet, 0.22);
    titleCard(c, 1, true);
    c.save();
    c.textAlign = 'center';
    setFont(c, 20, fonts.ko, 600);
    c.fillStyle = 'rgba(246,244,255,0.75)';
    c.fillText('▶  아래 플레이어에서 재생하면 MV가 시작됩니다', W / 2, 640);
    c.restore();
  }

  // ── 메인 ────────────────────────────────────────────

  return {
    setLyrics(next) {
      lines = next;
    },
    setCues(next) {
      C = { ...C, ...next };
      derive();
    },
    scenes: () => scenes.map(({ id, start, end }) => ({ id, start, end })),
    render(main, frame) {
      const s = main.canvas.width / W;
      main.setTransform(s, 0, 0, s, 0, 0);
      main.globalAlpha = 1;
      main.globalCompositeOperation = 'source-over';
      main.shadowBlur = 0;

      const t = frame.t;
      if (t === null) {
        poster(main);
        return;
      }

      const span = sceneAt(t);
      const f: SceneFrame = {
        t,
        k: Math.max(0, (t - span.start) / Math.max(0.01, span.end - span.start)),
        age: t - Math.max(0, span.start),
        span,
        video: footageReady(frame.footage) ? frame.footage : null,
        beat,
        C,
      };
      (DRAW[span.id] ?? storyboard)(main, f);

      // 화면 전체 효과는 자막보다 먼저(자막이 묻히지 않게)
      main.setTransform(1, 0, 0, 1, 0, 0);
      // 「K.O.」 뒤 고음 — 백색 반전(콘티에선 섬광으로)
      const flash = t >= C.scream ? Math.exp(-(t - C.scream) * 3.5) : 0;
      // 최고음을 끄는 동안 — 빛기둥(콘티에선 가운데 흰 띠가 넓어짐)
      const hold = clamp((t - C.peak) / 1.9);
      if (t >= C.peak && t < C.peak + 2.6) {
        const w = main.canvas.width * (0.06 + 0.5 * hold);
        main.globalAlpha = 0.5 * (1 - clamp((t - C.peak - 1.9) / 0.7));
        main.fillStyle = '#ffffff';
        main.fillRect(main.canvas.width / 2 - w / 2, 0, w, main.canvas.height);
      }
      if (flash > 0.01) {
        main.globalAlpha = flash * 0.9;
        main.fillStyle = '#ffffff';
        main.fillRect(0, 0, main.canvas.width, main.canvas.height);
      }
      main.globalAlpha = 1;
      main.setTransform(s, 0, 0, s, 0, 0);

      // 제목: 네온이 지지직 켜진다
      if (span.id === 'neonTitle' && t >= C.titleIn) {
        const on = t - C.titleIn > 0.7 || hash(Math.floor(t * 30)) > 0.45;
        titleCard(main, on ? 1 : 0.15, false);
      }
      if (t >= C.endTitle) titleCard(main, clamp((t - C.endTitle) / 1.2), true, GLOW.green);

      const line = lineAt(lines, t);
      if (line && t < C.endTitle) caption(main, t, line);

      main.setTransform(1, 0, 0, 1, 0, 0);
      // 시작/끝 페이드
      const fade = Math.max(1 - clamp(t / 0.3), clamp((t - C.outro) / 1.6));
      if (fade > 0) {
        main.globalAlpha = fade;
        main.fillStyle = '#000';
        main.fillRect(0, 0, main.canvas.width, main.canvas.height);
      }
      main.globalAlpha = 1;
    },
  };
}
