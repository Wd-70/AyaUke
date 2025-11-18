import mongoose, { Schema, Document } from 'mongoose';

// YouTube 채널 데이터
export interface ChannelData extends Document {
  channelId: string;
  channelName: string;
  channelUrl: string;
  lastSyncDate: Date;
  totalVideos: number;
  totalComments: number;
  timelineComments: number;
  createdAt: Date;
  updatedAt: Date;
}

const ChannelSchema = new Schema<ChannelData>({
  channelId: { type: String, required: true, unique: true },
  channelName: { type: String, required: true },
  channelUrl: { type: String, required: true },
  lastSyncDate: { type: Date, default: Date.now },
  totalVideos: { type: Number, default: 0 },
  totalComments: { type: Number, default: 0 },
  timelineComments: { type: Number, default: 0 }
}, {
  timestamps: true
});

// YouTube 비디오 데이터
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

// YouTube 댓글 데이터
export interface CommentData extends Document {
  commentId: string;
  videoId: string;
  parentCommentId?: string;  // 답글인 경우 부모 댓글 ID
  isReply: boolean;          // 답글 여부
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
  parentCommentId: { type: String },  // 답글인 경우 부모 댓글 ID
  isReply: { type: Boolean, default: false },  // 답글 여부
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

// 인덱스 설정
VideoSchema.index({ channelId: 1, publishedAt: -1 });
CommentSchema.index({ videoId: 1, isTimeline: 1 });
CommentSchema.index({ isProcessed: 1, isTimeline: 1 });
CommentSchema.index({ parentCommentId: 1 });  // 답글 조회용 인덱스

export const YouTubeChannel = mongoose.models.YouTubeChannel || mongoose.model<ChannelData>('YouTubeChannel', ChannelSchema);
export const YouTubeVideo = mongoose.models.YouTubeVideo || mongoose.model<VideoData>('YouTubeVideo', VideoSchema);
export const YouTubeComment = mongoose.models.YouTubeComment || mongoose.model<CommentData>('YouTubeComment', CommentSchema);
