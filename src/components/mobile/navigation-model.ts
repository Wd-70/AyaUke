/** Route boundaries matter: /clips-extra must not activate /clips. */
export function isRouteWithin(path: string, base: string) {
  return path === base || (base !== '/' && path.startsWith(`${base}/`));
}

export const MOBILE_TABS = [
  { href: '/', label: '홈', section: 'home' },
  { href: '/songbook', label: '노래책', section: 'songs' },
  { href: '/clips', label: '클립', section: 'clips' },
  { href: '/player', label: '보관함', section: 'library' },
] as const;

export function mobileSection(path: string) {
  if (path === '/') return 'home';
  if (['/songbook', '/playlist'].some(base => isRouteWithin(path, base))) return 'songs';
  if (['/clips', '/clip'].some(base => isRouteWithin(path, base))) return 'clips';
  if (['/player', '/clip-playlist'].some(base => isRouteWithin(path, base))) return 'library';
  return null;
}

export function hasMobileTabs(path: string) {
  return mobileSection(path) !== null || isRouteWithin(path, '/profile');
}

export function mobileParent(path: string) {
  if (isRouteWithin(path, '/clip')) return { href: '/clips', label: '클립 목록' };
  if (isRouteWithin(path, '/clip-playlist') || path.startsWith('/player/')) return { href: '/player', label: '보관함' };
  if (isRouteWithin(path, '/playlist')) return { href: '/songbook', label: '노래책' };
  return null;
}
