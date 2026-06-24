import fsp from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { SelfiePost, SelfieDay, SelfieAlias } from './selfie.schema'
import { normalizeText } from '@/shared/utils/song-match'
import { isLocalEnvironment } from '@/domains/operations/local-backup.service'
import { ValidationError } from '@/shared/api/errors'

const ARCHIVE_ROOT = path.join(process.cwd(), 'selfie-archive')

/** Date → KST 기준 YYYY-MM-DD */
export function toKstDate(d: Date): string {
  // en-CA 로케일은 YYYY-MM-DD 형식을 보장
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export interface IngestImageInput {
  imageUrl: string
  /** 확장이 직접 fetch한 이미지 바이트(base64). 없으면 서버가 imageUrl을 받아온다. */
  dataBase64?: string
  contentType?: string
  width?: number
  height?: number
}

export interface IngestPostInput {
  source: 'x' | 'cafe'
  sourceUrl: string
  postedAt?: string // ISO
  images: IngestImageInput[]
}

/** 이미지 바이트 확보(확장 전송분 우선, 없으면 서버 fetch). */
async function resolveBytes(img: IngestImageInput): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (img.dataBase64) {
    return { bytes: Buffer.from(img.dataBase64, 'base64'), contentType: img.contentType || 'image/jpeg' }
  }
  try {
    const res = await fetch(img.imageUrl)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || img.contentType || 'image/jpeg'
    return { bytes: Buffer.from(await res.arrayBuffer()), contentType: ct }
  } catch {
    return null
  }
}

/**
 * 게시물 1건 수집. 이미지를 로컬 아카이브(`selfie-archive/<date>/<hash>.<ext>`)에 저장하고
 * SelfiePost를 sourceUrl 기준 upsert(이미지는 hash로 합집합). 로컬 환경이 아니면 파일은 건너뛰고
 * 원격 imageUrl만 기록한다.
 */
export async function ingestPost(input: IngestPostInput) {
  if (!input.sourceUrl || !Array.isArray(input.images) || input.images.length === 0) {
    throw new ValidationError('sourceUrl과 이미지가 필요합니다.')
  }

  const postedAt = input.postedAt ? new Date(input.postedAt) : new Date()
  const date = toKstDate(postedAt)
  const local = isLocalEnvironment()

  const existing = await SelfiePost.findOne({ sourceUrl: input.sourceUrl })
  const seen = new Set<string>((existing?.images || []).map((i) => i.hash))
  const newImages: ISelfieImage[] = []

  for (const img of input.images) {
    const resolved = await resolveBytes(img)
    const hash = resolved ? createHash('sha1').update(resolved.bytes).digest('hex') : createHash('sha1').update(img.imageUrl).digest('hex')
    if (seen.has(hash)) continue
    seen.add(hash)

    let localPath: string | undefined
    if (local && resolved) {
      const ext = EXT_BY_TYPE[resolved.contentType] || 'jpg'
      const dir = path.join(ARCHIVE_ROOT, date)
      await fsp.mkdir(dir, { recursive: true })
      const rel = path.join('selfie-archive', date, `${hash}.${ext}`)
      await fsp.writeFile(path.join(dir, `${hash}.${ext}`), resolved.bytes)
      localPath = rel.split(path.sep).join('/')
    }

    newImages.push({ imageUrl: img.imageUrl, localPath, hash, width: img.width, height: img.height })
  }

  if (!existing) {
    await SelfiePost.create({ date, source: input.source, sourceUrl: input.sourceUrl, postedAt, images: newImages })
  } else if (newImages.length > 0) {
    existing.images.push(...newImages)
    existing.date = date
    existing.postedAt = postedAt
    await existing.save()
  }

  return { date, addedImages: newImages.length }
}

interface ISelfieImage {
  imageUrl: string
  localPath?: string
  hash: string
  width?: number
  height?: number
}

/** 갤러리: 날짜별 게시물·이미지 + 참석 인원수(분석된 경우). */
export async function listSelfiesByDate() {
  const posts = await SelfiePost.find().sort({ date: -1, createdAt: -1 }).lean()
  const days = await SelfieDay.find().lean()
  const attendeeCountByDate = new Map<string, number>()
  for (const d of days) attendeeCountByDate.set(d.date, (d.attendees || []).length)

  const byDate = new Map<string, { date: string; posts: typeof posts; attendeeCount: number }>()
  for (const p of posts) {
    if (!byDate.has(p.date)) {
      byDate.set(p.date, { date: p.date, posts: [], attendeeCount: attendeeCountByDate.get(p.date) || 0 })
    }
    byDate.get(p.date)!.posts.push(p)
  }
  return [...byDate.values()]
}

/** 누적 통계: 회차수·고유 참석자·최다 출현 리더보드·날짜별 인원. */
export async function getSelfieStats() {
  const days = await SelfieDay.find().sort({ date: -1 }).lean()
  const dateCounts = days.map((d) => ({ date: d.date, count: (d.attendees || []).length }))

  // 정규화 닉네임 → { 대표 닉네임, 출현 날짜 수 }
  const tally = new Map<string, { nickname: string; days: number }>()
  for (const d of days) {
    for (const a of d.attendees || []) {
      const cur = tally.get(a.normalized)
      if (cur) cur.days += 1
      else tally.set(a.normalized, { nickname: a.nickname, days: 1 })
    }
  }
  const leaderboard = [...tally.values()].sort((a, b) => b.days - a.days).slice(0, 50)

  return {
    totalDays: days.length,
    analyzedDays: days.filter((d) => d.analyzed).length,
    uniqueAttendees: tally.size,
    leaderboard,
    dateCounts,
  }
}

/** 사용자 정규화 닉네임 집합(channelName + 등록 별칭). */
async function userNormalizedSet(channelId: string, channelName?: string): Promise<Set<string>> {
  const set = new Set<string>()
  if (channelName) set.add(normalizeText(channelName))
  const aliases = await SelfieAlias.find({ channelId }).lean()
  for (const a of aliases) set.add(a.normalized)
  set.delete('')
  return set
}

/** 내 기록: 내가 나온 날짜 목록/총횟수/랭크 + 등록한 별칭. */
export async function getMyRecords(channelId: string, channelName?: string) {
  const mine = await userNormalizedSet(channelId, channelName)
  const days = await SelfieDay.find().sort({ date: -1 }).lean()

  const myDates: Array<{ date: string; matchedNickname: string }> = []
  for (const d of days) {
    const hit = (d.attendees || []).find((a) => mine.has(a.normalized))
    if (hit) myDates.push({ date: d.date, matchedNickname: hit.nickname })
  }

  // 랭크: 전체 참석자 중 출현 횟수 기준
  const tally = new Map<string, number>()
  for (const d of days) for (const a of d.attendees || []) tally.set(a.normalized, (tally.get(a.normalized) || 0) + 1)
  const myCount = myDates.length
  const rank = myCount > 0 ? [...tally.values()].filter((c) => c > myCount).length + 1 : null

  const aliases = await SelfieAlias.find({ channelId }).sort({ createdAt: -1 }).lean()

  return {
    count: myCount,
    rank,
    dates: myDates,
    aliases: aliases.map((a) => ({ id: String(a._id), nickname: a.nickname })),
  }
}

export async function addAlias(channelId: string, nickname: string) {
  const trimmed = (nickname || '').trim()
  const normalized = normalizeText(trimmed)
  if (!trimmed || !normalized) throw new ValidationError('닉네임을 입력해주세요.')
  await SelfieAlias.updateOne(
    { channelId, normalized },
    { $setOnInsert: { channelId, nickname: trimmed, normalized } },
    { upsert: true },
  )
}

export async function removeAlias(channelId: string, aliasId: string) {
  await SelfieAlias.deleteOne({ _id: aliasId, channelId })
}

/** 날짜별 참석자 명단 저장(분석 결과 반영). 닉네임 배열을 정규화 동시 저장. */
export async function setAttendees(date: string, names: string[], note?: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ValidationError('날짜 형식이 올바르지 않습니다(YYYY-MM-DD).')
  const seen = new Set<string>()
  const attendees: Array<{ nickname: string; normalized: string }> = []
  for (const raw of names) {
    const nickname = (raw || '').trim()
    const normalized = normalizeText(nickname)
    if (!nickname || !normalized || seen.has(normalized)) continue
    seen.add(normalized)
    attendees.push({ nickname, normalized })
  }
  await SelfieDay.updateOne(
    { date },
    { $set: { attendees, analyzed: true, analyzedAt: new Date(), ...(note !== undefined ? { note } : {}) } },
    { upsert: true },
  )
  return { date, count: attendees.length }
}
