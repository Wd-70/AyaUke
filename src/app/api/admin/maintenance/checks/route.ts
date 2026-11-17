import { z } from 'zod';
import type { Session } from 'next-auth';
import { withApi, ok } from '@/shared/api/handler';
import { ForbiddenError } from '@/shared/api/errors';
import { canManageSystem } from '@/lib/permissions';
import { CHECK_IDS, CHECKS, fix, inspect, inspectAll } from '@/domains/operations/maintenance-checks.service';
import { lastMaintenanceAt, listMaintenanceLogs, logMaintenance } from '@/domains/operations/maintenance-log.service';

export const dynamic = 'force-dynamic';

function assertSystem(session: Session | null) {
  if (!canManageSystem(session?.user)) throw new ForbiddenError('시스템 관리 권한이 필요합니다.');
}
const actor = (session: Session | null) =>
  (session?.user as { displayName?: string; name?: string } | undefined)?.displayName || session?.user?.name || '알 수 없음';

/** 데이터 점검(읽기 전용) + 최근 작업 기록 */
export const GET = withApi({ auth: 'user' }, async ({ session }) => {
  assertSystem(session);
  const [checks, logs, lastBackupAt] = await Promise.all([
    inspectAll(),
    listMaintenanceLogs(),
    lastMaintenanceAt(['backup-download', 'backup-save']),
  ]);
  return ok({ checks, logs, lastBackupAt });
});

const Body = z.object({ id: z.enum(CHECK_IDS) });

/** 한 항목 고치기 → 기록 → 다시 점검한 결과를 돌려준다 */
export const POST = withApi({ schema: Body, auth: 'user' }, async ({ input, session }) => {
  assertSystem(session);
  const changed = await fix(input.id);
  await logMaintenance(`fix:${input.id}`, `${CHECKS[input.id].title} 바로잡기`, actor(session), `${changed}건`);
  const [check, logs] = await Promise.all([inspect(input.id), listMaintenanceLogs()]);
  return ok({ changed, check, logs });
});
