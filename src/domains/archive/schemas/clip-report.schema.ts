import mongoose from 'mongoose';

/** 클립 신고 사유 */
export type ClipReportReason =
  | 'broken' // 재생 불가(원본 만료/삭제)
  | 'wrong_song' // 곡 정보 오류
  | 'wrong_time' // 구간(시작/종료) 오류
  | 'inappropriate' // 부적절한 내용
  | 'other'; // 기타

export type ClipReportStatus = 'pending' | 'resolved' | 'dismissed';

export interface IClipReport extends mongoose.Document {
  clipId: mongoose.Types.ObjectId; // SongVideo._id
  reason: ClipReportReason;
  detail?: string;
  reportedBy?: mongoose.Types.ObjectId; // 로그인 사용자(있으면)
  reportedByName?: string;
  channelId?: string;
  status: ClipReportStatus;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const clipReportSchema = new mongoose.Schema<IClipReport>(
  {
    clipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SongVideo',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: ['broken', 'wrong_song', 'wrong_time', 'inappropriate', 'other'],
      required: true,
    },
    detail: { type: String, maxlength: 500, trim: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reportedByName: { type: String, trim: true },
    channelId: { type: String },
    status: {
      type: String,
      enum: ['pending', 'resolved', 'dismissed'],
      default: 'pending',
      index: true,
    },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

// 같은 사용자가 같은 클립을 중복 신고(대기중)하지 못하도록 — 로그인 사용자 한정
clipReportSchema.index(
  { clipId: 1, channelId: 1, status: 1 },
  { unique: true, partialFilterExpression: { channelId: { $type: 'string' }, status: 'pending' } },
);
clipReportSchema.index({ status: 1, createdAt: -1 });

export const ClipReport =
  mongoose.models.ClipReport || mongoose.model<IClipReport>('ClipReport', clipReportSchema);
export default ClipReport;
