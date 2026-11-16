import { z } from 'zod';
import type { Session } from 'next-auth';
import { withApi, ok } from '@/shared/api/handler';
import { ForbiddenError } from '@/shared/api/errors';
import { canManageSystem, UserRole } from '@/lib/permissions';
import {
  isLocalEnvironment,
  listLocalBackups,
  saveBackupToDisk,
  deleteLocalBackup,
  updateBackupNote,
} from '@/domains/operations/local-backup.service';

function assertSystemAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined;
  if (!role || !canManageSystem(session?.user)) {
    throw new ForbiddenError('시스템 관리 권한이 필요합니다.');
  }
}

/** 로컬 백업 목록 + 환경 정보 */
export const GET = withApi({ auth: 'user' }, async ({ session }) => {
  assertSystemAdmin(session);
  const isLocal = isLocalEnvironment();
  return ok({ isLocal, backups: isLocal ? await listLocalBackups() : [] });
});

/** 로컬 디스크에 새 백업 저장 */
export const POST = withApi({ auth: 'user' }, async ({ session }) => {
  assertSystemAdmin(session);
  return ok(await saveBackupToDisk());
});

const NoteBody = z.object({ name: z.string().min(1), note: z.string().max(2000) });

/** 백업 메모 추가/수정 */
export const PATCH = withApi({ schema: NoteBody, auth: 'user' }, async ({ input, session }) => {
  assertSystemAdmin(session);
  const note = await updateBackupNote(input.name, input.note);
  return ok({ name: input.name, note });
});

const DeleteQuery = z.object({ name: z.string().min(1) });

/** 로컬 백업 삭제 */
export const DELETE = withApi({ schema: DeleteQuery, auth: 'user' }, async ({ input, session }) => {
  assertSystemAdmin(session);
  await deleteLocalBackup(input.name);
  return ok({ deleted: input.name });
});
