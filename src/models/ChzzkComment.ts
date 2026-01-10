import mongoose, { Schema, Document, Model } from "mongoose";

export interface IChzzkComment extends Document {
  commentId: number;
  videoNo: number;
  commentType: string; // COMMENT or REPLY
  parentCommentId?: number;

  content: string;
  authorName: string;
  publishedAt: Date;

  // Timeline related
  isTimeline: boolean;
  extractedTimestamps: string[];

  createdAt: Date;
  updatedAt: Date;
}

const ChzzkCommentSchema = new Schema<IChzzkComment>(
  {
    commentId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    videoNo: {
      type: Number,
      required: true,
      index: true,
    },
    commentType: {
      type: String,
      required: true,
      enum: ["COMMENT", "REPLY"],
    },
    parentCommentId: {
      type: Number,
    },
    content: {
      type: String,
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    publishedAt: {
      type: Date,
      required: true,
    },
    isTimeline: {
      type: Boolean,
      default: false,
      index: true,
    },
    extractedTimestamps: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
ChzzkCommentSchema.index({ videoNo: 1, publishedAt: -1 });
ChzzkCommentSchema.index({ videoNo: 1, isTimeline: 1 });

const ChzzkComment: Model<IChzzkComment> =
  mongoose.models.ChzzkComment ||
  mongoose.model<IChzzkComment>("ChzzkComment", ChzzkCommentSchema);

export default ChzzkComment;
