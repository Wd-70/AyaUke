import SongVideo from './schemas/song-video.schema';
import SongDetail from '@/domains/catalog/song.schema';
import { NotFoundError, ValidationError } from '@/shared/api/errors';

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
  const [total, verified, chzzk, topContributors, topSongs] = await Promise.all([
    SongVideo.countDocuments({}),
    SongVideo.countDocuments({ isVerified: true }),
    SongVideo.countDocuments({ platform: 'chzzk' }),
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
export async function listSongsWithClips({ page, limit, search, sortBy = 'recent' }: SongsWithClipsQuery) {
  const match: Record<string, unknown> = {};
  if (search) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    match.$or = [{ title: regex }, { artist: regex }];
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
  return {
    songs: result.items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ── 클립 목록 (서버 페이지네이션) ────────────────────────────────

export interface ClipsQuery {
  page: number;
  limit: number;
  sortBy?: 'recent' | 'addedBy' | 'songTitle' | 'verified' | 'sungDate';
  filterBy?: 'all' | 'verified' | 'unverified';
  platform?: 'all' | 'youtube' | 'chzzk';
  search?: string;
  addedBy?: string;
  songId?: string;
}

const SORTS: Record<NonNullable<ClipsQuery['sortBy']>, Record<string, 1 | -1>> = {
  recent: { createdAt: -1 },
  addedBy: { addedByName: 1, createdAt: -1 },
  songTitle: { title: 1, artist: 1 },
  verified: { isVerified: -1, createdAt: -1 },
  sungDate: { sungDate: -1 },
};

export async function listClips(query: ClipsQuery) {
  const { page, limit, sortBy = 'recent', filterBy = 'all', platform = 'all', search, addedBy, songId } = query;

  const match: Record<string, unknown> = {};
  if (filterBy === 'verified') match.isVerified = true;
  if (filterBy === 'unverified') match.isVerified = false;
  if (platform === 'chzzk') match.platform = 'chzzk';
  if (platform === 'youtube') match.platform = { $in: ['youtube', null] };
  if (songId) match.songId = songId;
  if (addedBy) match.addedByName = new RegExp(`^${escapeRegex(addedBy)}$`, 'i');
  if (search) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    match.$or = [{ title: regex }, { artist: regex }, { addedByName: regex }, { description: regex }];
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

  const clips = await SongVideo.find({ songId }).select('startTime endTime').lean();

  const updates = clips
    .filter((clip) =>
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
