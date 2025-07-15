import mongoose from 'mongoose'
import { randomUUID } from 'crypto'

export interface IPlaylist extends mongoose.Document {
  userId: mongoose.Types.ObjectId
  channelId: string
  name: string
  description?: string
  coverImage?: string
  tags: string[]
  songs: Array<{
    songId: mongoose.Types.ObjectId
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

const playlistSchema = new mongoose.Schema<IPlaylist>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500,
    default: ''
  },
  coverImage: {
    type: String,
    default: null
  },
  tags: [{
    type: String,
    maxlength: 20
  }],
  songs: [{
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SongDetail',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    order: {
      type: Number,
      required: true
    }
  }],
  // 공유 기능 관련
  shareId: {
    type: String,
    required: true,
    unique: true,
    default: () => randomUUID()
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  shareSettings: {
    allowCopy: {
      type: Boolean,
      default: true
    },
    requireLogin: {
      type: Boolean,
      default: false
    },
    expiresAt: {
      type: Date,
      default: null
    }
  },
  shareHistory: [{
    shareId: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    revokedAt: {
      type: Date,
      required: true
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// 인덱스
playlistSchema.index({ channelId: 1, name: 1 })
playlistSchema.index({ userId: 1, createdAt: -1 })
playlistSchema.index({ tags: 1 })
playlistSchema.index({ 'songs.songId': 1 })
// shareId는 unique: true로 이미 인덱스가 생성됨
playlistSchema.index({ isPublic: 1 })

// 가상 필드 - 안전한 처리
playlistSchema.virtual('songCount').get(function() {
  try {
    return Array.isArray(this.songs) ? this.songs.length : 0
  } catch (error) {
    return 0
  }
})

export default mongoose.models.Playlist || mongoose.model<IPlaylist>('Playlist', playlistSchema)