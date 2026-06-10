import mongoose, { Schema, Document } from 'mongoose';

/** 댓글 수집 대상 YouTube 채널과 동기화 현황 */
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

export const YouTubeChannel =
  mongoose.models.YouTubeChannel || mongoose.model<ChannelData>('YouTubeChannel', ChannelSchema);
export default YouTubeChannel;
