import { z } from 'zod';
import type { Session } from 'next-auth';
import { withApi, ok } from '@/shared/api/handler';
import { ForbiddenError } from '@/shared/api/errors';
import { canAccessAdminPanel, UserRole } from '@/lib/permissions';
import { readProgress, writeProgress, type ProgressFile } from '@/domains/operations/yt-clip-work.service';

function assertAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined;
  if (!role || !canAccessAdminPanel(role)) {
    throw new ForbiddenError('관리자 권한이 필요합니다.');
  }
}

/** 진행상태 읽기 */
export const GET = withApi({ auth: 'user' }, async ({ session }) => {
  assertAdmin(session);
  return ok({ progress: await readProgress() });
});

const VideoProgress = z.object({
  youtubeVideoId: z.string().optional(),
  anchors: z.array(z.object({ chzzkTime: z.number(), ytTime: z.number() })).optional(),
  matches: z.record(z.string(), z.string()).optional(),
  excluded: z.array(z.string()).optional(),
  done: z.boolean().optional(),
  skipped: z.boolean().optional(),
});
const Body = z.object({ progress: z.record(z.string(), VideoProgress) });

/** 진행상태 전체 저장 (클라이언트가 디바운스로 호출) */
export const PUT = withApi({ schema: Body, auth: 'user' }, async ({ input, session }) => {
  assertAdmin(session);
  await writeProgress(input.progress as ProgressFile);
  return ok({ saved: true });
});
