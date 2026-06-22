import { withApi, ok } from '@/shared/api/handler';
import { incrementClipPlayCount } from '@/domains/archive/clip.service';

// 재생 수 증가 (facade 활성화 시 fire-and-forget). 공개 — 남용돼도 통계용이라 영향 적음.
export const POST = withApi({}, async ({ params }) => {
  await incrementClipPlayCount(params.id);
  return ok({ ok: true });
});
