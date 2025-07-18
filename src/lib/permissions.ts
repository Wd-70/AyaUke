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
  
  // 노래 관리
  SONGS_VIEW = 'songs.view',
  SONGS_CREATE = 'songs.create',
  SONGS_EDIT = 'songs.edit',
  SONGS_DELETE = 'songs.delete',
  SONGS_BULK_EDIT = 'songs.bulk_edit',
  SONGS_STATS = 'songs.stats',
}

const ROLE_PERMISSIONS = {
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

export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[userRole] || []
  return permissions.includes(permission)
}

export function canAccessAdminPanel(role: UserRole): boolean {
  return role !== UserRole.USER
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN
}

export function canManageSongs(role: UserRole): boolean {
  return hasPermission(role, Permission.SONGS_VIEW)
}

// 하위 호환성을 위한 임시 함수 (나중에 제거)
export function roleToIsAdmin(role: UserRole): boolean {
  return role !== UserRole.USER
}