import ChzzkComment from './schemas/chzzk-comment.schema';
import ChzzkVideo from './schemas/chzzk-video.schema';
import ParsedTimeline from './schemas/parsed-timeline.schema';
import { parseChzzkTimelineComment } from './chzzk-timeline';
import { buildChzzkVideoUrl } from '@/shared/utils/video-url';

/**
 * 치지직 타임라인 댓글 → ParsedTimeline 생성.
 * 이미 수집된 chzzkcomments(isTimeline=true)를 소스로 하며,
 * 이후 곡 매칭 → 시간 검증 → 클립 업로드는 기존 유튜브 플로우와 동일하게 합류한다.
 */

export interface ChzzkParseResult {
  processedComments: number;
  createdItems: number;
  skippedExisting: number;
  videosWithoutInfo: number;
}

/** publishDate ISO → "YY.MM.DD" (유튜브 영상 제목의 날짜 표기와 동일한 형식) */
function toOriginalDateString(publishDate: string | Date): string | undefined {
  const date = new Date(publishDate);
  if (isNaN(date.getTime())) return undefined;
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

export async function parseChzzkTimelineComments(options?: {
  /** 특정 영상만 파싱 */
  videoNo?: number;
}): Promise<ChzzkParseResult> {
  const commentFilter: Record<string, unknown> = { isTimeline: true };
  if (options?.videoNo) commentFilter.videoNo = options.videoNo;

  const comments = await ChzzkComment.find(commentFilter).lean();

  // 영상 정보 일괄 조회 (제목/방송일/videoNo 매핑)
  const videoNos = [...new Set(comments.map((c) => c.videoNo))];
  const videos = await ChzzkVideo.find({ videoNo: { $in: videoNos } }).lean();
  const videoMap = new Map(videos.map((v) => [v.videoNo, v]));

  const result: ChzzkParseResult = {
    processedComments: 0,
    createdItems: 0,
    skippedExisting: 0,
    videosWithoutInfo: 0,
  };

  for (const comment of comments) {
    const video = videoMap.get(comment.videoNo);
    if (!video) {
      result.videosWithoutInfo++;
      continue;
    }

    const entries = parseChzzkTimelineComment(comment.content);
    if (entries.length === 0) continue;

    const videoIdStr = String(comment.videoNo);
    const videoUrl = buildChzzkVideoUrl(comment.videoNo);
    const uploadedDate = new Date(video.publishDate);
    const originalDateString = toOriginalDateString(video.publishDate);

    for (const entry of entries) {
      // 같은 영상의 ±10초 이내 기존 항목은 스킵 (여러 댓글의 동일 타임라인 중복 방지)
      const existing = await ParsedTimeline.findOne({
        platform: 'chzzk',
        videoId: videoIdStr,
        startTimeSeconds: {
          $gte: entry.startTimeSeconds - 10,
          $lte: entry.startTimeSeconds + 10,
        },
      });

      if (existing) {
        result.skippedExisting++;
        continue;
      }

      await new ParsedTimeline({
        id: `chzzk_${comment.commentId}_${entry.startTimeSeconds}`,
        platform: 'chzzk',
        videoId: videoIdStr,
        videoNo: comment.videoNo,
        videoTitle: video.videoTitle,
        uploadedDate,
        videoPublishedAt: uploadedDate,
        originalDateString,
        artist: entry.artist,
        songTitle: entry.songTitle,
        videoUrl,
        startTimeSeconds: entry.startTimeSeconds,
        endTimeSeconds: entry.endTimeSeconds,
        duration: entry.duration,
        originalComment: comment.content,
        commentAuthor: comment.authorName,
        commentId: String(comment.commentId),
        commentPublishedAt: comment.publishedAt,
        isRelevant: entry.isRelevant,
        isExcluded: false,
      }).save();

      result.createdItems++;
    }

    result.processedComments++;
  }

  return result;
}
