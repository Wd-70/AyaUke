import { withApi, ok } from '@/shared/api/handler';
import { listSongsForMatch } from '@/domains/archive/clip-workflow.service';
import { assertAdmin } from '../_guard';

/** 매칭용 등록곡 목록 (searchTags 포함) — 클라이언트 로컬 매칭용 */
export const GET = withApi({ auth: 'user' }, async ({ session }) => {
  assertAdmin(session);
  return ok({ songs: await listSongsForMatch() });
});
