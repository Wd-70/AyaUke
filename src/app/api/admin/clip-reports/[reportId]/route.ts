import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { Permission } from '@/lib/permissions';
import { resolveClipReport } from '@/domains/archive/clip-report.service';

const Body = z.object({
  action: z.enum(['resolve', 'dismiss', 'mark_unavailable']),
});

// 관리자: 신고 처리 (처리됨/반려/원본 불가 표시)
export const PATCH = withApi({ schema: Body, auth: Permission.SONGS_EDIT }, async ({ input, params, session }) => {
  await resolveClipReport(params.reportId, input.action, session!.user.userId);
  return ok({ ok: true });
});
