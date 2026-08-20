import mongoose, { Model } from 'mongoose';

/**
 * 클립(SongVideo)에 대한 "나만 보는" 개인 메모.
 * 사용자가 각 클립을 개인적으로 구별하기 위한 비공개 노트 — 좋아요(ClipLike)와 동일하게
 * clipId가 SongVideo를 가리키고 사용자(channelId)별로 하나만 존재한다(upsert).
 * 공개 데이터(SongVideo.description)와 분리되어 다른 사용자에게 노출되지 않는다.
 */
export interface IClipMemo extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  channelId: string;
  clipId: mongoose.Types.ObjectId; // SongVideo._id
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const clipMemoSchema = new mongoose.Schema<IClipMemo>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    channelId: {
      type: String,
      required: true,
    },
    clipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SongVideo',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true },
);

// 한 사용자가 같은 클립에 메모 하나만 (upsert 기준)
clipMemoSchema.index({ channelId: 1, clipId: 1 }, { unique: true });

export const ClipMemo =
  (mongoose.models.ClipMemo as Model<IClipMemo> | undefined) ||
  mongoose.model<IClipMemo>('ClipMemo', clipMemoSchema);
export default ClipMemo;
