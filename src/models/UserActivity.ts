import mongoose, { Schema, Document } from 'mongoose'

export interface IUserActivity extends Document {
  userId: mongoose.Types.ObjectId
  date: string // 'YYYY-MM-DD' 형식
  visitCount: number
  firstVisitAt: Date
  lastVisitAt: Date
  createdAt: Date
  updatedAt: Date
}

const UserActivitySchema = new Schema<IUserActivity>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: String,
    required: true
  },
  visitCount: {
    type: Number,
    default: 1
  },
  firstVisitAt: {
    type: Date,
    required: true
  },
  lastVisitAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
})

// 복합 인덱스: 사용자별 날짜 조회 최적화
UserActivitySchema.index({ userId: 1, date: 1 }, { unique: true })

// 날짜별 인덱스: 오래된 데이터 정리 시 사용
UserActivitySchema.index({ date: 1 })

const UserActivity = mongoose.models.UserActivity || mongoose.model<IUserActivity>('UserActivity', UserActivitySchema)

export { UserActivity }
export default UserActivity