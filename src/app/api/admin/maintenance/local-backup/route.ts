import { z } from 'zod';
import type { Session } from 'next-auth';
import { withApi, ok } from '@/shared/api/handler';
import { ForbiddenError } from '@/shared/api/errors';
import { isSuperAdmin, UserRole } from '@/lib/permissions';
import {
  isLocalEnvironment,
  listLocalBackups,
  saveBackupToDisk,
  deleteLocalBackup,
} from '@/domains/operations/local-backup.service';

function assertSuperAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined;
  if (!role || !isSuperAdmin(role)) {
    throw new ForbiddenError('최고관리자 권한이 필요합니다.');
  }
}

/** 로컬 백업 목록 + 환경 정보 */
export const GET = withApi({ auth: 'user' }, async ({ session }) => {
  assertSuperAdmin(session);
  const isLocal = isLocalEnvironment();
  return ok({ isLocal, backups: isLocal ? await listLocalBackups() : [] });
});

/** 로컬 디스크에 새 백업 저장 */
export const POST = withApi({ auth: 'user' }, async ({ session }) => {
  assertSuperAdmin(session);
  return ok(await saveBackupToDisk());
});

const DeleteQuery = z.object({ name: z.string().min(1) });

/** 로컬 백업 삭제 */
export const DELETE = withApi({ schema: DeleteQuery, auth: 'user' }, async ({ input, session }) => {
  assertSuperAdmin(session);
  await deleteLocalBackup(input.name);
  return ok({ deleted: input.name });
});
