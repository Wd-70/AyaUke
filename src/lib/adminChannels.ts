import { UserRole } from './permissions'

// 최고 관리자 권한을 가진 치지직 채널 ID 목록 (하드코딩)
export const SUPER_ADMIN_CHANNEL_IDS = [
  'd6017f757614569add71b0bc83a81382', // 사용자 (개발자)
] as const

// 아야우케 관리자 권한을 가진 치지직 채널 ID 목록 (하드코딩)
export const AYAUKE_ADMIN_CHANNEL_IDS = [
  'abe8aa82baf3d3ef54ad8468ee73e7fc', // 아야우케 (노래책 관리자)
] as const

// 최고 관리자 채널 정보
export const SUPER_ADMIN_CHANNELS = {
  'd6017f757614569add71b0bc83a81382': {
    name: '개발자',
    role: '개발 관리자',
  },
} as const

// 아야우케 관리자 채널 정보  
export const AYAUKE_ADMIN_CHANNELS = {
  'abe8aa82baf3d3ef54ad8468ee73e7fc': {
    name: '아야우케',
    role: '노래책 관리자',
  },
} as const

export function isSuperAdminChannel(channelId: string | null | undefined): boolean {
  if (!channelId) return false
  return SUPER_ADMIN_CHANNEL_IDS.includes(channelId as any)
}

export function isAyaukeAdminChannel(channelId: string | null | undefined): boolean {
  if (!channelId) return false
  return AYAUKE_ADMIN_CHANNEL_IDS.includes(channelId as any)
}

export function getSuperAdminInfo(channelId: string | null | undefined) {
  if (!channelId || !isSuperAdminChannel(channelId)) return null
  return SUPER_ADMIN_CHANNELS[channelId as keyof typeof SUPER_ADMIN_CHANNELS] || null
}

export function getAyaukeAdminInfo(channelId: string | null | undefined) {
  if (!channelId || !isAyaukeAdminChannel(channelId)) return null
  return AYAUKE_ADMIN_CHANNELS[channelId as keyof typeof AYAUKE_ADMIN_CHANNELS] || null
}

export function getStaticUserRole(channelId: string | null | undefined): UserRole {
  if (!channelId) return UserRole.USER
  
  if (isSuperAdminChannel(channelId)) {
    return UserRole.SUPER_ADMIN
  }
  
  if (isAyaukeAdminChannel(channelId)) {
    return UserRole.AYAUKE_ADMIN
  }
  
  return UserRole.USER
}

// 하위 호환성을 위한 함수들 (나중에 제거)
export function isAdminChannel(channelId: string | null | undefined): boolean {
  return isSuperAdminChannel(channelId) || isAyaukeAdminChannel(channelId)
}

export function getAdminInfo(channelId: string | null | undefined) {
  return getSuperAdminInfo(channelId) || getAyaukeAdminInfo(channelId)
}