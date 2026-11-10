import { describe, expect, it } from 'vitest';
import { hasMobileTabs, isRouteWithin, mobileParent, mobileSection, MOBILE_TABS } from './navigation-model';

describe('mobile navigation', () => {
  it.each([
    ['/', 'home'], ['/songbook', 'songs'], ['/playlist/shared', 'songs'],
    ['/clips', 'clips'], ['/clip/shared', 'clips'], ['/player', 'library'],
    ['/player/uploads', 'library'], ['/clip-playlist/shared', 'library'],
  ])('%s stays in the correct section', (path, section) => {
    expect(mobileSection(path)).toBe(section);
    expect(hasMobileTabs(path)).toBe(true);
  });
  it.each(['/game', '/game/super-honeyz', '/admin', '/admin/songs', '/obs/overlay/id', '/embed/clip/id', '/clips-extra', '/player-other'])('does not add app tabs to %s', path => {
    expect(hasMobileTabs(path)).toBe(false);
  });
  it('allows account pages without selecting an unrelated primary tab', () => {
    expect(hasMobileTabs('/profile')).toBe(true);
    expect(mobileSection('/profile')).toBe(null);
  });
  it('uses stable parent destinations for deep links opened outside the app', () => {
    expect(mobileParent('/clip/shared')?.href).toBe('/clips');
    expect(mobileParent('/clip-playlist/shared')?.href).toBe('/player');
    expect(mobileParent('/player/uploads')?.href).toBe('/player');
    expect(mobileParent('/playlist/shared')?.href).toBe('/songbook');
    expect(mobileParent('/')).toBe(null);
  });
  it('matches complete route segments and never treats home as a prefix', () => {
    expect(isRouteWithin('/clips', '/')).toBe(false);
    expect(isRouteWithin('/clips-other', '/clips')).toBe(false);
    expect(isRouteWithin('/clips/nested', '/clips')).toBe(true);
  });
  it('exposes distinct real destinations', () => {
    expect(new Set(MOBILE_TABS.map(tab => tab.href)).size).toBe(4);
  });
});
