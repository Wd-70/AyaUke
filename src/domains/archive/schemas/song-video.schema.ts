import mongoose, { Schema, Document } from 'mongoose';
import { parseVideoUrl, validateVideoUrl, type VideoPlatform } from '@/shared/utils/video-url';

export interface ISongVideo extends Document {
  songId: string; // SongDetail의 _id와 연결
  title: string; // 곡 제목 (검색용)
  artist: string; // 아티스트 (검색용)
  platform: VideoPlatform; // 'youtube' | 'chzzk' (기존 데이터는 default youtube)
  videoUrl: string; // 유튜브 URL 또는 치지직 다시보기 URL
  videoId: string; // 플랫폼별 영상 ID (치지직은 String(videoNo))
  sungDate: Date; // 부른 날짜
  description?: string; // 영상에 대한 설명 (옵션)
  startTime?: number; // 시작 시간 (초) - 노래 시작 부분으로 바로 이동
  endTime?: number; // 종료 시간 (초) - 노래 끝나는 부분
  addedBy: mongoose.Types.ObjectId; // 추가한 사용자의 MongoDB ObjectId (User._id 참조)
  addedByName: string; // 추가한 사용자의 이름
  isVerified: boolean; // 관리자가 검증한 영상인지
  verifiedBy?: mongoose.Types.ObjectId; // 검증한 관리자 User ObjectId
  verifiedAt?: Date; // 검증 날짜
  thumbnailUrl?: string; // 썸네일 URL (유튜브에서 자동 추출)
  duration?: string; // 영상 길이 (유튜브에서 자동 추출)
  sourceUnavailable?: boolean; // 원본 영상 만료/삭제로 재생 불가 (노래책 숨김)
  sourceCheckedAt?: Date; // 마지막 소스 점검 시각
  likeCount: number; // 좋아요 수 (비정규화 — ClipLike와 원자적 동기)
  playCount: number; // 재생 수 (facade 활성화 시 증가)
  createdAt: Date;
  updatedAt: Date;
}

const SongVideoSchema: Schema = new Schema({
  songId: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  artist: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  platform: {
    type: String,
    enum: ['youtube', 'chzzk'],
    default: 'youtube',
    index: true,
  },
  videoUrl: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: (v: string) => validateVideoUrl(v),
      message: '올바른 유튜브 또는 치지직 다시보기 URL을 입력해주세요.'
    }
  },
  videoId: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  sungDate: {
    type: Date,
    required: true,
    index: -1, // 최신순 정렬을 위한 내림차순 인덱스
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  startTime: {
    type: Number,
    min: 0,
    default: 0,
  },
  endTime: {
    type: Number,
    min: 0,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  addedByName: {
    type: String,
    required: true,
    trim: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true,
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  verifiedAt: {
    type: Date,
  },
  thumbnailUrl: {
    type: String,
    trim: true,
  },
  duration: {
    type: String,
    trim: true,
  },
  // 소스(원본 영상) 가용성: 점검 결과 만료/삭제로 재생 불가면 true → 노래책에서 숨김(소프트)
  sourceUnavailable: {
    type: Boolean,
    default: false,
    index: true,
  },
  sourceCheckedAt: {
    type: Date,
  },
  // 좋아요 수 (ClipLike와 비정규화 동기 — 공유 페이지/인기 정렬에서 집계 없이 읽기)
  likeCount: {
    type: Number,
    default: 0,
    index: true,
  },
  // 재생 수 (facade 활성화 시 증가)
  playCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// 복합 인덱스 설정
SongVideoSchema.index({ songId: 1, sungDate: -1 }); // 특정 곡의 영상을 최신순으로 조회
SongVideoSchema.index({ addedBy: 1, createdAt: -1 }); // 사용자별 추가한 영상 조회
SongVideoSchema.index({ isVerified: 1, sungDate: -1 }); // 검증된 영상 조회
SongVideoSchema.index({ title: 1, artist: 1 }); // 곡 정보로 검색

// 영상 URL에서 플랫폼/ID/썸네일 추출 미들웨어
// 치지직 썸네일은 URL만으로 만들 수 없어 생성 측(서비스)에서 chzzkvideos 데이터로 채운다
SongVideoSchema.pre('save', function(next) {
  if (this.isModified('videoUrl')) {
    const parsed = parseVideoUrl(this.videoUrl as string);
    if (parsed) {
      this.platform = parsed.platform;
      this.videoId = parsed.videoId;
      if (parsed.thumbnailUrl) {
        this.thumbnailUrl = parsed.thumbnailUrl;
      }
    }
  }
  next();
});

// 모델 생성
const SongVideo = mongoose.models.SongVideo || mongoose.model<ISongVideo>('SongVideo', SongVideoSchema);

export default SongVideo;