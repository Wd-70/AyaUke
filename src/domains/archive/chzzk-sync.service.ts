import ChzzkVideo from '@/models/ChzzkVideo';
import ChzzkComment from '@/models/ChzzkComment';
import { escapeRegex } from '@/lib/regexUtils';
import { config } from '@/shared/config';
import { NotFoundError, ValidationError } from '@/shared/api/errors';
import {
  fetchChzzkVideos,
  fetchChzzkComments,
  getChzzkCommentCount,
  checkVideoExists,
  type ChzzkVideoData,
} from './chzzk.client';
import { isTimelineComment, extractTimestamps, convertCommentTimestamps } from './timeline-parser';

/** 치지직 다시보기 동기화 + 조회 유스케이스. SSE 등 HTTP 표현은 모른다. */

// 아야우케 채널 (config의 첫 번째 ayauke 관리자 채널)
const AYAUKE_CHANNEL_ID = config.ayaukeAdminChannelIds[0];

export type SyncEvent =
  | { type: 'progress'; stage: string; message: string; totalVideos?: number }
  | { type: 'video_start'; current: number; total: number; videoNo: number; videoTitle: string; thumbnailUrl: string; reason?: string; oldCount?: number; newCount?: number }
  | { type: 'video_skip'; current: number; total: number; videoTitle: string; reason: string; commentCount: number }
  | { type: 'comments_start'; current: number; total: number; videoTitle: string }
  | {
      type: 'video_complete';
      current: number;
      total: number;
      videoTitle: string;
      commentsCount: number;
      timelineCommentsCount: number;
      stats: { processedVideos: number; totalComments: number; timelineComments: number };
    }
  | { type: 'video_error'; current: number; total: number; videoTitle: string; error: string };

export interface SyncStats {
  totalVideos: number;
  processedVideos: number;
  newVideos: number;
  totalComments: number;
  timelineComments: number;
  errors: Array<{ videoNo: number; videoTitle: string; error: string }>;
}

/** 댓글들을 파싱해 upsert하고 타임라인 댓글 수를 반환 */
async function upsertComments(videoNo: number): Promise<{ total: number; timeline: number }> {
  const comments = await fetchChzzkComments(videoNo);

  let timelineCount = 0;
  for (const commentData of comments) {
    const isTimeline = isTimelineComment(commentData.content);
    if (isTimeline) timelineCount++;

    await ChzzkComment.findOneAndUpdate(
      { commentId: commentData.commentId },
      {
        commentId: commentData.commentId,
        videoNo: commentData.videoNo,
        commentType: commentData.commentType,
        parentCommentId: commentData.parentCommentId,
        content: commentData.content,
        authorName: commentData.authorName,
        publishedAt: new Date(commentData.createTime),
        isTimeline,
        extractedTimestamps: isTimeline ? extractTimestamps(commentData.content) : [],
      },
      { upsert: true, new: true },
    );
  }

  return { total: comments.length, timeline: timelineCount };
}

async function upsertVideo(videoData: ChzzkVideoData, commentStats: { total: number; timeline: number }) {
  await ChzzkVideo.findOneAndUpdate(
    { videoNo: videoData.videoNo },
    {
      videoNo: videoData.videoNo,
      videoId: videoData.videoId,
      channelId: videoData.channel.channelId,
      channelName: videoData.channel.channelName,
      videoTitle: videoData.videoTitle,
      publishDate: new Date(videoData.publishDateAt).toISOString(),
      duration: videoData.duration,
      readCount: videoData.readCount,
      thumbnailImageUrl: videoData.thumbnailImageUrl,
      videoUrl: `https://chzzk.naver.com/video/${videoData.videoNo}`,
      totalComments: commentStats.total,
      timelineComments: commentStats.timeline,
      lastCommentSync: new Date(),
      isDeleted: false,
    },
    { upsert: true, new: true },
  );
}

/**
 * 채널 전체 동기화. onEvent 콜백으로 진행 상황을 보고한다 (SSE 라우트가 전달).
 * force=false면 댓글 수가 늘어난 영상만 다시 동기화한다.
 */
export async function syncChannel(options: {
  force?: boolean;
  onEvent?: (event: SyncEvent) => void;
}): Promise<SyncStats> {
  const { force = false, onEvent = () => {} } = options;

  onEvent({ type: 'progress', stage: 'fetching_videos', message: 'Fetching channel videos...' });
  const videos = await fetchChzzkVideos(AYAUKE_CHANNEL_ID);

  onEvent({
    type: 'progress',
    stage: 'videos_fetched',
    totalVideos: videos.length,
    message: `Found ${videos.length} videos`,
  });

  const stats: SyncStats = {
    totalVideos: videos.length,
    processedVideos: 0,
    newVideos: 0,
    totalComments: 0,
    timelineComments: 0,
    errors: [],
  };

  for (let i = 0; i < videos.length; i++) {
    const videoData = videos[i];
    const progress = { current: i + 1, total: videos.length };

    try {
      onEvent({
        type: 'video_start',
        ...progress,
        videoNo: videoData.videoNo,
        videoTitle: videoData.videoTitle,
        thumbnailUrl: videoData.thumbnailImageUrl,
      });

      const existingVideo = await ChzzkVideo.findOne({ videoNo: videoData.videoNo });
      let needsCommentSync =
        existingVideo && (existingVideo.totalComments === 0 || !existingVideo.lastCommentSync);

      // 기존 영상: 댓글 수 비교로 새 댓글 감지
      if (existingVideo && !force && !needsCommentSync) {
        const currentCommentCount = await getChzzkCommentCount(videoData.videoNo);

        if (currentCommentCount > existingVideo.totalComments) {
          needsCommentSync = true;
          onEvent({
            type: 'video_start',
            ...progress,
            videoNo: videoData.videoNo,
            videoTitle: videoData.videoTitle,
            thumbnailUrl: videoData.thumbnailImageUrl,
            reason: 'new_comments_detected',
            oldCount: existingVideo.totalComments,
            newCount: currentCommentCount,
          });
        } else {
          onEvent({
            type: 'video_skip',
            ...progress,
            videoTitle: videoData.videoTitle,
            reason: 'already_exists',
            commentCount: existingVideo.totalComments,
          });
          stats.processedVideos++;
          continue;
        }
      }

      if (!existingVideo) stats.newVideos++;

      onEvent({ type: 'comments_start', ...progress, videoTitle: videoData.videoTitle });

      const commentStats = await upsertComments(videoData.videoNo);
      await upsertVideo(videoData, commentStats);

      stats.totalComments += commentStats.total;
      stats.timelineComments += commentStats.timeline;

      onEvent({
        type: 'video_complete',
        ...progress,
        videoTitle: videoData.videoTitle,
        commentsCount: commentStats.total,
        timelineCommentsCount: commentStats.timeline,
        stats: {
          processedVideos: progress.current,
          totalComments: stats.totalComments,
          timelineComments: stats.timelineComments,
        },
      });

      stats.processedVideos++;
      await new Promise((resolve) => setTimeout(resolve, 150)); // rate limit 보호
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stats.errors.push({ videoNo: videoData.videoNo, videoTitle: videoData.videoTitle, error: message });
      onEvent({ type: 'video_error', ...progress, videoTitle: videoData.videoTitle, error: message });
      stats.processedVideos++;
    }
  }

  return stats;
}

/** 저장된 영상 목록 (제목 검색 + 페이지네이션) */
export async function listVideos(options: { page: number; limit: number; search?: string }) {
  const { page, limit, search } = options;

  // 정규식 인젝션/ReDoS 방지를 위해 이스케이프
  const query = search ? { videoTitle: { $regex: escapeRegex(search), $options: 'i' } } : {};

  const total = await ChzzkVideo.countDocuments(query);
  const videos = await ChzzkVideo.find(query)
    .sort({ publishDate: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return {
    videos,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalCount: total,
    },
  };
}

/** 영상 상세 + 댓글 (+옵션: offset 적용된 변환 댓글) */
export async function getVideoWithComments(videoNo: number, convertTimestamps: boolean) {
  const video = await ChzzkVideo.findOne({ videoNo }).lean() as Record<string, unknown> | null;
  if (!video) throw new NotFoundError('영상을 찾을 수 없습니다.');

  const comments = await ChzzkComment.find({ videoNo }).sort({ publishedAt: -1 }).lean();

  let convertedComments: string[] | undefined;
  const timeOffset = video.timeOffset as number | null | undefined;
  if (convertTimestamps && timeOffset !== null && timeOffset !== undefined) {
    convertedComments = comments
      .filter((c) => c.isTimeline)
      .map((comment) => convertCommentTimestamps(comment.content, timeOffset));
  }

  return { video, comments, convertedComments };
}

/** 변환 현황 통계 + 상위 영상 */
export async function getStatistics(options: { dateFrom?: string; dateTo?: string }) {
  const { dateFrom, dateTo } = options;

  const dateFilter: Record<string, unknown> = {};
  if (dateFrom || dateTo) {
    dateFilter.publishDate = {
      ...(dateFrom && { $gte: dateFrom }),
      ...(dateTo && { $lte: dateTo }),
    };
  }

  const [stats] = await ChzzkVideo.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: null,
        totalVideos: { $sum: 1 },
        totalTimelineComments: { $sum: '$timelineComments' },
        videosWithYoutubeUrl: { $sum: { $cond: [{ $ne: ['$youtubeUrl', null] }, 1, 0] } },
        videosWithTimeOffset: { $sum: { $cond: [{ $ne: ['$timeOffset', null] }, 1, 0] } },
        fullyConvertedVideos: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ['$youtubeUrl', null] }, { $ne: ['$timeOffset', null] }] },
              1,
              0,
            ],
          },
        },
        mostRecentSync: { $max: '$lastCommentSync' },
        avgTimelineComments: { $avg: '$timelineComments' },
      },
    },
  ]);

  const topVideos = await ChzzkVideo.find(dateFilter)
    .sort({ timelineComments: -1 })
    .limit(20)
    .select('videoNo videoTitle timelineComments totalComments publishDate youtubeUrl timeOffset thumbnailImageUrl')
    .lean();

  const healthScore =
    stats?.totalVideos > 0 ? (stats.fullyConvertedVideos / stats.totalVideos) * 100 : 0;

  return {
    statistics: {
      totalVideos: stats?.totalVideos || 0,
      totalTimelineComments: stats?.totalTimelineComments || 0,
      videosWithYoutubeUrl: stats?.videosWithYoutubeUrl || 0,
      videosWithTimeOffset: stats?.videosWithTimeOffset || 0,
      fullyConvertedVideos: stats?.fullyConvertedVideos || 0,
      mostRecentSync: stats?.mostRecentSync || null,
      avgTimelineComments: Math.round(stats?.avgTimelineComments || 0),
      conversionHealthScore: Math.round(healthScore * 10) / 10,
    },
    topVideos,
    metadata: { dateFrom, dateTo, calculatedAt: new Date().toISOString() },
  };
}

/** 영상의 유튜브 매핑/오프셋 갱신. URL 제거 시 오프셋도 함께 초기화한다. */
export async function updateVideoMapping(input: {
  videoNo: number;
  youtubeUrl?: string;
  timeOffset?: number | null;
}) {
  const { videoNo, youtubeUrl, timeOffset } = input;
  if (!videoNo) throw new ValidationError('videoNo is required');

  const updateData: Record<string, unknown> = {};
  let offsetCleared = false;

  if (youtubeUrl !== undefined) {
    updateData.youtubeUrl = youtubeUrl;

    if (!youtubeUrl || youtubeUrl.trim() === '') {
      // URL 제거 시 오프셋도 함께 초기화 (orphan offset 방지)
      updateData.timeOffset = null;
      updateData.syncSetAt = null;
      updateData.youtubeVideoId = null;
      offsetCleared = true;
    } else {
      // watch?v=, youtu.be/, embed/ 모든 형식 지원
      const youtubeIdMatch = youtubeUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&\s?]+)/);
      if (youtubeIdMatch) {
        updateData.youtubeVideoId = youtubeIdMatch[1];
      }
    }
  }

  if (timeOffset !== undefined) {
    updateData.timeOffset = timeOffset;
    updateData.syncSetAt = timeOffset === null ? null : new Date();
  }

  const video = await ChzzkVideo.findOneAndUpdate({ videoNo }, { $set: updateData }, { new: true });
  if (!video) throw new NotFoundError('영상을 찾을 수 없습니다.');

  return { video, offsetCleared };
}

/** 치지직에서 영상 존재 여부 확인 후 isDeleted 갱신 */
export async function refreshVideoStatus(videoNo: number) {
  if (!videoNo) throw new ValidationError('videoNo is required');

  const exists = await checkVideoExists(videoNo);
  await ChzzkVideo.findOneAndUpdate({ videoNo }, { $set: { isDeleted: !exists } });

  return { exists, isAccessible: exists };
}
