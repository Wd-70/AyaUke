import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { listPublicClips } from '@/domains/archive/clip.service';

const Query = z.object({
  sort: z.enum(['popular', 'mostPlayed', 'recent']).optional(),
  platform: z.enum(['all', 'youtube', 'chzzk']).optional(),
  verified: z.coerce.boolean().optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional(),
});

// 공개 클립 갤러리 목록 (/clips). 정렬/플랫폼/검증/검색 + 페이지네이션.
export const revalidate = 120;

export const GET = withApi({ schema: Query }, async ({ input }) => {
  return ok(await listPublicClips(input));
});
