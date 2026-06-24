/* 방종셀카 수집기 — 백그라운드 서비스 워커.
 * - 후보별 이미지를 확장 컨텍스트에서 fetch(쿠키/Referer 포함)해 base64로 만들고 로컬 dev 서버로 전송.
 * - 에이전트 모드: 서버 명령 큐를 long-poll로 가져와 활성 탭에서 스캔/수집/덤프를 실행하고 결과를 보고.
 * scanFrame/dumpFrame/mergeCandidates 는 inject.js에서 제공된다. */

importScripts('inject.js');

const BASE = 'http://localhost:3000';
const INGEST_URL = `${BASE}/api/admin/selfie/ingest`;
const DEBUG_URL = `${BASE}/api/admin/selfie/debug`;
const POLL_URL = `${BASE}/api/admin/selfie/agent/poll`;
const RESULT_URL = `${BASE}/api/admin/selfie/agent/result`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 옵션에 저장된 로컬 수집 토큰 (X-Selfie-Token). 세션 쿠키 대용. */
async function authHeaders() {
  try {
    const { selfieToken } = await chrome.storage.local.get('selfieToken');
    return selfieToken ? { 'X-Selfie-Token': selfieToken } : {};
  } catch (_) {
    return {};
  }
}

function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchImage(imageUrl) {
  try {
    const res = await fetch(imageUrl, { credentials: 'include' });
    if (!res.ok) return { imageUrl };
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buf = await res.arrayBuffer();
    return { imageUrl, dataBase64: bufferToBase64(buf), contentType };
  } catch (_) {
    return { imageUrl }; // 실패 시 URL만 보냄(서버가 직접 받아오기 시도)
  }
}

async function ingestCandidate(c) {
  const images = [];
  for (const img of c.images) images.push(await fetchImage(img.imageUrl));
  try {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({
        source: c.source,
        sourceUrl: c.sourceUrl,
        postedAt: c.postedAt || undefined,
        images,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data, sourceUrl: c.sourceUrl };
  } catch (e) {
    return { ok: false, status: 0, error: String(e), sourceUrl: c.sourceUrl };
  }
}

/** 개발용 덤프 전송 */
async function sendDump(payload) {
  try {
    const res = await fetch(DEBUG_URL, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

// ───────────────────────────────────────────────────────────────
// 탭 실행 헬퍼
// ───────────────────────────────────────────────────────────────

async function getActiveTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

async function runFrames(tabId, func) {
  const r = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func });
  return r.map((x) => x.result).filter(Boolean);
}

async function scanTab(tabId) {
  const frames = await runFrames(tabId, scanFrame);
  return mergeCandidates(frames);
}

function mergeList(frames) {
  const seen = new Set();
  const items = [];
  for (const f of frames) for (const it of (f && f.items) || []) {
    if (seen.has(it.articleid)) continue;
    seen.add(it.articleid);
    items.push(it);
  }
  return items;
}

/** 글 목록 페이지를 (URL이 있으면 백그라운드 탭으로 열어) 스캔해 게시글 항목을 반환. */
async function listTab(url) {
  if (url) {
    const tab = await chrome.tabs.create({ url, active: false });
    try {
      await waitTabComplete(tab.id, 20000);
      await sleep(4000); // 목록 iframe 렌더 대기
      const items = mergeList(await runFrames(tab.id, scanListFrame));
      return { listUrl: url, count: items.length, items };
    } finally {
      try { await chrome.tabs.remove(tab.id); } catch (_) {}
    }
  }
  const tab = await getActiveTab();
  if (!tab) return { error: '활성 탭 없음', items: [] };
  const items = mergeList(await runFrames(tab.id, scanListFrame));
  return { listUrl: tab.url, count: items.length, items };
}

function waitTabComplete(tabId, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (id, info) => { if (id === tabId && info.status === 'complete') finish(); };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((t) => { if (t && t.status === 'complete') finish(); }).catch(() => {});
    setTimeout(finish, timeoutMs);
  });
}

/** URL들을 백그라운드 탭으로 열어 본문 이미지만 가져온다(수집 없이 — 훑어보기용). */
async function peekUrls(urls) {
  const results = [];
  for (const url of urls || []) {
    const tab = await chrome.tabs.create({ url, active: false });
    try {
      await waitTabComplete(tab.id, 20000);
      await sleep(3500);
      const cands = await scanTab(tab.id);
      const c = cands[0] || null;
      results.push({
        url,
        postedAt: c ? c.postedAt : null,
        imageCount: c ? c.images.length : 0,
        images: c ? c.images.map((i) => i.imageUrl) : [],
      });
    } catch (e) {
      results.push({ url, error: String(e), images: [] });
    } finally {
      try { await chrome.tabs.remove(tab.id); } catch (_) {}
    }
  }
  return { results };
}

/** URL을 백그라운드 탭으로 열어 스캔·수집 후 닫는다. */
async function openCollect(url) {
  if (!url) return { ok: false, data: { error: 'url이 필요합니다.' } };
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    await waitTabComplete(tab.id, 20000);
    await sleep(3500); // SPA/본문 iframe 렌더 대기
    const cands = await scanTab(tab.id);
    const results = [];
    for (const c of cands) results.push(await ingestCandidate(c));
    return { ok: true, data: { url, candidates: cands.length, results } };
  } catch (e) {
    return { ok: false, data: { url, error: String(e) } };
  } finally {
    try { await chrome.tabs.remove(tab.id); } catch (_) {}
  }
}

// ───────────────────────────────────────────────────────────────
// 에이전트(서버→확장 명령 폴링)
// ───────────────────────────────────────────────────────────────

async function execCommand(cmd) {
  switch (cmd.type) {
    case 'ping':
      return { ok: true, data: { pong: true, at: Date.now() } };
    case 'scan': {
      const tab = await getActiveTab();
      if (!tab) return { ok: false, data: { error: '활성 탭 없음' } };
      return { ok: true, data: { pageUrl: tab.url, candidates: await scanTab(tab.id) } };
    }
    case 'ingest': {
      const tab = await getActiveTab();
      if (!tab) return { ok: false, data: { error: '활성 탭 없음' } };
      const cands = await scanTab(tab.id);
      const results = [];
      for (const c of cands) results.push(await ingestCandidate(c));
      return { ok: true, data: { pageUrl: tab.url, count: cands.length, results } };
    }
    case 'dump': {
      const tab = await getActiveTab();
      if (!tab) return { ok: false, data: { error: '활성 탭 없음' } };
      const frames = await runFrames(tab.id, dumpFrame);
      const r = await sendDump({ capturedAt: new Date().toISOString(), pageUrl: tab.url, frames });
      return { ok: r.ok, data: r.data };
    }
    case 'scanList':
      return { ok: true, data: await listTab(cmd.payload && cmd.payload.url) };
    case 'peek':
      return { ok: true, data: await peekUrls(cmd.payload && cmd.payload.urls) };
    case 'openCollect':
      return await openCollect(cmd.payload && cmd.payload.url);
    default:
      return { ok: false, data: { error: 'unknown command: ' + cmd.type } };
  }
}

let agentRunning = false;
async function startAgent() {
  if (agentRunning) return;
  agentRunning = true;
  try {
    for (;;) {
      const { agentEnabled } = await chrome.storage.local.get('agentEnabled');
      if (!agentEnabled) break;
      let cmd = null;
      try {
        const res = await fetch(POLL_URL, { headers: await authHeaders() });
        if (!res.ok) { await sleep(3000); continue; }
        const d = await res.json().catch(() => ({}));
        cmd = d && d.command;
      } catch (_) {
        await sleep(3000);
        continue;
      }
      if (!cmd) continue; // 20초 타임아웃 → 재폴링
      let out;
      try { out = await execCommand(cmd); } catch (e) { out = { ok: false, data: { error: String(e) } }; }
      try {
        await fetch(RESULT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({ id: cmd.id, ok: out.ok, data: out.data }),
        });
      } catch (_) { /* 결과 보고 실패는 무시(다음 명령 진행) */ }
    }
  } finally {
    agentRunning = false;
  }
}

async function maybeStartAgent() {
  const { agentEnabled } = await chrome.storage.local.get('agentEnabled');
  if (agentEnabled) startAgent();
}

// 메시지(팝업) 처리
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'ingest') {
    (async () => {
      const results = [];
      for (const c of msg.candidates || []) results.push(await ingestCandidate(c));
      sendResponse({ results });
    })();
    return true;
  }
  if (msg && msg.type === 'dump') {
    (async () => { sendResponse(await sendDump(msg.payload)); })();
    return true;
  }
  if (msg && msg.type === 'agentToggle') {
    (async () => {
      await chrome.storage.local.set({ agentEnabled: !!msg.enabled });
      if (msg.enabled) startAgent();
      sendResponse({ ok: true });
    })();
    return true;
  }
});

// SW 재기동 시 에이전트 복구 (alarms 하트비트 + 시작 이벤트)
chrome.runtime.onStartup.addListener(maybeStartAgent);
chrome.runtime.onInstalled.addListener(maybeStartAgent);
chrome.alarms.create('agentHeartbeat', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'agentHeartbeat') maybeStartAgent(); });
maybeStartAgent();
