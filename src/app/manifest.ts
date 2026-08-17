import type { MetadataRoute } from 'next';

/**
 * PWA 매니페스트 (Next.js 메타데이터 라우트 → /manifest.webmanifest).
 * 홈화면 설치 + 앱처럼 실행(standalone)을 위한 최소 구성.
 * start_url을 /player로 두어 설치된 앱은 바로 플레이어로 진입한다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '아야 AyaUke 노래책',
    short_name: 'AyaUke',
    description: '아야가 부르는 노래와 라이브 클립을 플레이리스트로 모아 듣는 노래책',
    start_url: '/player?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#D1AFE3',
    lang: 'ko',
    categories: ['music', 'entertainment'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: '플레이어', short_name: '플레이어', url: '/player', description: '내 클립 플레이리스트 재생' },
      { name: '라이브 클립', short_name: '클립', url: '/clips', description: '라이브 클립 갤러리' },
      { name: '노래책', short_name: '노래책', url: '/songbook', description: '노래 검색' },
    ],
  };
}
