import mongoose, { Model, Schema } from 'mongoose'

/**
 * 방종셀카 아카이브 도메인.
 * - SelfiePost: X/팬카페에서 수집한 게시물(원자료). 이미지 원격 링크 + 로컬 아카이브 경로.
 * - SelfieDay: 날짜(방송 회차)별 참석자 명단(셀카 속 채팅 닉네임을 분석해 큐레이션).
 * - SelfieAlias: 로그인 사용자가 등록한 과거/추가 닉네임(개인 기록 매칭용).
 */

export interface ISelfiePost extends mongoose.Document {
  date: string // YYYY-MM-DD (KST, 게시물 작성일 기준 회차)
  source: 'x' | 'cafe'
  sourceUrl: string // 원본 게시물 URL
  postedAt?: Date
  images: Array<{
    imageUrl: string // 원격(표시용) URL
    localPath?: string // 로컬 아카이브 상대경로 (분석/내구성)
    hash: string // 중복 방지(이미지 바이트 sha1)
    width?: number
    height?: number
  }>
  createdAt: Date
  updatedAt: Date
}

const selfiePostSchema = new mongoose.Schema<ISelfiePost>(
  {
    date: { type: String, required: true, index: true },
    source: { type: String, enum: ['x', 'cafe'], required: true },
    sourceUrl: { type: String, required: true },
    postedAt: { type: Date },
    images: [
      {
        imageUrl: { type: String, required: true },
        localPath: { type: String },
        hash: { type: String, required: true },
        width: { type: Number },
        height: { type: Number },
      },
    ],
  },
  { timestamps: true },
)

selfiePostSchema.index({ date: -1, createdAt: -1 })
selfiePostSchema.index({ 'images.hash': 1 })

export interface ISelfieDay extends mongoose.Document {
  date: string // YYYY-MM-DD (unique)
  attendees: Array<{ nickname: string; normalized: string; count?: number }>
  analyzed: boolean
  analyzedAt?: Date
  note?: string
  countSource?: string // 회차 내 출현수(count)를 누가 집계했는지 (예: 'codex:gpt-5.5 high', 'claude')
  countAt?: Date // 카운트 기록 시각
  createdAt: Date
  updatedAt: Date
}

const selfieDaySchema = new mongoose.Schema<ISelfieDay>(
  {
    date: { type: String, required: true, unique: true },
    attendees: [
      {
        nickname: { type: String, required: true },
        normalized: { type: String, required: true },
        // 그 회차(여러 셀카 스샷) 안에서 잡힌 횟수. 총 출석수엔 영향 없고, 동순위 세부 정렬·회차 내 순위용.
        count: { type: Number, default: 1 },
      },
    ],
    analyzed: { type: Boolean, default: false },
    analyzedAt: { type: Date },
    note: { type: String },
    countSource: { type: String },
    countAt: { type: Date },
  },
  { timestamps: true },
)

selfieDaySchema.index({ 'attendees.normalized': 1 })

export interface ISelfieAlias extends mongoose.Document {
  channelId: string
  nickname: string
  normalized: string
  createdAt: Date
}

const selfieAliasSchema = new mongoose.Schema<ISelfieAlias>(
  {
    channelId: { type: String, required: true, index: true },
    nickname: { type: String, required: true },
    normalized: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

// 한 사용자가 같은 정규화 닉네임을 중복 등록하지 못하게
selfieAliasSchema.index({ channelId: 1, normalized: 1 }, { unique: true })
selfieAliasSchema.index({ normalized: 1 })

export const SelfiePost =
  (mongoose.models.SelfiePost as Model<ISelfiePost> | undefined) ||
  mongoose.model<ISelfiePost>('SelfiePost', selfiePostSchema)

export const SelfieDay =
  (mongoose.models.SelfieDay as Model<ISelfieDay> | undefined) ||
  mongoose.model<ISelfieDay>('SelfieDay', selfieDaySchema)

export const SelfieAlias =
  (mongoose.models.SelfieAlias as Model<ISelfieAlias> | undefined) ||
  mongoose.model<ISelfieAlias>('SelfieAlias', selfieAliasSchema)
