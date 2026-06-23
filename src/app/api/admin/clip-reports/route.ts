import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { Permission } from '@/lib/permissions';
import { listClipReports, countPendingReports } from '@/domains/archive/clip-report.service';

const Query = z.object({
  status: z.enum(['pending', 'resolved', 'dismissed', 'all']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// 관리자: 신고 목록 + 대기 수
export const GET = withApi({ schema: Query, auth: Permission.SONGS_EDIT }, async ({ input }) => {
  const [list, pending] = await Promise.all([
    listClipReports({ status: input.status ?? 'pending', page: input.page ?? 1, limit: input.limit ?? 30 }),
    countPendingReports(),
  ]);
  return ok({ ...list, pendingCount: pending });
});
