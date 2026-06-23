import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { listAllClipSummaries } from '@/domains/archive/clip.service';

const Query = z.object({
  sort: z.enum(['popular', 'mostPlayed', 'recent']).optional(),
  platform: z.enum(['all', 'youtube', 'chzzk']).optional(),
  verified: z.coerce.boolean().optional(),
});

// 검색 모드용 전체 클립 요약 (클라이언트 isTextMatch 필터링). 자주 안 바뀌므로 길게 캐시.
export const revalidate = 300;

export const GET = withApi({ schema: Query }, async ({ input }) => {
  const clips = await listAllClipSummaries(input);
  return ok({ clips, total: clips.length });
});
