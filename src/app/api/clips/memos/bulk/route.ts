import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { bulkClipMemoStatus } from '@/domains/engagement/clip-memo.service';

const Body = z.object({
  clipIds: z.array(z.string()).min(1).max(500),
});

/** 여러 클립의 메모 보유 여부를 한 번에 조회한다 (카드 인디케이터용). */
export const POST = withApi({ schema: Body, auth: 'user' }, async ({ input, session }) => {
  return ok(await bulkClipMemoStatus(session!.user.channelId, input.clipIds));
});
