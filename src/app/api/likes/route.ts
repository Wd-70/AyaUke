import { z } from 'zod';
import mongoose from 'mongoose';
import Like from '@/models/Like';
import User from '@/models/User';
import SongDetail from '@/models/SongDetail';
import { withApi, ok } from '@/shared/api/handler';
import { NotFoundError, ConflictError } from '@/shared/api/errors';

const SongIdQuery = z.object({ songId: z.string().min(1).optional() });
const SongIdBody = z.object({ songId: z.string().min(1) });

async function findSessionUser(channelId: string) {
  const user = await User.findOne({ channelId });
  if (!user) throw new NotFoundError('사용자를 찾을 수 없습니다.');
  return user;
}

export const GET = withApi({ schema: SongIdQuery, auth: 'user' }, async ({ input, session }) => {
  const channelId = session!.user.channelId;

  if (input.songId) {
    const like = await Like.findOne({
      channelId,
      songId: new mongoose.Types.ObjectId(input.songId),
    });
    return ok({ liked: !!like });
  }

  const likes = await Like.find({ channelId })
    .populate('songId', 'title artist language')
    .sort({ createdAt: -1 });
  return ok({ likes });
});

export const POST = withApi({ schema: SongIdBody, auth: 'user' }, async ({ input, session }) => {
  const user = await findSessionUser(session!.user.channelId);

  const song = await SongDetail.findById(input.songId);
  if (!song) throw new NotFoundError('곡을 찾을 수 없습니다.');

  const songId = new mongoose.Types.ObjectId(input.songId);
  const existing = await Like.findOne({ userId: user._id, songId });
  if (existing) throw new ConflictError('이미 좋아요한 곡입니다.');

  const like = await new Like({ userId: user._id, channelId: session!.user.channelId, songId }).save();
  await SongDetail.findByIdAndUpdate(input.songId, { $inc: { likeCount: 1 } });

  return ok({ like }, { status: 201 });
});

export const DELETE = withApi({ schema: SongIdBody, auth: 'user' }, async ({ input, session }) => {
  const user = await findSessionUser(session!.user.channelId);

  const result = await Like.findOneAndDelete({
    userId: user._id,
    songId: new mongoose.Types.ObjectId(input.songId),
  });
  if (!result) throw new NotFoundError('좋아요를 찾을 수 없습니다.');

  await SongDetail.findByIdAndUpdate(input.songId, { $inc: { likeCount: -1 } });

  return ok({ deleted: true });
});
