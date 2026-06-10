import mongoose from 'mongoose';
import Like from './like.schema';
import User from '@/models/User';
import SongDetail from '@/domains/catalog/song.schema';
import { NotFoundError, ConflictError } from '@/shared/api/errors';

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

async function requireUserByChannel(channelId: string) {
  const user = await User.findOne({ channelId });
  if (!user) throw new NotFoundError('사용자를 찾을 수 없습니다.');
  return user;
}

/** 특정 곡 좋아요 여부 */
export async function getLikeStatus(channelId: string, songId: string): Promise<boolean> {
  const like = await Like.findOne({ channelId, songId: toObjectId(songId) });
  return !!like;
}

/** 사용자의 전체 좋아요 목록 (곡 기본 정보 포함) */
export async function listLikes(channelId: string) {
  return Like.find({ channelId })
    .populate('songId', 'title artist language')
    .sort({ createdAt: -1 });
}

/** 좋아요 추가. 곡의 likeCount도 함께 증가시킨다. */
export async function addLike(channelId: string, songId: string) {
  const user = await requireUserByChannel(channelId);

  const song = await SongDetail.findById(songId);
  if (!song) throw new NotFoundError('곡을 찾을 수 없습니다.');

  const existing = await Like.findOne({ userId: user._id, songId: toObjectId(songId) });
  if (existing) throw new ConflictError('이미 좋아요한 곡입니다.');

  const like = await new Like({ userId: user._id, channelId, songId: toObjectId(songId) }).save();
  await SongDetail.findByIdAndUpdate(songId, { $inc: { likeCount: 1 } });
  return like;
}

/** 좋아요 취소. 곡의 likeCount도 함께 감소시킨다. */
export async function removeLike(channelId: string, songId: string) {
  const user = await requireUserByChannel(channelId);

  const removed = await Like.findOneAndDelete({ userId: user._id, songId: toObjectId(songId) });
  if (!removed) throw new NotFoundError('좋아요를 찾을 수 없습니다.');

  await SongDetail.findByIdAndUpdate(songId, { $inc: { likeCount: -1 } });
}

/** 여러 곡의 좋아요 여부를 한 번에 조회 */
export async function bulkLikeStatus(channelId: string, songIds: string[]) {
  const validSongIds = songIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

  const likeMap: Record<string, boolean> = {};
  for (const songId of validSongIds) likeMap[songId] = false;

  if (validSongIds.length > 0) {
    const likes = await Like.find({
      channelId,
      songId: { $in: validSongIds.map(toObjectId) },
    })
      .select('songId')
      .lean();

    for (const like of likes) likeMap[String(like.songId)] = true;
  }

  const total = Object.values(likeMap).filter(Boolean).length;
  return { likes: likeMap, total, requested: validSongIds.length };
}
