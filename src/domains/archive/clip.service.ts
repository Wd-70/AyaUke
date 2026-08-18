import SongVideo from './schemas/song-video.schema';
import SongDetail from '@/domains/catalog/song.schema';
import User from '@/models/User';
import { NotFoundError, ValidationError } from '@/shared/api/errors';

// ── 업로더 닉네임 정규화 (읽기 시 resolve) ───────────────────────
// 클립에 저장된 addedByName은 추가 시점의 복사본이라 사용자가 닉네임을 바꾸면
// stale해진다. 표시용 이름은 addedBy(User 참조)로 읽을 때마다 최신값을 조인해 채운다.
// (저장된 addedByName은 탈퇴/레거시 사용자 + 기존 검색·집계 호환용 폴백으로만 유지)

/** clips 배열의 addedByName을 User의 현재 표시이름으로 덮어쓴다 (배치 조인 1회). */
export async function resolveUploaderNames<
  T extends { addedBy?: unknown; addedByName?: string },
>(clips: T[]): Promise<T[]> {
  const ids = [...new Set(clips.map((c) => c.addedBy && String(c.addedBy)).filter(Boolean))];
  if (ids.length === 0) return clips;

  const users = await User.find({ _id: { $in: ids } })
    .select('displayName channelName')
    .lean<{ _id: unknown; displayName?: string; channelName?: string }[]>();
  const nameById = new Map(
    users.map((u) => [String(u._id), u.displayName || u.channelName || '']),
  );

  return clips.map((c) => {
    const fresh = c.addedBy ? nameById.get(String(c.addedBy)) : '';
    return fresh ? { ...c, addedByName: fresh } : c;
  });
}

// ── 공개 클립 DTO (공유 페이지 / 공개 API) ────────────────────────

export interface PublicClipDTO {
  /** 내부 ObjectId (좋아요/신고 등 API용) */
  id: string;
  /** 공개 URL용 불투명 식별자 (/clip/[shareId]) */
  shareId: string;
  songId: string;
  title: string;
  artist: string;
  platform: 'youtube' | 'chzzk';
  videoId: string;
  startTime: number;
  endTime: number | null;
  sungDate: string | null;
  /** 표시용 날짜 라벨 "YYYY.MM.DD" (KST) */
  sungDateLabel: string | null;
  description: string | null;
  uploaderName: string;
  thumbnailUrl: string | null;
  isVerified: boolean;
  available: boolean;
  likeCount: number;
  playCount: number;
}

export interface PublicClipSummary {
  id: string;
  /** 공개 URL용 불투명 식별자 (/clip/[shareId]) */
  shareId: string;
  songId: string;
  title: string;
  artist: string;
  platform: 'youtube' | 'chzzk';
  sungDate: string | null;
  /** 표시용 날짜 "YYYY.MM.DD" (KST) */
  sungDateLabel: string | null;
  thumbnailUrl: string | null;
  isVerified: boolean;
  likeCount: number;
  playCount: number;
}

const SUMMARY_FIELDS = 'shareId songId title artist titleAlias artistAlias platform sungDate thumbnailUrl isVerified likeCount playCount';

/** 표시용 날짜 라벨 (KST YYYY.MM.DD) */
function toDateLabel(d: Date | string | undefined): string | null {
  if (!d) return null;
  return new Date(d)
    .toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .replace(/\. /g, '.')
    .replace(/\.$/, '');
}

/** lean SongVideo 문서 → 공개 요약 DTO */
function toClipSummary(c: Record<string, unknown>): PublicClipSummary {
  const sungDate = c.sungDate as Date | undefined;
  return {
    id: String(c._id),
    shareId: String(c.shareId ?? c._id),
    songId: String(c.songId ?? ''),
    // 표시용: 별칭(titleAlias/artistAlias) 우선 — 노래책과 일관 (검색은 원본 title/artist 유지)
    title: String(c.titleAlias || c.title || ''),
    artist: String(c.artistAlias || c.artist || ''),
    platform: (c.platform as 'youtube' | 'chzzk') || 'youtube',
    sungDate: sungDate ? new Date(sungDate).toISOString() : null,
    sungDateLabel: toDateLabel(sungDate),
    thumbnailUrl: (c.thumbnailUrl as string) || null,
    isVerified: !!c.isVerified,
    likeCount: (c.likeCount as number) || 0,
    playCount: (c.playCount as number) || 0,
  };
}

/** 같은 곡의 다른 클립들(공유 페이지 rail용) — 좋아요·최신순, 현재 클립 제외. */
export async function getPublicClipsForSong(
  songId: string,
  excludeClipId: string,
  limit = 8,
): Promise<PublicClipSummary[]> {
  const clips = await SongVideo.find({
    songId,
    sourceUnavailable: { $ne: true },
    _id: { $ne: /^[0-9a-fA-F]{24}$/.test(excludeClipId) ? excludeClipId : null },
  })
    .sort({ likeCount: -1, sungDate: -1 })
    .limit(limit)
    .select(SUMMARY_FIELDS)
    .lean<Record<string, unknown>[]>();

  return clips.map(toClipSummary);
}

// ── 공개 클립 갤러리 (/clips) ─────────────────────────────────────

export interface PublicClipsQuery {
  sort?: 'popular' | 'mostPlayed' | 'recent';
  platform?: 'all' | 'youtube' | 'chzzk';
  verified?: boolean;
  q?: string;
  page?: number;
  limit?: number;
}

// _id를 마지막 정렬키로 둬 동률(likeCount/sungDate 동일) 시에도 순서를 고정한다.
// (없으면 offset 페이지네이션이 비결정적이라 같은 클립이 여러 페이지에 중복 등장)
const PUBLIC_SORTS: Record<NonNullable<PublicClipsQuery['sort']>, Record<string, 1 | -1>> = {
  popular: { likeCount: -1, sungDate: -1, _id: -1 },
  mostPlayed: { playCount: -1, sungDate: -1, _id: -1 },
  recent: { sungDate: -1, createdAt: -1, _id: -1 },
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 공개 클립 전체 요약 — 검색 모드용. 클라이언트가 isTextMatch(초성·한영·띄어쓰기 무시)로
 * 즉시 필터링한다(노래책 검색과 동일 UX). 검색은 q를 받지 않고 플랫폼/검증만 적용.
 */
export async function listAllClipSummaries({
  sort = 'popular',
  platform = 'all',
  verified = false,
}: Omit<PublicClipsQuery, 'q' | 'page' | 'limit'>): Promise<PublicClipSummary[]> {
  const match: Record<string, unknown> = { sourceUnavailable: { $ne: true } };
  if (platform === 'chzzk') match.platform = 'chzzk';
  if (platform === 'youtube') match.platform = { $in: ['youtube', null] };
  if (verified) match.isVerified = true;

  const clips = await SongVideo.find(match)
    .sort(PUBLIC_SORTS[sort])
    .limit(6000) // 안전 상한
    .select(SUMMARY_FIELDS)
    .lean<Record<string, unknown>[]>();

  return clips.map(toClipSummary);
}

/** 공개 클립 목록 — 갤러리용. 정렬/플랫폼/검증/검색 + 페이지네이션. 재생 불가 제외. */
export async function listPublicClips({
  sort = 'popular',
  platform = 'all',
  verified = false,
  q,
  page = 1,
  limit = 24,
}: PublicClipsQuery) {
  const match: Record<string, unknown> = { sourceUnavailable: { $ne: true } };
  if (platform === 'chzzk') match.platform = 'chzzk';
  if (platform === 'youtube') match.platform = { $in: ['youtube', null] };
  if (verified) match.isVerified = true;
  if (q && q.trim()) {
    const re = new RegExp(escapeRe(q.trim()), 'i');
    match.$or = [{ title: re }, { artist: re }, { titleAlias: re }, { artistAlias: re }];
  }

  const safeLimit = Math.min(Math.max(limit, 1), 48);
  const [clips, total] = await Promise.all([
    SongVideo.find(match)
      .sort(PUBLIC_SORTS[sort])
      .skip((page - 1) * safeLimit)
      .limit(safeLimit)
      .select(SUMMARY_FIELDS)
      .lean<Record<string, unknown>[]>(),
    SongVideo.countDocuments(match),
  ]);

  return {
    clips: clips.map(toClipSummary),
    pagination: {
      page,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
      hasMore: page * safeLimit < total,
    },
  };
}

/** 클립 재생 수 증가 (facade 활성화 시). 실패해도 무시. */
export async function incrementClipPlayCount(clipId: string): Promise<void> {
  if (!/^[0-9a-fA-F]{24}$/.test(clipId)) return;
  await SongVideo.findByIdAndUpdate(clipId, { $inc: { playCount: 1 } }).catch(() => {});
}

/** 공개 클립 단건 조회 — 내부 필드(addedBy/verifiedBy 등) 미노출, 업로더명은 최신값. */
export async function getPublicClip(idOrShareId: string): Promise<PublicClipDTO | null> {
  // 공개 URL은 shareId, 레거시 URL/내부 호출은 24-hex ObjectId 모두 허용
  const clip = /^[0-9a-fA-F]{24}$/.test(idOrShareId)
    ? await SongVideo.findById(idOrShareId).lean<Record<string, unknown> | null>()
    : await SongVideo.findOne({ shareId: idOrShareId }).lean<Record<string, unknown> | null>();
  if (!clip) return null;

  const [resolved] = await resolveUploaderNames([
    clip as { addedBy?: unknown; addedByName?: string },
  ]);

  const sungDate = clip.sungDate as Date | undefined;
  const endTime = clip.endTime as number | undefined;
  // 표시용 날짜 라벨 (KST 기준 YYYY.MM.DD)
  const sungDateLabel = sungDate
    ? new Date(sungDate).toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).replace(/\. /g, '.').replace(/\.$/, '')
    : null;
  return {
    id: String(clip._id),
    shareId: String(clip.shareId ?? clip._id),
    songId: String(clip.songId),
    // 표시용: 별칭 우선 (노래책과 일관)
    title: String(clip.titleAlias || clip.title || ''),
    artist: String(clip.artistAlias || clip.artist || ''),
    platform: (clip.platform as 'youtube' | 'chzzk') || 'youtube',
    videoId: String(clip.videoId),
    startTime: (clip.startTime as number) || 0,
    endTime: endTime != null && endTime > 0 ? endTime : null,
    sungDate: sungDate ? new Date(sungDate).toISOString() : null,
    sungDateLabel,
    description: (clip.description as string) || null,
    uploaderName: (resolved.addedByName as string) || '익명',
    thumbnailUrl: (clip.thumbnailUrl as string) || null,
    isVerified: !!clip.isVerified,
    available: !clip.sourceUnavailable,
    likeCount: (clip.likeCount as number) || 0,
    playCount: (clip.playCount as number) || 0,
  };
}

/**
 * 라이브 클립(SongVideo) 관리 유스케이스.
 * 관리자 라이브 클립 탭의 조회/통계/기본 길이 일괄 적용을 담당한다.
 */

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** songId(문자열) → songdetails(ObjectId _id) 조인. 변환 실패 시 null로 무시 */
const SONG_LOOKUP = {
  $lookup: {
    from: 'songdetails',
    let: { sid: { $convert: { input: '$songId', to: 'objectId', onError: null, onNull: null } } },
    pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$sid'] } } }],
    as: 'songDetail',
  },
} as const;

// ── 통계 ──────────────────────────────────────────────────────────

export async function getClipStats() {
  const [total, verified, chzzk, unavailable, topContributors, topSongs] = await Promise.all([
    SongVideo.countDocuments({}),
    SongVideo.countDocuments({ isVerified: true }),
    SongVideo.countDocuments({ platform: 'chzzk' }),
    SongVideo.countDocuments({ sourceUnavailable: true }),
    SongVideo.aggregate([
      { $group: { _id: '$addedByName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    SongVideo.aggregate([
      {
        $group: {
          _id: { songId: '$songId', title: '$title', artist: '$artist' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  return {
    total,
    verified,
    unverified: total - verified,
    unavailable,
    platforms: { youtube: total - chzzk, chzzk },
    topContributors: topContributors.map((c) => ({ name: c._id as string, count: c.count as number })),
    topSongs: topSongs.map((s) => ({
      songId: s._id.songId as string,
      title: s._id.title as string,
      artist: s._id.artist as string,
      count: s.count as number,
    })),
  };
}

// ── 곡별 보기 ─────────────────────────────────────────────────────

export interface SongsWithClipsQuery {
  page: number;
  limit: number;
  search?: string;
  sortBy?: 'recent' | 'clipCount' | 'title';
}

/** 클립을 곡 단위로 묶어 페이지네이션. 곡의 기본 클립 길이(clipDuration) 포함 */
/** 곡 내 클립들에 시간 겹침이 있는지 (같은 플랫폼·같은 영상 내, sweep line) */
function hasTimeOverlap(clips: { p?: string; v: string; s?: number; e?: number | null }[]): boolean {
  const byVideo = new Map<string, { s: number; e: number }[]>();
  for (const c of clips) {
    const key = `${c.p || 'youtube'}|${c.v}`;
    const arr = byVideo.get(key) ?? [];
    arr.push({ s: c.s ?? 0, e: c.e ?? Number.MAX_SAFE_INTEGER });
    byVideo.set(key, arr);
  }
  for (const arr of byVideo.values()) {
    if (arr.length < 2) continue;
    arr.sort((a, b) => a.s - b.s);
    let maxEnd = -Infinity;
    for (const { s, e } of arr) {
      if (s < maxEnd) return true; // 정확히 이어지는(s===maxEnd) 경우는 정상으로 제외
      maxEnd = Math.max(maxEnd, e);
    }
  }
  return false;
}

export async function listSongsWithClips({ page, limit, search, sortBy = 'recent' }: SongsWithClipsQuery) {
  const match: Record<string, unknown> = {};
  if (search) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    match.$or = [{ title: regex }, { artist: regex }, { titleAlias: regex }, { artistAlias: regex }];
  }

  const sortStage: Record<string, 1 | -1> =
    sortBy === 'clipCount'
      ? { clipCount: -1, latestSungDate: -1 }
      : sortBy === 'title'
        ? { title: 1, artist: 1 }
        : { latestSungDate: -1 };

  const [result] = await SongVideo.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    {
      $group: {
        _id: '$songId',
        title: { $first: '$title' },
        artist: { $first: '$artist' },
        clipCount: { $sum: 1 },
        verifiedCount: { $sum: { $cond: ['$isVerified', 1, 0] } },
        platforms: { $addToSet: { $ifNull: ['$platform', 'youtube'] } },
        latestSungDate: { $max: '$sungDate' },
        thumbnailUrl: { $first: '$thumbnailUrl' },
        // 곡별 겹침 판정용 시간 정보 (페이지 항목에 대해서만 Node에서 계산)
        overlapClips: {
          $push: { p: { $ifNull: ['$platform', 'youtube'] }, v: '$videoId', s: { $ifNull: ['$startTime', 0] }, e: '$endTime' },
        },
      },
    },
    { $sort: sortStage },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $addFields: { songId: '$_id' } },
          SONG_LOOKUP as never,
          {
            $addFields: {
              songDetail: { $arrayElemAt: ['$songDetail', 0] },
            },
          },
          {
            $project: {
              _id: 0,
              songId: 1,
              title: 1,
              artist: 1,
              clipCount: 1,
              verifiedCount: 1,
              platforms: 1,
              latestSungDate: 1,
              thumbnailUrl: 1,
              overlapClips: 1,
              titleAlias: '$songDetail.titleAlias',
              artistAlias: '$songDetail.artistAlias',
              clipDuration: '$songDetail.clipDuration',
            },
          },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ]);

  const total: number = result.total[0]?.n ?? 0;
  // 페이지 항목에 대해서만 겹침 여부 계산 후, 무거운 시간 배열은 응답에서 제거
  const songs = (result.items as Array<Record<string, unknown> & { overlapClips?: { p?: string; v: string; s?: number; e?: number | null }[] }>).map(
    ({ overlapClips, ...song }) => ({ ...song, hasOverlap: hasTimeOverlap(overlapClips ?? []) }),
  );
  return {
    songs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ── 클립 목록 (서버 페이지네이션) ────────────────────────────────

export interface ClipsQuery {
  page: number;
  limit: number;
  sortBy?: 'recent' | 'addedBy' | 'songTitle' | 'verified' | 'sungDate';
  filterBy?: 'all' | 'verified' | 'unverified' | 'unavailable';
  platform?: 'all' | 'youtube' | 'chzzk';
  search?: string;
  addedBy?: string;
  songId?: string;
  videoId?: string;
}

const SORTS: Record<NonNullable<ClipsQuery['sortBy']>, Record<string, 1 | -1>> = {
  recent: { createdAt: -1 },
  addedBy: { addedByName: 1, createdAt: -1 },
  songTitle: { title: 1, artist: 1 },
  verified: { isVerified: -1, createdAt: -1 },
  sungDate: { sungDate: -1 },
};

export async function listClips(query: ClipsQuery) {
  const { page, limit, sortBy = 'recent', filterBy = 'all', platform = 'all', search, addedBy, songId, videoId } = query;

  const match: Record<string, unknown> = {};
  if (filterBy === 'verified') match.isVerified = true;
  if (filterBy === 'unverified') match.isVerified = false;
  if (filterBy === 'unavailable') match.sourceUnavailable = true;
  if (platform === 'chzzk') match.platform = 'chzzk';
  if (platform === 'youtube') match.platform = { $in: ['youtube', null] };
  if (songId) match.songId = songId;
  if (videoId) match.videoId = videoId;
  if (addedBy) match.addedByName = new RegExp(`^${escapeRegex(addedBy)}$`, 'i');
  if (search) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    match.$or = [{ title: regex }, { artist: regex }, { titleAlias: regex }, { artistAlias: regex }, { addedByName: regex }, { description: regex }];
  }

  const [result] = await SongVideo.aggregate([
    { $match: match },
    { $sort: SORTS[sortBy] },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          SONG_LOOKUP as never,
          {
            $addFields: {
              songDetail: {
                $let: {
                  vars: { sd: { $arrayElemAt: ['$songDetail', 0] } },
                  in: {
                    _id: '$$sd._id',
                    title: '$$sd.title',
                    artist: '$$sd.artist',
                    titleAlias: '$$sd.titleAlias',
                    artistAlias: '$$sd.artistAlias',
                    clipDuration: '$$sd.clipDuration',
                  },
                },
              },
            },
          },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ]);

  const total: number = result.total[0]?.n ?? 0;
  return {
    clips: result.items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/** 특정 곡의 클립 전체 (곡별 패널용 — 한 곡 분량이라 페이지네이션 불필요) */
export async function listClipsForSong(songId: string) {
  const [clips, song] = await Promise.all([
    SongVideo.find({ songId }).sort({ sungDate: -1, startTime: 1 }).lean(),
    SongDetail.findById(songId).select('title artist titleAlias artistAlias clipDuration').lean(),
  ]);
  return { clips, song };
}

// ── 중복검사용 전체 데이터 (TimelineParsingView 업로드가 사용) ──

export async function getDuplicateCheckData() {
  const clips = await SongVideo.find(
    {},
    { songId: 1, platform: 1, videoId: 1, startTime: 1, endTime: 1, sungDate: 1 },
  )
    .lean()
    .sort({ createdAt: -1 });

  return clips.map((clip) => ({
    songId: clip.songId,
    platform: clip.platform || 'youtube',
    videoId: clip.videoId,
    startTime: clip.startTime || 0,
    endTime: clip.endTime,
    sungDate: clip.sungDate,
  }));
}

// ── 기본 길이 일괄 적용 ──────────────────────────────────────────

/**
 * 이 클립에 기본 길이를 적용해야 하는가 (순수 판정 — 테스트 대상).
 * 종료시간이 없거나 비정상이면 적용, 현재 길이가 기본 길이와
 * threshold 초보다 크게 차이나면 적용. 가까우면(수동 조정 포함) 보존.
 */
export function shouldApplyDefaultDuration(
  startTime: number,
  endTime: number | null | undefined,
  defaultDuration: number,
  thresholdSeconds: number,
): boolean {
  if (endTime == null || endTime <= startTime) return true;
  return Math.abs(endTime - startTime - defaultDuration) > thresholdSeconds;
}

export interface ApplyDurationResult {
  clipDuration: number;
  total: number;
  updated: number;
  skipped: number;
}

/** 곡의 기본 길이를 해당 곡 클립들에 일괄 적용 (threshold 초 이내 차이는 보존) */
export async function applyDefaultDurationToClips(
  songId: string,
  thresholdSeconds: number,
): Promise<ApplyDurationResult> {
  const song = await SongDetail.findById(songId).select('clipDuration').lean();
  if (!song) throw new NotFoundError('곡을 찾을 수 없습니다.');

  const clipDuration = (song as { clipDuration?: number }).clipDuration;
  if (!clipDuration || clipDuration <= 0) {
    throw new ValidationError('이 곡에 기본 클립 길이가 설정되어 있지 않습니다.');
  }

  const clips = await SongVideo.find({ songId }).select('startTime endTime isVerified').lean();

  const updates = clips
    .filter((clip) =>
      // 검증 완료 클립은 사람이 구간을 확정한 것이므로 일괄 적용에서 보존(스킵)
      !(clip as { isVerified?: boolean }).isVerified &&
      shouldApplyDefaultDuration(clip.startTime || 0, clip.endTime, clipDuration, thresholdSeconds),
    )
    .map((clip) => ({
      updateOne: {
        filter: { _id: clip._id },
        update: { $set: { endTime: (clip.startTime || 0) + clipDuration } },
      },
    }));

  if (updates.length > 0) {
    await SongVideo.bulkWrite(updates);
  }

  return {
    clipDuration,
    total: clips.length,
    updated: updates.length,
    skipped: clips.length - updates.length,
  };
}
