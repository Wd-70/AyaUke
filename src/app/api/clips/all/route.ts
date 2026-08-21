import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { listAllClipSummaries } from '@/domains/archive/clip.service';
import { listLikedClipIds } from '@/domains/engagement/clip-like.service';

const Query = z.object({
  sort: z.enum(['popular', 'mostPlayed', 'recent']).optional(),
  platform: z.enum(['all', 'youtube', 'chzzk']).optional(),
  verified: z.coerce.boolean().optional(),
  liked: z.coerce.boolean().optional(),
});

// 검색 모드용 전체 클립 요약 (클라이언트 isTextMatch 필터링). liked=true면 좋아요한 것만.

export const GET = withApi({ schema: Query }, async ({ input, session }) => {
  let ids: string[] | undefined;
  if (input.liked) {
    const channelId = session?.user?.channelId;
    ids = channelId ? await listLikedClipIds(channelId) : [];
  }
  const clips = await listAllClipSummaries({ ...input, ids });
  return ok({ clips, total: clips.length });
});
