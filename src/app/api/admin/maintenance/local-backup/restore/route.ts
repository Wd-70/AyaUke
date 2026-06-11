import { z } from 'zod';
import type { Session } from 'next-auth';
import { withApi, ok } from '@/shared/api/handler';
import { ForbiddenError, ValidationError } from '@/shared/api/errors';
import { isSuperAdmin, UserRole } from '@/lib/permissions';
import { restoreBackup } from '@/domains/operations/local-backup.service';

function assertSuperAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined;
  if (!role || !isSuperAdmin(role)) {
    throw new ForbiddenError('최고관리자 권한이 필요합니다.');
  }
}

// confirm은 백업 이름과 정확히 일치해야 함 (사용자가 직접 입력 → 오작동 방지)
const Body = z.object({
  name: z.string().min(1),
  confirm: z.string().min(1),
});

/** 백업 스냅샷으로 DB 복원 (파괴적 — 운영 DB를 덮어씀) */
export const POST = withApi({ schema: Body, auth: 'user' }, async ({ input, session }) => {
  assertSuperAdmin(session);
  if (input.confirm !== input.name) {
    throw new ValidationError('확인 입력이 백업 이름과 일치하지 않습니다.');
  }
  return ok(await restoreBackup(input.name));
});
