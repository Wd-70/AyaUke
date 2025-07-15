// 관리자 권한을 가진 치지직 채널 ID 목록
export const ADMIN_CHANNEL_IDS = [
  'abe8aa82baf3d3ef54ad8468ee73e7fc', // 아야우케
  'd6017f757614569add71b0bc83a81382', // 사용자 (개발자)
  // 여기에 추가 관리자 채널 ID를 추가하세요
] as const

// 관리자 채널 정보 (선택사항 - UI 표시용)
export const ADMIN_CHANNELS = {
  'abe8aa82baf3d3ef54ad8468ee73e7fc': {
    name: '아야우케',
    role: '메인 관리자',
    permissions: ['all']
  },
  'd6017f757614569add71b0bc83a81382': {
    name: '개발자',
    role: '개발 관리자',
    permissions: ['all']
  },
  // 추가 관리자 정보
} as const

export function isAdminChannel(channelId: string | null | undefined): boolean {
  if (!channelId) return false
  return ADMIN_CHANNEL_IDS.includes(channelId as string)
}

export function getAdminInfo(channelId: string | null | undefined) {
  if (!channelId || !isAdminChannel(channelId)) return null
  return ADMIN_CHANNELS[channelId as keyof typeof ADMIN_CHANNELS] || null
}