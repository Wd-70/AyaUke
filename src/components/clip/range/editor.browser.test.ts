/** Isolated UI regression tests: no dev server, real API, or video provider requests. */
import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { build } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import tailwind from 'tailwindcss';

const root = process.cwd();
const entry = 'virtual:clip-range-test';
const playerModule = '\0clip-range-test-player';
const clientModule = '\0clip-range-test-client';
const fixture = `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Editor from '@/components/clip/range/ClipRangeEditor';
const initial = { clipId: 'test-clip', platform: 'youtube', videoId: 'test-video', sourceVersion: 1, rangeVersion: 1,
  isVerified: false, official: { startTime: 28800, endTime: 29000 }, personal: null,
  effective: { startTime: 28800, endTime: 29000, origin: 'original' }, recommendationId: null, proposals: [] };
window.fixture = { data: initial, calls: [], failShare: false, position: 28800, playing: false };
function App() {
  const [open, setOpen] = useState(true);
  return <><button onClick={() => setOpen(true)}>편집 열기</button>{open && <Editor initial={window.fixture.data} owner="test-user" loggedIn
    onClose={() => setOpen(false)} onApply={data => { window.fixture.data = data; setOpen(false); }} />}</>;
}
createRoot(document.getElementById('root')).render(<App />);
`;
const playerFixture = `
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
export default forwardRef(function Player(props, ref) {
  const position = useRef(props.initialPlayback?.position ?? props.startTime);
  const playing = useRef(false);
  window.fixture.setPosition = value => { position.current = value; playing.current = false; };
  useImperativeHandle(ref, () => ({
    getDuration: () => 30000, getCurrentTime: () => position.current, isPlaying: () => playing.current,
    seekTo: value => { if (!window.fixture.delaySeek) position.current = value; window.fixture.lastSeek = value; },
    play: () => { playing.current = true; }, pause: () => { playing.current = false; }
  }));
  useEffect(() => {
    const timer = setInterval(() => {
      if (playing.current) position.current += 0.1;
      if (position.current >= props.endTime) { playing.current = false; props.onEnded?.(); }
      window.fixture.position = position.current; window.fixture.playing = playing.current;
    }, 20);
    return () => clearInterval(timer);
  }, []);
  return <div className="aspect-video rounded-xl bg-black text-white">테스트 영상</div>;
});
`;
const clientFixture = `
export async function loadDetail() { return window.fixture.data; }
export async function changeRange(id, action) {
  const f = window.fixture; f.calls.push(action);
  if (action.action === 'personal') f.data = { ...f.data, personal: action.range, effective: { ...action.range, origin: 'personal' } };
  if (action.action === 'propose' && f.failShare) throw new Error('test share failure');
  return { range: f.data };
}
`;

describe.skipIf(!existsSync(chromium.executablePath()))('구간 편집 브라우저 회귀', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let html: string;
  beforeAll(async () => {
    const result = await build({
      configFile: false, envDir: false, logLevel: 'silent', oxc: { jsx: { runtime: 'automatic' } },
      define: { 'process.env.NODE_ENV': JSON.stringify('development') },
      resolve: { alias: { '@': path.join(root, 'src') } },
      build: { write: false, minify: false, lib: { entry, formats: ['iife'], name: 'ClipRangeTest' } },
      plugins: [{ name: 'clip-range-fixture', enforce: 'pre',
        resolveId(id, importer) {
          if (id.endsWith(entry)) return '\0' + entry;
          if (importer?.replaceAll('\\', '/').endsWith('/range/ClipRangeEditor.tsx')) {
            if (id === '../ClipPlayer') return playerModule;
            if (id === './range-client') return clientModule;
          }
        },
        load(id) {
          if (id === '\0' + entry) return { code: fixture, moduleType: 'tsx' };
          if (id === playerModule) return { code: playerFixture, moduleType: 'tsx' };
          if (id === clientModule) return clientFixture;
        },
      }],
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap(result => 'output' in result ? result.output : []);
    const js = outputs.filter(output => output.type === 'chunk').map(output => output.code).join('\n');
    const content = playerFixture + ['ClipRangeEditor.tsx', 'RangeControls.tsx', 'RangeTimeline.tsx'].map(file => readFileSync(path.join(root, 'src/components/clip/range', file), 'utf8')).join('\n');
    const css = await postcss([tailwind({ content: [{ raw: content }], corePlugins: { preflight: true } })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
    html = `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}</style></head><body><div id="root"></div><script>${js.replaceAll('</script', '<\\/script')}</script></body></html>`;
    browser = await chromium.launch({ headless: true });
  }, 60_000);
  beforeEach(async () => {
    context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.route('**/*', route => route.fulfill({ contentType: 'text/html', body: html }));
    page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('http://clip-editor.test');
    await page.getByRole('heading', { name: '재생 구간 조정' }).waitFor({ timeout: 5_000 }).catch(async error => { throw new Error(errors.join('\n') || `${error.message}\n${await page.locator('body').innerText()}`); });
    await page.waitForFunction(() => !(document.querySelector('input[type="range"]') as HTMLInputElement)?.disabled);
  });
  afterEach(async () => { await context?.close(); });
  afterAll(async () => { await browser?.close(); });

  it('모바일은 끝 조정을 기본 표시하고 데스크톱은 양쪽을 표시한다', async () => {
    expect(await page.getByRole('textbox', { name: /종료 시각/ }).isVisible()).toBe(true);
    expect(await page.getByRole('textbox', { name: /시작 시각/ }).isVisible()).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (process.env.CLIP_RANGE_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.CLIP_RANGE_SCREENSHOT_DIR, 'mobile.png') });
    expect(await page.getByText('사용자 개선안 0개').evaluate(element => (element.parentElement as HTMLDetailsElement).open)).toBe(false);
    await page.getByRole('button', { name: '시작 조정', exact: true }).click();
    expect(await page.getByRole('button', { name: '시작 0.5초 앞당기기' }).isVisible()).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await page.getByRole('textbox', { name: /시작 시각/ }).isVisible()).toBe(true);
    expect(await page.getByRole('textbox', { name: /종료 시각/ }).isVisible()).toBe(true);
    if (process.env.CLIP_RANGE_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.CLIP_RANGE_SCREENSHOT_DIR, 'desktop.png') });
  });

  it('제외 구간은 라이트·다크에서 실제 회색 배경과 사선 무늬를 표시한다', async () => {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      const style = await page.locator('[data-range-track="excluded"]').evaluate(element => {
        const css = getComputedStyle(element);
        return { color: css.backgroundColor, pattern: css.backgroundImage, height: element.getBoundingClientRect().height };
      });
      expect(style.color).toBe('rgb(156, 163, 175)');
      expect(style.pattern).toContain('repeating-linear-gradient');
      expect(style.height).toBeGreaterThanOrEqual(12);
    }
  });

  it('실제 위치·경계 수정에 따라 포함 여부를 갱신하고 비동기 시킹을 앞서 판정하지 않는다', async () => {
    const status = page.locator('[data-range-position]');
    const moveTo = async (position: number, state: string) => {
      await page.evaluate(value => (window as any).fixture.setPosition(value), position);
      await expect.poll(() => status.getAttribute('data-range-position')).toBe(state);
    };
    await moveTo(28799.9, 'before');
    await page.evaluate(() => { (window as any).fixture.delaySeek = true; });
    const slider = page.getByRole('slider', { name: '편집 미리듣기 위치' });
    await slider.focus(); await slider.press('End');
    expect(await page.evaluate(() => (window as any).fixture.lastSeek)).toBe(29015);
    expect(await status.getAttribute('data-range-position')).toBe('before');
    await moveTo(28800, 'inside');
    await moveTo(29000, 'after');
    await moveTo(28999.9, 'inside');
    const end = page.getByRole('textbox', { name: /종료 시각/ });
    await end.fill('199'); await end.press('Enter');
    await expect.poll(() => status.getAttribute('data-range-position')).toBe('after');
    await end.fill('bad'); await end.press('Enter');
    await expect.poll(() => status.getAttribute('data-range-position')).toBe('unknown');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  it('상대 시간 입력은 독립적으로 편집되고 절대 시간으로 저장된다', async () => {
    const end = page.getByRole('textbox', { name: /종료 시각/ });
    await end.fill('3:25'); await end.press('Enter');
    await page.getByRole('button', { name: '시작 조정', exact: true }).click();
    const start = page.getByRole('textbox', { name: /시작 시각/ });
    await start.fill('-0:02.5'); await start.press('Enter');
    expect(await page.evaluate(() => (window as any).fixture.calls)).toHaveLength(0);
    await page.getByRole('button', { name: '저장하고 공유', exact: true }).click();
    await page.getByRole('heading', { name: '재생 구간 조정' }).waitFor({ state: 'hidden' });
    const calls = await page.evaluate(() => (window as any).fixture.calls);
    expect(calls.map((call: any) => call.action)).toEqual(['personal', 'propose']);
    expect(calls[0].range).toEqual({ startTime: 28797.5, endTime: 29005 });
  });

  it('잘못된 시간은 유지하고 저장을 막으며 고치면 해제한다', async () => {
    const end = page.getByRole('textbox', { name: /종료 시각/ });
    await end.fill('3:75'); await end.press('Tab');
    expect(await end.inputValue()).toBe('3:75');
    expect(await end.getAttribute('aria-invalid')).toBe('true');
    expect(await page.getByRole('button', { name: '저장', exact: true }).isDisabled()).toBe(true);
    await end.fill('3:25'); await end.press('Enter');
    expect(await page.getByRole('button', { name: '저장하고 공유', exact: true }).isEnabled()).toBe(true);
  });

  it('입력 중 닫아도 자동 복원하며 초기화 후에는 복원하지 않는다', async () => {
    await page.getByRole('textbox', { name: /종료 시각/ }).fill('205');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '편집 열기', exact: true }).click();
    await expect.poll(() => page.getByRole('textbox', { name: /종료 시각/ }).inputValue()).toBe('3:25.0');
    await page.getByRole('button', { name: '편집 초기화', exact: true }).click();
    expect(await page.getByRole('button', { name: '한 단계 되돌리기' }).isDisabled()).toBe(true);
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.getByRole('button', { name: '편집 열기', exact: true }).click();
    await expect.poll(() => page.getByRole('textbox', { name: /종료 시각/ }).inputValue()).toBe('3:20.0');
  });

  it('경계 전후 미리듣기는 종료 뒤까지 듣고 멈추지만 편집 구간은 종료에서 멈춘다', async () => {
    await page.getByRole('button', { name: '종료 경계 전후 듣기', exact: true }).click();
    await page.waitForFunction(() => (window as any).fixture.lastSeek === 28995);
    await page.getByText('설정한 종료점을 지났습니다', { exact: true }).waitFor();
    await page.getByText('끝 경계 전후 듣기 완료', { exact: true }).waitFor();
    expect(await page.evaluate(() => (window as any).fixture.position)).toBeGreaterThanOrEqual(29002 - 0.05);
    const end = page.getByRole('textbox', { name: /종료 시각/ });
    await end.fill('0:03'); await end.press('Enter');
    await page.getByRole('button', { name: '편집 구간 재생', exact: true }).click();
    await page.getByText('편집 구간 완료', { exact: true }).waitFor();
    const state = await page.evaluate(() => (window as any).fixture);
    expect(state.playing).toBe(false);
    expect(state.position).toBeGreaterThanOrEqual(28803 - 0.05);
    expect(state.position).toBeLessThan(28804);
  });

  it('개인 저장 후 공유 실패는 공유만 재시도한다', async () => {
    await page.evaluate(() => { (window as any).fixture.failShare = true; });
    const end = page.getByRole('textbox', { name: /종료 시각/ });
    await end.fill('3:00'); await end.press('Enter');
    await page.getByRole('button', { name: '저장하고 공유', exact: true }).click();
    await page.getByText('내 구간 저장 완료.', { exact: false }).waitFor();
    await page.evaluate(() => { (window as any).fixture.failShare = false; });
    await page.getByRole('button', { name: '공유 다시 시도', exact: true }).click();
    await page.getByRole('heading', { name: '재생 구간 조정' }).waitFor({ state: 'hidden' });
    expect(await page.evaluate(() => (window as any).fixture.calls.map((call: any) => call.action))).toEqual(['personal', 'propose', 'propose']);
  });
});
