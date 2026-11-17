import { z } from 'zod';
import type { Session } from 'next-auth';
import { withApi, ok } from '@/shared/api/handler';
import { ForbiddenError, ValidationError } from '@/shared/api/errors';
import { isSuperAdmin, UserRole } from '@/lib/permissions';
import { restoreBackup } from '@/domains/operations/local-backup.service';
import { logMaintenance } from '@/domains/operations/maintenance-log.service';

const actor = (session: Session | null) =>
  (session?.user as { displayName?: string; name?: string } | undefined)?.displayName || session?.user?.name || '알 수 없음';

function assertSuperAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined;
  if (!role || !isSuperAdmin(session?.user)) {
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
  const restored = await restoreBackup(input.name);
  // 복원이 기록 컬렉션까지 덮어쓰므로 복원이 끝난 뒤에 남긴다
  await logMaintenance('backup-restore', '백업으로 복원', actor(session), input.name);
  return ok(restored);
});
