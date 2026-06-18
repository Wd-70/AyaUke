import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import {
  setItemMatch, setItemTime, setItemExcluded, setItemVerified, editItem,
} from '@/domains/archive/clip-workflow.service';
import { assertAdmin } from '../../_guard';

const Body = z.object({
  matchedSongId: z.string().nullable().optional(),
  isExcluded: z.boolean().optional(),
  isTimeVerified: z.boolean().optional(),
  startTimeSeconds: z.number().optional(),
  endTimeSeconds: z.number().nullable().optional(),
  artist: z.string().optional(),
  songTitle: z.string().optional(),
  customDescription: z.string().optional(),
});

/** 파싱 항목 단건 변경 (매칭/시간/제외/검증/본문). 보낸 필드만 적용 */
export const PATCH = withApi({ schema: Body, auth: 'user' }, async ({ input, session, params }) => {
  assertAdmin(session);
  const id = params.id;

  // 매칭 먼저(기본 종료시각 자동) → 명시적 시간 편집이 있으면 그 값이 최종
  if (input.matchedSongId !== undefined) await setItemMatch(id, input.matchedSongId);
  if (input.startTimeSeconds !== undefined) {
    await setItemTime(id, input.startTimeSeconds, input.endTimeSeconds ?? null);
  }
  if (input.isExcluded !== undefined) await setItemExcluded(id, input.isExcluded);
  if (input.isTimeVerified !== undefined) await setItemVerified(id, input.isTimeVerified);
  if (input.artist !== undefined || input.songTitle !== undefined || input.customDescription !== undefined) {
    await editItem(id, { artist: input.artist, songTitle: input.songTitle, customDescription: input.customDescription });
  }
  return ok({ updated: true });
});
