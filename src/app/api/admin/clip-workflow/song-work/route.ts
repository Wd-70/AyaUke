import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { getSongWork, getSongCandidates } from '@/domains/archive/clip-workflow.service';
import { assertAdmin } from '../_guard';

const Query = z.object({ songId: z.string().min(1), candidates: z.coerce.boolean().default(false) });

/** 한 곡의 출현(매칭) + 기존 클립. candidates=true면 역매칭 후보까지 */
export const GET = withApi({ schema: Query, auth: 'user' }, async ({ input, session }) => {
  assertAdmin(session);
  const work = await getSongWork(input.songId);
  if (!input.candidates) return ok(work);
  return ok({ ...work, candidates: await getSongCandidates(input.songId) });
});
