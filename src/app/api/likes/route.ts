import { z } from 'zod';
import { withApi, ok } from '@/shared/api/handler';
import * as likeService from '@/domains/engagement/like.service';

const SongIdQuery = z.object({ songId: z.string().min(1).optional() });
const SongIdRequired = z.object({ songId: z.string().min(1) });

export const GET = withApi({ schema: SongIdQuery, auth: 'user' }, async ({ input, session }) => {
  const channelId = session!.user.channelId;

  if (input.songId) {
    return ok({ liked: await likeService.getLikeStatus(channelId, input.songId) });
  }
  return ok({ likes: await likeService.listLikes(channelId) });
});

export const POST = withApi({ schema: SongIdRequired, auth: 'user' }, async ({ input, session }) => {
  const like = await likeService.addLike(session!.user.channelId, input.songId);
  return ok({ like }, { status: 201 });
});

export const DELETE = withApi({ schema: SongIdRequired, auth: 'user' }, async ({ input, session }) => {
  await likeService.removeLike(session!.user.channelId, input.songId);
  return ok({ deleted: true });
});
