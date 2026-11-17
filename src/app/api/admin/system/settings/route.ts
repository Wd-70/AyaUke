import type { Session } from 'next-auth';
import { withApi, ok } from '@/shared/api/handler';
import { ForbiddenError } from '@/shared/api/errors';
import { canAccessAdminPanel, canManageSystem } from '@/lib/permissions';
import { getSiteSettings, saveSiteSettings } from '@/domains/operations/site-settings.service';
import { SiteSettingsPatchSchema } from '@/domains/operations/site-settings';
import { logMaintenance } from '@/domains/operations/maintenance-log.service';

const actor = (session: Session | null) =>
  (session?.user as { displayName?: string; name?: string } | undefined)?.displayName || session?.user?.name || '알 수 없음';

/** 사이트 설정 읽기 — 클립 기본값 등은 다른 관리 탭에서도 쓰므로 관리자 누구나 */
export const GET = withApi({ auth: 'user' }, async ({ session }) => {
  if (!canAccessAdminPanel(session?.user)) throw new ForbiddenError('관리자 권한이 필요합니다.');
  return ok(await getSiteSettings());
});

/** 사이트 설정 바꾸기 — 시스템 권한 */
export const PATCH = withApi({ schema: SiteSettingsPatchSchema, auth: 'user' }, async ({ input, session }) => {
  if (!canManageSystem(session?.user)) throw new ForbiddenError('시스템 관리 권한이 필요합니다.');
  const by = actor(session);
  const saved = await saveSiteSettings(input, by);
  await logMaintenance('settings', '사이트 설정 변경', by, JSON.stringify(input));
  return ok(saved);
});
