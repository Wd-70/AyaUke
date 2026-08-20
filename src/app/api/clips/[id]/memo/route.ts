import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { getClipMemo, setClipMemo } from '@/domains/engagement/clip-memo.service';

// 클립 개인 메모 — 나만 보는 비공개 노트. 로그인 필수.
export const GET = withApi({ auth: 'user' }, async ({ params, session }) => {
  const text = await getClipMemo(session!.user.channelId, params.id);
  return ok({ text: text ?? '' });
});

const Body = z.object({ text: z.string().max(1000) });

// 저장(빈 문자열이면 삭제).
export const PUT = withApi({ schema: Body, auth: 'user' }, async ({ input, params, session }) => {
  const text = await setClipMemo(session!.user.channelId, params.id, input.text);
  return ok({ text });
});
