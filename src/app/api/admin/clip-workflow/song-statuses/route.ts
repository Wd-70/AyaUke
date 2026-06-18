import { withApi, ok } from '@/shared/api/handler';
import { listSongStatuses } from '@/domains/archive/clip-workflow.service';
import { assertAdmin } from '../_guard';

/** 곡별 타임라인 출현·클립 수 (곡 단위 좌측 목록용) */
export const GET = withApi({ auth: 'user' }, async ({ session }) => {
  assertAdmin(session);
  return ok({ statuses: await listSongStatuses() });
});
