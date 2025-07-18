import mongoose, { Document, Schema } from 'mongoose';

export interface MRLink {
  url: string;
  skipSeconds?: number;
  label?: string;
  duration?: string;
}

export interface ISongRequest extends Document {
  title: string;
  artist: string;
  
  // 제출자 정보
  originalSubmitter: string; // userId
  originalSubmitterName: string; // displayName
  submittedAt: Date;
  
  // 추천 시스템 (노래책과 별개)
  recommendationCount: number;
  recommendedBy: string[]; // userId 배열
  
  // 조회수
  viewCount: number;
  
  // 기본 곡 정보 (노래책과 호환)
  language?: string;
  genre?: string;
  difficulty?: string;
  lyrics?: string;
  description?: string; // 추천 이유/설명
  
  // 태그 시스템
  searchTags: string[]; // 검색용 태그
  
  // MR 링크들 (노래책과 동일한 구조)
  mrLinks: MRLink[];
  selectedMRIndex?: number; // 기본 MR 선택
  
  // 원곡 관련 링크들
  originalTrackUrl?: string; // 원곡 링크 (YouTube, Spotify 등)
  lyricsUrl?: string; // 가사 원본 링크
  
  // 추가 메타데이터
  keyAdjustment?: number | null; // 키 조정
  duration?: string; // 곡 길이
  releaseYear?: string; // 발매년도
  
  // 편집 이력
  editHistory: {
    userId: string;
    userName: string;
    editedAt: Date;
    changes: string; // 변경 내용 요약
    fieldsChanged: string[]; // 변경된 필드들
  }[];
  
  // 상태 관리
  status: 'active' | 'pending_approval' | 'approved' | 'rejected';
  
  // 노래책 편입 여부
  promotedToSongbook: boolean;
  promotedAt?: Date;
  promotedBy?: string; // 승격한 관리자
  songbookId?: string; // 노래책에서의 ID
  
  // 메타데이터
  createdAt: Date;
  updatedAt: Date;
}

// MR 링크 서브스키마
const MRLinkSchema = new Schema({
  url: { type: String, required: true },
  skipSeconds: { type: Number, default: 0 },
  label: { type: String },
  duration: { type: String }
}, { _id: false });

const SongRequestSchema = new Schema<ISongRequest>({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  
  originalSubmitter: { type: String, required: true },
  originalSubmitterName: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now },
  
  recommendationCount: { type: Number, default: 0 },
  recommendedBy: [{ type: String }],
  
  viewCount: { type: Number, default: 0 },
  
  // 기본 곡 정보
  language: { type: String },
  genre: { type: String },
  difficulty: { type: String },
  lyrics: { type: String },
  description: { type: String },
  
  // 태그 시스템
  searchTags: [{ type: String }],
  
  // MR 링크들
  mrLinks: [MRLinkSchema],
  selectedMRIndex: { type: Number, default: 0 },
  
  // 원곡 관련 링크들
  originalTrackUrl: { type: String },
  lyricsUrl: { type: String },
  
  // 추가 메타데이터
  keyAdjustment: { type: Number, default: null },
  duration: { type: String },
  releaseYear: { type: String },
  
  editHistory: [{
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    editedAt: { type: Date, default: Date.now },
    changes: { type: String, required: true },
    fieldsChanged: [{ type: String }]
  }],
  
  status: { 
    type: String, 
    enum: ['active', 'pending_approval', 'approved', 'rejected'],
    default: 'active'
  },
  
  promotedToSongbook: { type: Boolean, default: false },
  promotedAt: { type: Date },
  promotedBy: { type: String },
  songbookId: { type: String }
}, {
  timestamps: true
});

// 인덱스 설정
SongRequestSchema.index({ title: 1, artist: 1 });
SongRequestSchema.index({ recommendationCount: -1 });
SongRequestSchema.index({ viewCount: -1 });
SongRequestSchema.index({ submittedAt: -1 });
SongRequestSchema.index({ status: 1 });
SongRequestSchema.index({ promotedToSongbook: 1 });

// 중복 방지를 위한 복합 인덱스
SongRequestSchema.index({ title: 1, artist: 1 }, { unique: true });

export default mongoose.models.SongRequest || mongoose.model<ISongRequest>('SongRequest', SongRequestSchema);