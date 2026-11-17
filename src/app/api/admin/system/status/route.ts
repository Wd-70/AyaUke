import { withApi, ok } from '@/shared/api/handler';
import { ForbiddenError } from '@/shared/api/errors';
import { canManageSystem } from '@/lib/permissions';
import { getSystemStatus } from '@/domains/operations/system-status.service';

export const dynamic = 'force-dynamic';

/** 연동 상태판 — 외부 서비스를 실제로 한 번씩 호출해 본다(읽기 전용) */
export const GET = withApi({ auth: 'user' }, async ({ session }) => {
  if (!canManageSystem(session?.user)) throw new ForbiddenError('시스템 관리 권한이 필요합니다.');
  return ok(await getSystemStatus());
});
