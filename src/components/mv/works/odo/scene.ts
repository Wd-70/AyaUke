// 踊 MV 렌더러.
// 콘셉트(PLAN.md): 오늘 밤 한 번의 공연 — 암전 속에서 박자마다 불이 켜진다. 바탕은 검정, 빛의 색은 아껴서 늘린다.
// 장면 그리기는 scenes1~3.ts(PLAN.md 표 번호 순), 아직 없는 장면은 콘티(장면 설명 + 마디·박 표시)로 그린다.
import type { MvClipContext, MvLyricLine, MvRenderer } from '../../types';
import { TAU, beatGrid, chunksShown, clamp, decodeEnvelope, fitSize, lineAt, setFont } from '../../engine';
import { ENVELOPE } from './envelope';
import { BG, type Ctx, H, type Kit, NEON, type SceneFn, type SceneFrame, W, glow } from './kit';
import { scenes1 } from './scenes1';
import { scenes2 } from './scenes2';
import { scenes3 } from './scenes3';
import { BEAT_PERIOD, BEAT_PHASE, CUES, type Cues, LYRICS, type SceneSpan, barTime, scenesOf } from './timeline';

export { W, H };

/** 가사를 장면이 직접 크게 그리는 곳 — 일본어 자막은 숨기고 번역만 */
const OWN_JA = new Set(['halfKO', 'ledKO', 'chatGray', 'odoCuts']);

export interface SceneFonts {
  /** 일본어 가사 자막 (Zen Kaku Gothic New 900) */
  ja: string;
  /** 큰 글자·제목 (Dela Gothic One) */
  display: string;
  /** 한국어 번역 */
  ko: string;
}

export function createOdoRenderer(clip: MvClipContext, fonts: SceneFonts): MvRenderer {
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

  const kit: Kit = {
    fonts,
    dateLabel: clip.sungDateLabel,
    lines: () => lines,
    cues: () => C,
    beat: () => beat,
    bar: (n) => barTime(n, C),
    env: (ch, t) => rawEnv(ch, t),
    footage(c, video, x, y, w, h, crop) {
      if (!footageReady(video)) return false;
      // 방송 화면에서 아바타 부분(왼쪽 채팅 제외, x 0.285~0.84)만, 얼굴이 가운데 오도록
      const rx = video.videoWidth * 0.285;
      const rw = video.videoWidth * 0.555;
      const vh = video.videoHeight;
      const zoom = Math.max(1, crop?.zoom ?? 1);
      let sw = rw;
      let sh = rw / (w / h);
      if (sh > vh) {
        sh = vh;
        sw = vh * (w / h);
      }
      sw /= zoom;
      sh /= zoom;
      const cx = rx + rw * (crop?.cx ?? 0.5);
      const sx = clamp(cx - sw / 2, rx, rx + rw - sw);
      const sy = crop?.cy === undefined ? Math.max(0, (vh - sh) * 0.3) : clamp(vh * crop.cy - sh / 2, 0, vh - sh);
      if (crop?.mirror) {
        c.save();
        c.translate(x * 2 + w, 0);
        c.scale(-1, 1);
        c.drawImage(video, sx, sy, sw, sh, x, y, w, h);
        c.restore();
      } else {
        c.drawImage(video, sx, sy, sw, sh, x, y, w, h);
      }
      return true;
    },
  };

  const DRAW: Partial<Record<string, SceneFn>> = { ...scenes1(kit), ...scenes2(kit), ...scenes3(kit) };

  let vignette: HTMLCanvasElement | null = null;
  function ensureVignette() {
    if (vignette) return vignette;
    vignette = document.createElement('canvas');
    vignette.width = 640;
    vignette.height = 360;
    const vc = vignette.getContext('2d')!;
    const g = vc.createRadialGradient(320, 180, 150, 320, 180, 410);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.6)');
    vc.fillStyle = g;
    vc.fillRect(0, 0, 640, 360);
    return vignette;
  }

  function drawScene(c: Ctx, span: SceneSpan, t: number, video: HTMLVideoElement | null) {
    const f: SceneFrame = {
      t,
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

  function storyboard(c: Ctx, f: SceneFrame) {
    const { def, index } = f.span;
    c.fillStyle = BG;
    c.fillRect(0, 0, W, H);
    def.glow.forEach((g, i) => glow(c, W * ((i + 0.5) / def.glow.length), H * 0.5, 320, NEON[g], 0.12 + 0.2 * beat.pulse(f.t, 5)));
    c.fillStyle = 'rgba(246,244,255,0.92)';
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
    const idx = beat.index(f.t);
    const inBar = ((idx % 4) + 4) % 4;
    c.textAlign = 'right';
    c.fillText(`마디 ${Math.floor(idx / 4)} · 박 ${inBar + 1}`, W - 84, 48);
    c.globalAlpha = 0.3 + 0.7 * beat.pulse(f.t, 5);
    c.beginPath();
    c.arc(W - 58, 58, inBar === 0 ? 13 : 7, 0, TAU);
    c.fill();
    c.globalAlpha = 1;
  }

  // ── 가사 ────────────────────────────────────────────

  /** 아래 가운데 자막 — 덩어리가 순서대로 튀어나오고, 한국어는 그 아래. 밝은 화면에서도 읽히게 검은 테두리 */
  function caption(c: Ctx, t: number, line: MvLyricLine, ja: boolean) {
    const out = clamp((line.end + 0.25 - t) / 0.25);
    c.save();
    c.lineJoin = 'round';
    if (ja) {
      const shown = chunksShown(line, t);
      const full = line.ja.map((j) => j.text).join('');
      const size = fitSize(c, full, fonts.ja, 40, 1100, 900);
      setFont(c, size, fonts.ja, 900);
      c.textBaseline = 'alphabetic';
      c.textAlign = 'left';
      let x = W / 2 - c.measureText(full).width / 2;
      for (let i = 0; i < line.ja.length; i++) {
        const ch = line.ja[i];
        const w = c.measureText(ch.text).width;
        if (i < shown) {
          const k = clamp((t - ch.t) / 0.1);
          c.globalAlpha = out * k;
          c.lineWidth = 7;
          c.strokeStyle = 'rgba(5,4,8,0.88)';
          c.strokeText(ch.text, x, 634 - (1 - k) * 12);
          c.fillStyle = '#ffffff';
          c.fillText(ch.text, x, 634 - (1 - k) * 12);
        }
        x += w;
      }
    }
    if (line.ko) {
      c.globalAlpha = out * clamp((t - line.t) * 8);
      setFont(c, 21, fonts.ko, 700);
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.lineWidth = 5;
      c.strokeStyle = 'rgba(5,4,8,0.88)';
      c.strokeText(line.ko, W / 2, 672);
      c.fillStyle = 'rgba(255,255,255,0.94)';
      c.fillText(line.ko, W / 2, 672);
    }
    c.restore();
  }

  function poster(c: Ctx) {
    c.fillStyle = BG;
    c.fillRect(0, 0, W, H);
    glow(c, W / 2, 330, 460, NEON.violet, 0.3);
    glow(c, W / 2, 330, 300, NEON.pink, 0.22);
    c.save();
    c.textAlign = 'center';
    c.shadowColor = NEON.pink;
    c.shadowBlur = 36;
    c.fillStyle = '#fff5fb';
    setFont(c, 170, fonts.display, 400);
    c.fillText('踊', W / 2, 382);
    c.shadowBlur = 0;
    setFont(c, 22, fonts.ko, 600);
    c.fillStyle = 'rgba(246,244,255,0.85)';
    c.fillText(clip.sungDateLabel ? `Ado · AyaUke cover · ${clip.sungDateLabel}` : 'Ado · AyaUke cover', W / 2, 446);
    setFont(c, 20, fonts.ko, 600);
    c.fillStyle = 'rgba(246,244,255,0.7)';
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
      const s = main.canvas.width / W;
      const reset = (c: Ctx) => {
        c.setTransform(s, 0, 0, s, 0, 0);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
        c.shadowBlur = 0;
        c.shadowColor = 'transparent';
        c.filter = 'none';
        c.setLineDash([]);
        c.textAlign = 'left';
        c.textBaseline = 'alphabetic';
      };
      reset(main);

      const t = frame.t;
      if (t === null) {
        poster(main);
        return;
      }
      const video = footageReady(frame.footage) ? frame.footage : null;
      const span = sceneAt(t);
      main.save();
      main.beginPath();
      main.rect(0, 0, W, H);
      main.clip();
      drawScene(main, span, t, video);
      main.restore();
      reset(main);

      // 가장자리를 어둡게 — 흰 바탕 장면(드롭 2 첫머리)은 뺀다
      if (span.id !== 'jumpCrowd' && span.id !== 'odoCuts') {
        main.setTransform(1, 0, 0, 1, 0, 0);
        main.globalAlpha = 0.85;
        main.drawImage(ensureVignette(), 0, 0, main.canvas.width, main.canvas.height);
        reset(main);
      }

      const line = lineAt(lines, t);
      if (line && t < C.endTitle) caption(main, t, line, !OWN_JA.has(span.id));

      // 시작/끝 페이드
      main.setTransform(1, 0, 0, 1, 0, 0);
      const fade = Math.max(1 - clamp(t / 0.25), clamp((t - C.outro) / 1.6));
      if (fade > 0) {
        main.globalAlpha = fade;
        main.fillStyle = '#000';
        main.fillRect(0, 0, main.canvas.width, main.canvas.height);
      }
      main.globalAlpha = 1;
    },
  };
}
