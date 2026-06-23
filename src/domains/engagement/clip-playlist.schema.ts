import mongoose, { Model } from 'mongoose'
import { randomUUID } from 'crypto'

/**
 * 라이브 클립(SongVideo) 플레이리스트.
 * 곡 플레이리스트(Playlist)와 동일 구조이며, songs 대신 clips(SongVideo 참조)를 담는다.
 * 곡/클립 플레이리스트는 서로 독립적으로 동작한다.
 */
export interface IClipPlaylist extends mongoose.Document {
  userId: mongoose.Types.ObjectId
  channelId: string
  name: string
  description?: string
  coverImage?: string
  tags: string[]
  clips: Array<{
    clipId: mongoose.Types.ObjectId // SongVideo._id
    addedAt: Date
    order: number
  }>
  // 공유 기능 관련
  shareId: string
  isPublic: boolean
  shareSettings: {
    allowCopy: boolean
    requireLogin: boolean
    expiresAt?: Date
  }
  shareHistory: Array<{
    shareId: string
    createdAt: Date
    revokedAt: Date
  }>
  createdAt: Date
  updatedAt: Date
}

const clipPlaylistSchema = new mongoose.Schema<IClipPlaylist>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  channelId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
    maxlength: 100,
  },
  description: {
    type: String,
    maxlength: 500,
    default: '',
  },
  coverImage: {
    type: String,
    default: null,
  },
  tags: [{
    type: String,
    maxlength: 20,
  }],
  clips: [{
    clipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SongVideo',
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    order: {
      type: Number,
      required: true,
    },
  }],
  // 공유 기능 관련
  shareId: {
    type: String,
    required: true,
    unique: true,
    default: () => randomUUID(),
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
  shareSettings: {
    allowCopy: {
      type: Boolean,
      default: true,
    },
    requireLogin: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  shareHistory: [{
    shareId: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      required: true,
    },
  }],
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})

// 인덱스
clipPlaylistSchema.index({ channelId: 1, name: 1 })
clipPlaylistSchema.index({ userId: 1, createdAt: -1 })
clipPlaylistSchema.index({ tags: 1 })
clipPlaylistSchema.index({ 'clips.clipId': 1 })
// shareId는 unique: true로 이미 인덱스가 생성됨
clipPlaylistSchema.index({ isPublic: 1 })

// 가상 필드 - 안전한 처리
clipPlaylistSchema.virtual('clipCount').get(function() {
  try {
    return Array.isArray(this.clips) ? this.clips.length : 0
  } catch {
    return 0
  }
})

export default (mongoose.models.ClipPlaylist as Model<IClipPlaylist> | undefined) ||
  mongoose.model<IClipPlaylist>('ClipPlaylist', clipPlaylistSchema)
