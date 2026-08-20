import mongoose from 'mongoose';
import ClipMemo from './clip-memo.schema';
import User from '@/models/User';
import SongVideo from '@/domains/archive/schemas/song-video.schema';
import { NotFoundError } from '@/shared/api/errors';

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

async function requireUserByChannel(channelId: string) {
  const user = await User.findOne({ channelId });
  if (!user) throw new NotFoundError('사용자를 찾을 수 없습니다.');
  return user;
}

/** 특정 클립의 내 메모 텍스트 (없으면 null) */
export async function getClipMemo(channelId: string, clipId: string): Promise<string | null> {
  if (!mongoose.Types.ObjectId.isValid(clipId)) return null;
  const memo = await ClipMemo.findOne({ channelId, clipId: toObjectId(clipId) }).select('text').lean();
  return (memo as { text?: string } | null)?.text ?? null;
}

/**
 * 메모 저장(upsert). 빈 문자열이면 메모 삭제.
 * 반환: 저장된 텍스트('' = 삭제됨).
 */
export async function setClipMemo(channelId: string, clipId: string, rawText: string): Promise<string> {
  const user = await requireUserByChannel(channelId);

  const clip = await SongVideo.findById(clipId).select('_id');
  if (!clip) throw new NotFoundError('클립을 찾을 수 없습니다.');

  const text = (rawText ?? '').trim().slice(0, 1000);

  if (!text) {
    await ClipMemo.findOneAndDelete({ channelId, clipId: toObjectId(clipId) });
    return '';
  }

  await ClipMemo.findOneAndUpdate(
    { channelId, clipId: toObjectId(clipId) },
    { $set: { text, userId: user._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return text;
}

/** 여러 클립의 메모 보유 여부를 한 번에 조회 (카드 인디케이터용) */
export async function bulkClipMemoStatus(channelId: string, clipIds: string[]) {
  const valid = clipIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const memos: Record<string, boolean> = {};
  for (const id of valid) memos[id] = false;

  if (valid.length > 0) {
    const rows = await ClipMemo.find({
      channelId,
      clipId: { $in: valid.map(toObjectId) },
    })
      .select('clipId')
      .lean();
    for (const row of rows) memos[String(row.clipId)] = true;
  }

  return { memos, requested: valid.length };
}
