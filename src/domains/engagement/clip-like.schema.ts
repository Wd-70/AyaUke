import mongoose from 'mongoose';

/**
 * 클립(SongVideo) 좋아요. 곡 단위 Like와 동일한 구조 — clipId가 SongVideo를 가리킨다.
 * (한 사용자가 같은 클립을 중복 좋아요할 수 없음)
 */
export interface IClipLike extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  channelId: string;
  clipId: mongoose.Types.ObjectId; // SongVideo._id
  createdAt: Date;
}

const clipLikeSchema = new mongoose.Schema<IClipLike>(
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
  },
  { timestamps: true },
);

// 한 사용자가 같은 클립을 중복 좋아요 불가
clipLikeSchema.index({ channelId: 1, clipId: 1 }, { unique: true });
clipLikeSchema.index({ userId: 1, clipId: 1 }, { unique: true });
clipLikeSchema.index({ userId: 1, createdAt: -1 });
clipLikeSchema.index({ clipId: 1 });

export const ClipLike =
  mongoose.models.ClipLike || mongoose.model<IClipLike>('ClipLike', clipLikeSchema);
export default ClipLike;
