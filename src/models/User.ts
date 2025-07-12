import mongoose from 'mongoose'

export interface IUser extends mongoose.Document {
  channelId: string
  channelName: string
  profileImageUrl?: string
  isAdmin: boolean
  createdAt: Date
  lastLoginAt: Date
  preferences: {
    theme: 'light' | 'dark' | 'system'
    defaultPlaylistView: 'grid' | 'list'
  }
}

const userSchema = new mongoose.Schema<IUser>({
  channelId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  channelName: {
    type: String,
    required: true
  },
  profileImageUrl: {
    type: String,
    default: null
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  lastLoginAt: {
    type: Date,
    default: Date.now
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    defaultPlaylistView: {
      type: String,
      enum: ['grid', 'list'],
      default: 'grid'
    }
  }
}, {
  timestamps: true
})

// 인덱스 추가
userSchema.index({ channelId: 1 })
userSchema.index({ isAdmin: 1 })

export default mongoose.models.User || mongoose.model<IUser>('User', userSchema)