import mongoose, { Schema } from 'mongoose';

/**
 * 타임라인 댓글 원문(정규화 저장소).
 *
 * 기존에는 ParsedTimeline 항목마다 originalComment(댓글 HTML 전문, ~4KB)를
 * 통째로 복사 저장해, 같은 댓글에서 나온 수십 개 항목이 동일 블롭을 중복 보유했다
 * (9,854개 항목이 실제로는 566개 고유 댓글 → ~31MB 낭비). 댓글 본문을 이 컬렉션에
 * commentId 기준 한 벌만 저장하고, 항목은 commentId로 참조한다.
 */
export interface ITimelineComment {
  commentId: string;
  platform: 'youtube' | 'chzzk';
  text: string;
  author?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TimelineCommentSchema = new Schema<ITimelineComment>(
  {
    commentId: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['youtube', 'chzzk'], default: 'youtube' },
    text: { type: String, required: true },
    author: { type: String },
    publishedAt: { type: Date },
  },
  {
    strict: true,
    timestamps: true,
    versionKey: false,
  },
);

export const TimelineComment =
  mongoose.models.TimelineComment ||
  mongoose.model<ITimelineComment>('TimelineComment', TimelineCommentSchema);

export default TimelineComment;
