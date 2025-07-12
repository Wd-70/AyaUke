import mongoose from 'mongoose'

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
    required: true,
    index: true
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
  }]
}, {
  timestamps: true
})

// 인덱스
playlistSchema.index({ channelId: 1, name: 1 })
playlistSchema.index({ userId: 1, createdAt: -1 })
playlistSchema.index({ tags: 1 })
playlistSchema.index({ 'songs.songId': 1 })

// 가상 필드
playlistSchema.virtual('songCount').get(function() {
  return this.songs.length
})

export default mongoose.models.Playlist || mongoose.model<IPlaylist>('Playlist', playlistSchema)