/** No dev server or external media/API. Real provider, buttons, wrapper and editor. */
import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { build } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import tailwind from 'tailwindcss';

const entry = 'virtual:range-entrypoints';
const root = process.cwd();
const fixture = `
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from 'next-auth/react';
import { ClipRangeProvider, useClipRangeEditor } from '@/components/clip/range/ClipRangeProvider';
import Button from '@/components/clip/range/ClipRangeButton';
import Player from '@/components/clip/range/ResolvedClipPlayer';
const data = id => ({ clipId: id, platform: 'youtube', videoId: 'video-' + id, sourceVersion: 1, rangeVersion: 1,
  isVerified: false, official: { startTime: 1000, endTime: 1200 }, personal: null,
  effective: { startTime: 1000, endTime: 1200, origin: 'original' }, recommendationId: null, proposals: [] });
window.fixture = { data: { a: data('a'), b: data('b'), c: data('c') }, players: {}, calls: [], selected: 0, fail: false, defer: false };
function Surface() {
  const range = useClipRangeEditor();
  const [parent, setParent] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const key = e => { if (e.key === 'Escape' && !range.isOpen) setParent(false); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [range.isOpen]);
  return <main className="space-y-3 p-4">
    {parent && <div data-testid="parent">상세 팝업 유지</div>}
    <div data-testid="video"><Player rangeSessionId="inline" posterDescription="inline" platform="youtube" videoId="video-a" startTime={1000} endTime={1200} trackPlayClipId="a" autoplay /></div>
    <div><Button clipId="a" sessionId="inline" title="상세" variant="action" /></div>
    <Button clipId="a" sessionId="inline" title="공유" variant="pill" />
    <Button clipId="a" sessionId="inline" title="선택행" variant="compact" />
    <Button clipId="a" sessionId="global" title="전체" variant="toolbar" />
    <div onClick={() => window.fixture.selected++}><Button clipId="c" title="목록" variant="icon" /></div>
    <Player rangeSessionId="global" posterDescription="global" platform="youtube" videoId="video-a" startTime={1000} endTime={1200} trackPlayClipId="a" />
    <Player rangeSessionId="other" posterDescription="other" platform="youtube" videoId="video-b" startTime={1000} endTime={1200} trackPlayClipId="b" autoplay />
    <button onClick={() => setMounted(true)}>목록 클립 재생기 연결</button>
    {mounted && <Player posterDescription="later" platform="youtube" videoId="video-c" startTime={1000} endTime={1200} trackPlayClipId="c" />}
  </main>;
}
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function App() {
  const [owner, setOwner] = useState('user-1'); window.fixture.setOwner = setOwner;
  return <AuthContext.Provider value={{ data: owner === 'guest' ? null : { user: { userId: owner } }, status: owner === 'guest' ? 'unauthenticated' : 'authenticated' }}>
    <QueryClientProvider client={client}><ClipRangeProvider><Surface /></ClipRangeProvider></QueryClientProvider>
  </AuthContext.Provider>;
}
createRoot(document.getElementById('root')).render(<App />);
`;
const auth = `import { createContext, useContext } from 'react'; export const AuthContext = createContext(null); export const useSession = () => useContext(AuthContext);`;
const api = `
export const rangeKey = (owner, id) => ['clip-range', owner, id];
export async function loadRanges(ids) { return ids.map(id => window.fixture.data[id]); }
export async function loadDetail(id) {
  if (window.fixture.fail) throw new Error('조회 실패 테스트');
  if (window.fixture.defer) await new Promise(resolve => { window.fixture.resolveLoad = resolve; });
  return window.fixture.data[id];
}
export async function changeRange(id, action) {
  const f = window.fixture; f.calls.push({ id, ...action });
  if (f.deferSave) await new Promise(resolve => { f.resolveSave = resolve; });
  if (action.action === 'personal') f.data[id] = { ...f.data[id], personal: action.range, effective: { ...action.range, origin: 'personal' } };
  return { range: f.data[id] };
}
`;
const player = `
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
export default forwardRef(function Player(props, ref) {
  const state = useRef({ position: props.initialPlayback?.position ?? props.startTime,
    playing: props.trackPlayClipId ? (props.initialPlayback?.play ?? props.autoplay ?? false) : false,
    start: props.startTime, end: props.endTime });
  useImperativeHandle(ref, () => ({ getDuration: () => 2000, getCurrentTime: () => state.current.position,
    isPlaying: () => state.current.playing, play: () => { state.current.playing = true; },
    pause: () => { state.current.playing = false; }, seekTo: value => { state.current.position = value; }, toggle() {} }));
  useEffect(() => {
    const name = props.posterDescription;
    if (name) window.fixture.players[name] = state.current;
    return () => { if (name && window.fixture.players[name] === state.current) delete window.fixture.players[name]; };
  }, []);
  return <div className="h-16 rounded-xl bg-black text-white">영상 {props.posterDescription}</div>;
});
`;

describe.skipIf(!existsSync(chromium.executablePath()))('화면별 진입점과 공통 편집 세션', () => {
  let browser: Browser; let context: BrowserContext; let page: Page; let html: string;
  beforeAll(async () => {
    const result = await build({ configFile: false, envDir: false, logLevel: 'silent',
      oxc: { jsx: { runtime: 'automatic' } }, define: { 'process.env.NODE_ENV': JSON.stringify('development') },
      resolve: { alias: { '@': path.join(root, 'src') } },
      build: { write: false, minify: false, lib: { entry, formats: ['iife'], name: 'EntrypointsTest' } },
      plugins: [{ name: 'fixture', enforce: 'pre', resolveId(id, importer) {
        if (id.endsWith(entry)) return '\0fixture';
        if (id === 'next-auth/react') return '\0auth';
        if (importer?.replaceAll('\\', '/').includes('/clip/range/')) {
          if (id === '../ClipPlayer') return '\0player';
          if (id === './range-client') return '\0api';
        }
      }, load(id) {
        if (id === '\0fixture') return { code: fixture, moduleType: 'tsx' };
        if (id === '\0auth') return auth;
        if (id === '\0api') return api;
        if (id === '\0player') return { code: player, moduleType: 'tsx' };
      } }],
    });
    const output = (Array.isArray(result) ? result : [result]).flatMap(item => 'output' in item ? item.output : []);
    const js = output.filter(item => item.type === 'chunk').map(item => item.code).join('\n');
    const content = fixture + player + ['ClipRangeProvider.tsx', 'ClipRangeButton.tsx', 'ClipRangeEditor.tsx', 'RangeControls.tsx', 'RangeTimeline.tsx']
      .map(file => readFileSync(path.join(root, 'src/components/clip/range', file), 'utf8')).join('\n');
    const css = await postcss([tailwind({ content: [{ raw: content }] })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
    html = `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}</style></head><body><div id="root"></div><script>${js.replaceAll('</script', '<\\/script')}</script></body></html>`;
    browser = await chromium.launch({ headless: true });
  }, 60_000);
  beforeEach(async () => {
    context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
    page = await context.newPage();
    await page.goto('http://entrypoints.test');
    await page.waitForFunction(() => Object.keys((window as any).fixture?.players ?? {}).length === 3, undefined, { timeout: 5000 });
  });
  afterEach(async () => { await context?.close(); });
  afterAll(async () => { await browser?.close(); });
  const edit = async () => {
    await page.getByRole('button', { name: '상세 재생 구간 조정', exact: true }).click();
    await page.getByRole('textbox', { name: /종료 시각/ }).waitFor();
  };

  it('영상 안에는 버튼이 없고 모든 외부 형태는 44px 터치 영역이다', async () => {
    expect(await page.getByTestId('video').getByRole('button').count()).toBe(0);
    const buttons = page.getByRole('button', { name: /재생 구간 조정/ });
    expect(await buttons.count()).toBe(5);
    for (const button of await buttons.all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await button.getAttribute('aria-haspopup')).toBe('dialog');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
  it('여러 재생기를 멈추고 Esc는 뒤 팝업을 유지하며 원래 상태로 복귀한다', async () => {
    await edit();
    expect(await page.evaluate(() => Object.values((window as any).fixture.players).map((p: any) => p.playing))).toEqual([false, false, false]);
    await page.keyboard.press('Escape');
    await page.getByRole('textbox', { name: /종료 시각/ }).waitFor({ state: 'hidden' });
    expect(await page.getByTestId('parent').isVisible()).toBe(true);
    expect(await page.evaluate(() => (window as any).fixture.players.inline.playing)).toBe(true);
    expect(await page.evaluate(() => (window as any).fixture.players.global.playing)).toBe(false);
    expect(await page.evaluate(() => (window as any).fixture.players.other.playing)).toBe(true);
    await expect.poll(() => page.getByRole('button', { name: '상세 재생 구간 조정', exact: true }).evaluate(el => el === document.activeElement)).toBe(true);
  });
  it('변경은 같은 클립의 세션들에만 반영하고 새 구간 밖의 위치를 보정한다', async () => {
    await page.evaluate(() => { (window as any).fixture.players.inline.position = 1190; });
    await edit();
    const input = page.getByRole('textbox', { name: /종료 시각/ });
    await input.fill('1:30'); await input.press('Enter');
    await page.getByRole('button', { name: '저장하고 공유', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).fixture.players.inline.end)).toBe(1090);
    const players = await page.evaluate(() => (window as any).fixture.players);
    expect(players.inline.position).toBe(1000);
    expect(players.inline.playing).toBe(true);
    expect(players.global.end).toBe(1090); expect(players.global.playing).toBe(false);
    expect(players.other.end).toBe(1200);
  });
  it('목록의 비로그인 편집은 행 선택 없이 적용되며 계정 변경 시 분리된다', async () => {
    await page.evaluate(() => (window as any).fixture.setOwner('guest'));
    await page.getByRole('button', { name: '목록 재생 구간 조정', exact: true }).click();
    const input = page.getByRole('textbox', { name: /종료 시각/ });
    await input.fill('90'); await input.press('Enter');
    await page.getByRole('button', { name: '이번 재생에 적용', exact: true }).click();
    expect(await page.evaluate(() => (window as any).fixture.selected)).toBe(0);
    expect(await page.evaluate(() => (window as any).fixture.calls)).toHaveLength(0);
    await page.getByRole('button', { name: '목록 클립 재생기 연결' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).fixture.players.later?.end)).toBe(1090);
    await page.evaluate(() => (window as any).fixture.setOwner('user-2'));
    await expect.poll(() => page.evaluate(() => (window as any).fixture.players.later?.end)).toBe(1200);
  });
  it('조회 실패는 재시도할 수 있고 로딩 취소 후 늦은 응답은 다시 열지 않는다', async () => {
    await page.evaluate(() => { (window as any).fixture.fail = true; });
    await page.getByRole('button', { name: '목록 재생 구간 조정', exact: true }).click();
    await page.getByText('조회 실패 테스트', { exact: true }).waitFor();
    await page.evaluate(() => { (window as any).fixture.fail = false; });
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await page.getByRole('textbox', { name: /종료 시각/ }).waitFor();
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.evaluate(() => { (window as any).fixture.defer = true; });
    await page.getByRole('button', { name: '목록 재생 구간 조정', exact: true }).click();
    await page.getByText('구간 정보를 불러오는 중…', { exact: true }).waitFor();
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.evaluate(() => { (window as any).fixture.resolveLoad(); });
    expect(await page.getByRole('textbox', { name: /종료 시각/ }).count()).toBe(0);
    expect(await page.evaluate(() => (window as any).fixture.players.inline.playing)).toBe(true);
  });
  it('계정 변경 전 저장의 늦은 응답은 새 편집창을 닫거나 공유를 이어가지 않는다', async () => {
    await page.evaluate(() => { (window as any).fixture.deferSave = true; });
    await edit();
    const end = page.getByRole('textbox', { name: /종료 시각/ });
    await end.fill('90'); await end.press('Enter');
    await page.getByRole('button', { name: '저장하고 공유', exact: true }).click();
    await page.waitForFunction(() => !!(window as any).fixture.resolveSave);
    await page.evaluate(() => (window as any).fixture.setOwner('user-2'));
    await page.getByRole('textbox', { name: /종료 시각/ }).waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '목록 재생 구간 조정', exact: true }).click();
    await page.getByRole('textbox', { name: /종료 시각/ }).waitFor();
    await page.evaluate(() => { (window as any).fixture.deferSave = false; (window as any).fixture.resolveSave(); });
    await expect.poll(() => page.getByRole('textbox', { name: /종료 시각/ }).inputValue()).toBe('3:20.0');
    expect(await page.evaluate(() => (window as any).fixture.calls.map((call: any) => call.action))).toEqual(['personal']);
  });
});
