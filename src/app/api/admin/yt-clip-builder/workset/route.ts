import type { Session } from 'next-auth';
import { withApi, ok } from '@/shared/api/handler';
import { ForbiddenError } from '@/shared/api/errors';
import { canAccessAdminPanel, UserRole } from '@/lib/permissions';
import { readWorkset } from '@/domains/operations/yt-clip-work.service';
import { isLocalEnvironment } from '@/domains/operations/local-backup.service';

function assertAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined;
  if (!role || !canAccessAdminPanel(role)) {
    throw new ForbiddenError('관리자 권한이 필요합니다.');
  }
}

/** 저장된 workset.json 반환 (없으면 needsExport) */
export const GET = withApi({ auth: 'user' }, async ({ session }) => {
  assertAdmin(session);
  const workset = await readWorkset();
  return ok({ isLocal: isLocalEnvironment(), workset, needsExport: workset === null });
});
