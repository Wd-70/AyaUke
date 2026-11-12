#!/usr/bin/env node
/**
 * MV 프레임 시간 측정(검수용) — 시각마다 40프레임을 그려 프레임 간격 중앙값·90%를 잰다.
 * 16.7ms(60fps)를 넘는 장면은 매 프레임 그리는 것이 무겁다는 뜻 — 스프라이트·Path2D 묶음으로 줄인다.
 * 헤드리스 크롬이라 실제 브라우저보다 느리게 나올 수 있다(상대 비교용).
 *
 * 사용: node scripts/mv/perf.mjs <클립 shareId> 3,10,64,115 [--base http://localhost:3123]
 */
import { chromium } from 'playwright';

const [, , id, list, ...rest] = process.argv;
if (!id || !list) {
  console.error('사용: node scripts/mv/perf.mjs <클립 shareId> <시각,시각,...> [--base URL]');
  process.exit(1);
}
const baseAt = rest.indexOf('--base');
const base = baseAt >= 0 ? rest[baseAt + 1] : 'http://localhost:3123';
const times = list.split(',').map(Number);

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(`${base}/mv/${id}?t=${times[0]}`, { waitUntil: 'networkidle', timeout: 180000 });
await page.waitForFunction(() => typeof window.__mvSeek === 'function', null, { timeout: 120000 });
for (const t of times) {
  const ms = await page.evaluate(async (t) => {
    window.__mvSeek(t);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const stamps = [];
    for (let i = 0; i < 40; i++) {
      window.__mvSeek(t + i / 60);
      stamps.push(await new Promise((r) => requestAnimationFrame(r)));
    }
    const d = stamps.slice(1).map((s, i) => s - stamps[i]).sort((a, b) => a - b);
    return { med: d[Math.floor(d.length / 2)], p90: d[Math.floor(d.length * 0.9)] };
  }, t);
  const slow = ms.med > 20 ? '  ← 느림' : '';
  console.log(`${String(t).padStart(7)}s  중앙값 ${ms.med.toFixed(1)}ms  90% ${ms.p90.toFixed(1)}ms${slow}`);
}
await browser.close();
