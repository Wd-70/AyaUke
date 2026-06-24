/* 방종셀카 수집기 — 콘텐츠 스크립트.
 * 현재 페이지(X 타임라인/프로필 또는 네이버 카페 게시물)에서 셀카형 이미지 게시물 후보를 스캔한다.
 * 팝업에서 type:'scan' 메시지를 보내면 후보 목록을 반환한다. */

function highResTwimg(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'pbs.twimg.com' && u.pathname.startsWith('/media/')) {
      const fmt = u.searchParams.get('format') || 'jpg';
      return `${u.origin}${u.pathname}?format=${fmt}&name=orig`;
    }
  } catch (_) {}
  return url;
}

/** X(트위터): article 단위로 게시물 이미지·작성일·퍼머링크 추출 */
function scanX() {
  const out = new Map(); // sourceUrl -> candidate
  const articles = document.querySelectorAll('article[data-testid="tweet"], article[role="article"]');
  articles.forEach((a) => {
    const imgs = [...a.querySelectorAll('img[src*="pbs.twimg.com/media"]')]
      .map((i) => highResTwimg(i.src));
    if (imgs.length === 0) return;

    const timeEl = a.querySelector('time[datetime]');
    const postedAt = timeEl ? timeEl.getAttribute('datetime') : null;

    let sourceUrl = location.href.split('?')[0];
    const link = a.querySelector('a[href*="/status/"]');
    if (link) {
      try { sourceUrl = new URL(link.getAttribute('href'), location.origin).href.split('?')[0]; } catch (_) {}
    }

    const uniqImgs = [...new Set(imgs)].map((u) => ({ imageUrl: u }));
    if (out.has(sourceUrl)) {
      const cur = out.get(sourceUrl);
      const seen = new Set(cur.images.map((i) => i.imageUrl));
      uniqImgs.forEach((i) => { if (!seen.has(i.imageUrl)) cur.images.push(i); });
    } else {
      out.set(sourceUrl, { source: 'x', sourceUrl, postedAt, images: uniqImgs });
    }
  });
  return [...out.values()];
}

/** 네이버 카페/기타: 게시물 본문의 큰 이미지를 한 묶음으로 수집(작성일 best-effort) */
function scanGeneric() {
  const imgs = [...document.querySelectorAll('img')]
    .filter((i) => (i.naturalWidth || i.width || 0) >= 300)
    .map((i) => i.currentSrc || i.src)
    .filter(Boolean);
  if (imgs.length === 0) return [];

  const timeEl = document.querySelector('time[datetime]');
  const postedAt = timeEl ? timeEl.getAttribute('datetime') : null;
  const source = location.hostname.includes('cafe.naver') ? 'cafe' : 'x';

  return [{
    source,
    sourceUrl: location.href.split('?')[0],
    postedAt,
    images: [...new Set(imgs)].map((u) => ({ imageUrl: u })),
  }];
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'scan') {
    const host = location.hostname;
    const isX = host.includes('x.com') || host.includes('twitter.com');
    let candidates = [];
    try {
      candidates = isX ? scanX() : scanGeneric();
    } catch (e) {
      candidates = [];
    }
    sendResponse({ candidates });
  }
  return true;
});
