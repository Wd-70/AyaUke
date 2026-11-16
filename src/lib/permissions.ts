export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  SONG_ADMIN = 'song_admin', 
  AYAUKE_ADMIN = 'ayauke_admin', // 아야우케 관리자 (SONG_ADMIN과 동일한 권한)
  SONG_EDITOR = 'song_editor',
  USER = 'user'
}

export enum Permission {
  // 시스템 관리
  SYSTEM_ADMIN = 'system.admin',
  USER_MANAGE = 'users.manage',
  CLIPS_MANAGE = 'clips.manage',
  
  // 노래 관리
  SONGS_VIEW = 'songs.view',
  SONGS_CREATE = 'songs.create',
  SONGS_EDIT = 'songs.edit',
  SONGS_DELETE = 'songs.delete',
  SONGS_BULK_EDIT = 'songs.bulk_edit',
  SONGS_STATS = 'songs.stats',
}

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    Permission.SYSTEM_ADMIN,
    Permission.USER_MANAGE,
    Permission.SONGS_VIEW,
    Permission.SONGS_CREATE,
    Permission.SONGS_EDIT,
    Permission.SONGS_DELETE,
    Permission.SONGS_BULK_EDIT,
    Permission.SONGS_STATS,
  ],
  [UserRole.SONG_ADMIN]: [
    Permission.SONGS_VIEW,
    Permission.SONGS_CREATE,
    Permission.SONGS_EDIT,
    Permission.SONGS_DELETE,
    Permission.SONGS_BULK_EDIT,
    Permission.SONGS_STATS,
  ],
  [UserRole.AYAUKE_ADMIN]: [
    Permission.SONGS_VIEW,
    Permission.SONGS_CREATE,
    Permission.SONGS_EDIT,
    Permission.SONGS_DELETE,
    Permission.SONGS_BULK_EDIT,
    Permission.SONGS_STATS,
  ],
  [UserRole.SONG_EDITOR]: [
    Permission.SONGS_VIEW,
    Permission.SONGS_EDIT,
    Permission.SONGS_STATS,
  ],
  [UserRole.USER]: []
}

export const ADMIN_SCOPES = ['songs', 'clips', 'users', 'system'] as const;
export type AdminScope = typeof ADMIN_SCOPES[number];
export const ADMIN_SCOPE_LABELS: Record<AdminScope, string> = { songs: '노래', clips: '클립', users: '사용자', system: '시스템' };
export type PermissionSubject = string | { role?: string; adminScopes?: readonly AdminScope[] } | null | undefined;
const roleOf = (subject: PermissionSubject) => typeof subject === 'string' ? subject : subject?.role;
/** Missing field preserves legacy roles; an explicit empty array revokes all delegated access. */
export function getAdminScopes(subject: PermissionSubject): readonly AdminScope[] {
  if (isSuperAdmin(subject)) return ADMIN_SCOPES;
  if (typeof subject === 'object' && subject?.adminScopes !== undefined) return Array.isArray(subject.adminScopes) ? subject.adminScopes.filter(s => ADMIN_SCOPES.includes(s)) : [];
  return ['song_admin', 'ayauke_admin', 'song_editor'].includes(roleOf(subject) || '') ? ['songs'] : [];
}
export const canManageClips = (subject: PermissionSubject) => getAdminScopes(subject).includes('clips');
export const canManageUsers = (subject: PermissionSubject) => getAdminScopes(subject).includes('users');
export const canManageSystem = (subject: PermissionSubject) => getAdminScopes(subject).includes('system');
export function hasPermission(subject: PermissionSubject, permission: Permission): boolean {
  if (isSuperAdmin(subject)) return true;
  if (permission === Permission.CLIPS_MANAGE) return canManageClips(subject);
  if (permission === Permission.USER_MANAGE) return canManageUsers(subject);
  if (permission === Permission.SYSTEM_ADMIN) return canManageSystem(subject);
  if (typeof subject === 'object' && subject?.adminScopes !== undefined) return getAdminScopes(subject).includes('songs');
  const permissions = ROLE_PERMISSIONS[roleOf(subject) as UserRole] || []
  return permissions.includes(permission)
}

export function canAccessAdminPanel(subject: PermissionSubject): boolean {
  return getAdminScopes(subject).length > 0
}

export function isSuperAdmin(subject: PermissionSubject): boolean {
  return roleOf(subject) === UserRole.SUPER_ADMIN
}

export function canManageSongs(subject: PermissionSubject): boolean {
  return hasPermission(subject, Permission.SONGS_VIEW)
}

// 하위 호환성을 위한 임시 함수 (나중에 제거)
export function roleToIsAdmin(subject: PermissionSubject): boolean {
  return canAccessAdminPanel(subject)
}
