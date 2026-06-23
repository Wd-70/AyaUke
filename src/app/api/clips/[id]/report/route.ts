import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { createClipReport } from '@/domains/archive/clip-report.service';

const Body = z.object({
  reason: z.enum(['broken', 'wrong_song', 'wrong_time', 'inappropriate', 'other']),
  detail: z.string().max(500).optional(),
});

// 클립 신고 — 로그인 사용자 (스팸 방지 + 중복 신고 제한)
export const POST = withApi({ schema: Body, auth: 'user' }, async ({ input, params, session }) => {
  await createClipReport({
    clipId: params.id,
    reason: input.reason,
    detail: input.detail,
    channelId: session!.user.channelId,
  });
  return ok({ reported: true }, { status: 201 });
});
