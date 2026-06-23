/**
 * 플랫폼 인식 영상 URL 유틸 (순수 함수).
 * 라이브 클립이 유튜브와 치지직 다시보기 양쪽을 지원하면서
 * URL 검증/식별자 추출의 단일 진입점이 된다.
 */
import {
  extractYouTubeVideoId,
  generateThumbnailUrl,
  validateYouTubeUrl,
} from '@/lib/youtube';

export type VideoPlatform = 'youtube' | 'chzzk';

export interface ParsedVideoUrl {
  platform: VideoPlatform;
  /** 플랫폼별 영상 식별자. 치지직은 String(videoNo) */
  videoId: string;
  /** 치지직 전용 영상 번호 */
  videoNo?: number;
  /** 유튜브만 URL에서 즉시 생성 가능. 치지직은 chzzkvideos에서 별도 조회 */
  thumbnailUrl?: string;
}

const CHZZK_VIDEO_REGEX = /^https?:\/\/(www\.)?chzzk\.naver\.com\/video\/(\d+)/;

export function extractChzzkVideoNo(url: string): number | null {
  const match = url.match(CHZZK_VIDEO_REGEX);
  return match ? parseInt(match[2], 10) : null;
}

export function buildChzzkVideoUrl(videoNo: number): string {
  return `https://chzzk.naver.com/video/${videoNo}`;
}

/**
 * 영상 URL에 시작 시각(초)을 붙여 반환한다(원본 영상의 그 장면으로 딥링크).
 * - 유튜브: `t={초}`
 * - 치지직 VOD: `currentTime={초}` — 치지직은 `?t=`를 무시하고 `?currentTime=`로만
 *   seek된다(댓글 타임스탬프 클릭이 내부적으로 쓰는 값). 실측으로 확인.
 * connector는 URL의 `?` 유무로 판단한다.
 */
export function buildVideoUrlWithTime(url: string, seconds: number): string {
  if (!url) return url;
  const t = Math.max(0, Math.floor(seconds || 0));
  const param = CHZZK_VIDEO_REGEX.test(url) ? 'currentTime' : 't';
  const connector = url.includes('?') ? '&' : '?';
  return `${url}${connector}${param}=${t}`;
}

/**
 * 플랫폼/식별자/시작초로 "원본 영상" URL을 만든다 (클립 시작 시각으로 딥링크).
 *   - youtube: https://www.youtube.com/watch?v={id}&t={초}
 *   - chzzk:   https://chzzk.naver.com/video/{no}?currentTime={초}
 */
export function buildSourceUrl(platform: VideoPlatform, videoId: string, seconds = 0): string {
  const base =
    platform === 'chzzk'
      ? buildChzzkVideoUrl(Number(videoId))
      : `https://www.youtube.com/watch?v=${videoId}`;
  return buildVideoUrlWithTime(base, seconds);
}

/** URL에서 플랫폼과 식별자를 파싱. 지원하지 않는 URL이면 null */
export function parseVideoUrl(url: string): ParsedVideoUrl | null {
  if (!url || typeof url !== 'string') return null;

  const chzzkVideoNo = extractChzzkVideoNo(url);
  if (chzzkVideoNo !== null) {
    return {
      platform: 'chzzk',
      videoId: String(chzzkVideoNo),
      videoNo: chzzkVideoNo,
    };
  }

  if (validateYouTubeUrl(url)) {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) return null;
    return {
      platform: 'youtube',
      videoId,
      thumbnailUrl: generateThumbnailUrl(videoId),
    };
  }

  return null;
}

/** 유튜브 또는 치지직 다시보기 URL인가 */
export function validateVideoUrl(url: string): boolean {
  return parseVideoUrl(url) !== null;
}
