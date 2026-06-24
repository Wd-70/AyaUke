/* 방종셀카 수집기 — 백그라운드 서비스 워커.
 * 후보별 이미지를 확장 컨텍스트에서 fetch(쿠키/Referer 포함)해 base64로 만들고
 * 로컬 dev 서버의 수집 엔드포인트로 전송한다. (관리자로 localhost:3000 로그인 필요) */

const BASE = 'http://localhost:3000';
const INGEST_URL = `${BASE}/api/admin/selfie/ingest`;
const DEBUG_URL = `${BASE}/api/admin/selfie/debug`;

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

/** 개발용 덤프 전송 — 크로스오리진 fetch는 백그라운드에서(팝업 직접 fetch는 MV3에서 막힐 수 있음) */
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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'ingest') {
    (async () => {
      const results = [];
      for (const c of msg.candidates || []) results.push(await ingestCandidate(c));
      sendResponse({ results });
    })();
    return true; // 비동기 응답
  }
  if (msg && msg.type === 'dump') {
    (async () => { sendResponse(await sendDump(msg.payload)); })();
    return true;
  }
});
