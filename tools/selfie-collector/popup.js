/* 방종셀카 수집기 — 팝업.
 * chrome.scripting.executeScript({allFrames:true}) 로 모든 프레임(카페 본문 iframe 포함)에서
 * 스캔/덤프 함수를 실행하고 결과를 합친다. */

const $ = (s) => document.querySelector(s);
let candidates = [];

// 토큰 설정 여부 안내
chrome.storage.local.get('selfieToken').then(({ selfieToken }) => {
  if (!selfieToken) $('#status').textContent = '⚠ 먼저 확장 옵션에서 토큰을 설정하세요 (확장 우클릭 → 옵션).';
});

function serverMsg(resp) {
  if (resp && resp.data && resp.data.error && resp.data.error.message) return resp.data.error.message;
  if (resp && resp.status === 0) return 'dev 서버 연결 실패(서버 켜짐 확인)';
  return resp ? `HTTP ${resp.status}` : '확장 통신 실패';
}

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
    // 본문 컨테이너 우선순위 — 에디터 본문(.se-main-container)부터. 댓글/프로필은 이 바깥이라 제외된다.
    // 컨테이너가 없는 프레임(최상위=카페 대문/사이드바)은 건너뛴다 → 배너 광고 오수집 방지.
    const SELS = ['.se-main-container', '#postViewArea', '.ContentRenderer', '.NHN_Writeform_Main', '.article_viewer'];
    let container = null;
    for (const s of SELS) { container = document.querySelector(s); if (container) break; }
    if (!container) return { candidates: [] };

    let imgs = [...container.querySelectorAll('img')]
      .map((i) => i.currentSrc || i.src || i.getAttribute('data-src') || '')
      .filter(Boolean)
      .filter((s) => HOSTS.includes(hostOf(s)));
    imgs = [...new Set(imgs)];
    if (imgs.length === 0) return { candidates: [] };

    // 게시물 작성일: .article_info .date 의 'YYYY.MM.DD. HH:MM' (댓글 .comment_info_date 는 제외).
    let postedAt = null;
    const dateEl = document.querySelector('.article_info .date') || document.querySelector('.WriterInfo .date');
    const m = (dateEl ? (dateEl.textContent || '').trim() : '')
      .match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?(?:\s*(\d{1,2}):(\d{2}))?/);
    if (m) {
      const p = (n) => String(n).padStart(2, '0');
      postedAt = `${m[1]}-${p(m[2])}-${p(m[3])}T${p(m[4] || 0)}:${p(m[5] || 0)}:00+09:00`;
    }

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
    // 크로스오리진 전송은 백그라운드 경유(팝업 직접 fetch는 MV3에서 'Failed to fetch'가 날 수 있음)
    chrome.runtime.sendMessage({ type: 'dump', payload }, async (resp) => {
      if (chrome.runtime.lastError || !resp) {
        $('#status').textContent = '덤프 전송 실패(확장 통신). 확장을 새로고침해 보세요.';
        return;
      }
      if (resp.ok) {
        $('#status').textContent = `덤프 저장됨: ${resp.data.path}\n프레임 ${results.length}개. 이 경로를 Claude에게 알려주세요.`;
        try { await navigator.clipboard.writeText(resp.data.path || ''); } catch (_) {}
      } else {
        $('#status').textContent = `덤프 전송 실패: ${serverMsg(resp)}`;
      }
    });
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
    if (ok === 0) {
      const first = resp.results[0];
      $('#status').textContent = `수집 실패: ${serverMsg(first)}`;
    } else {
      $('#status').textContent = `완료: ${ok}/${resp.results.length} 게시물 성공, 이미지 ${added}장 신규 저장`;
    }
  });
});
