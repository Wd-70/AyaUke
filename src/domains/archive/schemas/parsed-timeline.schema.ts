import mongoose, { Schema } from 'mongoose';

/**
 * 유튜브 댓글에서 파싱된 노래 타임라인 항목.
 * (구 /api/timeline-parser 라우트의 인라인 스키마를 추출)
 */
export interface IParsedTimeline {
  id: string;
  /** 'youtube' | 'chzzk' — 기존 데이터는 default youtube */
  platform: 'youtube' | 'chzzk';
  videoId: string;
  /** 치지직 전용 영상 번호 */
  videoNo?: number;
  videoTitle: string;
  uploadedDate: Date; // 파싱된 날짜
  videoPublishedAt?: Date; // 실제 YouTube 영상 업로드 날짜
  originalDateString?: string;
  artist: string;
  songTitle: string;
  videoUrl: string; // t 파라미터 제외 기본 URL
  startTimeSeconds: number;
  endTimeSeconds?: number | null; // 마지막 곡은 null
  duration?: number | null;
  isRelevant: boolean;
  isExcluded: boolean;
  matchedSong?: {
    songId?: string;
    title?: string;
    artist?: string;
    confidence?: number;
  };
  /** @deprecated 댓글 원문은 TimelineComment(commentId 기준)로 정규화. 신규 항목은 미저장. */
  originalComment?: string;
  commentAuthor: string;
  commentId: string;
  commentPublishedAt?: Date;
  // 수동 검증 관련
  isTimeVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  verificationNotes?: string;
  customDescription?: string; // 라이브 클립 업로드용 커스텀 설명
  specialTags?: string[]; // 모르는 곡, 곡 없음 등
  createdAt: Date;
  updatedAt: Date;
}

const ParsedTimelineSchema = new Schema<IParsedTimeline>(
  {
    id: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['youtube', 'chzzk'], default: 'youtube', index: true },
    videoId: { type: String, required: true },
    videoNo: { type: Number },
    videoTitle: { type: String, required: true },
    uploadedDate: { type: Date, required: true },
    videoPublishedAt: { type: Date },
    originalDateString: { type: String },
    artist: { type: String, required: true },
    songTitle: { type: String, required: true },
    videoUrl: { type: String, required: true },
    startTimeSeconds: { type: Number, required: true },
    endTimeSeconds: { type: Number },
    duration: { type: Number },
    isRelevant: { type: Boolean, default: true },
    isExcluded: { type: Boolean, default: false },
    matchedSong: {
      songId: { type: String },
      title: { type: String },
      artist: { type: String },
      confidence: { type: Number },
    },
    // 댓글 원문은 TimelineComment로 정규화됨. 기존 데이터 호환 위해 필드는 유지하되 선택값.
    originalComment: { type: String },
    commentAuthor: { type: String, required: true },
    commentId: { type: String, required: true },
    commentPublishedAt: { type: Date },
    isTimeVerified: { type: Boolean, default: false },
    verifiedBy: { type: String },
    verifiedAt: { type: Date },
    verificationNotes: { type: String },
    customDescription: { type: String },
    specialTags: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    strict: true,
    timestamps: false, // createdAt/updatedAt 수동 관리 (기존 데이터 호환)
    versionKey: false,
  },
);

// 목록 조회 정렬용 — 인덱스 없이는 컬렉션이 커지면 32MB 정렬 메모리 제한 초과
ParsedTimelineSchema.index({ uploadedDate: -1, startTimeSeconds: 1 });
// 파싱 시 중복 검사용 (platform+videoId+시작시간 ±10초 범위 조회)
ParsedTimelineSchema.index({ platform: 1, videoId: 1, startTimeSeconds: 1 });

export const ParsedTimeline =
  mongoose.models.ParsedTimeline ||
  mongoose.model<IParsedTimeline>('ParsedTimeline', ParsedTimelineSchema);

export default ParsedTimeline;
