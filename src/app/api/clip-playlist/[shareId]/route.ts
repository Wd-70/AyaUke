import { NextResponse } from 'next/server'
import { withApi } from '@/shared/api/handler'
import { getSharedClipPlaylist } from '@/domains/engagement/clip-playlist.service'
import '@/domains/archive/schemas/song-video.schema' // populate를 위한 SongVideo 모델 등록

/**
 * 공유 링크로 클립 플레이리스트 조회 (공개 라우트).
 * 페이지 URL(/clip-playlist/[shareId])이 사용자에게 공유되므로 이 경로는 유지한다.
 */
export const GET = withApi({}, async ({ session, params }) => {
  const data = await getSharedClipPlaylist(params.shareId, session?.user?.channelId ?? null)
  return NextResponse.json(data)
})
