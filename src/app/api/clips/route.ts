import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { listPublicClips } from '@/domains/archive/clip.service';
import { listLikedClipIds } from '@/domains/engagement/clip-like.service';

const Query = z.object({
  sort: z.enum(['popular', 'mostPlayed', 'recent']).optional(),
  platform: z.enum(['all', 'youtube', 'chzzk']).optional(),
  verified: z.coerce.boolean().optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional(),
  liked: z.coerce.boolean().optional(),
});

// 공개 클립 갤러리 목록 (/clips). 정렬/플랫폼/검증/검색 + 페이지네이션.
// liked=true면 로그인 사용자가 좋아요한 클립만. (세션 의존이라 개인화 — 캐시 안 함)

export const GET = withApi({ schema: Query }, async ({ input, session }) => {
  let ids: string[] | undefined;
  if (input.liked) {
    const channelId = session?.user?.channelId;
    // 비로그인 → 빈 집합(결과 없음). 로그인 → 좋아요한 클립 id 집합으로 제한.
    ids = channelId ? await listLikedClipIds(channelId) : [];
  }
  return ok(await listPublicClips({ ...input, ids }));
});
