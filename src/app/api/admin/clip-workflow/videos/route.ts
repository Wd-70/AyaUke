import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { listVideosWithStatus } from '@/domains/archive/clip-workflow.service';
import { assertAdmin } from '../_guard';

const Query = z.object({ platform: z.enum(['chzzk', 'youtube']) });

/** 플랫폼별 영상 목록 + 상태(파싱/매칭/검증/클립 수) */
export const GET = withApi({ schema: Query, auth: 'user' }, async ({ input, session }) => {
  assertAdmin(session);
  return ok({ videos: await listVideosWithStatus(input.platform) });
});
