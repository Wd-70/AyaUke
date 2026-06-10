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
