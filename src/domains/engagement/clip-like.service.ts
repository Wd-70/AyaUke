import mongoose from 'mongoose';
import ClipLike from './clip-like.schema';
import User from '@/models/User';
import SongVideo from '@/domains/archive/schemas/song-video.schema';
import { NotFoundError, ConflictError } from '@/shared/api/errors';

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

async function requireUserByChannel(channelId: string) {
  const user = await User.findOne({ channelId });
  if (!user) throw new NotFoundError('사용자를 찾을 수 없습니다.');
  return user;
}

/** 특정 클립 좋아요 여부 */
export async function getClipLikeStatus(channelId: string, clipId: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(clipId)) return false;
  const like = await ClipLike.findOne({ channelId, clipId: toObjectId(clipId) });
  return !!like;
}

/** 좋아요 추가. 클립의 likeCount를 원자적으로 증가. 반환: 갱신된 likeCount */
export async function addClipLike(channelId: string, clipId: string): Promise<number> {
  const user = await requireUserByChannel(channelId);

  const clip = await SongVideo.findById(clipId).select('_id likeCount');
  if (!clip) throw new NotFoundError('클립을 찾을 수 없습니다.');

  const existing = await ClipLike.findOne({ userId: user._id, clipId: toObjectId(clipId) });
  if (existing) throw new ConflictError('이미 좋아요한 클립입니다.');

  await new ClipLike({ userId: user._id, channelId, clipId: toObjectId(clipId) }).save();
  const updated = await SongVideo.findByIdAndUpdate(
    clipId,
    { $inc: { likeCount: 1 } },
    { new: true },
  ).select('likeCount');
  return (updated as { likeCount?: number } | null)?.likeCount ?? 0;
}

/** 좋아요 취소. 클립의 likeCount를 원자적으로 감소(0 미만 방지). 반환: 갱신된 likeCount */
export async function removeClipLike(channelId: string, clipId: string): Promise<number> {
  const user = await requireUserByChannel(channelId);

  const removed = await ClipLike.findOneAndDelete({ userId: user._id, clipId: toObjectId(clipId) });
  if (!removed) throw new NotFoundError('좋아요를 찾을 수 없습니다.');

  const updated = await SongVideo.findByIdAndUpdate(
    clipId,
    [{ $set: { likeCount: { $max: [0, { $subtract: [{ $ifNull: ['$likeCount', 0] }, 1] }] } } }],
    { new: true },
  ).select('likeCount');
  return (updated as { likeCount?: number } | null)?.likeCount ?? 0;
}

/** 사용자가 좋아요한 모든 클립의 id 목록 (좋아요 필터용) */
export async function listLikedClipIds(channelId: string): Promise<string[]> {
  const likes = await ClipLike.find({ channelId }).select('clipId').lean();
  return likes.map((l) => String((l as { clipId: unknown }).clipId));
}

/** 여러 클립의 좋아요 여부를 한 번에 조회 */
export async function bulkClipLikeStatus(channelId: string, clipIds: string[]) {
  const valid = clipIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const likeMap: Record<string, boolean> = {};
  for (const id of valid) likeMap[id] = false;

  if (valid.length > 0) {
    const likes = await ClipLike.find({
      channelId,
      clipId: { $in: valid.map(toObjectId) },
    })
      .select('clipId')
      .lean();
    for (const like of likes) likeMap[String(like.clipId)] = true;
  }

  return { likes: likeMap, requested: valid.length };
}
