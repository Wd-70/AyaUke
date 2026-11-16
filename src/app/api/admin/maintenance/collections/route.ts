import type { Session } from 'next-auth';
import { withApi, ok } from '@/shared/api/handler';
import { ForbiddenError } from '@/shared/api/errors';
import { canManageSystem, UserRole } from '@/lib/permissions';
import { getCollectionSummary } from '@/domains/operations/backup.service';

function assertSystemAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined;
  if (!role || !canManageSystem(session?.user)) {
    throw new ForbiddenError('시스템 관리 권한이 필요합니다.');
  }
}

/** 컬렉션별 문서 수/크기 요약 (읽기 전용) */
export const GET = withApi({ auth: 'user' }, async ({ session }) => {
  assertSystemAdmin(session);
  return ok({ collections: await getCollectionSummary() });
});
