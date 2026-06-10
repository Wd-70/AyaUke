import { z } from 'zod';
import mongoose from 'mongoose';
import Like from '@/models/Like';
import { withApi, ok } from '@/shared/api/handler';

const Body = z.object({
  songIds: z.array(z.string()).min(1).max(2000),
});

/** 여러 곡의 좋아요 여부를 한 번에 조회한다. (구 /api/likes-bulk 흡수) */
export const POST = withApi({ schema: Body, auth: 'user' }, async ({ input, session }) => {
  const validSongIds = input.songIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

  const likeMap: Record<string, boolean> = {};
  for (const songId of validSongIds) likeMap[songId] = false;

  if (validSongIds.length > 0) {
    const likes = await Like.find({
      channelId: session!.user.channelId,
      songId: { $in: validSongIds.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select('songId')
      .lean();

    for (const like of likes) likeMap[String(like.songId)] = true;
  }

  const total = Object.values(likeMap).filter(Boolean).length;
  return ok({ likes: likeMap, total, requested: validSongIds.length });
});
