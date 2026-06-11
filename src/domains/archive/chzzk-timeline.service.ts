import ChzzkComment from './schemas/chzzk-comment.schema';
import ChzzkVideo from './schemas/chzzk-video.schema';
import ParsedTimeline from './schemas/parsed-timeline.schema';
import TimelineComment from './schemas/timeline-comment.schema';
import { parseChzzkTimelineComment } from './chzzk-timeline';
import { buildChzzkVideoUrl } from '@/shared/utils/video-url';

/**
 * 치지직 타임라인 댓글 → ParsedTimeline 생성.
 * 이미 수집된 chzzkcomments(isTimeline=true)를 소스로 하며,
 * 이후 곡 매칭 → 시간 검증 → 클립 업로드는 기존 유튜브 플로우와 동일하게 합류한다.
 */

export interface ChzzkParseProgress {
  stage: 'loading' | 'parsing' | 'saving';
  current: number;
  total: number;
  createdItems: number;
  message: string;
}

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
  /** 진행 상황 보고 (SSE 라우트가 전달) */
  onProgress?: (progress: ChzzkParseProgress) => void;
}): Promise<ChzzkParseResult> {
  const onProgress = options?.onProgress ?? (() => {});

  onProgress({ stage: 'loading', current: 0, total: 0, createdItems: 0, message: '치지직 댓글 로딩 중...' });

  const commentFilter: Record<string, unknown> = { isTimeline: true };
  if (options?.videoNo) commentFilter.videoNo = options.videoNo;

  const comments = await ChzzkComment.find(commentFilter).lean();

  // 영상 정보 일괄 조회 (제목/방송일/videoNo 매핑)
  const videoNos = [...new Set(comments.map((c) => c.videoNo))];
  const videos = await ChzzkVideo.find({ videoNo: { $in: videoNos } }).lean();
  const videoMap = new Map(videos.map((v) => [v.videoNo, v]));

  // 기존 치지직 타임라인의 (videoId → 시작시간들)을 한 번에 로드해 메모리에서 중복 검사
  // (항목별 findOne은 댓글 수백 개 × 항목 수십 개에서 수 분이 걸린다)
  const existing = await ParsedTimeline.find(
    { platform: 'chzzk' },
    { videoId: 1, startTimeSeconds: 1 },
  ).lean();
  const existingStartTimes = new Map<string, number[]>();
  for (const item of existing) {
    const list = existingStartTimes.get(item.videoId) ?? [];
    list.push(item.startTimeSeconds);
    existingStartTimes.set(item.videoId, list);
  }

  const result: ChzzkParseResult = {
    processedComments: 0,
    createdItems: 0,
    skippedExisting: 0,
    videosWithoutInfo: 0,
  };

  const docsToInsert: Record<string, unknown>[] = [];
  // 댓글 원문은 TimelineComment(commentId 기준 한 벌)로 정규화 저장
  const commentUpserts: Record<string, unknown>[] = [];
  const seenCommentIds = new Set<string>();

  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i];

    if (i % 20 === 0) {
      onProgress({
        stage: 'parsing',
        current: i,
        total: comments.length,
        createdItems: docsToInsert.length,
        message: `댓글 파싱 중... (${i}/${comments.length})`,
      });
    }

    const video = videoMap.get(comment.videoNo);
    if (!video) {
      result.videosWithoutInfo++;
      continue;
    }

    const entries = parseChzzkTimelineComment(comment.content);
    if (entries.length === 0) continue;

    const commentIdStr = String(comment.commentId);
    if (!seenCommentIds.has(commentIdStr)) {
      seenCommentIds.add(commentIdStr);
      commentUpserts.push({
        updateOne: {
          filter: { commentId: commentIdStr },
          update: {
            $set: {
              platform: 'chzzk',
              text: comment.content,
              author: comment.authorName,
              publishedAt: comment.publishedAt,
            },
          },
          upsert: true,
        },
      });
    }

    const videoIdStr = String(comment.videoNo);
    const videoUrl = buildChzzkVideoUrl(comment.videoNo);
    const uploadedDate = new Date(video.publishDate);
    const originalDateString = toOriginalDateString(video.publishDate);
    const knownTimes = existingStartTimes.get(videoIdStr) ?? [];

    for (const entry of entries) {
      // 같은 영상의 ±10초 이내 기존 항목은 스킵 (여러 댓글의 동일 타임라인 중복 방지)
      const isDuplicate = knownTimes.some((t) => Math.abs(t - entry.startTimeSeconds) <= 10);
      if (isDuplicate) {
        result.skippedExisting++;
        continue;
      }

      knownTimes.push(entry.startTimeSeconds);
      docsToInsert.push({
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
        // originalComment는 TimelineComment로 정규화(commentId 참조). 항목엔 미저장.
        commentAuthor: comment.authorName,
        commentId: String(comment.commentId),
        commentPublishedAt: comment.publishedAt,
        isRelevant: entry.isRelevant,
        isExcluded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    existingStartTimes.set(videoIdStr, knownTimes);
    result.processedComments++;
  }

  // 댓글 원문 정규화 저장 (항목 저장 전에 선반영)
  if (commentUpserts.length > 0) {
    await TimelineComment.bulkWrite(commentUpserts, { ordered: false }).catch(() => undefined);
  }

  if (docsToInsert.length > 0) {
    onProgress({
      stage: 'saving',
      current: comments.length,
      total: comments.length,
      createdItems: docsToInsert.length,
      message: `${docsToInsert.length}개 항목 저장 중...`,
    });

    // ordered: false — 동시 실행 등으로 id가 중복돼도 나머지는 저장
    const inserted = await ParsedTimeline.insertMany(docsToInsert, { ordered: false }).catch(
      (error: { insertedDocs?: unknown[] }) => error.insertedDocs ?? [],
    );
    result.createdItems = Array.isArray(inserted) ? inserted.length : docsToInsert.length;
  }

  return result;
}
