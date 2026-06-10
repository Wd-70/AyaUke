import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { fetchVideoStreamInfo } from '@/domains/archive/chzzk.client';

const Query = z.object({
  videoNo: z.coerce.number().int().positive(),
});

/**
 * 치지직 다시보기 스트림 정보 (공개).
 * 라이브 클립은 비로그인 방문자도 시청하는 기능이므로 인증을 요구하지 않는다.
 * 스트림 URL은 만료될 수 있어 캐시/저장하지 않고 재생 시마다 조회한다.
 * streamType: 'hls'(구 임시 다시보기) | 'mp4'(영구 보존 VOD)
 */
export const GET = withApi({ schema: Query }, async ({ input }) => {
  const info = await fetchVideoStreamInfo(input.videoNo);
  // hlsUrl은 기존 소비자 호환 필드
  return ok({ ...info, hlsUrl: info.streamUrl });
});
