import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { withApi } from '@/shared/api/handler';
import { ForbiddenError } from '@/shared/api/errors';
import { isSuperAdmin, UserRole } from '@/lib/permissions';
import { createBackupStream } from '@/domains/operations/backup.service';

function assertSuperAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined;
  if (!role || !isSuperAdmin(role)) {
    throw new ForbiddenError('최고관리자 권한이 필요합니다.');
  }
}

/** 전체 DB를 JSON 파일로 스트리밍 다운로드 (DB에 저장하지 않음) */
export const GET = withApi({ auth: 'user' }, async ({ session }) => {
  assertSuperAdmin(session);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return new Response(createBackupStream(), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="ayauke-backup-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  }) as NextResponse;
});
