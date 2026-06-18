import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { getVideoDetail } from '@/domains/archive/clip-workflow.service';
import { assertAdmin } from '../_guard';

const Query = z.object({ platform: z.enum(['chzzk', 'youtube']), videoId: z.string().min(1) });

/** 영상 상세: 원본 댓글 + 파싱 항목 */
export const GET = withApi({ schema: Query, auth: 'user' }, async ({ input, session }) => {
  assertAdmin(session);
  return ok(await getVideoDetail(input.platform, input.videoId));
});
