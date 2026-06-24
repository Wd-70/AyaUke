/* 방종셀카 수집기 — 팝업.
 * chrome.scripting.executeScript({allFrames:true}) 로 모든 프레임(카페 본문 iframe 포함)에서
 * 스캔/덤프 함수를 실행하고 결과를 합친다. */

const $ = (s) => document.querySelector(s);
let candidates = [];

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** 모든 프레임에서 func 실행 → 각 프레임 result 배열 반환 */
async function runAllFrames(func) {
  const tab = await activeTab();
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func,
  });
  return { tab, results: results.map((r) => r.result).filter(Boolean) };
}

// ───────────────────────────────────────────────────────────────
// 주입 함수(자체 완결형 — 바깥 스코프 참조 금지)
// ───────────────────────────────────────────────────────────────

/** 셀카 후보 스캔: 카페는 본문 컨테이너+첨부 호스트만, X는 article 단위. */
function scanFrame() {
  const host = location.hostname;
  const isCafe = host.includes('cafe.naver.com');
  const isX = host.includes('x.com') || host.includes('twitter.com');
  const hostOf = (s) => { try { return new URL(s, location.href).hostname; } catch (_) { return ''; } };

  if (isCafe) {
    const HOSTS = [
      'cafeptthumb-phinf.pstatic.net',
      'postfiles.pstatic.net',
      'cafeskthumb-phinf.pstatic.net',
      'cafefiles.pstatic.net',
      'mblogthumb-phinf.pstatic.net',
    ];
    const container = document.querySelector(
      '.se-main-container, #postViewArea, .ContentRenderer, .article_viewer, .NHN_Writeform_Main',
    );
    const root = container || document.body;
    let imgs = [...root.querySelectorAll('img')]
      .map((i) => i.currentSrc || i.src)
      .filter(Boolean)
      .filter((s) => HOSTS.includes(hostOf(s)));
    imgs = [...new Set(imgs)];
    if (imgs.length === 0) return { candidates: [] };
    const t = document.querySelector('.se-main-container time[datetime], time[datetime]');
    const postedAt = t ? t.getAttribute('datetime') : null;
    return {
      candidates: [{
        source: 'cafe',
        sourceUrl: location.href.split('?')[0],
        postedAt,
        images: imgs.map((u) => ({ imageUrl: u })),
      }],
    };
  }

  if (isX) {
    const highRes = (url) => {
      try {
        const u = new URL(url);
        if (u.hostname === 'pbs.twimg.com' && u.pathname.startsWith('/media/')) {
          const f = u.searchParams.get('format') || 'jpg';
          return `${u.origin}${u.pathname}?format=${f}&name=orig`;
        }
      } catch (_) {}
      return url;
    };
    const out = new Map();
    document.querySelectorAll('article[data-testid="tweet"], article[role="article"]').forEach((a) => {
      const imgs = [...a.querySelectorAll('img[src*="pbs.twimg.com/media"]')].map((i) => highRes(i.src));
      if (imgs.length === 0) return;
      const tm = a.querySelector('time[datetime]');
      const postedAt = tm ? tm.getAttribute('datetime') : null;
      let su = location.href.split('?')[0];
      const l = a.querySelector('a[href*="/status/"]');
      if (l) { try { su = new URL(l.getAttribute('href'), location.origin).href.split('?')[0]; } catch (_) {} }
      const u = [...new Set(imgs)].map((x) => ({ imageUrl: x }));
      if (out.has(su)) {
        const c = out.get(su); const seen = new Set(c.images.map((i) => i.imageUrl));
        u.forEach((i) => { if (!seen.has(i.imageUrl)) c.images.push(i); });
      } else out.set(su, { source: 'x', sourceUrl: su, postedAt, images: u });
    });
    return { candidates: [...out.values()] };
  }

  return { candidates: [] };
}

/** 개발용 인벤토리: 모든 이미지의 호스트/크기/조상 + 후보 컨테이너 HTML + 날짜 후보. */
function dumpFrame() {
  const hostOf = (s) => { try { return new URL(s, location.href).hostname; } catch (_) { return ''; } };
  const ancestry = (el) => {
    const out = []; let n = el;
    for (let i = 0; i < 6 && n && n.tagName; i++) {
      let s = n.tagName;
      if (n.id) s += '#' + n.id;
      if (n.className && typeof n.className === 'string') {
        s += '.' + n.className.trim().split(/\s+/).slice(0, 3).join('.');
      }
      out.push(s); n = n.parentElement;
    }
    return out;
  };
  const imgs = [...document.querySelectorAll('img')]
    .map((i) => ({
      src: i.currentSrc || i.src || '',
      host: hostOf(i.currentSrc || i.src || ''),
      nw: i.naturalWidth || 0, nh: i.naturalHeight || 0,
      dw: i.width || 0, dh: i.height || 0,
      alt: (i.alt || '').slice(0, 40),
      anc: ancestry(i),
    }))
    .filter((o) => o.src);

  const CONTAINERS = ['.se-main-container', '#postViewArea', '.ContentRenderer', '.article_viewer', '.NHN_Writeform_Main', '#tbody', '.se-viewer'];
  const containers = CONTAINERS.map((sel) => {
    const el = document.querySelector(sel);
    return { sel, found: !!el, html: el ? el.outerHTML.slice(0, 700) : null };
  });

  const dateRe = /(\d{4}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2})|((오전|오후)\s?\d{1,2}:\d{2})/;
  const dates = [];
  document.querySelectorAll('time[datetime]').forEach((t) => {
    dates.push({ kind: 'time', datetime: t.getAttribute('datetime'), text: (t.textContent || '').trim().slice(0, 40), anc: ancestry(t).slice(0, 4) });
  });
  [...document.querySelectorAll('span,div,p,em,a,b')].slice(0, 5000).forEach((el) => {
    if (el.children.length !== 0) return;
    const tx = (el.textContent || '').trim();
    if (tx.length > 0 && tx.length <= 30 && dateRe.test(tx)) {
      dates.push({ kind: 'text', text: tx.slice(0, 40), anc: ancestry(el).slice(0, 4) });
    }
  });

  return {
    frameUrl: location.href,
    isTop: window.top === window,
    title: document.title,
    imgCount: imgs.length,
    imgs: imgs.slice(0, 100),
    containers,
    dates: dates.slice(0, 40),
  };
}

// ───────────────────────────────────────────────────────────────
// 오케스트레이션
// ───────────────────────────────────────────────────────────────

function fmtDate(iso) { try { return new Date(iso || Date.now()).toLocaleDateString('ko-KR'); } catch (_) { return '(날짜?)'; } }

function render() {
  const list = $('#list'); list.innerHTML = '';
  $('#ingest').disabled = candidates.length === 0;
  if (candidates.length === 0) { $('#status').textContent = '셀카 후보를 찾지 못했습니다. 본문이 보이는 글에서 다시 시도하거나 개발용 덤프를 보내주세요.'; return; }
  $('#status').textContent = `${candidates.length}개 게시물 후보 — 확인 후 '선택 수집'`;
  candidates.forEach((c, i) => {
    const div = document.createElement('div'); div.className = 'cand';
    const thumbs = c.images.map((im) => `<img src="${im.imageUrl}" referrerpolicy="no-referrer" />`).join('');
    div.innerHTML =
      `<label><input type="checkbox" data-i="${i}" checked /> ${fmtDate(c.postedAt)} · ${c.images.length}장 · ${c.source.toUpperCase()}</label>` +
      `<div class="thumbs">${thumbs}</div>` +
      `<div class="src">${c.sourceUrl}</div>`;
    list.appendChild(div);
  });
}

$('#scan').addEventListener('click', async () => {
  $('#status').textContent = '스캔 중...';
  try {
    const { results } = await runAllFrames(scanFrame);
    const map = new Map();
    results.forEach((f) => (f.candidates || []).forEach((c) => {
      if (!map.has(c.sourceUrl)) map.set(c.sourceUrl, c);
      else { const e = map.get(c.sourceUrl); const seen = new Set(e.images.map((i) => i.imageUrl)); c.images.forEach((i) => { if (!seen.has(i.imageUrl)) e.images.push(i); }); }
    }));
    candidates = [...map.values()];
    render();
  } catch (e) {
    $('#status').textContent = '스캔 실패: ' + String(e);
  }
});

$('#dump').addEventListener('click', async () => {
  $('#status').textContent = '덤프 수집 중...';
  try {
    const { tab, results } = await runAllFrames(dumpFrame);
    const payload = { capturedAt: new Date().toISOString(), pageUrl: tab.url, frames: results };
    const res = await fetch('http://localhost:3000/api/admin/selfie/debug', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      $('#status').textContent = `덤프 저장됨: ${data.path}\n프레임 ${results.length}개. 이 경로를 Claude에게 알려주세요.`;
      try { await navigator.clipboard.writeText(data.path || ''); } catch (_) {}
    } else {
      $('#status').textContent = `덤프 전송 실패(${res.status}) — localhost:3000 dev 서버 + 관리자 로그인을 확인하세요.`;
    }
  } catch (e) {
    $('#status').textContent = '덤프 실패: ' + String(e);
  }
});

$('#ingest').addEventListener('click', () => {
  const selected = [...document.querySelectorAll('#list input[type=checkbox]:checked')]
    .map((cb) => candidates[Number(cb.dataset.i)]).filter(Boolean);
  if (selected.length === 0) return;
  $('#ingest').disabled = true;
  $('#status').textContent = `${selected.length}개 전송 중...`;
  chrome.runtime.sendMessage({ type: 'ingest', candidates: selected }, (resp) => {
    $('#ingest').disabled = false;
    if (chrome.runtime.lastError || !resp) {
      $('#status').textContent = '전송 실패 — localhost:3000 dev 서버와 관리자 로그인을 확인하세요.';
      return;
    }
    const ok = resp.results.filter((r) => r.ok).length;
    const added = resp.results.reduce((s, r) => s + (r.data && r.data.addedImages ? r.data.addedImages : 0), 0);
    $('#status').textContent = `완료: ${ok}/${resp.results.length} 게시물 성공, 이미지 ${added}장 신규 저장`;
  });
});
