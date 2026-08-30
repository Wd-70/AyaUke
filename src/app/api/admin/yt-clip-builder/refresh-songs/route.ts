import type { Session } from 'next-auth';
import { withApi, ok } from '@/shared/api/handler';
import { ForbiddenError } from '@/shared/api/errors';
import { canAccessAdminPanel, UserRole } from '@/lib/permissions';
import { refreshWorksetSongs } from '@/domains/operations/yt-clip-work.service';

function assertAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined;
  if (!role || !canAccessAdminPanel(role)) {
    throw new ForbiddenError('관리자 권한이 필요합니다.');
  }
}

/** 곡 목록만 DB에서 다시 읽어 workset.json의 songs만 갱신 (로컬 전용, 빠름) */
export const POST = withApi({ auth: 'user' }, async ({ session }) => {
  assertAdmin(session);
  return ok(await refreshWorksetSongs());
});
