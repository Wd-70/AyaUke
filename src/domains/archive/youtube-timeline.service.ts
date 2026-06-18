import YouTubeComment from './schemas/youtube-comment.schema';
import YouTubeVideo from './schemas/youtube-video.schema';
import ParsedTimeline from './schemas/parsed-timeline.schema';
import TimelineComment from './schemas/timeline-comment.schema';
import { parseYouTubeTimelineComment } from './youtube-timeline.parse';

/**
 * 유튜브 타임라인 댓글 → ParsedTimeline 생성.
 * 기존 timeline-parser 라우트의 인라인 parse-timeline-comments 로직을 도메인 서비스로 추출.
 * 치지직(parseChzzkTimelineComments)과 동일한 인터페이스·합류 지점.
 */

export interface YouTubeParseResult {
  processedComments: number;
  createdItems: number;
  skippedExisting: number;
  videosWithoutInfo: number;
}

export async function parseYouTubeTimelineComments(options?: {
  /** 특정 영상만 파싱 */
  videoId?: string;
}): Promise<YouTubeParseResult> {
  const commentFilter: Record<string, unknown> = { isTimeline: true };
  if (options?.videoId) commentFilter.videoId = options.videoId;

  const comments = await YouTubeComment.find(commentFilter).lean();

  // 영상 정보 일괄 조회 (제목/날짜)
  const videoIds = [...new Set(comments.map((c) => c.videoId))];
  const videos = await YouTubeVideo.find({ videoId: { $in: videoIds } }).lean();
  const videoMap = new Map(videos.map((v) => [v.videoId, v]));

  // 기존 유튜브 타임라인 (videoId → 시작시간들)로 메모리 중복검사
  const existing = await ParsedTimeline.find(
    { platform: { $in: ['youtube', null] } },
    { videoId: 1, startTimeSeconds: 1 },
  ).lean();
  const existingStartTimes = new Map<string, number[]>();
  for (const item of existing) {
    const list = existingStartTimes.get(item.videoId) ?? [];
    list.push(item.startTimeSeconds);
    existingStartTimes.set(item.videoId, list);
  }

  const result: YouTubeParseResult = {
    processedComments: 0, createdItems: 0, skippedExisting: 0, videosWithoutInfo: 0,
  };

  const docsToInsert: Record<string, unknown>[] = [];
  const commentUpserts: Record<string, unknown>[] = [];
  const processedCommentIds: string[] = [];
  const seenCommentIds = new Set<string>();

  for (const comment of comments) {
    const video = videoMap.get(comment.videoId);
    if (!video) { result.videosWithoutInfo++; continue; }

    // 유튜브 타임라인 댓글은 타임스탬프가 HTML <a> 링크 → 링크 없으면 스킵
    if (!comment.textContent || !comment.textContent.includes('<a ')) continue;

    const entries = parseYouTubeTimelineComment(comment.textContent, video.title);
    if (entries.length === 0) continue;

    const commentIdStr = String(comment.commentId);
    if (!seenCommentIds.has(commentIdStr)) {
      seenCommentIds.add(commentIdStr);
      commentUpserts.push({
        updateOne: {
          filter: { commentId: commentIdStr },
          update: { $set: { platform: 'youtube', text: comment.textContent, author: comment.authorName, publishedAt: comment.publishedAt } },
          upsert: true,
        },
      });
    }
    processedCommentIds.push(commentIdStr);

    const videoUrlFallback = `https://www.youtube.com/watch?v=${comment.videoId}`;
    const knownTimes = existingStartTimes.get(comment.videoId) ?? [];

    for (const entry of entries) {
      const isDuplicate = knownTimes.some((t) => Math.abs(t - entry.startTimeSeconds) <= 10);
      if (isDuplicate) { result.skippedExisting++; continue; }

      knownTimes.push(entry.startTimeSeconds);
      docsToInsert.push({
        id: `${comment.commentId}_${entry.startTimeSeconds}`,
        platform: 'youtube',
        videoId: comment.videoId,
        videoTitle: video.title,
        uploadedDate: entry.uploadedDate || video.publishedAt,
        videoPublishedAt: video.publishedAt,
        originalDateString: entry.originalDateString || undefined,
        artist: entry.artist,
        songTitle: entry.songTitle,
        videoUrl: entry.videoUrl || videoUrlFallback,
        startTimeSeconds: entry.startTimeSeconds,
        endTimeSeconds: entry.endTimeSeconds,
        duration: entry.duration,
        commentAuthor: comment.authorName,
        commentId: commentIdStr,
        commentPublishedAt: comment.publishedAt,
        isRelevant: entry.isRelevant,
        isExcluded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    existingStartTimes.set(comment.videoId, knownTimes);
    result.processedComments++;
  }

  if (commentUpserts.length > 0) {
    await TimelineComment.bulkWrite(commentUpserts as never[], { ordered: false }).catch(() => undefined);
  }

  if (docsToInsert.length > 0) {
    const inserted = await ParsedTimeline.insertMany(docsToInsert, { ordered: false }).catch(
      (error: { insertedDocs?: unknown[] }) => error.insertedDocs ?? [],
    );
    result.createdItems = Array.isArray(inserted) ? inserted.length : docsToInsert.length;
  }

  // 처리한 댓글을 isProcessed로 표시 (레거시 동작 유지)
  if (processedCommentIds.length > 0) {
    await YouTubeComment.updateMany(
      { commentId: { $in: processedCommentIds } },
      { $set: { isProcessed: true, processedAt: new Date(), processedBy: 'clip-workflow' } },
    ).catch(() => undefined);
  }

  return result;
}
