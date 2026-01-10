import mongoose, { Schema, Document, Model } from "mongoose";

export interface IChzzkVideo extends Document {
  videoNo: number;
  videoId: string;
  channelId: string;
  channelName: string;
  videoTitle: string;
  publishDate: string;
  duration: number;
  readCount: number;
  thumbnailImageUrl: string;
  videoUrl: string;

  // Comment statistics
  totalComments: number;
  timelineComments: number;
  lastCommentSync: Date;

  // YouTube mapping (user input)
  youtubeUrl?: string;
  youtubeVideoId?: string;
  timeOffset?: number; // in seconds, youtube time - chzzk time
  syncSetAt?: Date;

  // Video status
  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const ChzzkVideoSchema = new Schema<IChzzkVideo>(
  {
    videoNo: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    videoId: {
      type: String,
      required: true,
      index: true,
    },
    channelId: {
      type: String,
      required: true,
      index: true,
    },
    channelName: {
      type: String,
      required: true,
    },
    videoTitle: {
      type: String,
      required: true,
    },
    publishDate: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    readCount: {
      type: Number,
      default: 0,
    },
    thumbnailImageUrl: {
      type: String,
      required: true,
    },
    videoUrl: {
      type: String,
      required: true,
    },
    totalComments: {
      type: Number,
      default: 0,
    },
    timelineComments: {
      type: Number,
      default: 0,
    },
    lastCommentSync: {
      type: Date,
    },
    youtubeUrl: {
      type: String,
    },
    youtubeVideoId: {
      type: String,
    },
    timeOffset: {
      type: Number,
    },
    syncSetAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
ChzzkVideoSchema.index({ channelId: 1, publishDate: -1 });
ChzzkVideoSchema.index({ timelineComments: -1 });
ChzzkVideoSchema.index({ youtubeUrl: 1 });

const ChzzkVideo: Model<IChzzkVideo> =
  mongoose.models.ChzzkVideo ||
  mongoose.model<IChzzkVideo>("ChzzkVideo", ChzzkVideoSchema);

export default ChzzkVideo;
