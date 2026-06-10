import { NextResponse } from 'next/server';
import { withApi } from '@/shared/api/handler';
import { getSharedPlaylist } from '@/domains/engagement/playlist.service';
import '@/domains/catalog/song.schema'; // populate를 위한 모델 등록

/**
 * 공유 링크로 플레이리스트 조회 (공개 라우트).
 * 페이지 URL(/playlist/[shareId])이 사용자에게 공유되므로 이 경로는 유지한다.
 */
// NOTE: 성공 응답은 기존 소비자 호환을 위해 레거시 형태 유지 (Phase 5에서 envelope로 전환)
export const GET = withApi({}, async ({ session, params }) => {
  const data = await getSharedPlaylist(params.shareId, session?.user?.channelId ?? null);
  return NextResponse.json(data);
});
