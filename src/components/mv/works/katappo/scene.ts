// 片っぽ MV 렌더러.
// 콘셉트(PLAN.md): 겨울에 사는 나 ↔ 햇빛 속의 너(해바라기). 화면의 반쪽 규칙, 금색은 마지막 후렴까지 아낀다.
// 장면 그리기는 scenes1~3.ts(PLAN.md 표 번호 순), 아직 없는 장면은 콘티(온도 배경 + 장면 설명 + 박 표시)로 그린다.
import type { MvClipContext, MvLyricLine, MvRenderer } from '../../types';
import { TAU, beatGrid, chunksShown, clamp, decodeEnvelope, easeOutCubic, fitSize, hash, lineAt, noise1, setFont } from '../../engine';
import { paperGrain } from '../../paint';
import { ENVELOPE } from './envelope';
import { COL, type Ctx, H, type Kit, type SceneFn, type SceneFrame, W } from './kit';
import { scenes1 } from './scenes1';
import { scenes2 } from './scenes2';
import { scenes3 } from './scenes3';
import { BEAT_PERIOD, BEAT_PHASE, CUES, type Cues, LYRICS, type SceneSpan, type Tone, cutWithin, scenesOf } from './timeline';

export { W, H };

/** 콘티용 온도별 배경 [위, 아래] */
const TONES: Record<Tone, [string, string]> = {
  frost: ['#e3e9f0', '#a3b3c6'],
  winter: ['#c4d2e0', '#5f7695'],
  sun: ['#ffe7a3', '#e48a2a'],
  room: ['#3b3442', '#1b1720'],
  dark: ['#0a090c', '#000000'],
  bloom: ['#ffe38a', '#f07c16'],
};

/** 가사를 장면이 직접 그리는 곳 — 일본어 자막은 숨기고(ko만), 무음엔 둘 다 없음 */
const OWN_JA = new Set(['scatterRing', 'crackedWords', 'scatterPull']);
const NO_LYRICS = new Set(['hush']);
/** 밝은 화면 — 자막을 짙은 먹색 + 흰 번짐으로 */
const INK_CAPTION = new Set(['morningBack', 'hands', 'halfAlone', 'crackedWords', 'footprints', 'standing', 'winterCore', 'coda']);

/** 원본 영상을 여러 칸에 쓰는 장면 — 이 근처에서만 지난 화면을 기억해 둔다 */
const FOOTAGE = new Set(['polaroids', 'filmStrip', 'flowerFootage']);

/** 앞 장면이 이만큼(초) 겹치며 사라지는 장면 */
const DISSOLVE: Record<string, number> = {
  unfinishedMap: 0.5,
  morningBack: 0.6,
  footprints: 0.8,
  standing: 0.7,
  bridgeVase: 1.0,
  warmLight: 0.8,
  coda: 1.2,
};

export interface SceneFonts {
  /** 일본어 가사 (Shippori Mincho) */
  ja: string;
  /** 한국어 번역·콘티 설명 */
  ko: string;
}

export function createKatappoRenderer(clip: MvClipContext, fonts: SceneFonts): MvRenderer {
  const rawEnv = decodeEnvelope(ENVELOPE);
  let lines = LYRICS;
  let C: Cues = CUES;
  let scenes = scenesOf(lines, C);
  let beat = beatGrid(BEAT_PERIOD, BEAT_PHASE + C.beatOffset);

  function derive() {
    scenes = scenesOf(lines, C);
    beat = beatGrid(BEAT_PERIOD, BEAT_PHASE + C.beatOffset);
  }

  const sceneAt = (t: number) => scenes.find((s) => t >= s.start && t < s.end) ?? scenes[scenes.length - 1];

  const footageReady = (v: HTMLVideoElement | null): v is HTMLVideoElement => !!v && v.readyState >= 2 && v.videoWidth > 0;

  // ── 원본 화면 기억 ──────────────────────────────────
  // 같은 영상을 여러 칸(폴라로이드·필름)에 쓸 때 칸마다 다른 순간을 보여 주려고, 원본 장면 근처에서
  // 지난 HISTORY_SEC초의 아바타 부분을 작게(HISTORY_W) 찍어 둔다. 넘기기(시각이 튐)하면 비운다.
  const HISTORY_SEC = 4.5;
  const HISTORY_FPS = 12;
  const HISTORY_W = 360;
  const history: { t: number; canvas: HTMLCanvasElement }[] = [];
  let spare: HTMLCanvasElement[] = [];
  let lastT = -Infinity;
  let nowT = 0;
  const avatarRect = (vw: number) => [vw * 0.285, vw * 0.555] as const;

  function remember(video: HTMLVideoElement | null, t: number) {
    nowT = t;
    if (t < lastT - 0.1 || t > lastT + 1) {
      spare.push(...history.map((h) => h.canvas));
      history.length = 0;
    }
    lastT = t;
    const near = FOOTAGE.has(sceneAt(t).id) || FOOTAGE.has(sceneAt(t + HISTORY_SEC).id);
    if (!near) {
      if (history.length) {
        spare.push(...history.map((h) => h.canvas));
        history.length = 0;
      }
      if (spare.length) spare = [];
      return;
    }
    if (!footageReady(video)) return;
    const last = history[history.length - 1];
    if (last && t - last.t < 1 / HISTORY_FPS) return;
    const [rx, rw] = avatarRect(video.videoWidth);
    const old = history.length >= HISTORY_SEC * HISTORY_FPS ? history.shift()!.canvas : null;
    const cv = old ?? spare.pop() ?? document.createElement('canvas');
    cv.width = HISTORY_W;
    cv.height = Math.round((HISTORY_W * video.videoHeight) / rw);
    cv.getContext('2d')!.drawImage(video, rx, 0, rw, video.videoHeight, 0, 0, cv.width, cv.height);
    history.push({ t, canvas: cv });
  }

  /** at초 무렵의 기억 — 그보다 앞선 것 중 가장 늦은 것, 기억이 거기까지 안 닿으면 null */
  function recalled(at: number) {
    if (!history.length || history[0].t > at) return null;
    let i = history.length - 1;
    while (i > 0 && history[i].t > at) i--;
    return history[i].canvas;
  }

  const kit: Kit = {
    fonts,
    dateLabel: clip.sungDateLabel,
    lines: () => lines,
    cues: () => C,
    beat: () => beat,
    env: (ch, t) => rawEnv(ch, t - C.beatOffset),
    footage(c, video, x, y, w, h, delay = 0) {
      if (!footageReady(video)) return false;
      // 방송 화면에서 아바타 부분(왼쪽 채팅 제외, x 0.285~0.84)만, 얼굴이 가운데 오도록
      const past = delay > 0 ? recalled(nowT - delay) : null;
      const src: CanvasImageSource = past ?? video;
      const [rx, rw] = past ? [0, past.width] : avatarRect(video.videoWidth);
      const vh = past ? past.height : video.videoHeight;
      let sw = rw;
      let sh = rw / (w / h);
      if (sh > vh) {
        sh = vh;
        sw = vh * (w / h);
      }
      c.drawImage(src, rx + (rw - sw) / 2, Math.max(0, (vh - sh) * 0.3), sw, sh, x, y, w, h);
      return true;
    },
  };

  const DRAW: Partial<Record<string, SceneFn>> = { ...scenes1(kit), ...scenes2(kit), ...scenes3(kit) };

  // ── 화면 버퍼 ───────────────────────────────────────
  let prevBuf: HTMLCanvasElement | null = null;
  let vignette: HTMLCanvasElement | null = null;

  function ensureBuffers(main: Ctx) {
    const { width, height } = main.canvas;
    if (!prevBuf || prevBuf.width !== width || prevBuf.height !== height) {
      prevBuf = document.createElement('canvas');
      prevBuf.width = width;
      prevBuf.height = height;
    }
    if (!vignette) {
      vignette = document.createElement('canvas');
      vignette.width = 640;
      vignette.height = 360;
      const vc = vignette.getContext('2d')!;
      const g = vc.createRadialGradient(320, 180, 140, 320, 180, 400);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(10,8,16,0.55)');
      vc.fillStyle = g;
      vc.fillRect(0, 0, 640, 360);
    }
  }

  function drawScene(c: Ctx, span: SceneSpan, t: number, video: HTMLVideoElement | null) {
    const f: SceneFrame = {
      t,
      // 위로는 막지 않는다 — 겹치며 사라지는 앞 장면의 카메라가 전환 중에도 계속 움직이게
      k: Math.max(0, (t - span.start) / Math.max(0.01, span.end - span.start)),
      age: t - Math.max(0, span.start),
      dur: span.end - Math.max(0, span.start),
      span,
      video,
    };
    c.save();
    (DRAW[span.id] ?? storyboard)(c, f);
    c.restore();
  }

  // ── 콘티(아직 그리지 않은 장면) ──────────────────────

  function fillTone(c: Ctx, tone: Tone, x = 0, y = 0, w = W, h = H) {
    const [top, bottom] = TONES[tone];
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
  }

  function storyboard(c: Ctx, f: SceneFrame) {
    const { def, index } = f.span;
    if (Array.isArray(def.tone)) {
      const [a, b] = def.tone;
      const lr = def.split !== 'tb';
      fillTone(c, a, 0, 0, lr ? W / 2 : W, lr ? H : H / 2);
      fillTone(c, b, lr ? W / 2 : 0, lr ? 0 : H / 2, lr ? W / 2 : W, lr ? H : H / 2);
    } else fillTone(c, def.tone);
    const warm = ['sun', 'bloom'].includes(Array.isArray(def.tone) ? def.tone[1] : def.tone);
    if (def.tech.includes('입자')) {
      for (let i = 0; i < 50; i++) {
        const x = (hash(index * 101 + i * 7) * (W + 80) + noise1(f.t * 0.4 + i, index) * 40) % (W + 80) - 40;
        const y = (hash(index * 101 + i * 11) * (H + 80) + f.t * (40 + hash(i) * 60)) % (H + 80) - 40;
        c.globalAlpha = 0.6;
        c.fillStyle = warm ? COL.gold : COL.snow;
        c.beginPath();
        c.arc(x, y, 3, 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
    }
    const light = !['room', 'dark'].includes(Array.isArray(def.tone) ? def.tone[0] : def.tone);
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
    if (def.id === 'tears') c.fillText(`컷 ${cutWithin(lines[37], f.t).n + 1}/4`, 140, 108);
    c.globalAlpha = 1;
  }

  // ── 가사 ────────────────────────────────────────────

  /** 아래 가운데 자막 — 덩어리가 순서대로 떠오르고, 한국어는 그 아래. ink면 밝은 화면용 */
  function caption(c: Ctx, t: number, line: MvLyricLine, ja: boolean, ink: boolean) {
    const textShadow = (cc: Ctx, blur: number) => {
      cc.shadowColor = ink ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.55)';
      cc.shadowBlur = blur;
    };
    const out = clamp((line.end + 0.35 - t) / 0.35);
    c.save();
    if (ja) {
      const shown = chunksShown(line, t);
      const full = line.ja.map((j) => j.text).join('');
      const size = fitSize(c, full, fonts.ja, 44, 1100, 600);
      setFont(c, size, fonts.ja, 600);
      c.textBaseline = 'alphabetic';
      c.textAlign = 'left';
      let x = W / 2 - c.measureText(full).width / 2;
      textShadow(c, 16);
      for (let i = 0; i < line.ja.length; i++) {
        const ch = line.ja[i];
        const w = c.measureText(ch.text).width;
        if (i < shown) {
          const k = easeOutCubic(clamp((t - ch.t) / 0.4));
          c.globalAlpha = out * k;
          c.fillStyle = ink ? '#27303f' : '#fffaf0';
          c.fillText(ch.text, x, 628 + (1 - k) * 10);
        }
        x += w;
      }
    }
    if (line.ko) {
      textShadow(c, 12);
      c.globalAlpha = out * clamp((t - line.t) * 3);
      setFont(c, 21, fonts.ko, 600);
      c.textAlign = 'center';
      c.fillStyle = ink ? 'rgba(39,48,63,0.9)' : 'rgba(255,255,255,0.9)';
      c.fillText(line.ko, W / 2, 670);
    }
    c.restore();
  }

  // ── 제목 ────────────────────────────────────────────

  function poster(c: Ctx) {
    fillTone(c, 'frost');
    c.save();
    c.textAlign = 'center';
    c.fillStyle = '#3c4a62';
    setFont(c, 104, fonts.ja, 600);
    c.fillText('片っぽ', W / 2, 352);
    setFont(c, 21, fonts.ko, 600);
    c.fillStyle = 'rgba(60,74,98,0.8)';
    c.fillText(clip.sungDateLabel ? `eill · AyaUke cover · ${clip.sungDateLabel}` : 'eill · AyaUke cover', W / 2, 400);
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
    scenes: () => scenes.map(({ id, start, end }) => ({ id, start, end })),
    render(main, frame) {
      ensureBuffers(main);
      const s = main.canvas.width / W;
      const reset = (c: Ctx) => {
        c.setTransform(s, 0, 0, s, 0, 0);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
        c.shadowBlur = 0;
        c.shadowColor = 'transparent';
        c.filter = 'none';
      };
      reset(main);

      const t = frame.t;
      if (t === null) {
        poster(main);
        return;
      }
      const video = footageReady(frame.footage) ? frame.footage : null;
      remember(video, t);
      const span = sceneAt(t);
      drawScene(main, span, t, video);

      // 앞 장면이 겹치며 사라짐
      const dis = DISSOLVE[span.id] ?? 0;
      if (dis > 0 && t - span.start < dis && span.index > 0) {
        const pc = prevBuf!.getContext('2d')!;
        reset(pc);
        drawScene(pc, scenes[span.index - 1], t, video);
        main.setTransform(1, 0, 0, 1, 0, 0);
        main.globalAlpha = 1 - easeOutCubic((t - span.start) / dis);
        main.drawImage(prevBuf!, 0, 0);
        reset(main);
      }

      // 종이결 + 비네트
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.globalCompositeOperation = 'multiply';
      main.globalAlpha = 0.22;
      main.drawImage(paperGrain(), 0, 0, main.canvas.width, main.canvas.height);
      main.globalCompositeOperation = 'source-over';
      main.globalAlpha = 1;
      main.drawImage(vignette!, 0, 0, main.canvas.width, main.canvas.height);
      reset(main);

      const line = lineAt(lines, t);
      if (line && !NO_LYRICS.has(span.id) && t < C.endTitle) caption(main, t, line, !OWN_JA.has(span.id), INK_CAPTION.has(span.id));

      // 마지막 후렴 폭발 섬광 · 최고음 금빛
      main.setTransform(1, 0, 0, 1, 0, 0);
      const flash = t >= C.climax ? Math.exp(-(t - C.climax) * 4) : 0;
      const gold = Math.exp(-Math.pow((t - C.peak) / 1.4, 2)) * (0.4 + 0.6 * kit.env('rms', t));
      if (gold > 0.01) {
        main.globalAlpha = gold * 0.4;
        main.globalCompositeOperation = 'screen';
        main.fillStyle = COL.gold;
        main.fillRect(0, 0, main.canvas.width, main.canvas.height);
        main.globalCompositeOperation = 'source-over';
      }
      if (flash > 0.01) {
        main.globalAlpha = flash * 0.9;
        main.fillStyle = '#fffaf0';
        main.fillRect(0, 0, main.canvas.width, main.canvas.height);
      }
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
