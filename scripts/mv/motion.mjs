#!/usr/bin/env node
/**
 * 장면 끝 멈춤 검사(검수용) — 장면마다 가운데와 끝 직전의 움직임 양을 재서, 전환 전에 연출이 끝나 화면이 멈춘 장면을 찾는다.
 * 움직임 = 0.2초 사이 화면 차이(160×90으로 줄여 픽셀 평균 차, 0~255). 자막 줄(아래 20%)은 뺀다.
 * '끝'은 장면 끝 0.23초 전 → 0.03초 전. 막대는 장면을 10등분한 지점마다의 움직임(로그 눈금).
 * 끝 움직임이 거의 0(0.05 미만)이거나 그 장면의 평소(10지점 중앙값)의 30% 미만이면 표시한다 — 무음·엔딩 페이드처럼 의도된 정지도 걸리니 보고 판단.
 * 렌더러가 scenes()를 내놓아야 한다(MvRenderer.scenes — ?t= 모드에서 window.__mvScenes).
 *
 * 사용: node scripts/mv/motion.mjs <클립 shareId> [--base http://localhost:3123] [--only id,id]
 */
import { chromium } from 'playwright';

const [, , id, ...rest] = process.argv;
if (!id) {
  console.error('사용: node scripts/mv/motion.mjs <클립 shareId> [--base URL] [--only 장면id,…]');
  process.exit(1);
}
const opt = (name) => {
  const at = rest.indexOf(`--${name}`);
  return at >= 0 ? rest[at + 1] : undefined;
};
const base = opt('base') ?? 'http://localhost:3123';
const only = opt('only')?.split(',');

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(`${base}/mv/${id}?t=0`, { waitUntil: 'networkidle', timeout: 180000 });
await page.waitForFunction(() => typeof window.__mvScenes === 'function' && window.__mvScenes()?.length, null, { timeout: 120000 });
const scenes = await page.evaluate(() => window.__mvScenes());

const rows = await page.evaluate(
  async ({ scenes, only }) => {
    const src = document.querySelector('canvas');
    const small = document.createElement('canvas');
    small.width = 160;
    small.height = 90;
    const sc = small.getContext('2d', { willReadFrequently: true });
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const grab = async (t) => {
      window.__mvSeek(t);
      await frame();
      sc.drawImage(src, 0, 0, 160, 90);
      return sc.getImageData(0, 0, 160, 72).data;
    };
    const diff = (a, b) => {
      let s = 0;
      for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      return s / (a.length / 4) / 3;
    };
    const motion = async (t) => diff(await grab(t - 0.2), await grab(t));
    const out = [];
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      if (only && !only.includes(s.id)) continue;
      const start = Math.max(0, s.start);
      const dur = s.end - start;
      if (dur < 0.6) continue;
      const mid = await motion(start + dur * 0.5 + 0.1);
      const end = await motion(s.end - 0.03);
      // 흐름: 장면을 10등분해 각 지점의 움직임
      const curve = [];
      for (let k = 1; k <= 10; k++) curve.push(await motion(Math.min(s.end - 0.03, start + 0.2 + ((dur - 0.2) * k) / 10)));
      out.push({ i, id: s.id, start, end: s.end, mid, last: end, curve });
    }
    return out;
  },
  { scenes, only },
);

const bars = '▁▂▃▄▅▆▇█';
const spark = (v) => v.map((x) => bars[Math.min(7, Math.max(0, Math.round(Math.log2(1 + x * 4))))]).join('');
for (const r of rows) {
  // 장면 자체가 느린 것(눈만 내리는 등)은 빼고, 그 장면의 평소 움직임보다 끝이 크게 줄어든 것만
  const typical = [...r.curve].sort((a, b) => a - b)[5];
  const flag = r.last < 0.05 || r.last < typical * 0.3 ? '  ← 끝에서 멈춤' : '';
  console.log(
    `${String(r.i).padStart(2)} ${r.id.padEnd(14)} ${r.start.toFixed(1).padStart(6)}~${r.end.toFixed(1).padEnd(6)}  가운데 ${r.mid.toFixed(2).padStart(5)}  끝 ${r.last.toFixed(2).padStart(5)}  ${spark(r.curve)}${flag}`,
  );
}
await browser.close();
