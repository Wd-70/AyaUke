import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { build } from 'vite';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { createRequire } from 'node:module';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { WorkflowItem } from './types';

// 실제 컴포넌트를 번들링하고 API·영상만 대체한다. 서버·DB에 접근하지 않는다.
describe('mobile clip workflow', () => {
  let browser: Browser;
  let javascript: string;
  let css: string;
  beforeAll(async () => {
    const result = await build({
      configFile: false, logLevel: 'silent',
      oxc: { jsx: { runtime: 'automatic', development: false } },
      resolve: { alias: { '@': path.resolve('src') } },
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{
        name: 'workflow-browser-fixture',
        resolveId(id) {
          if (id === 'workflow-fixture') return '\0workflow-fixture.tsx';
          if (id.replaceAll('\\', '/').endsWith('/components/clip/ClipPlayer')) return '\0mock-youtube';
          if (id.replaceAll('\\', '/').endsWith('/components/video/ChzzkPlayer')) return '\0mock-chzzk';
        },
        load(id) {
          if (id === '\0workflow-fixture.tsx') return `
            import React from 'react'; import { createRoot } from 'react-dom/client';
            import ClipWorkflowTab from '${path.resolve('src/app/admin/tabs/clip-workflow/ClipWorkflowTab.tsx').replaceAll('\\', '/')}';
            window.React = React;
            window.playerMounts = 0; window.playerPosition = 0; window.playerState = 2;
            window.YT = { Player: class {
              constructor(node, options) { window.playerMounts++; this.frame = document.createElement('iframe'); this.frame.title = '테스트 영상'; this.frame.srcdoc = '<body style="background:black;color:white">테스트 영상</body>'; node.replaceWith(this.frame); setTimeout(() => options.events.onReady({ target: this }), 0); }
              getCurrentTime() { return window.playerPosition; }
              seekTo(value) { window.playerPosition = value; }
              getPlayerState() { return window.playerState; }
              playVideo() { window.playerState = 1; }
              pauseVideo() { window.playerState = 2; }
              destroy() { this.frame.remove(); }
            }};
            createRoot(document.getElementById('root')).render(<ClipWorkflowTab />);`;
          if (id === '\0mock-youtube') return 'export const loadYouTubeApi = () => Promise.resolve();';
          if (id === '\0mock-chzzk') return 'export default function ChzzkPlayer() { return null; }';
        },
      }],
      build: { write: false, minify: false, rollupOptions: { input: 'workflow-fixture', output: { inlineDynamicImports: true } } },
    });
    const output = Array.isArray(result) ? result[0] : result;
    if (!('output' in output)) throw new Error('Unexpected build output');
    javascript = output.output.filter((entry) => entry.type === 'chunk').map((entry) => entry.code).join('\n');
    const require = createRequire(import.meta.url);
    const config = require(path.resolve('tailwind.config.js'));
    css = (await postcss([tailwindcss({ ...config, content: ['./src/app/admin/tabs/clip-workflow/**/*.tsx', './src/app/admin/tabs/live-clips/ClipTimeEditor.tsx', './src/app/admin/tabs/live-clips/ClipVerifyButton.tsx'] })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined })).css;
    browser = await chromium.launch({ headless: true });
  }, 60000);
  afterAll(async () => { await browser?.close(); });

  async function fixture(width = 390, unmatched = false) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const song = { id: 'song', artist: '가수', title: '곡', clipDuration: 240 };
    const items: WorkflowItem[] = Array.from({ length: 24 }, (_, index) => ({ id: `item-${index}`, platform: 'youtube', videoId: 'video', videoUrl: 'https://www.youtube.com/watch?v=video', videoTitle: '모바일 작업 영상', date: '2026-10-09', artist: '가수', songTitle: `곡 ${index + 1}`, startTimeSeconds: 10 + index * 300, endTimeSeconds: 250 + index * 300, matchedSongId: 'song', isRelevant: true, isExcluded: false, isTimeVerified: false, commentAuthor: '작성자' }));
    items[23] = { ...items[23], videoId: 'other-video', videoTitle: '다른 작업 영상', videoUrl: 'https://www.youtube.com/watch?v=other-video' };
    if (unmatched) items[0] = { ...items[0], artist: '미등록 가수', songTitle: '미등록 노래', matchedSongId: undefined };
    const otherCandidates = Array.from({ length: 51 }, (_, index) => ({ ...items[0], id: `candidate-${index}`, videoId: 'envhVMj3mc4', videoTitle: `다른 방송 ${index + 1}` }));
    let clips = [0, 1].map((index) => ({ _id: `clip-${index}`, songId: 'song', platform: 'youtube', videoId: 'video', videoUrl: items[0].videoUrl, title: `클립 ${index + 1}`, artist: '가수', startTime: 10 + index * 300, endTime: 250 + index * 300, description: '', isVerified: false, songDetail: song }));
    const control = { failSave: false, delay: 0, saves: 0, candidateRequests: 0, candidateFail: false, candidateDelay: 0, candidateQuery: '', candidatePage: 0 };
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'workflow.test') return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script type="module">${javascript}</script></body></html>` });
      let data: unknown = {};
      if (url.pathname.endsWith('/songs')) data = { songs: [song] };
      else if (url.pathname.endsWith('/videos')) data = { videos: Array.from({ length: 30 }, (_, index) => ({ platform: 'youtube', videoId: index ? `video-${index}` : 'video', title: index ? `다른 영상 ${index}` : '모바일 작업 영상', date: '2026-10-09', timelineCommentCount: 1, parsedCount: 24, matchedCount: 24, verifiedCount: 0, clipCount: 2 })) };
      else if (url.pathname.endsWith('/video')) data = { comments: [], items, existingClips: [] };
      else if (url.pathname.endsWith('/song-statuses')) data = { statuses: [{ songId: 'song', occurrences: 24, clips: 2 }] };
      else if (url.pathname.endsWith('/song-work')) data = { occurrences: items, clips: [], candidates: [] };
      else if (url.pathname.endsWith('/search-timelines')) data = { items };
      else if (url.pathname.endsWith('/candidates')) {
        control.candidateRequests++;
        control.candidateQuery = url.searchParams.get('q') || '';
        control.candidatePage = Number(url.searchParams.get('page')) || 1;
        if (control.candidateDelay) await new Promise(resolve => setTimeout(resolve, control.candidateDelay));
        if (control.candidateFail) return route.fulfill({ status: 500, json: { success: false, error: { message: '후보 조회 실패' } } });
        const list = control.candidateQuery === '없는 곡' ? [] : otherCandidates;
        data = { items: list.slice((control.candidatePage - 1) * 50, control.candidatePage * 50), total: list.length, page: control.candidatePage, pageSize: 50 };
      }
      else if (url.pathname.includes('/item/')) {
        control.saves++;
        if (control.delay) await new Promise((resolve) => setTimeout(resolve, control.delay));
        if (control.failSave) return route.fulfill({ status: 500, json: { success: false, error: { message: '테스트 저장 실패' } } });
        const item = items.find((item) => item.id === decodeURIComponent(url.pathname.split('/').at(-1)!))!;
        Object.assign(item, route.request().postDataJSON());
        data = { item };
      } else if (url.pathname === '/api/admin/clips') {
        if (route.request().method() === 'PATCH') {
          const request = route.request().postDataJSON();
          const clip = clips.find((clip) => clip._id === request.clipId)!;
          Object.assign(clip, request.data || {});
          return route.fulfill({ json: { success: true, clip } });
        }
        if (route.request().method() === 'DELETE') clips = clips.filter((clip) => clip._id !== url.searchParams.get('clipId'));
        data = { clips };
      }
      return route.fulfill({ json: { success: true, data } });
    });
    await page.goto('http://workflow.test/');
    await page.getByRole('button', { name: '모바일 작업 영상', exact: false }).click().catch(async (error) => { throw new Error(`${error.message}\n${errors.join('\n')}\n${(await page.locator('body').innerText()).slice(0,1200)}`); });
    if (width < 1024) await page.getByRole('button', { name: `${items[0].artist} - ${items[0].songTitle} 편집`, exact: true }).waitFor();
    else await page.getByText(`${items[0].artist} - ${items[0].songTitle}`, { exact: true }).first().waitFor();
    return { page, errors, control };
  }

  async function scrollContainers(page: Page) {
    return page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('*')).filter((element) => element.getClientRects().length && ['auto', 'scroll'].includes(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1).length);
  }

  it('uses one scroller, restores the list, keeps the player and waits for saves', async () => {
    const { page, errors, control } = await fixture();
    expect(await scrollContainers(page)).toBe(1);
    await page.getByRole('button', { name: '가수 - 곡 7 편집', exact: true }).scrollIntoViewIfNeeded();
    const listPosition = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('*')).find((element) => element.getClientRects().length && getComputedStyle(element).overflowY === 'auto' && element.scrollHeight > element.clientHeight)?.scrollTop);
    await page.getByRole('button', { name: '가수 - 곡 7 편집', exact: true }).click();
    const mounts = await page.evaluate(() => (window as unknown as { playerMounts: number }).playerMounts);
    await page.getByRole('button', { name: '1초 앞으로', exact: true }).click();
    const position = await page.evaluate(() => (window as unknown as { playerPosition: number }).playerPosition);
    await page.getByRole('button', { name: '← 타임라인', exact: true }).click();
    await page.getByRole('button', { name: '가수 - 곡 7 편집', exact: true }).waitFor();
    expect(await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('*')).find((element) => element.getClientRects().length && getComputedStyle(element).overflowY === 'auto' && element.scrollHeight > element.clientHeight)?.scrollTop)).toBe(listPosition);
    await page.getByRole('button', { name: '가수 - 곡 7 편집', exact: true }).click();
    expect(await page.evaluate(() => (window as unknown as { playerPosition: number }).playerPosition)).toBe(position);
    expect(await page.evaluate(() => (window as unknown as { playerMounts: number }).playerMounts)).toBe(mounts);
    await page.getByLabel('시작 시간 (초)', { exact: true }).fill('');
    await page.getByRole('button', { name: '1초 앞으로', exact: true }).click();
    expect(control.saves).toBe(0);
    expect(await page.getByLabel('시작 시간 (초)', { exact: true }).inputValue()).toBe('1810');
    control.delay = 250;
    await page.getByLabel('시작 시간 (초)', { exact: true }).fill('1830.5');
    await page.getByRole('button', { name: '다음 항목 →', exact: true }).click();
    await page.getByText('8 / 24', { exact: true }).waitFor();
    expect(control.saves).toBe(1);
    control.failSave = true;
    await page.getByLabel('시작 시간 (초)', { exact: true }).fill('2120');
    await page.getByRole('button', { name: '다음 항목 →', exact: true }).click();
    await page.getByRole('alert').waitFor();
    expect(await page.getByText('8 / 24', { exact: true }).isVisible()).toBe(true);
    control.failSave = false;
    await page.getByRole('button', { name: '저장 다시 시도' }).click();
    await page.getByText('저장됨', { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 400 });
    expect(await page.getByRole('button', { name: '다음 항목 →', exact: true }).isVisible()).toBe(true);
    expect(await scrollContainers(page)).toBe(1);
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await page.evaluate(() => (window as unknown as { playerMounts: number }).playerMounts)).toBe(mounts);
    expect(errors).toEqual([]);
    await page.close();
  }, 30000);

  it('protects unsaved clips and keeps nested dialogs locked', async () => {
    const { page, errors } = await fixture(360);
    await page.getByRole('button', { name: '생성된 클립 보기 (2)', exact: true }).click();
    await page.getByRole('button', { name: '클립 1', exact: false }).click();
    await page.getByPlaceholder('설명', { exact: true }).fill('모바일 편집');
    await page.getByRole('button', { name: '다음 클립 →', exact: true }).click();
    await page.getByRole('alertdialog').waitFor();
    await page.getByRole('button', { name: '계속 편집', exact: true }).click();
    expect(await page.getByPlaceholder('설명', { exact: true }).inputValue()).toBe('모바일 편집');
    await page.getByRole('button', { name: '다음 클립 →', exact: true }).click();
    await page.getByRole('button', { name: '저장하고 이동', exact: true }).click();
    await page.getByText('2 / 2', { exact: true }).waitFor();
    await page.getByRole('button', { name: '생성된 클립 확인 닫기' }).click();
    expect(await page.evaluate(() => document.body.style.position)).toBe('fixed');
    await page.getByRole('button', { name: '← 영상 목록', exact: true }).click();
    expect(await page.evaluate(() => document.body.style.position)).not.toBe('fixed');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('workflow-video-chzzk-video');
    expect(errors).toEqual([]);
    await page.close();
  }, 30000);

  it('opens song and unmatched editors without stacked lists', async () => {
    const { page, errors } = await fixture(430);
    await page.getByRole('button', { name: '← 영상 목록', exact: true }).click();
    await page.getByRole('button', { name: '곡 단위', exact: true }).click();
    await page.getByRole('button', { name: '곡 가수 출현 24 클립 2', exact: false }).click();
    await page.getByRole('button', { name: '다른 작업 영상 출현 편집', exact: true }).click();
    expect(await page.getByRole('button', { name: '← 타임라인', exact: true }).isVisible()).toBe(true);
    await page.getByRole('button', { name: '← 곡 목록', exact: true }).click();
    await page.getByPlaceholder('곡 검색 (비우면 출현·클립 있는 곡)').fill('미등록');
    await page.getByRole('button', { name: '미등록 타임라인 검색', exact: false }).click();
    await page.getByRole('button', { name: '가수 - 곡 1 편집', exact: true }).click();
    expect(await page.getByRole('button', { name: '← 타임라인', exact: true }).isVisible()).toBe(true);
    await page.screenshot({ path: path.join(tmpdir(), 'ayauke-mobile-clip-editor.png'), fullPage: false });
    expect(errors).toEqual([]);
    await page.close();
  }, 30000);

  it('looks up other unmatched candidates only after a click, with accurate pagination and no saves', async () => {
    const { page, errors, control } = await fixture(390, true);
    await page.getByRole('button', { name: '미등록 가수 - 미등록 노래 편집', exact: true }).click();
    const trigger = page.getByRole('button', { name: '다른 미매칭 후보 보기', exact: true });
    await trigger.waitFor();
    expect(control.candidateRequests).toBe(0);
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '다른 미매칭 후보', exact: true });
    await dialog.getByText('다른 미매칭 후보 총 51건', { exact: false }).waitFor();
    expect(control.candidateRequests).toBe(1);
    expect(control.candidateQuery).toBe('미등록 노래');
    expect(await dialog.locator('li').count()).toBe(50);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.getByRole('button', { name: '다음 페이지', exact: true }).evaluate(element => element === document.activeElement)).toBe(true);
    await dialog.getByLabel('후보 검색어 (곡명·가수)').fill('없는 곡');
    expect(control.candidateRequests).toBe(1);
    await dialog.getByRole('button', { name: '다음 페이지', exact: true }).click();
    await dialog.getByText('51~51건 표시', { exact: false }).waitFor();
    expect(control.candidateQuery).toBe('미등록 노래');
    expect(await dialog.locator('li').count()).toBe(1);
    await dialog.getByRole('button', { name: '검색', exact: true }).click();
    await dialog.getByText('다른 미매칭 후보 총 0건', { exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    expect(await page.evaluate(() => document.body.style.position)).toBe('fixed');
    expect(await trigger.evaluate(element => element === document.activeElement)).toBe(true);
    expect(control.saves).toBe(0);
    expect(errors).toEqual([]);
    await page.close();
  }, 30000);

  it('handles failed lookups and closing during a request without stale dialogs', async () => {
    const { page, errors, control } = await fixture(1280, true);
    const trigger = page.getByRole('button', { name: '다른 미매칭 후보 보기', exact: true });
    await trigger.waitFor();
    control.candidateFail = true;
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '다른 미매칭 후보', exact: true });
    await dialog.getByRole('alert').waitFor();
    control.candidateFail = false;
    await dialog.getByRole('button', { name: '검색', exact: true }).click();
    await dialog.getByText('다른 미매칭 후보 총 51건', { exact: false }).waitFor();
    await dialog.getByRole('button', { name: '미매칭 후보 닫기' }).click();
    control.candidateDelay = 250;
    await trigger.click();
    await dialog.getByRole('button', { name: '미매칭 후보 닫기' }).click();
    await page.waitForTimeout(300);
    expect(await dialog.count()).toBe(0);
    expect(control.saves).toBe(0);
    expect(errors).toEqual([]);
    await page.close();
  }, 30000);
});
