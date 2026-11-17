import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { withApi } from '@/shared/api/handler';
import { ForbiddenError } from '@/shared/api/errors';
import { canManageSystem, UserRole } from '@/lib/permissions';
import { createBackupStream } from '@/domains/operations/backup.service';
import { logMaintenance } from '@/domains/operations/maintenance-log.service';

const actor = (session: Session | null) =>
  (session?.user as { displayName?: string; name?: string } | undefined)?.displayName || session?.user?.name || '알 수 없음';

function assertSystemAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined;
  if (!role || !canManageSystem(session?.user)) {
    throw new ForbiddenError('시스템 관리 권한이 필요합니다.');
  }
}

/** 전체 DB를 JSON 파일로 스트리밍 다운로드 (DB에 저장하지 않음) */
export const GET = withApi({ auth: 'user' }, async ({ session }) => {
  assertSystemAdmin(session);

  await logMaintenance('backup-download', '전체 백업 다운로드', actor(session));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return new Response(createBackupStream(), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="ayauke-backup-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  }) as NextResponse;
});
