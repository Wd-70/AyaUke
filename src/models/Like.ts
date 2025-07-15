import mongoose from 'mongoose'

export interface ILike extends mongoose.Document {
  userId: mongoose.Types.ObjectId
  channelId: string
  songId: mongoose.Types.ObjectId // MongoDB Song Document ID
  createdAt: Date
}

const likeSchema = new mongoose.Schema<ILike>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  songId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SongDetail',
    required: true
  }
}, {
  timestamps: true
})

// 복합 인덱스: 한 사용자가 같은 곡을 중복 좋아요할 수 없음
likeSchema.index({ channelId: 1, songId: 1 }, { unique: true })
likeSchema.index({ userId: 1, songId: 1 }, { unique: true })
likeSchema.index({ userId: 1, createdAt: -1 })
likeSchema.index({ songId: 1 })

export default mongoose.models.Like || mongoose.model<ILike>('Like', likeSchema)