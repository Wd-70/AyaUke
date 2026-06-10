import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { NotFoundError } from '@/shared/api/errors';

/** 치지직 비공식 API 클라이언트. HTTP 호출과 응답 정규화만 담당한다. */

const CHZZK_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'front-client-platform-type': 'PC',
  'front-client-product-type': 'web',
};

export interface ChzzkVideoData {
  videoNo: number;
  videoId: string;
  videoTitle: string;
  publishDateAt: number;
  duration: number;
  readCount: number;
  thumbnailImageUrl: string;
  channel: {
    channelId: string;
    channelName: string;
  };
}

export interface ChzzkCommentData {
  commentId: number;
  videoNo: number;
  commentType: string;
  parentCommentId?: number;
  content: string;
  userIdHash: string;
  authorName: string;
  createTime: number;
}

/** 채널의 다시보기 영상 목록 (API 상한: 50개/요청) */
export async function fetchChzzkVideos(channelId: string, size: number = 50): Promise<ChzzkVideoData[]> {
  // 주의: 파라미터 순서와 빈 값까지 정확히 맞춰야 한다 (치지직 API 특성)
  const maxSize = Math.min(size, 50);
  const response = await fetchWithTimeout(
    `https://api.chzzk.naver.com/service/v1/channels/${channelId}/videos?sortType=LATEST&pagingType=PAGE&page=0&size=${maxSize}&publishDateAt=&videoType=`,
    { headers: { ...CHZZK_HEADERS, referer: `https://chzzk.naver.com/${channelId}` } },
    30000,
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[fetchChzzkVideos] API response:', {
      status: response.status,
      body: errorText,
    });
    if (response.status === 400) {
      throw new Error('Chzzk API returned 400 Bad Request. Please verify channel ID and API parameters.');
    }
    throw new Error(`Chzzk API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 200) {
    throw new Error(`Chzzk API returned error code: ${data.code}, message: ${data.message}`);
  }

  return data.content?.data || [];
}

/** 전체 댓글을 받지 않고 총 댓글 수만 빠르게 확인 (삭제된 영상은 0) */
export async function getChzzkCommentCount(videoNo: number): Promise<number> {
  try {
    const response = await fetchWithTimeout(
      `https://apis.naver.com/nng_main/nng_comment_api/v1/type/STREAMING_VIDEO/id/${videoNo}/comments?limit=30&offset=0&orderType=POPULAR&pagingType=PAGE`,
      { headers: { ...CHZZK_HEADERS, Referer: `https://chzzk.naver.com/video/${videoNo}` } },
      10000,
    );

    if (!response.ok) return 0;

    const data = await response.json();
    if (data.code && data.code !== 200) return 0;

    return data.content?.comments?.totalCount || 0;
  } catch {
    return 0;
  }
}

/** "YYYYMMDDHHMMSS" → epoch ms */
function parseChzzkDate(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  return new Date(
    parseInt(dateStr.substring(0, 4)),
    parseInt(dateStr.substring(4, 6)) - 1,
    parseInt(dateStr.substring(6, 8)),
    parseInt(dateStr.substring(8, 10)),
    parseInt(dateStr.substring(10, 12)),
    parseInt(dateStr.substring(12, 14)),
  ).getTime();
}

/* 치지직 댓글 API 응답: { code, message, content: { bestComments[], comments: { data[], totalCount } } }
 * 각 항목은 { comment: {...}, user: {...}, replyComments: [...] } 중첩 구조이며
 * 답글은 replyComments에 이미 포함되어 있어 별도 API 호출이 필요 없다. */
function flattenCommentItem(item: Record<string, any>, videoNo: number): ChzzkCommentData {
  const comment = item.comment || item;
  const user = item.user || {};

  return {
    commentId: comment.commentId,
    videoNo: parseInt(comment.objectId) || videoNo,
    commentType: comment.commentType || 'COMMENT',
    parentCommentId: comment.parentCommentId || undefined,
    content: comment.content,
    userIdHash: user.userIdHash || 'unknown',
    authorName: user.userNickname || user.userIdHash || 'Unknown',
    createTime: parseChzzkDate(comment.createdDate),
  };
}

/** 영상의 전체 댓글 + 베스트 댓글 + 답글을 평탄화해 수집 */
export async function fetchChzzkComments(videoNo: number): Promise<ChzzkCommentData[]> {
  const allComments: ChzzkCommentData[] = [];
  let offset = 0;
  const limit = 30;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await fetchWithTimeout(
        `https://apis.naver.com/nng_main/nng_comment_api/v1/type/STREAMING_VIDEO/id/${videoNo}/comments?limit=${limit}&offset=${offset}&orderType=POPULAR&pagingType=PAGE`,
        { headers: { ...CHZZK_HEADERS, Referer: `https://chzzk.naver.com/video/${videoNo}` } },
        30000,
      );

      if (!response.ok) {
        if (response.status === 404) break;
        const errorText = await response.text();
        throw new Error(`Chzzk Comment API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      if (data.code && data.code !== 200) {
        throw new Error(`Chzzk Comment API error code: ${data.code} - ${data.message}`);
      }

      // 응답 구조 방어적 탐색
      let comments: Record<string, any>[] = [];
      let bestComments: Record<string, any>[] = [];

      if (data.content) {
        if (offset === 0 && Array.isArray(data.content.bestComments)) {
          bestComments = data.content.bestComments;
        }
        const c = data.content.comments;
        if (c && typeof c === 'object' && !Array.isArray(c)) {
          comments = c.data || c.list || [];
        } else if (Array.isArray(c)) {
          comments = c;
        } else if (data.content.data) {
          comments = data.content.data;
        } else if (Array.isArray(data.content)) {
          comments = data.content;
        }
      } else if (data.comments) {
        comments = data.comments;
      }

      // 베스트 댓글 병합 (중복 제거)
      if (bestComments.length > 0) {
        const regularCommentIds = new Set(comments.map((c) => (c.comment || c).commentId));
        const uniqueBest = bestComments.filter((bc) => !regularCommentIds.has((bc.comment || bc).commentId));
        comments = [...uniqueBest, ...comments];
      }

      if (comments.length === 0) {
        hasMore = false;
        continue;
      }

      for (const item of comments) {
        allComments.push(flattenCommentItem(item, videoNo));
        for (const replyItem of item.replyComments || []) {
          allComments.push(flattenCommentItem(replyItem, videoNo));
        }
      }

      offset += limit;
      await new Promise((resolve) => setTimeout(resolve, 100)); // rate limit 보호
    } catch (error) {
      console.error(`[fetchChzzkComments] Error for video ${videoNo}:`, {
        error: error instanceof Error ? error.message : error,
        offset,
        totalCollected: allComments.length,
      });
      hasMore = false;
    }
  }

  return allComments;
}

/** 영상이 아직 치지직에 존재하는지 확인 */
export async function checkVideoExists(videoNo: number): Promise<boolean> {
  try {
    const dt = Date.now().toString(36).substring(0, 5); // 캐시 버스터
    const response = await fetchWithTimeout(
      `https://api.chzzk.naver.com/service/v3/videos/${videoNo}?dt=${dt}`,
      { headers: { ...CHZZK_HEADERS, Referer: `https://chzzk.naver.com/video/${videoNo}` } },
      15000,
    );

    if (!response.ok) return false;

    const data = await response.json();
    return data.code === 200 && data.content?.videoNo === videoNo;
  } catch {
    return false;
  }
}

export interface StreamInfo {
  streamUrl: string;
  /** 'hls' = 임시 다시보기(리와인드), 'mp4' = 영구 보존 VOD (progressive, Range 시킹 가능) */
  streamType: 'hls' | 'mp4';
  duration: number;
  videoTitle: string;
}

/** 네이버 VOD 재생 JSON에서 최고 화질 MP4 URL 추출 */
function pickBestMp4Url(playback: Record<string, any>): string | null {
  let best: { width: number; url: string } | null = null;

  for (const period of playback.period ?? []) {
    for (const adaptationSet of period.adaptationSet ?? []) {
      if (adaptationSet.mimeType !== 'video/mp4') continue;
      for (const rep of adaptationSet.representation ?? []) {
        const width = rep.width ?? 0;
        const url = rep.baseURL?.[0]?.value;
        if (url && (!best || width > best.width)) {
          best = { width, url };
        }
      }
    }
  }

  return best?.url ?? null;
}

/**
 * 다시보기 스트림 정보.
 * - 구 임시 다시보기: liveRewindPlaybackJson → HLS
 * - 영구 보존 VOD(파트너): videoId + inKey → 네이버 VOD API → progressive MP4
 * URL은 만료될 수 있으므로 저장하지 말고 재생 시마다 조회한다.
 */
export async function fetchVideoStreamInfo(videoNo: number | string): Promise<StreamInfo> {
  const dt = Date.now().toString(36).substring(0, 5);
  const response = await fetchWithTimeout(
    `https://api.chzzk.naver.com/service/v3/videos/${videoNo}?dt=${dt}`,
    { headers: { ...CHZZK_HEADERS, Referer: `https://chzzk.naver.com/video/${videoNo}` } },
    15000,
  );

  if (response.status === 404) {
    throw new NotFoundError('치지직에서 삭제되었거나 존재하지 않는 영상입니다.');
  }
  if (!response.ok) throw new Error('Failed to fetch video info');

  const data = await response.json();
  if (data.code === 404 || !data.content) {
    throw new NotFoundError('치지직에서 삭제되었거나 존재하지 않는 영상입니다.');
  }
  if (data.code !== 200) throw new Error('Video not available');

  const content = data.content;

  // 1) 구 방식: 라이브 리와인드 HLS
  if (content.liveRewindPlaybackJson) {
    const playbackData = JSON.parse(content.liveRewindPlaybackJson);
    const hlsMedia = playbackData.media?.find((m: { mediaId: string }) => m.mediaId === 'HLS');
    if (hlsMedia?.path) {
      return {
        streamUrl: hlsMedia.path,
        streamType: 'hls',
        duration: playbackData.meta?.duration || content.duration || 0,
        videoTitle: content.videoTitle,
      };
    }
  }

  // 2) 영구 보존 VOD: videoId + inKey → 네이버 VOD 재생 정보
  if (content.videoId && content.inKey) {
    const playbackResponse = await fetchWithTimeout(
      `https://apis.naver.com/neonplayer/vodplay/v2/playback/${content.videoId}?key=${content.inKey}`,
      { headers: { ...CHZZK_HEADERS, Accept: 'application/json' } },
      15000,
    );

    if (playbackResponse.ok) {
      const playback = await playbackResponse.json();
      const mp4Url = pickBestMp4Url(playback);
      if (mp4Url) {
        return {
          streamUrl: mp4Url,
          streamType: 'mp4',
          duration: content.duration || 0,
          videoTitle: content.videoTitle,
        };
      }
    }
  }

  throw new Error('재생 가능한 스트림을 찾을 수 없습니다.');
}

/** @deprecated fetchVideoStreamInfo를 사용하세요. (hlsUrl 필드 호환용) */
export async function fetchVideoHlsInfo(videoNo: number | string) {
  const info = await fetchVideoStreamInfo(videoNo);
  return { hlsUrl: info.streamUrl, duration: info.duration, videoTitle: info.videoTitle };
}
