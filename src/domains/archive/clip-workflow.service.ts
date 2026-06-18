import ChzzkVideo from './schemas/chzzk-video.schema';
import ChzzkComment from './schemas/chzzk-comment.schema';
import YouTubeVideo from './schemas/youtube-video.schema';
import YouTubeComment from './schemas/youtube-comment.schema';
import ParsedTimeline from './schemas/parsed-timeline.schema';
import SongVideo from './schemas/song-video.schema';
import SongDetail from '@/domains/catalog/song.schema';
import { parseChzzkTimelineComments } from './chzzk-timeline.service';
import { parseYouTubeTimelineComments } from './youtube-timeline.service';
import { decodeHtmlEntities } from './youtube-timeline.parse';
import { NotFoundError } from '@/shared/api/errors';
import { toKstDateString } from '@/shared/utils/stream-date';
import { matchSongs } from '@/shared/utils/song-match';
import type {
  Platform, WorkflowVideo, WorkflowComment, WorkflowItem, WorkflowSong, VideoDetail, ExistingClip,
} from '@/app/admin/tabs/clip-workflow/types';

export type { Platform, WorkflowVideo, WorkflowComment, WorkflowItem, WorkflowSong, VideoDetail, ExistingClip };

/**
 * 클립 만들기 통합 탭의 백엔드.
 * 플랫폼 어댑터(치지직/유튜브)로 영상/댓글/파싱을 다루고, 파싱 항목(ParsedTimeline)
 * 변경은 플랫폼 무관 공통으로 처리한다. 수집/생성은 기존 라우트(chzzk-sync/youtube-comments/clips·bulk)를
 * 클라이언트가 직접 호출하므로 여기서 다루지 않는다.
 */

/** ParsedTimeline의 날짜를 YYYY-MM-DD로 (originalDateString "YY.MM.DD" 우선, 없으면 uploadedDate) */
function toItemDate(originalDateString?: string, uploadedDate?: Date): string {
  if (originalDateString) {
    const m = originalDateString.match(/^(\d{2,4})\.(\d{1,2})\.(\d{1,2})$/);
    if (m) {
      let y = parseInt(m[1], 10); if (y < 100) y += 2000;
      return `${y}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
    }
  }
  return uploadedDate ? toKstDateString(uploadedDate) : '';
}

/** 유튜브 HTML 댓글을 표시용 평문으로 (디코드 + <br>→줄바꿈 + 태그 제거) */
function htmlToText(html: string): string {
  return decodeHtmlEntities(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

// ── ParsedTimeline 집계 헬퍼 ──
async function countsByVideo(platformFilter: Record<string, unknown>) {
  const rows = await ParsedTimeline.aggregate([
    { $match: platformFilter },
    {
      $group: {
        _id: '$videoId',
        parsed: { $sum: 1 },
        // 제외된 항목은 클립이 안 만들어지므로 매칭 수에서 뺀다(완료 판정 일관성)
        matched: {
          $sum: {
            $cond: [
              { $and: [{ $ifNull: ['$matchedSong.songId', false] }, { $ne: ['$isExcluded', true] }] },
              1, 0,
            ],
          },
        },
        verified: { $sum: { $cond: ['$isTimeVerified', 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [r._id as string, r as { parsed: number; matched: number; verified: number }]));
}

async function clipCountsByVideo(match: Record<string, unknown>) {
  const rows = await SongVideo.aggregate([
    { $match: match },
    { $group: { _id: '$videoId', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id as string, r.n as number]));
}

/** 한 영상에 이미 생성된 클립 (songId + startTime) — 항목별 생성 여부 표시용 */
async function existingClipsForVideo(match: Record<string, unknown>): Promise<ExistingClip[]> {
  const clips = await SongVideo.find(match, { songId: 1, startTime: 1 }).lean();
  return clips.map((c) => ({ songId: String(c.songId), startTime: (c.startTime as number) || 0 }));
}

// ── 어댑터: 치지직 ──
const chzzkAdapter = {
  async listVideosWithStatus(): Promise<WorkflowVideo[]> {
    const videos = await ChzzkVideo.find({}, {
      videoNo: 1, videoTitle: 1, publishDate: 1, thumbnailImageUrl: 1, timelineComments: 1,
    }).lean();
    const [parsed, clips] = await Promise.all([
      countsByVideo({ platform: 'chzzk' }),
      clipCountsByVideo({ platform: 'chzzk' }),
    ]);
    return videos
      .map((v) => {
        const id = String(v.videoNo);
        const c = parsed.get(id);
        return {
          platform: 'chzzk' as Platform,
          videoId: id,
          title: (v.videoTitle as string) || '',
          date: toKstDateString(v.publishDate as string),
          thumbnailUrl: (v.thumbnailImageUrl as string) || '',
          timelineCommentCount: (v.timelineComments as number) || 0,
          parsedCount: c?.parsed ?? 0,
          matchedCount: c?.matched ?? 0,
          verifiedCount: c?.verified ?? 0,
          clipCount: clips.get(id) ?? 0,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  async getVideoDetail(videoId: string): Promise<VideoDetail> {
    const videoNo = parseInt(videoId, 10);
    const comments = await ChzzkComment.find({ videoNo, isTimeline: true })
      .sort({ publishedAt: 1 }).lean();
    return {
      comments: comments.map((c) => ({
        author: c.authorName as string,
        publishedAt: (c.publishedAt as Date)?.toISOString?.() || '',
        content: (c.content as string) || '',
      })),
      items: await listItems({ platform: 'chzzk', videoId }),
      existingClips: await existingClipsForVideo({ platform: 'chzzk', videoId }),
    };
  },

  async parseVideo(videoId: string) {
    return parseChzzkTimelineComments({ videoNo: parseInt(videoId, 10) });
  },
};

// ── 어댑터: 유튜브 ──
const youtubeAdapter = {
  async listVideosWithStatus(): Promise<WorkflowVideo[]> {
    const videos = await YouTubeVideo.find({}, {
      videoId: 1, title: 1, publishedAt: 1, thumbnailUrl: 1, timelineComments: 1,
    }).lean();
    const [parsed, clips] = await Promise.all([
      countsByVideo({ platform: { $in: ['youtube', null] } }),
      clipCountsByVideo({ platform: { $in: ['youtube', null] } }),
    ]);
    return videos
      .map((v) => {
        const id = v.videoId as string;
        const c = parsed.get(id);
        return {
          platform: 'youtube' as Platform,
          videoId: id,
          title: (v.title as string) || '',
          date: toKstDateString(v.publishedAt as Date),
          thumbnailUrl: (v.thumbnailUrl as string) || '',
          timelineCommentCount: (v.timelineComments as number) || 0,
          parsedCount: c?.parsed ?? 0,
          matchedCount: c?.matched ?? 0,
          verifiedCount: c?.verified ?? 0,
          clipCount: clips.get(id) ?? 0,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  async getVideoDetail(videoId: string): Promise<VideoDetail> {
    const comments = await YouTubeComment.find({ videoId, isTimeline: true })
      .sort({ publishedAt: 1 }).lean();
    return {
      comments: comments.map((c) => ({
        author: c.authorName as string,
        publishedAt: (c.publishedAt as Date)?.toISOString?.() || '',
        content: htmlToText(c.textContent as string),
      })),
      items: await listItems({ platform: { $in: ['youtube', null] }, videoId }),
      existingClips: await existingClipsForVideo({ platform: { $in: ['youtube', null] }, videoId }),
    };
  },

  async parseVideo(videoId: string) {
    return parseYouTubeTimelineComments({ videoId });
  },
};

function adapter(platform: Platform) {
  return platform === 'chzzk' ? chzzkAdapter : youtubeAdapter;
}

export function listVideosWithStatus(platform: Platform) {
  return adapter(platform).listVideosWithStatus();
}
export function getVideoDetail(platform: Platform, videoId: string) {
  return adapter(platform).getVideoDetail(videoId);
}
export function parseVideo(platform: Platform, videoId: string) {
  return adapter(platform).parseVideo(videoId);
}

// ── 파싱 항목 조회/변경 (플랫폼 무관) ──
async function listItems(filter: Record<string, unknown>): Promise<WorkflowItem[]> {
  const items = await ParsedTimeline.find(filter, {
    id: 1, platform: 1, videoId: 1, videoTitle: 1, originalDateString: 1, uploadedDate: 1,
    startTimeSeconds: 1, endTimeSeconds: 1, duration: 1, artist: 1, songTitle: 1,
    isRelevant: 1, isExcluded: 1, isTimeVerified: 1, matchedSong: 1, customDescription: 1, commentAuthor: 1, videoUrl: 1,
  }).sort({ startTimeSeconds: 1 }).lean();

  return items.map((it) => ({
    id: it.id as string,
    platform: ((it.platform as string) || 'youtube') as Platform,
    videoId: it.videoId as string,
    videoTitle: (it.videoTitle as string) || undefined,
    date: toItemDate(it.originalDateString as string | undefined, it.uploadedDate as Date | undefined),
    startTimeSeconds: (it.startTimeSeconds as number) || 0,
    endTimeSeconds: (it.endTimeSeconds as number | null | undefined) ?? null,
    duration: (it.duration as number | null | undefined) ?? null,
    artist: (it.artist as string) || '',
    songTitle: (it.songTitle as string) || '',
    isRelevant: it.isRelevant !== false,
    isExcluded: it.isExcluded === true,
    isTimeVerified: it.isTimeVerified === true,
    matchedSongId: (it.matchedSong as { songId?: string } | undefined)?.songId || undefined,
    customDescription: (it.customDescription as string) || undefined,
    commentAuthor: (it.commentAuthor as string) || '',
    videoUrl: (it.videoUrl as string) || '',
  }));
}

/** 곡 매칭/해제. 매칭 시 종료시각=시작+clipDuration 자동(검증분 보존) */
export async function setItemMatch(id: string, songId: string | null) {
  if (!songId) {
    await ParsedTimeline.updateOne({ id }, { $unset: { matchedSong: '' }, $set: { updatedAt: new Date() } });
    return;
  }
  const song = await SongDetail.findById(songId).select('title artist clipDuration').lean() as
    { title?: string; artist?: string; clipDuration?: number } | null;
  if (!song) throw new NotFoundError('곡을 찾을 수 없습니다.');

  const setStage: Record<string, unknown> = {
    matchedSong: { songId, title: song.title, artist: song.artist, confidence: 1.0 },
    updatedAt: new Date(),
  };
  const clipDuration = song.clipDuration;
  if (clipDuration && clipDuration > 0) {
    setStage.endTimeSeconds = {
      $cond: [{ $eq: ['$isTimeVerified', true] }, '$endTimeSeconds', { $add: ['$startTimeSeconds', clipDuration] }],
    };
    setStage.duration = { $cond: [{ $eq: ['$isTimeVerified', true] }, '$duration', clipDuration] };
  }
  await ParsedTimeline.updateOne({ id }, [{ $set: setStage }]);
}

export async function setItemTime(id: string, startTimeSeconds: number, endTimeSeconds: number | null) {
  await ParsedTimeline.updateOne({ id }, {
    $set: {
      startTimeSeconds,
      endTimeSeconds,
      duration: endTimeSeconds != null ? Math.max(0, endTimeSeconds - startTimeSeconds) : null,
      updatedAt: new Date(),
    },
  });
}

export async function setItemExcluded(id: string, isExcluded: boolean) {
  await ParsedTimeline.updateOne({ id }, { $set: { isExcluded, updatedAt: new Date() } });
}

export async function setItemVerified(id: string, isTimeVerified: boolean) {
  await ParsedTimeline.updateOne({ id }, { $set: { isTimeVerified, updatedAt: new Date() } });
}

export async function editItem(
  id: string,
  patch: { artist?: string; songTitle?: string; customDescription?: string },
) {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.artist !== undefined) set.artist = patch.artist;
  if (patch.songTitle !== undefined) set.songTitle = patch.songTitle;
  if (patch.customDescription !== undefined) set.customDescription = patch.customDescription;
  await ParsedTimeline.updateOne({ id }, { $set: set });
}

// ── 곡 단위 작업 ──────────────────────────────────────────────────

/** 곡별 타임라인 활동(매칭 출현 수)·클립 수 — 곡 단위 좌측 목록용 */
export async function listSongStatuses(): Promise<{ songId: string; occurrences: number; clips: number }[]> {
  const [occ, clips] = await Promise.all([
    ParsedTimeline.aggregate<{ _id: string; n: number }>([
      { $match: { 'matchedSong.songId': { $nin: [null, undefined] } } },
      { $group: { _id: '$matchedSong.songId', n: { $sum: 1 } } },
    ]),
    SongVideo.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$songId', n: { $sum: 1 } } }]),
  ]);
  const map = new Map<string, { songId: string; occurrences: number; clips: number }>();
  for (const o of occ) map.set(String(o._id), { songId: String(o._id), occurrences: o.n, clips: 0 });
  for (const c of clips) {
    const k = String(c._id);
    const e = map.get(k) ?? { songId: k, occurrences: 0, clips: 0 };
    e.clips = c.n;
    map.set(k, e);
  }
  return [...map.values()];
}

const byDateDesc = (a: WorkflowItem, b: WorkflowItem) =>
  (b.date || '').localeCompare(a.date || '') || a.startTimeSeconds - b.startTimeSeconds;

/** 한 곡의 매칭된 출현(여러 영상) + 그 곡의 기존 클립 */
export async function getSongWork(songId: string): Promise<{
  occurrences: WorkflowItem[];
  clips: { videoId: string; startTime: number }[];
}> {
  const occurrences = (await listItems({ 'matchedSong.songId': songId })).sort(byDateDesc);
  const clipDocs = await SongVideo.find({ songId }, { videoId: 1, startTime: 1 }).lean();
  return {
    occurrences,
    clips: clipDocs.map((c) => ({ videoId: c.videoId as string, startTime: (c.startTime as number) || 0 })),
  };
}

/** 이 곡과 이름이 일치하는 미매칭 타임라인(역매칭 후보) — 새 곡 등록 시 일괄 연결용 */
export async function getSongCandidates(songId: string): Promise<WorkflowItem[]> {
  const song = await SongDetail.findById(songId)
    .select('title artist titleAlias artistAlias searchTags').lean() as
    { title?: string; artist?: string; titleAlias?: string; artistAlias?: string; searchTags?: string[] } | null;
  if (!song) return [];

  const matchable = [{
    id: songId, title: song.title || '', artist: song.artist || '',
    titleAlias: song.titleAlias, artistAlias: song.artistAlias, searchTags: song.searchTags,
  }];

  const unmatched = await listItems({ isRelevant: true, isExcluded: { $ne: true }, matchedSong: { $exists: false } });
  return unmatched
    .filter((it) => matchSongs(it.artist, it.songTitle, matchable, { minConfidence: 0.6, limit: 1 }).length > 0)
    .sort(byDateDesc)
    .slice(0, 300);
}

/** 매칭용 등록곡 (searchTags 포함) */
export async function listSongsForMatch(): Promise<WorkflowSong[]> {
  const songs = await SongDetail.find({ status: { $ne: 'deleted' } }, {
    title: 1, artist: 1, titleAlias: 1, artistAlias: 1, searchTags: 1, clipDuration: 1,
  }).lean();
  return songs.map((s) => ({
    id: String(s._id),
    title: (s.title as string) || '',
    artist: (s.artist as string) || '',
    titleAlias: (s.titleAlias as string) || undefined,
    artistAlias: (s.artistAlias as string) || undefined,
    searchTags: (s.searchTags as string[]) || [],
    clipDuration: (s.clipDuration as number | undefined) ?? undefined,
  }));
}
