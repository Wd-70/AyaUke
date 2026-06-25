/* 방종셀카 수집기 — 주입/공유 함수.
 * scanFrame/dumpFrame 은 chrome.scripting.executeScript({func}) 로 페이지에 주입되므로
 * 반드시 자체 완결형(바깥 스코프 참조 금지)이어야 한다.
 * 팝업(<script src>)과 백그라운드(importScripts) 양쪽에서 로드되어 공유된다. */

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

    // 원본 해상도 수집: pstatic CDN의 ?type=w1600 등 리사이즈 파라미터를 제거하면 원본을 받는다.
    const origUrl = (u) => {
      try {
        const x = new URL(u, location.href);
        if (x.hostname.endsWith('pstatic.net')) { x.searchParams.delete('type'); return x.toString(); }
      } catch (_) {}
      return u;
    };
    let imgs = [...container.querySelectorAll('img')]
      .map((i) => i.currentSrc || i.src || i.getAttribute('data-src') || '')
      .filter(Boolean)
      .filter((s) => HOSTS.includes(hostOf(s)))
      .map(origUrl);
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

  // 글 목록 페이지용: 게시글 링크 후보(제목+URL). 회원 작성글/게시판 목록 구조 파악에 쓴다.
  const linkSeen = new Set();
  const links = [];
  document.querySelectorAll('a[href*="/articles/"], a[href*="articleid="], a[href*="ArticleRead"]').forEach((a) => {
    const href = a.href;
    if (!href || linkSeen.has(href)) return;
    linkSeen.add(href);
    if (links.length < 80) {
      links.push({ href, text: (a.textContent || '').trim().slice(0, 60), anc: ancestry(a).slice(0, 5) });
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
    linkCount: links.length,
    links,
  };
}

/** 글 목록(회원 작성글/게시판)에서 게시글 항목 추출: a.article 의 제목+articleid → 새 URL. 댓글링크(a.cmt) 제외. */
function scanListFrame() {
  if (!location.hostname.includes('cafe.naver.com')) return { items: [] };
  const items = [];
  const seen = new Set();
  document.querySelectorAll('a.article').forEach((a) => {
    const href = a.href || '';
    const idm = href.match(/articleid=(\d+)/) || href.match(/\/articles\/(\d+)/);
    if (!idm) return;
    const id = idm[1];
    if (seen.has(id)) return;
    seen.add(id);
    const cm = href.match(/clubid=(\d+)/) || href.match(/cafes\/(\d+)/) || location.href.match(/cafes\/(\d+)/);
    const club = cm ? cm[1] : '';
    const title = (a.textContent || '').trim();
    items.push({ articleid: id, title, url: club ? `https://cafe.naver.com/ca-fe/cafes/${club}/articles/${id}` : href });
  });
  return { listUrl: location.href, items };
}

/** X 미디어/프로필 탭을 아래로 스크롤하며 본인 계정 status URL을 모은다(가상 스크롤 대비 매 회 수집).
 * 활성 탭(최상위 프레임)에서 async 로 주입된다. 반환: { items:[{id,url}], scrolls, stoppedBy } */
async function scanXMediaFrame() {
  const host = location.hostname;
  if (!(host.includes('x.com') || host.includes('twitter.com'))) return { items: [], stoppedBy: 'not-x' };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const me = (location.pathname.split('/')[1] || '').toLowerCase(); // 미디어 탭 주인(본인) 핸들
  const ids = new Map(); // id -> url
  const collect = () => {
    document.querySelectorAll('a[href*="/status/"]').forEach((a) => {
      const m = (a.getAttribute('href') || '').match(/^\/?([^/]+)\/status\/(\d+)/);
      if (!m) return;
      if (me && m[1].toLowerCase() !== me) return; // 사이드바(트렌드/추천) 타 계정 글 제외
      if (!ids.has(m[2])) ids.set(m[2], `https://x.com/${m[1]}/status/${m[2]}`);
    });
  };

  const startT = Date.now();
  const MAX_MS = 180000;     // 최대 3분
  const STABLE_STOP = 10;    // 새 글 없이 N회 연속이면 끝으로 간주
  let stable = 0, last = 0, scrolls = 0, stoppedBy = 'max-time';
  for (; Date.now() - startT < MAX_MS; scrolls++) {
    collect();
    window.scrollBy(0, Math.round(window.innerHeight * 0.9));
    await sleep(650);
    if (ids.size === last) { if (++stable >= STABLE_STOP) { stoppedBy = 'end'; break; } }
    else { stable = 0; last = ids.size; }
  }
  collect();
  return { items: [...ids.entries()].map(([id, url]) => ({ id, url })), scrolls, stoppedBy };
}

/** 여러 프레임의 scanFrame 결과를 sourceUrl 기준으로 합친다(이미지 합집합). */
function mergeCandidates(frameResults) {
  const map = new Map();
  (frameResults || []).forEach((f) => ((f && f.candidates) || []).forEach((c) => {
    if (!map.has(c.sourceUrl)) map.set(c.sourceUrl, { ...c, images: [...c.images] });
    else {
      const e = map.get(c.sourceUrl);
      const seen = new Set(e.images.map((i) => i.imageUrl));
      c.images.forEach((i) => { if (!seen.has(i.imageUrl)) e.images.push(i); });
      if (!e.postedAt && c.postedAt) e.postedAt = c.postedAt;
    }
  }));
  return [...map.values()];
}
