import mongoose, { Schema, Document, Model } from 'mongoose';
import { generateShortId } from '@/shared/utils/short-id';
import { parseVideoUrl, validateVideoUrl, type VideoPlatform } from '@/shared/utils/video-url';
import { ClipRangeProposal, ClipRangeVote, PersonalClipRange, removeClipRangeData } from '../clip-range.schema';
import { validRange } from '../clip-range.policy';

export interface ISongVideo extends Document {
  /** 공개 URL용 불투명 식별자(/clip/[shareId]) — 내부 _id 노출 방지 */
  shareId?: string;
  songId: string; // SongDetail의 _id와 연결
  title: string; // 곡 제목 (검색용/원본)
  artist: string; // 아티스트 (검색용/원본)
  titleAlias?: string; // 표시용 별칭 (SongDetail에서 비정규화, 있으면 우선 표시)
  artistAlias?: string; // 표시용 별칭 (SongDetail에서 비정규화, 있으면 우선 표시)
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
  sourceVersion: number;
  rangeVersion: number;
  rangeActivity: number;
  communityRange?: { proposalId: mongoose.Types.ObjectId; sourceVersion: number; baseVersion: number; startTime: number; endTime: number; support: number; trimSeconds: number } | null;
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
  // 공개 URL용 불투명 식별자. sparse라 백필 전 기존 문서(null)는 unique 제약에서 제외된다.
  shareId: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    default: () => generateShortId(),
  },
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
  titleAlias: {
    type: String,
    trim: true,
  },
  artistAlias: {
    type: String,
    trim: true,
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
  sourceVersion: { type: Number, default: 0 },
  rangeVersion: { type: Number, default: 0 },
  rangeActivity: { type: Number, default: 0 },
  communityRange: {
    type: new Schema({ proposalId: Schema.Types.ObjectId, sourceVersion: Number, baseVersion: Number,
      startTime: Number, endTime: Number, support: Number, trimSeconds: Number }, { _id: false }),
    default: undefined,
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
    index: true,
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
// Official edits invalidate the recommendation. The version guard protects
// overlapping database writes; publishOfficial also checks the editor's revision.
const rangeChanges = new WeakMap<object, { before: ISongVideo; sourceChanged: boolean }>();
SongVideoSchema.pre('findOneAndUpdate', async function() {
  const update = this.getUpdate();
  if (!update || Array.isArray(update)) return;
  const set = { ...update, ...(update.$set || {}) } as Record<string, any>;
  const relevant = ['startTime', 'endTime', 'videoId', 'platform', 'isVerified'];
  if (!relevant.some(k => k in set)) return;
  const before = await this.model.findOne(this.getFilter()).session(this.getOptions().session ?? null).lean<ISongVideo>();
  if (!before) return;
  const sourceChanged = (['videoId', 'platform'] as const).some(k => k in set && set[k] !== before[k]);
  const timeChanged = (['startTime', 'endTime'] as const).some(k => k in set && (set[k] ?? null) !== (before[k] ?? null));
  const verificationChanged = 'isVerified' in set && set.isVerified !== before.isVerified;
  if (!sourceChanged && !timeChanged && !verificationChanged) return;
  if (!validRange({ startTime: set.startTime ?? before.startTime ?? 0,
    endTime: 'endTime' in set ? set.endTime ?? null : before.endTime ?? null })) {
    throw new Error('종료 시간은 시작 시간보다 뒤여야 합니다.');
  }
  const fields = update.$set || (update.$set = {});
  for (const k of Object.keys(update)) if (!k.startsWith('$')) { fields[k] = update[k]; delete update[k]; }
  if ((timeChanged || sourceChanged) && fields.isVerified !== true) {
    fields.isVerified = false; fields.verifiedAt = null; fields.verifiedBy = null;
  }
  fields.communityRange = null;
  if (sourceChanged && !('duration' in fields)) fields.duration = null;
  update.$inc = { ...update.$inc, rangeVersion: 1, ...(sourceChanged ? { sourceVersion: 1 } : {}) };
  this.setQuery({ $and: [this.getFilter(), { $or: [{ rangeVersion: before.rangeVersion ?? 0 },
    ...((before.rangeVersion ?? 0) === 0 ? [{ rangeVersion: { $exists: false } }] : [])] }] });
  rangeChanges.set(this, { before, sourceChanged });
});

SongVideoSchema.post('findOneAndUpdate', async function(doc) {
  const change = rangeChanges.get(this);
  rangeChanges.delete(this);
  if (!change || !doc) return;
  const { before, sourceChanged } = change;
  const session = this.getOptions().session ?? undefined;
  const expiresAt = new Date(Date.now() + 90 * 86_400_000);
  // Only retire the old revision: a new proposal may already have been submitted
  // after a non-transactional legacy update completed.
  const filter = { clipId: before._id, baseVersion: { $lte: before.rangeVersion ?? 0 }, status: 'active' };
  const retired = await ClipRangeProposal.find(filter).select('_id').session(session ?? null);
  await ClipRangeProposal.updateMany(filter,
    { $set: { status: 'superseded', expiresAt } }, { session });
  await ClipRangeVote.updateMany({ proposalId: { $in: retired.map(p => p._id) } }, { $set: { expiresAt } }, { session });
  if (sourceChanged) await PersonalClipRange.deleteMany({ clipId: before._id, sourceVersion: { $lte: before.sourceVersion ?? 0 } }).session(session ?? null);
});

SongVideoSchema.post('findOneAndDelete', async function(doc) {
  if (doc) await removeClipRangeData([doc._id]);
});

const SongVideo = (mongoose.models.SongVideo as Model<ISongVideo> | undefined) || mongoose.model<ISongVideo>('SongVideo', SongVideoSchema);

export default SongVideo;
