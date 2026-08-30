import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { searchUnmatchedTimelines } from '@/domains/archive/clip-workflow.service';
import { assertAdmin } from '../_guard';

const Query = z.object({ q: z.string().min(1) });

/** 자유 텍스트로 미매칭 타임라인 검색 (미등록 곡 발견용) */
export const GET = withApi({ schema: Query, auth: 'user' }, async ({ input, session }) => {
  assertAdmin(session);
  return ok({ items: await searchUnmatchedTimelines(input.q) });
});
