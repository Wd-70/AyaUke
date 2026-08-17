/*
 * AyaUke PWA 서비스워커 (경량·보수적).
 * - 페이지 내비게이션: 네트워크 우선, 실패 시 캐시 → 오프라인 폴백
 * - 동일 출처 정적 자산(_next/static, /icons, 이미지): 캐시 우선
 * - API·영상 스트림·타 출처(pbs.twimg, googlevideo, chzzk CDN 등): 개입하지 않음(그대로 통과)
 * 영상/HLS/Range 요청을 절대 가로채지 않아 재생에 영향을 주지 않는다.
 */
const VERSION = 'v1';
const STATIC_CACHE = `ayauke-static-${VERSION}`;
const PAGE_CACHE = `ayauke-pages-${VERSION}`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png']).catch(() => {}),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:png|jpg|jpeg|webp|svg|gif|ico|woff2?)$/i.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 타 출처(영상 CDN, 썸네일 등)는 개입하지 않음
  if (url.origin !== self.location.origin) return;
  // API·영상 스트림 관련 경로는 절대 캐시/가로채지 않음
  if (url.pathname.startsWith('/api/')) return;

  // 페이지 내비게이션: 네트워크 우선 → 캐시 → 오프라인
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGE_CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL))),
    );
    return;
  }

  // 정적 자산: 캐시 우선
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy)).catch(() => {});
            return res;
          }),
      ),
    );
  }
});
