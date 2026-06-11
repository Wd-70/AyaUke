import { z } from 'zod';
import type { Session } from 'next-auth';
import { withApi, ok } from '@/shared/api/handler';
import { ForbiddenError } from '@/shared/api/errors';
import { isSuperAdmin, UserRole } from '@/lib/permissions';
import { applyDefaultDurationToClips } from '@/domains/archive/clip.service';

function assertSuperAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined;
  if (!role || !isSuperAdmin(role)) {
    throw new ForbiddenError('최고관리자 권한이 필요합니다.');
  }
}

const Body = z.object({
  songId: z.string().min(1),
  /** 현재 길이가 기본 길이와 이 값(초) 이내로 차이나면 보존 */
  thresholdSeconds: z.number().min(0).max(600).default(5),
});

/** 곡의 기본 클립 길이를 기존 클립들에 일괄 적용 (임계값 이내는 수동 조정 보존) */
export const POST = withApi({ schema: Body, auth: 'user' }, async ({ input, session }) => {
  assertSuperAdmin(session);
  return ok(await applyDefaultDurationToClips(input.songId, input.thresholdSeconds));
});
