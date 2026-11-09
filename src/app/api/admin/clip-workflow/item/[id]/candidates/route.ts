import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { getUnmatchedTimelineCandidates } from '@/domains/archive/clip-workflow.service';
import { assertAdmin } from '../../../_guard';

const Query = z.object({ q: z.string().trim().min(1).max(200), page: z.coerce.number().int().min(1).default(1) });

/** Read-only, explicitly requested candidate lookup; never matches or edits items. */
export const GET = withApi({ schema: Query, auth: 'user' }, async ({ input, session, params }) => {
  assertAdmin(session);
  return ok(await getUnmatchedTimelineCandidates(params.id, input.q, input.page));
});
