import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { bulkClipLikeStatus } from '@/domains/engagement/clip-like.service';

const Body = z.object({
  clipIds: z.array(z.string()).min(1).max(500),
});

/** 여러 클립의 좋아요 여부를 한 번에 조회한다. */
export const POST = withApi({ schema: Body, auth: 'user' }, async ({ input, session }) => {
  return ok(await bulkClipLikeStatus(session!.user.channelId, input.clipIds));
});
