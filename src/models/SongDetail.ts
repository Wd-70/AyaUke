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
  lyricsLinks: [{
    title: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v: string) {
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
    verified: {
      type: Boolean,
      default: false,
    },
    addedBy: {
      type: String,
      trim: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  searchTags: [{
    type: String,
    trim: true,
  }],
  sungCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  likeCount: {
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
  // 곡 상태 관리
  status: {
    type: String,
    enum: ['active', 'deleted', 'pending', 'rejected'],
    default: 'active'
  },
  // 곡 소스 타입 (기존 source 필드 확장)
  sourceType: {
    type: String,
    enum: ['sheet', 'admin', 'user_suggestion'],
    default: 'sheet'
  },
  // 추천자 정보 (사용자 추천곡인 경우)
  suggestedBy: {
    type: String, // 사용자 채널 ID
    trim: true,
  },
  // 삭제 관련 정보
  deletedAt: {
    type: Date,
  },
  deletedBy: {
    type: String, // 삭제한 관리자 채널 ID
    trim: true,
  },
  deleteReason: {
    type: String,
    trim: true,
  },
  // 승인 관련 정보 (추천곡용)
  approvedAt: {
    type: Date,
  },
  approvedBy: {
    type: String, // 승인한 관리자 채널 ID
    trim: true,
  },
}, {
  timestamps: true,
});

// 제목+아티스트 복합 unique 인덱스 (같은 제목이라도 다른 아티스트면 허용)
SongDetailSchema.index({ title: 1, artist: 1 }, { unique: true });
SongDetailSchema.index({ title: 1 }); // 제목 검색용
SongDetailSchema.index({ sungCount: -1 });
SongDetailSchema.index({ lastSungDate: -1 });
SongDetailSchema.index({ searchTags: 1 });
SongDetailSchema.index({ language: 1 });
SongDetailSchema.index({ status: 1 });
SongDetailSchema.index({ sourceType: 1 });
SongDetailSchema.index({ suggestedBy: 1 });
SongDetailSchema.index({ deletedAt: -1 });

// 새로운 통일된 모델명 (SongDetail)
const SongDetail = mongoose.models.SongDetail || mongoose.model<ISongDetail>('SongDetail', SongDetailSchema);

// 기존 호환성을 위한 별칭 제거 (마이그레이션 완료)
// SongDetail 모델만 사용

export default SongDetail;