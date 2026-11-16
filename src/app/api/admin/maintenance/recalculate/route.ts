import { z } from 'zod';
import type { Session } from 'next-auth';
import { withApi, ok } from '@/shared/api/handler';
import { ForbiddenError } from '@/shared/api/errors';
import { canManageSystem, UserRole } from '@/lib/permissions';
import { recalculateLikeCounts, recalculateSongStats } from '@/domains/operations/recalc.service';

function assertSystemAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined;
  if (!role || !canManageSystem(session?.user)) {
    throw new ForbiddenError('시스템 관리 권한이 필요합니다.');
  }
}

const Body = z.object({
  target: z.enum(['likeCount', 'songStats']),
  songId: z.string().optional(),
});

/** 비정규화 카운트 재계산 (구 recalculate-like-counts / recalculate-song-stats 통합) */
export const POST = withApi({ schema: Body, auth: 'user' }, async ({ input, session }) => {
  assertSystemAdmin(session);

  const result =
    input.target === 'likeCount'
      ? await recalculateLikeCounts()
      : await recalculateSongStats(input.songId);

  return ok(result);
});
