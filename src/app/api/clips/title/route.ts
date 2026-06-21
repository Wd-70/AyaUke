import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import { connectDB } from '@/shared/db/mongodb';
import ChzzkVideo from '@/domains/archive/schemas/chzzk-video.schema';

const Query = z.object({
  platform: z.enum(['youtube', 'chzzk']),
  videoId: z.string().min(1),
});

/**
 * 클립 영상의 "실제 제목"만 가볍게 조회 (공개). facade에서 스트림을 만들지 않고
 * 제목을 lazy-load하기 위한 용도 — 영상 바이트는 받지 않는다.
 *   - chzzk: ChzzkVideo 컬렉션의 videoTitle (DB 조회, 스트림 resolve 없음)
 *   - youtube: oEmbed (키 불필요, 메타데이터만)
 */
export const GET = withApi({ schema: Query }, async ({ input }) => {
  const { platform, videoId } = input;
  let title: string | null = null;

  if (platform === 'chzzk') {
    await connectDB();
    const videoNo = Number(videoId);
    if (Number.isFinite(videoNo)) {
      const doc = await ChzzkVideo.findOne({ videoNo })
        .select('videoTitle')
        .lean();
      title = (doc as { videoTitle?: string } | null)?.videoTitle ?? null;
    }
  } else {
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(
          videoId
        )}&format=json`
      );
      if (res.ok) {
        const data = (await res.json()) as { title?: unknown };
        title = typeof data.title === 'string' ? data.title : null;
      }
    } catch {
      /* oEmbed 실패는 무시 — 제목 없이 메모로 폴백 */
    }
  }

  return ok({ title });
});
