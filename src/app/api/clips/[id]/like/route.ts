import { withApi, ok } from '@/shared/api/handler';
import * as clipLikeService from '@/domains/engagement/clip-like.service';

export const POST = withApi({ auth: 'user' }, async ({ params, session }) => {
  const likeCount = await clipLikeService.addClipLike(session!.user.channelId, params.id);
  return ok({ liked: true, likeCount }, { status: 201 });
});

export const DELETE = withApi({ auth: 'user' }, async ({ params, session }) => {
  const likeCount = await clipLikeService.removeClipLike(session!.user.channelId, params.id);
  return ok({ liked: false, likeCount });
});
