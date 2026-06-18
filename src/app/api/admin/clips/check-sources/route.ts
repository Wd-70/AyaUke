import { z } from 'zod';
import type { Session } from 'next-auth';
import { withApi, ok } from '@/shared/api/handler';
import { ForbiddenError } from '@/shared/api/errors';
import { isSuperAdmin, UserRole } from '@/lib/permissions';
import {
  listCheckTargets, checkSourceBatch, applySourceStatus, restoreClipSource,
} from '@/domains/archive/clip-source.service';

function assertSuperAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined;
  if (!role || !isSuperAdmin(role)) throw new ForbiddenError('최고관리자 권한이 필요합니다.');
}

const platform = z.enum(['youtube', 'chzzk']);

/** 점검 대상 목록 (영상 단위). platform=chzzk|youtube|all */
const TargetsQuery = z.object({ platform: z.enum(['chzzk', 'youtube', 'all']).default('all') });
export const GET = withApi({ schema: TargetsQuery, auth: 'user' }, async ({ input, session }) => {
  assertSuperAdmin(session);
  return ok({ targets: await listCheckTargets(input.platform) });
});

/** 한 배치 점검 (DB 미변경) — 클라이언트가 청크로 반복 호출하며 진행률 표시 */
const CheckBody = z.object({
  targets: z.array(z.object({ platform, videoId: z.string().min(1), clips: z.number() })).max(50),
});
export const POST = withApi({ schema: CheckBody, auth: 'user' }, async ({ input, session }) => {
  assertSuperAdmin(session);
  return ok({ rows: await checkSourceBatch(input.targets) });
});

/** 선택 영상 클립 숨김/복구 적용 */
const ApplyBody = z.object({
  videos: z.array(z.object({ platform, videoId: z.string().min(1) })),
  unavailable: z.boolean().default(true),
});
export const PUT = withApi({ schema: ApplyBody, auth: 'user' }, async ({ input, session }) => {
  assertSuperAdmin(session);
  return ok({ modified: await applySourceStatus(input.videos, input.unavailable) });
});

/** 개별 클립 숨김 해제 (목록 배지 복구용) */
const RestoreBody = z.object({ clipId: z.string().min(1) });
export const PATCH = withApi({ schema: RestoreBody, auth: 'user' }, async ({ input, session }) => {
  assertSuperAdmin(session);
  await restoreClipSource(input.clipId);
  return ok({ restored: input.clipId });
});
