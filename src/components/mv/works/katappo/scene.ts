// 片っぽ MV 렌더러 — 지금은 뼈대(콘티 영상) 단계.
// 콘셉트(PLAN.md): 겨울에 사는 나 ↔ 햇빛 속의 너(해바라기). 화면의 반쪽 규칙, 금색은 마지막 후렴까지 아낀다.
// 장면마다 DRAW에 그리는 함수를 채워 나가고, 아직 없는 장면은 콘티(온도 배경 + 장면 설명 + 박자 표시)로 그린다.
import type { MvClipContext, MvLyricLine, MvRenderer } from '../../types';
import {
  TAU, beatGrid, chunksShown, clamp, decodeEnvelope, easeOutCubic, fitSize, hash, invLerp, lineAt, noise1, setFont,
} from '../../engine';
import { ENVELOPE } from './envelope';
import {
  BEAT_PERIOD, BEAT_PHASE, CUES, type Cues, LYRICS, type SceneSpan, type Tone, cutWithin, scenesOf,
} from './timeline';

type Ctx = CanvasRenderingContext2D;

export const W = 1280;
export const H = 720;

const SNOW = '#f4f7fb';
const GOLD = '#f2b632';
const PETAL = '#f5a623';

/** 온도별 배경 [위, 아래] */
const TONES: Record<Tone, [string, string]> = {
  frost: ['#e3e9f0', '#a3b3c6'],
  winter: ['#c4d2e0', '#5f7695'],
  sun: ['#ffe7a3', '#e48a2a'],
  room: ['#3b3442', '#1b1720'],
  dark: ['#0a090c', '#000000'],
  bloom: ['#ffe38a', '#f07c16'],
};

export interface SceneFonts {
  /** 일본어 가사 (Shippori Mincho) */
  ja: string;
  /** 한국어 번역·콘티 설명 */
  ko: string;
}

/** 장면 함수가 받는 것 */
export interface SceneFrame {
  t: number;
  /** 장면 안 진행 0→1 */
  k: number;
  /** 장면 시작 후 초 */
  age: number;
  span: SceneSpan;
  video: HTMLVideoElement | null;
  beat: ReturnType<typeof beatGrid>;
  C: Cues;
}

type SceneFn = (c: Ctx, f: SceneFrame) => void;

export function createKatappoRenderer(clip: MvClipContext, fonts: SceneFonts): MvRenderer {
  const rawEnv = decodeEnvelope(ENVELOPE);
  let lines = LYRICS;
  let C: Cues = CUES;
  let scenes = scenesOf(lines, C);
  let beat = beatGrid(BEAT_PERIOD, BEAT_PHASE + C.beatOffset);
  const env = (ch: Parameters<typeof rawEnv>[0], t: number) => rawEnv(ch, t - C.beatOffset);

  function derive() {
    scenes = scenesOf(lines, C);
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
    const sy = Math.max(0, (vh - sh) * 0.35);
    c.drawImage(video, sx, sy, sw, sh, x, y, w, h);
  }

  // ── 공용 그리기 ─────────────────────────────────────

  function fillTone(c: Ctx, tone: Tone, x = 0, y = 0, w = W, h = H) {
    const [top, bottom] = TONES[tone];
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
  }

  /** 눈(차가운 장면)·꽃잎(따뜻한 장면) — 시각만으로 위치가 정해진다 */
  function particles(c: Ctx, t: number, warm: boolean, count: number, seed: number) {
    c.save();
    for (let i = 0; i < count; i++) {
      const sp = 40 + hash(seed + i * 3) * 70;
      const x = (hash(seed + i * 7) * (W + 80) + noise1(t * 0.4 + i, seed) * 40 + t * (warm ? 18 : 6)) % (W + 80) - 40;
      const y = (hash(seed + i * 11) * (H + 80) + t * sp) % (H + 80) - 40;
      const r = 2 + hash(seed + i * 13) * (warm ? 7 : 4);
      c.globalAlpha = 0.35 + hash(seed + i * 17) * 0.5;
      c.fillStyle = warm ? PETAL : SNOW;
      c.beginPath();
      if (warm) c.ellipse(x, y, r * 1.6, r * 0.7, t * (0.5 + hash(i)) + i, 0, TAU);
      else c.arc(x, y, r, 0, TAU);
      c.fill();
    }
    c.restore();
  }

  function textShadow(c: Ctx, blur: number) {
    c.shadowColor = 'rgba(0,0,0,0.55)';
    c.shadowBlur = blur;
  }

  // ── 장면 ────────────────────────────────────────────

  /** 완성한 장면은 여기에 id로 넣는다. 없으면 콘티로 그린다 */
  const DRAW: Partial<Record<string, SceneFn>> = {};

  /** 콘티: 온도 배경 + 기법 힌트(입자·영상 틀) + 장면 번호·설명·구도 */
  function storyboard(c: Ctx, f: SceneFrame) {
    const { def, index } = f.span;
    if (Array.isArray(def.tone)) {
      const [a, b] = def.tone;
      const lr = def.split !== 'tb';
      fillTone(c, a, 0, 0, lr ? W / 2 : W, lr ? H : H / 2);
      fillTone(c, b, lr ? W / 2 : 0, lr ? 0 : H / 2, lr ? W / 2 : W, lr ? H : H / 2);
      c.fillStyle = 'rgba(255,255,255,0.7)';
      if (lr) c.fillRect(W / 2 - 1, 0, 2, H);
      else c.fillRect(0, H / 2 - 1, W, 2);
    } else fillTone(c, def.tone);

    const warm = ['sun', 'bloom'].includes(Array.isArray(def.tone) ? def.tone[1] : def.tone);
    if (def.tech.includes('입자')) particles(c, f.t, warm, warm ? 46 : 70, index * 101);
    if (def.tech.includes('영상')) {
      const fw = 420;
      const fh = 300;
      const fx = W / 2 - fw / 2 + Math.sin(f.age * 0.4) * 30;
      const fy = 150;
      c.fillStyle = '#f7f3ea';
      c.fillRect(fx - 14, fy - 14, fw + 28, fh + 64);
      if (f.video) drawFootage(c, f.video, fx, fy, fw, fh);
      else {
        c.fillStyle = '#2a2430';
        c.fillRect(fx, fy, fw, fh);
      }
    }

    // 장면 번호·설명
    const light = !['room', 'dark'].includes(Array.isArray(def.tone) ? def.tone[0] : def.tone);
    c.save();
    c.fillStyle = light ? 'rgba(20,24,34,0.82)' : 'rgba(245,240,232,0.85)';
    c.textBaseline = 'top';
    setFont(c, 64, fonts.ko, 800);
    c.globalAlpha = 0.35;
    c.fillText(String(index).padStart(2, '0'), 48, 36);
    c.globalAlpha = 1;
    setFont(c, 26, fonts.ko, 700);
    c.fillText(def.what, 140, 44);
    setFont(c, 18, fonts.ko, 500);
    c.globalAlpha = 0.75;
    c.fillText(`${def.shot}  ·  ${def.tech.join(' + ') || '—'}  ·  ${def.id}`, 140, 82);
    if (def.id === 'tears') {
      const cut = cutWithin(lines[37], f.t);
      c.fillText(`컷 ${cut.n + 1}/4`, 140, 108);
    }
    c.restore();

    // 장면 진행 막대 + 박 표시(마디 첫 박은 크게)
    c.fillStyle = light ? 'rgba(20,24,34,0.35)' : 'rgba(255,255,255,0.3)';
    c.fillRect(0, H - 4, W * f.k, 4);
    const down = ((beat.index(f.t) % 4) + 4) % 4 === 0;
    c.globalAlpha = 0.25 + 0.6 * beat.pulse(f.t);
    c.beginPath();
    c.arc(W - 52, 56, down ? 12 : 7, 0, TAU);
    c.fill();
    c.globalAlpha = 1;
  }

  // ── 가사 ────────────────────────────────────────────

  /** 아래 가운데 자막 — 덩어리가 순서대로 떠오르고, 한국어는 그 아래 */
  function caption(c: Ctx, t: number, line: MvLyricLine) {
    const out = clamp((line.end + 0.35 - t) / 0.35);
    const shown = chunksShown(line, t);
    const full = line.ja.map((j) => j.text).join('');
    const size = fitSize(c, full, fonts.ja, 44, 1100, 600);
    c.save();
    setFont(c, size, fonts.ja, 600);
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    let x = W / 2 - c.measureText(full).width / 2;
    const y = 628;
    textShadow(c, 16);
    for (let i = 0; i < line.ja.length; i++) {
      const ch = line.ja[i];
      const w = c.measureText(ch.text).width;
      if (i < shown) {
        const k = easeOutCubic(clamp((t - ch.t) / 0.4));
        c.globalAlpha = out * k;
        c.fillStyle = '#fffaf0';
        c.fillText(ch.text, x, y + (1 - k) * 10);
      }
      x += w;
    }
    if (line.ko) {
      c.globalAlpha = out * clamp((t - line.t) * 3);
      setFont(c, 21, fonts.ko, 600);
      c.textAlign = 'center';
      c.fillStyle = 'rgba(255,255,255,0.88)';
      c.fillText(line.ko, W / 2, 670);
    }
    c.restore();
  }

  // ── 제목·엔딩 ───────────────────────────────────────

  function titleCard(c: Ctx, alpha: number, date: boolean) {
    c.save();
    c.globalAlpha = alpha;
    c.textAlign = 'center';
    textShadow(c, 18);
    c.fillStyle = '#fffaf0';
    setFont(c, 96, fonts.ja, 600);
    c.fillText('片っぽ', W / 2, 340);
    setFont(c, 22, fonts.ko, 600);
    c.fillStyle = 'rgba(255,250,240,0.85)';
    c.fillText(date && clip.sungDateLabel ? `eill · AyaUke cover · ${clip.sungDateLabel}` : 'eill · AyaUke cover', W / 2, 392);
    c.restore();
  }

  function poster(c: Ctx) {
    fillTone(c, 'frost');
    titleCard(c, 1, true);
    c.save();
    c.textAlign = 'center';
    setFont(c, 20, fonts.ko, 600);
    c.fillStyle = 'rgba(20,24,34,0.75)';
    c.fillText('▶  아래 플레이어에서 재생하면 MV가 시작됩니다', W / 2, 640);
    c.restore();
  }

  // ── 메인 ────────────────────────────────────────────

  return {
    setLyrics(next) {
      lines = next;
      derive();
    },
    setCues(next) {
      C = { ...C, ...next };
      derive();
    },
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
        k: clamp((t - span.start) / Math.max(0.01, span.end - span.start)),
        age: t - Math.max(0, span.start),
        span,
        video: footageReady(frame.footage) ? frame.footage : null,
        beat,
        C,
      };
      (DRAW[span.id] ?? storyboard)(main, f);

      if (span.id === 'frost') titleCard(main, clamp((t - C.titleIn) / 1.2) * (1 - invLerp(f.span.end - 1.2, f.span.end, t)), false);
      if (t >= C.endTitle) titleCard(main, clamp((t - C.endTitle) / 1.5), true);

      const line = lineAt(lines, t);
      if (line && span.id !== 'hush' && t < C.endTitle) caption(main, t, line);

      // 마지막 후렴 폭발 섬광 · 최고음 금빛
      const flash = t >= C.climax ? Math.exp(-(t - C.climax) * 4) : 0;
      const glow = Math.exp(-Math.pow((t - C.peak) / 1.4, 2)) * (0.4 + 0.6 * env('rms', t));
      main.setTransform(1, 0, 0, 1, 0, 0);
      if (glow > 0.01) {
        main.globalAlpha = glow * 0.45;
        main.globalCompositeOperation = 'screen';
        main.fillStyle = GOLD;
        main.fillRect(0, 0, main.canvas.width, main.canvas.height);
        main.globalCompositeOperation = 'source-over';
      }
      if (flash > 0.01) {
        main.globalAlpha = flash * 0.9;
        main.fillStyle = '#fffaf0';
        main.fillRect(0, 0, main.canvas.width, main.canvas.height);
      }

      // 시작/끝 페이드
      const fade = Math.max(1 - clamp(t / 0.6), clamp((t - C.outro) / 2));
      if (fade > 0) {
        main.globalAlpha = fade;
        main.fillStyle = '#000';
        main.fillRect(0, 0, main.canvas.width, main.canvas.height);
      }
      main.globalAlpha = 1;
    },
  };
}
