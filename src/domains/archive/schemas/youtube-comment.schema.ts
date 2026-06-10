import mongoose, { Schema, Document } from 'mongoose';

/** 수집된 YouTube 댓글 (타임라인 감지/처리 상태 포함) */
export interface CommentData extends Document {
  commentId: string;
  videoId: string;
  parentCommentId?: string; // 답글인 경우 부모 댓글 ID
  isReply: boolean;
  authorName: string;
  textContent: string;
  publishedAt: Date;
  likeCount: number;
  isTimeline: boolean;
  extractedTimestamps: string[];
  isProcessed: boolean;
  processedBy?: string;
  processedAt?: Date;
  manuallyMarked?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<CommentData>({
  commentId: { type: String, required: true, unique: true },
  videoId: { type: String, required: true },
  parentCommentId: { type: String },
  isReply: { type: Boolean, default: false },
  authorName: { type: String, required: true },
  textContent: { type: String, required: true },
  publishedAt: { type: Date, required: true },
  likeCount: { type: Number, default: 0 },
  isTimeline: { type: Boolean, default: false },
  extractedTimestamps: [{ type: String }],
  isProcessed: { type: Boolean, default: false },
  processedBy: { type: String },
  processedAt: { type: Date },
  manuallyMarked: { type: Boolean, default: false }
}, {
  timestamps: true
});

CommentSchema.index({ videoId: 1, isTimeline: 1 });
CommentSchema.index({ isProcessed: 1, isTimeline: 1 });
CommentSchema.index({ parentCommentId: 1 });

export const YouTubeComment =
  mongoose.models.YouTubeComment || mongoose.model<CommentData>('YouTubeComment', CommentSchema);
export default YouTubeComment;
