import mongoose, { Schema, Document } from 'mongoose';
import { SongDetail } from '@/types';

export interface ISongDetail extends SongDetail, Document {}

const MRLinkSchema = new Schema({
  url: {
    type: String,
    required: true,
    trim: true,
  },
  skipSeconds: {
    type: Number,
    default: 0,
    min: 0,
  },
  label: {
    type: String,
    trim: true,
  },
  duration: {
    type: String,
    trim: true,
  },
}, { _id: false });

const SongDetailSchema: Schema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  artist: {
    type: String,
    required: true,
    trim: true,
  },
  titleAlias: {
    type: String,
    trim: true,
  },
  artistAlias: {
    type: String,
    trim: true,
  },
  language: {
    type: String,
    trim: true,
    enum: ['Korean', 'English', 'Japanese', 'Chinese', 'Other'],
  },
  lyrics: {
    type: String,
    trim: true,
  },
  searchTags: [{
    type: String,
    trim: true,
  }],
  sungCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  lastSungDate: {
    type: String,
    trim: true,
  },
  keyAdjustment: {
    type: Number,
    default: null,
    validate: {
      validator: function(v: number | null) {
        if (v === undefined || v === null) return true;
        return v >= -12 && v <= 12;
      },
      message: '키 조절은 -12부터 +12 사이의 숫자로 입력해주세요.'
    }
  },
  isFavorite: {
    type: Boolean,
    default: false,
  },
  mrLinks: [MRLinkSchema],
  selectedMRIndex: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function(this: ISongDetail, v: number) {
        if (v === undefined || v === null) return true;
        const mrLinks = this.mrLinks;
        if (!mrLinks || mrLinks.length === 0) return true;
        return v < mrLinks.length;
      },
      message: 'selectedMRIndex must be within the range of available MR links'
    }
  },
  playlists: [{
    type: String,
    trim: true,
  }],
  personalNotes: {
    type: String,
    trim: true,
  },
  imageUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v: string) {
        if (!v) return true; // 빈 값은 허용
        // URL 형식 검증
        try {
          new URL(v);
          return true;
        } catch {
          return false;
        }
      },
      message: '올바른 URL 형식을 입력해주세요.'
    }
  },
}, {
  timestamps: true,
});

SongDetailSchema.index({ title: 1 }, { unique: true });
SongDetailSchema.index({ isFavorite: -1 });
SongDetailSchema.index({ sungCount: -1 });
SongDetailSchema.index({ lastSungDate: -1 });
SongDetailSchema.index({ searchTags: 1 });
SongDetailSchema.index({ playlists: 1 });
SongDetailSchema.index({ language: 1 });

export default mongoose.models.SongbookDetail || mongoose.model<ISongDetail>('SongbookDetail', SongDetailSchema);