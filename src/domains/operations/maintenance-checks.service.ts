import mongoose from 'mongoose';
import SongDetail from '@/domains/catalog/song.schema';
import SongVideo from '@/domains/archive/schemas/song-video.schema';
import Like from '@/domains/engagement/like.schema';
import ClipLike from '@/domains/engagement/clip-like.schema';
import ClipMemo from '@/domains/engagement/clip-memo.schema';
import Playlist from '@/domains/engagement/playlist.schema';
import ClipPlaylist from '@/domains/engagement/clip-playlist.schema';
import { recalculateLikeCounts } from './recalc.service';
import { toKstDateString } from '@/shared/utils/stream-date';

/**
 * 데이터 유지보수 → 데이터 점검.
 *
 * 점검(inspect)은 읽기만 해서 '문제가 몇 건인지'와 예시를 보여 주고,
 * 고치기(fix)는 그 항목만 실제 데이터 기준으로 바로잡는다. 예전 '재계산' 버튼 두 개를
 * 이 흐름으로 바꾸고, 빠져 있던 항목(클립 좋아요 수, 지워진 곡·클립을 가리키는 데이터)을 더했다.
 */

export const CHECK_IDS = [
  'song-like-count',
  'song-stats',
  'clip-like-count',
  'orphan-song-likes',
  'orphan-clip-likes',
  'orphan-clip-memos',
  'orphan-playlist-songs',
  'orphan-clip-playlist-items',
  'unplayable-clips',
] as const;
export type CheckId = (typeof CHECK_IDS)[number];

export interface CheckDefinition {
  id: CheckId;
  group: 'counts' | 'orphans' | 'content';
  title: string;
  /** 문제가 무엇인지 — 운영자가 버튼을 누르기 전에 읽는 설명 */
  explain: string;
  /** 고치기를 누르면 실제로 무슨 일이 일어나는지 */
  fix: string | null;
  /** 지우는 작업이면 true — 확인 창에서 백업을 권한다 */
  destructive: boolean;
  /** 고치는 대신 다른 탭에서 다뤄야 하는 항목 */
  goTo?: { tab: string; label: string };
}

export const CHECKS: Record<CheckId, CheckDefinition> = {
  'song-like-count': {
    id: 'song-like-count',
    group: 'counts',
    title: '곡 좋아요 수',
    explain: '곡마다 저장해 둔 좋아요 수가 실제 좋아요 기록 수와 다른 곡입니다. 노래책의 하트 숫자와 좋아요 순 정렬이 틀려집니다.',
    fix: '해당 곡의 좋아요 수를 실제 기록 수로 맞춥니다.',
    destructive: false,
  },
  'song-stats': {
    id: 'song-stats',
    group: 'counts',
    title: '곡 부른 횟수·최근 부른 날',
    explain: '곡의 부른 횟수와 최근 부른 날이 재생 가능한 라이브 클립 기준과 다른 곡입니다. 노래책의 마이크 숫자와 최근 부른 순 정렬이 틀려집니다.',
    fix: '재생 가능한 클립 수와 가장 최근 클립 날짜로 맞춥니다(원본이 사라진 클립은 세지 않음).',
    destructive: false,
  },
  'clip-like-count': {
    id: 'clip-like-count',
    group: 'counts',
    title: '클립 좋아요 수',
    explain: '클립마다 저장해 둔 좋아요 수가 실제 클립 좋아요 기록 수와 다른 클립입니다. 클립 갤러리의 하트 숫자와 인기순이 틀려집니다.',
    fix: '해당 클립의 좋아요 수를 실제 기록 수로 맞춥니다.',
    destructive: false,
  },
  'orphan-song-likes': {
    id: 'orphan-song-likes',
    group: 'orphans',
    title: '없는 곡에 남은 좋아요',
    explain: '데이터베이스에서 완전히 지워진 곡을 가리키는 좋아요 기록입니다. 화면에는 보이지 않지만 통계를 부풀립니다.',
    fix: '해당 좋아요 기록을 지웁니다.',
    destructive: true,
  },
  'orphan-clip-likes': {
    id: 'orphan-clip-likes',
    group: 'orphans',
    title: '없는 클립에 남은 좋아요',
    explain: '지워진 클립을 가리키는 클립 좋아요 기록입니다.',
    fix: '해당 좋아요 기록을 지웁니다.',
    destructive: true,
  },
  'orphan-clip-memos': {
    id: 'orphan-clip-memos',
    group: 'orphans',
    title: '없는 클립에 남은 메모',
    explain: '지워진 클립에 사용자가 남겼던 개인 메모입니다. 더 이상 어디에서도 보이지 않습니다.',
    fix: '해당 메모를 지웁니다.',
    destructive: true,
  },
  'orphan-playlist-songs': {
    id: 'orphan-playlist-songs',
    group: 'orphans',
    title: '플레이리스트 속 없는 곡',
    explain: '곡 플레이리스트에 담겨 있지만 곡이 지워져 빈 칸으로 남은 항목입니다.',
    fix: '플레이리스트에서 해당 항목만 뺍니다(플레이리스트 자체는 그대로).',
    destructive: true,
  },
  'orphan-clip-playlist-items': {
    id: 'orphan-clip-playlist-items',
    group: 'orphans',
    title: '클립 플레이리스트 속 없는 클립',
    explain: '클립 플레이리스트에 담겨 있지만 클립이 지워진 항목입니다. 연속 재생 때 건너뛰는 칸이 생깁니다.',
    fix: '플레이리스트에서 해당 항목만 뺍니다(플레이리스트 자체는 그대로).',
    destructive: true,
  },
  'unplayable-clips': {
    id: 'unplayable-clips',
    group: 'content',
    title: '원본이 사라진 클립',
    explain: '원본 다시보기가 만료·삭제되어 재생할 수 없는 클립입니다. 노래책에서는 자동으로 숨겨집니다. 다른 원본으로 옮기거나 정리하려면 라이브 클립 탭의 소스 점검을 쓰세요.',
    fix: null,
    destructive: false,
    goTo: { tab: 'clips', label: '라이브 클립에서 보기' },
  },
};

export interface CheckResult extends CheckDefinition {
  count: number;
  /** 문제 예시 몇 개(곡 제목 등) */
  samples: string[];
}

const songName = (s: { title?: string; titleAlias?: string; artist?: string }) =>
  `${s.titleAlias || s.title || '(제목 없음)'}${s.artist ? ` · ${s.artist}` : ''}`;
/** 한국 날짜 — 부른 날짜는 KST 자정으로 저장돼 UTC로 자르면 전날이 된다 */
const day = (d: Date | null | undefined) => (d ? toKstDateString(new Date(d)) : null);

type Mismatch = { id: mongoose.Types.ObjectId; set: Record<string, unknown>; sample: string };

// ── 비정규화 카운트 ────────────────────────────────────────────

async function songLikeMismatches(): Promise<Mismatch[]> {
  const counts = await Like.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([{ $group: { _id: '$songId', n: { $sum: 1 } } }]);
  const map = new Map(counts.map((c) => [String(c._id), c.n]));
  const songs = await SongDetail.find({}, { title: 1, titleAlias: 1, artist: 1, likeCount: 1 }).lean<
    { _id: mongoose.Types.ObjectId; title?: string; titleAlias?: string; artist?: string; likeCount?: number }[]
  >();
  return songs.flatMap((s) => {
    const actual = map.get(String(s._id)) ?? 0;
    const stored = s.likeCount ?? 0;
    return actual === stored ? [] : [{ id: s._id, set: { likeCount: actual }, sample: `${songName(s)} (${stored} → ${actual})` }];
  });
}

async function songStatMismatches(): Promise<Mismatch[]> {
  const stats = await SongVideo.aggregate<{ _id: string; n: number; last: Date }>([
    { $match: { sourceUnavailable: { $ne: true } } },
    { $group: { _id: '$songId', n: { $sum: 1 }, last: { $max: '$sungDate' } } },
  ]);
  const map = new Map(stats.map((s) => [String(s._id), s]));
  const songs = await SongDetail.find({ status: { $ne: 'deleted' } }, { title: 1, titleAlias: 1, artist: 1, sungCount: 1, lastSungDate: 1 }).lean<
    { _id: mongoose.Types.ObjectId; title?: string; titleAlias?: string; artist?: string; sungCount?: number; lastSungDate?: string | null }[]
  >();
  return songs.flatMap((s) => {
    const st = map.get(String(s._id));
    const count = st?.n ?? 0;
    const last = day(st?.last) ?? null;
    const storedCount = s.sungCount ?? 0;
    const storedLast = s.lastSungDate ?? null;
    if (count === storedCount && last === storedLast) return [];
    const what = count !== storedCount ? `${storedCount}회 → ${count}회` : `${storedLast ?? '없음'} → ${last ?? '없음'}`;
    return [{ id: s._id, set: { sungCount: count, lastSungDate: last }, sample: `${songName(s)} (${what})` }];
  });
}

async function clipLikeMismatches(): Promise<Mismatch[]> {
  const counts = await ClipLike.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([{ $group: { _id: '$clipId', n: { $sum: 1 } } }]);
  const map = new Map(counts.map((c) => [String(c._id), c.n]));
  const clips = await SongVideo.find({}, { title: 1, artist: 1, likeCount: 1 }).lean<
    { _id: mongoose.Types.ObjectId; title?: string; artist?: string; likeCount?: number }[]
  >();
  return clips.flatMap((c) => {
    const actual = map.get(String(c._id)) ?? 0;
    const stored = c.likeCount ?? 0;
    return actual === stored ? [] : [{ id: c._id, set: { likeCount: actual }, sample: `${songName(c)} (${stored} → ${actual})` }];
  });
}

// ── 지워진 대상을 가리키는 데이터 ────────────────────────────────

/** ref 필드가 가리키는 문서가 없는 기록의 _id */
async function orphanIds(model: mongoose.Model<any>, field: string, target: mongoose.Model<any>): Promise<mongoose.Types.ObjectId[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const rows = await model.aggregate<{ _id: mongoose.Types.ObjectId }>([
    { $lookup: { from: target.collection.name, localField: field, foreignField: '_id', as: 't' } },
    { $match: { t: { $size: 0 } } },
    { $project: { _id: 1 } },
  ]);
  return rows.map((r) => r._id);
}

/** 플레이리스트 배열 속, 대상이 없는 항목: 플레이리스트별 빠진 id 목록 */
async function orphanEntries(
  model: mongoose.Model<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  arrayField: 'songs' | 'clips',
  idField: 'songId' | 'clipId',
  target: mongoose.Model<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<{ playlistId: mongoose.Types.ObjectId; name: string; missing: mongoose.Types.ObjectId[] }[]> {
  return model.aggregate([
    { $unwind: `$${arrayField}` },
    { $lookup: { from: target.collection.name, localField: `${arrayField}.${idField}`, foreignField: '_id', as: 't' } },
    { $match: { t: { $size: 0 } } },
    { $group: { _id: '$_id', name: { $first: '$name' }, missing: { $push: `$${arrayField}.${idField}` } } },
    { $project: { _id: 0, playlistId: '$_id', name: 1, missing: 1 } },
  ]);
}

// ── 점검 ────────────────────────────────────────────────────────

const result = (id: CheckId, count: number, samples: string[]): CheckResult => ({ ...CHECKS[id], count, samples: samples.slice(0, 3) });

export async function inspect(id: CheckId): Promise<CheckResult> {
  switch (id) {
    case 'song-like-count': {
      const m = await songLikeMismatches();
      return result(id, m.length, m.map((x) => x.sample));
    }
    case 'song-stats': {
      const m = await songStatMismatches();
      return result(id, m.length, m.map((x) => x.sample));
    }
    case 'clip-like-count': {
      const m = await clipLikeMismatches();
      return result(id, m.length, m.map((x) => x.sample));
    }
    case 'orphan-song-likes':
      return result(id, (await orphanIds(Like, 'songId', SongDetail)).length, []);
    case 'orphan-clip-likes':
      return result(id, (await orphanIds(ClipLike, 'clipId', SongVideo)).length, []);
    case 'orphan-clip-memos':
      return result(id, (await orphanIds(ClipMemo, 'clipId', SongVideo)).length, []);
    case 'orphan-playlist-songs': {
      const e = await orphanEntries(Playlist, 'songs', 'songId', SongDetail);
      return result(id, e.reduce((n, p) => n + p.missing.length, 0), e.map((p) => `「${p.name}」 ${p.missing.length}개`));
    }
    case 'orphan-clip-playlist-items': {
      const e = await orphanEntries(ClipPlaylist, 'clips', 'clipId', SongVideo);
      return result(id, e.reduce((n, p) => n + p.missing.length, 0), e.map((p) => `「${p.name}」 ${p.missing.length}개`));
    }
    case 'unplayable-clips':
      return result(id, await SongVideo.countDocuments({ sourceUnavailable: true }), []);
  }
}

export async function inspectAll(): Promise<CheckResult[]> {
  return Promise.all(CHECK_IDS.map((id) => inspect(id)));
}

// ── 고치기 ──────────────────────────────────────────────────────

async function applyMismatches(model: mongoose.Model<any>, list: Mismatch[]): Promise<number> { // eslint-disable-line @typescript-eslint/no-explicit-any
  for (let i = 0; i < list.length; i += 200) {
    await model.bulkWrite(list.slice(i, i + 200).map((m) => ({ updateOne: { filter: { _id: m.id }, update: { $set: m.set } } })));
  }
  return list.length;
}

async function pullEntries(
  model: mongoose.Model<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  arrayField: 'songs' | 'clips',
  idField: 'songId' | 'clipId',
  target: mongoose.Model<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<number> {
  const entries = await orphanEntries(model, arrayField, idField, target);
  let changed = 0;
  for (const p of entries) {
    await model.updateOne({ _id: p.playlistId }, { $pull: { [arrayField]: { [idField]: { $in: p.missing } } } });
    changed += p.missing.length;
  }
  return changed;
}

/** @returns 바로잡은 건수 */
export async function fix(id: CheckId): Promise<number> {
  switch (id) {
    case 'song-like-count':
      return (await recalculateLikeCounts()).updatedCount;
    case 'song-stats':
      return applyMismatches(SongDetail, await songStatMismatches());
    case 'clip-like-count':
      return applyMismatches(SongVideo, await clipLikeMismatches());
    case 'orphan-song-likes':
      return (await Like.deleteMany({ _id: { $in: await orphanIds(Like, 'songId', SongDetail) } })).deletedCount ?? 0;
    case 'orphan-clip-likes':
      return (await ClipLike.deleteMany({ _id: { $in: await orphanIds(ClipLike, 'clipId', SongVideo) } })).deletedCount ?? 0;
    case 'orphan-clip-memos':
      return (await ClipMemo.deleteMany({ _id: { $in: await orphanIds(ClipMemo, 'clipId', SongVideo) } })).deletedCount ?? 0;
    case 'orphan-playlist-songs':
      return pullEntries(Playlist, 'songs', 'songId', SongDetail);
    case 'orphan-clip-playlist-items':
      return pullEntries(ClipPlaylist, 'clips', 'clipId', SongVideo);
    case 'unplayable-clips':
      throw new Error('이 항목은 라이브 클립 탭에서 다룹니다.');
  }
}
