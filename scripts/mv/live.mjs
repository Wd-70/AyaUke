#!/usr/bin/env node
/**
 * 원본 영상과 함께 찍기(검수용) — 실제로 클립을 재생해 원본 화면이 들어가는 장면(폴라로이드·필름·꽃 가운데 등)을 확인한다.
 * ?t= 정지 모드는 영상을 안 쓰므로(라벤더 번짐으로 대신) 이걸로 본다. 소리는 끈다.
 * 시각마다 그 2.5초 전으로 옮겨 재생하다가(지난 몇 초를 기억해 쓰는 장면이 있어서) 해당 시각에 캔버스를 찍는다.
 *
 * 사용: node scripts/mv/live.mjs <클립 shareId> 52,121,175 [--base http://localhost:3123] [--out 파일.jpg] [--width 640]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [, , id, list, ...rest] = process.argv;
if (!id || !list) {
  console.error('사용: node scripts/mv/live.mjs <클립 shareId> <시각,시각,...> [--base URL] [--out 파일] [--width 640]');
  process.exit(1);
}
const opt = (name, d) => {
  const at = rest.indexOf(`--${name}`);
  return at >= 0 ? rest[at + 1] : d;
};
const base = opt('base', 'http://localhost:3123');
const width = Number(opt('width', 640));
const out = opt('out', `D:/cache/ayauke-mv/sheets/${id}-live.jpg`);
const times = list.split(',').map(Number);

const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
// HLS 스트림이라 networkidle은 오지 않는다 — load 후 플레이어의 재생 버튼을 누른다
await page.goto(`${base}/mv/${id}`, { waitUntil: 'load', timeout: 180000 });
await page.waitForSelector('video', { timeout: 60000, state: 'attached' });
await page.evaluate(() => (document.querySelector('video').muted = true));
await page.getByRole('button', { name: '재생' }).first().click();
// 클립 시작(정수 초)에서 재생이 시작된다 — MV의 t=0
const t0 = await page.evaluate(async () => {
  const v = document.querySelector('video');
  for (let i = 0; i < 300 && !(v.readyState >= 2 && v.currentTime > 0); i++) await new Promise((r) => setTimeout(r, 100));
  return Math.floor(v.currentTime);
});
console.log(`영상 시작 ${t0.toFixed(1)}s`);

const shots = [];
for (const t of times) {
  const data = await page.evaluate(
    async ({ t, t0, width }) => {
      const v = document.querySelector('video');
      v.currentTime = t0 + t - 2.5;
      await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
      await v.play().catch(() => {});
      while (v.currentTime < t0 + t) await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const src = document.querySelector('canvas');
      const c = document.createElement('canvas');
      c.width = width;
      c.height = Math.round((width * 9) / 16);
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      try {
        return c.toDataURL('image/jpeg', 0.85);
      } catch {
        return null;
      }
    },
    { t, t0, width },
  );
  if (!data) {
    // 영상 때문에 캔버스를 못 읽으면 화면 캡처로
    const el = await page.$('canvas');
    shots.push(await el.screenshot({ type: 'jpeg', quality: 85 }));
  } else shots.push(Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${t}s 찍음`);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
if (shots.length === 1) fs.writeFileSync(out, shots[0]);
else shots.forEach((b, i) => fs.writeFileSync(out.replace(/\.jpg$/, `-${times[i]}.jpg`), b));
console.log(out);
await browser.close();
