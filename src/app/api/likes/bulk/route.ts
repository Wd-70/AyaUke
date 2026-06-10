import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { bulkLikeStatus } from '@/domains/engagement/like.service';

const Body = z.object({
  songIds: z.array(z.string()).min(1).max(2000),
});

/** 여러 곡의 좋아요 여부를 한 번에 조회한다. */
export const POST = withApi({ schema: Body, auth: 'user' }, async ({ input, session }) => {
  return ok(await bulkLikeStatus(session!.user.channelId, input.songIds));
});
