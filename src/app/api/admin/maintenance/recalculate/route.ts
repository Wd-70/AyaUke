import { z } from 'zod';
import type { Session } from 'next-auth';
import { withApi, ok } from '@/shared/api/handler';
import { ForbiddenError } from '@/shared/api/errors';
import { isSuperAdmin, UserRole } from '@/lib/permissions';
import { recalculateLikeCounts, recalculateSongStats } from '@/domains/operations/recalc.service';

function assertSuperAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined;
  if (!role || !isSuperAdmin(role)) {
    throw new ForbiddenError('최고관리자 권한이 필요합니다.');
  }
}

const Body = z.object({
  target: z.enum(['likeCount', 'songStats']),
  songId: z.string().optional(),
});

/** 비정규화 카운트 재계산 (구 recalculate-like-counts / recalculate-song-stats 통합) */
export const POST = withApi({ schema: Body, auth: 'user' }, async ({ input, session }) => {
  assertSuperAdmin(session);

  const result =
    input.target === 'likeCount'
      ? await recalculateLikeCounts()
      : await recalculateSongStats(input.songId);

  return ok(result);
});
