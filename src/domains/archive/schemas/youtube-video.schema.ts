import mongoose, { Schema, Document } from 'mongoose';

/** 댓글 수집된 YouTube 영상 메타데이터 */
export interface VideoData extends Document {
  videoId: string;
  channelId: string;
  title: string;
  publishedAt: Date;
  duration: string;
  viewCount: number;
  totalComments: number;
  timelineComments: number;
  lastCommentSync: Date;
  lastNewCommentAt?: Date;
  thumbnailUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const VideoSchema = new Schema<VideoData>({
  videoId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  title: { type: String, required: true },
  publishedAt: { type: Date, required: true },
  duration: { type: String, default: '' },
  viewCount: { type: Number, default: 0 },
  totalComments: { type: Number, default: 0 },
  timelineComments: { type: Number, default: 0 },
  lastCommentSync: { type: Date, default: Date.now },
  lastNewCommentAt: { type: Date },
  thumbnailUrl: { type: String, default: '' }
}, {
  timestamps: true
});

VideoSchema.index({ channelId: 1, publishedAt: -1 });

export const YouTubeVideo =
  mongoose.models.YouTubeVideo || mongoose.model<VideoData>('YouTubeVideo', VideoSchema);
export default YouTubeVideo;
