import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { parseVideo } from '@/domains/archive/clip-workflow.service';
import { assertAdmin } from '../_guard';

const Body = z.object({ platform: z.enum(['chzzk', 'youtube']), videoId: z.string().min(1) });

/** 영상 단위 댓글 파싱 → ParsedTimeline 생성 */
export const POST = withApi({ schema: Body, auth: 'user' }, async ({ input, session }) => {
  assertAdmin(session);
  return ok(await parseVideo(input.platform, input.videoId));
});
