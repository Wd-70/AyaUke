#!/usr/bin/env node
/**
 * MV 장면 모음(검수용) — 여러 시각의 화면을 한 장에 모은다. 렌더러가 시각만으로 그림을 정하므로
 * 페이지를 한 번만 열고 정지 시각만 바꿔 가며 찍는다(MvStage의 ?t= 모드 + window.__mvSeek).
 *
 * 사용:
 *   node scripts/mv/sheet.mjs <클립 shareId> --every 2                 곡 전체 2초 간격
 *   node scripts/mv/sheet.mjs <클립 shareId> --times 23,24.5,26 --width 960   특정 시각 크게
 *   --from/--to 범위, --cols 열 수(기본 6), --base 서버 주소(기본 http://localhost:3123), --out 파일
 * 출력: 기본 D:/cache/ayauke-mv/sheets/<shareId>-<태그>.jpg. 페이지 오류가 있으면 마지막에 출력한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

function args() {
  const [id, ...rest] = process.argv.slice(2);
  if (!id || id.startsWith('--')) {
    console.error('사용: node scripts/mv/sheet.mjs <클립 shareId> [--every 2 | --times a,b,c] [--from s --to e]');
    process.exit(1);
  }
  const o = { id, base: 'http://localhost:3123', cols: 6, width: 480, every: 2 };
  for (let i = 0; i < rest.length; i += 2) o[rest[i].replace(/^--/, '')] = rest[i + 1];
  return o;
}

(async () => {
  const o = args();
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = new Set();
  page.on('pageerror', (e) => errors.add(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.add(m.text()));

  await page.goto(`${o.base}/mv/${o.id}?t=${o.from ?? 0}`, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForFunction(() => typeof window.__mvSeek === 'function', null, { timeout: 120000 });
  const duration = await page.evaluate(() => window.__mvDuration);

  let times;
  if (o.times) times = String(o.times).split(',').map(Number);
  else {
    const from = Number(o.from ?? 0);
    const to = Number(o.to ?? duration ?? 200);
    times = [];
    for (let t = from; t < to - 0.05; t += Number(o.every)) times.push(Math.round(t * 100) / 100);
  }

  const sheet = await page.evaluate(
    async ({ times, cols, width }) => {
      const src = document.querySelector('canvas');
      const w = Number(width);
      const h = Math.round((w * 9) / 16);
      const label = 22;
      const out = document.createElement('canvas');
      out.width = cols * w;
      out.height = Math.ceil(times.length / cols) * (h + label);
      const c = out.getContext('2d');
      c.fillStyle = '#1e1e1e';
      c.fillRect(0, 0, out.width, out.height);
      const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (let i = 0; i < times.length; i++) {
        window.__mvSeek(times[i]);
        await frame();
        const x = (i % cols) * w;
        const y = Math.floor(i / cols) * (h + label);
        c.drawImage(src, x, y + label, w, h);
        c.fillStyle = '#ffdc78';
        c.font = '600 14px sans-serif';
        c.fillText(`${times[i].toFixed(2)}s`, x + 6, y + 16);
      }
      return out.toDataURL('image/jpeg', 0.88);
    },
    { times, cols: Number(o.cols), width: Number(o.width) },
  );

  const tag = o.times ? 'stills' : `every${o.every}`;
  const out = o.out ?? path.join('D:/cache/ayauke-mv/sheets', `${o.id}-${tag}.jpg`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(sheet.split(',')[1], 'base64'));
  console.log(`${times.length}장 → ${out}`);
  if (errors.size) console.log(`페이지 오류 ${errors.size}:\n` + [...errors].slice(0, 10).join('\n'));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
