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
 * 영상 URL에 시작 시각(초)을 붙여 반환한다.
 * - 유튜브(watch?v=…): 이미 쿼리가 있으므로 `&t={초}`
 * - 치지직(video/{no}): 쿼리가 없으므로 `?t={초}` — 기존의 무조건 `&t=`는
 *   `.../video/123&t=100` 처럼 깨진 URL을 만들었다.
 * connector를 URL에 `?` 유무로 판단해 플랫폼과 무관하게 올바른 형식을 만든다.
 * (치지직 t 파라미터 지원이 불확실해도 형식은 유효하므로 안전)
 */
export function buildVideoUrlWithTime(url: string, seconds: number): string {
  if (!url) return url;
  const t = Math.max(0, Math.floor(seconds || 0));
  const connector = url.includes('?') ? '&' : '?';
  return `${url}${connector}t=${t}`;
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
