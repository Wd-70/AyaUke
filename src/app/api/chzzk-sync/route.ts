import { z } from 'zod';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { withApi, ok } from '@/shared/api/handler';
import { ForbiddenError, ValidationError } from '@/shared/api/errors';
import { canAccessAdminPanel, UserRole } from '@/lib/permissions';
import * as syncService from '@/domains/archive/chzzk-sync.service';
import { fetchVideoHlsInfo } from '@/domains/archive/chzzk.client';

/** 관리자 역할(any admin) 확인 — 기존 isAdmin 불리언 게이트와 동일한 의미 */
function assertAdmin(session: Session | null) {
  const role = (session?.user as { role?: string } | undefined)?.role as UserRole | undefined;
  if (!role || !canAccessAdminPanel(role)) {
    throw new ForbiddenError('관리자 권한이 필요합니다.');
  }
}

const GetQuery = z.object({
  action: z.enum(['sync-channel-stream', 'list-videos', 'get-video', 'get-statistics', 'get-hls-url']),
  force: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().default(''),
  videoNo: z.coerce.number().int().optional(),
  convertTimestamps: z.coerce.boolean().default(false),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const GET = withApi({ schema: GetQuery, auth: 'user' }, async ({ input, session }) => {
  assertAdmin(session);

  switch (input.action) {
    case 'sync-channel-stream': {
      // SSE 스트리밍: 서비스의 이벤트 콜백을 SSE 메시지로 변환
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: string, data: unknown) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          try {
            const stats = await syncService.syncChannel({
              force: input.force,
              onEvent: ({ type, ...data }) => sendEvent(type, data),
            });
            sendEvent('complete', { stats, message: 'Sync completed successfully' });
          } catch (error) {
            sendEvent('error', { error: error instanceof Error ? error.message : String(error) });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      }) as NextResponse;
    }

    case 'list-videos':
      return ok(await syncService.listVideos({ page: input.page, limit: input.limit, search: input.search }));

    case 'get-video': {
      if (!input.videoNo) throw new ValidationError('videoNo is required');
      return ok(await syncService.getVideoWithComments(input.videoNo, input.convertTimestamps));
    }

    case 'get-statistics':
      return ok(await syncService.getStatistics({ dateFrom: input.dateFrom, dateTo: input.dateTo }));

    case 'get-hls-url': {
      if (!input.videoNo) throw new ValidationError('videoNo is required');
      return ok(await fetchVideoHlsInfo(input.videoNo));
    }
  }
});

const PostBody = z.object({
  action: z.enum(['sync-channel', 'update-video', 'check-video-status']),
  force: z.boolean().default(false),
  videoNo: z.number().int().optional(),
  youtubeUrl: z.string().optional(),
  timeOffset: z.number().nullable().optional(),
});

export const POST = withApi({ schema: PostBody, auth: 'user' }, async ({ input, session }) => {
  assertAdmin(session);

  switch (input.action) {
    case 'sync-channel': {
      const stats = await syncService.syncChannel({ force: input.force });
      return ok(stats);
    }

    case 'update-video': {
      if (!input.videoNo) throw new ValidationError('videoNo is required');
      return ok(
        await syncService.updateVideoMapping({
          videoNo: input.videoNo,
          youtubeUrl: input.youtubeUrl,
          timeOffset: input.timeOffset,
        }),
      );
    }

    case 'check-video-status': {
      if (!input.videoNo) throw new ValidationError('videoNo is required');
      return ok(await syncService.refreshVideoStatus(input.videoNo));
    }
  }
});
