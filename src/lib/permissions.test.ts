import { describe, expect, it } from 'vitest';
import { ADMIN_SCOPES, Permission, canAccessAdminPanel, canManageSongs, canManageClips, canManageUsers, canManageSystem, getAdminScopes, hasPermission } from './permissions';
import { AdminUserUpdate, canChangeGrants } from '@/domains/identity/admin-grants';

describe('additive administration permissions', () => {
  it.each(Array.from({ length: 16 }, (_, mask) => mask))('isolates all four scope combinations (%s)', mask => {
    const adminScopes = ADMIN_SCOPES.filter((_, i) => mask & (1 << i));
    const user = { role: 'user', adminScopes };
    expect(canAccessAdminPanel(user)).toBe(mask !== 0);
    [canManageSongs, canManageClips, canManageUsers, canManageSystem].forEach((check, i) => expect(check(user)).toBe(!!(mask & (1 << i))));
    expect(hasPermission(user, Permission.SONGS_DELETE)).toBe(adminScopes.includes('songs'));
  });
  it('preserves legacy editor restrictions until explicit grants replace the role', () => {
    expect(getAdminScopes({ role: 'song_editor' })).toEqual(['songs']);
    expect(hasPermission({ role: 'song_editor' }, Permission.SONGS_EDIT)).toBe(true);
    expect(hasPermission({ role: 'song_editor' }, Permission.SONGS_DELETE)).toBe(false);
    expect(canManageClips({ role: 'song_admin' })).toBe(false);
    expect(canManageSongs({ role: 'ayauke_admin' })).toBe(true);
    expect(canAccessAdminPanel({ role: 'song_admin', adminScopes: [] })).toBe(false);
    expect(canManageSongs({ role: 'song_admin', adminScopes: ['clips'] })).toBe(false);
  });
  it('keeps root access and denies unknown or absent roles', () => {
    expect(getAdminScopes({ role: 'super_admin', adminScopes: [] })).toEqual(ADMIN_SCOPES);
    for (const user of [null, undefined, { role: 'unknown' }, { role: 'user' }]) expect(canAccessAdminPanel(user)).toBe(false);
  });
  it('does not let delegated user/system managers change grants, or edit root grants', () => {
    expect(canChangeGrants({ role: 'user', adminScopes: ['users', 'system'] }, { role: 'user' })).toBe(false);
    expect(canChangeGrants('super_admin', 'user')).toBe(true);
    expect(canChangeGrants('super_admin', 'super_admin')).toBe(false);
  });
  it('strictly validates grants and rejects legacy role escalation', () => {
    for (const body of [{ role: 'super_admin' }, { adminScopes: ['unknown'] }, { adminScopes: ['songs', 'songs'] }, { adminScopes: null }]) expect(AdminUserUpdate.safeParse(body).success).toBe(false);
    expect(AdminUserUpdate.safeParse({ adminScopes: [] }).success).toBe(true);
    expect(AdminUserUpdate.safeParse({ adminScopes: [...ADMIN_SCOPES] }).success).toBe(true);
  });
});
