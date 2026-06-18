import type { Session } from 'next-auth';
import { ForbiddenError } from '@/shared/api/errors';
import { canAccessAdminPanel, UserRole } from '@/lib/permissions';

/** clip-workflow 라우트 공통 관리자 가드 */
export function assertAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined;
  if (!role || !canAccessAdminPanel(role)) {
    throw new ForbiddenError('관리자 권한이 필요합니다.');
  }
}
