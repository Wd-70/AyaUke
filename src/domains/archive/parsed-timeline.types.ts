/**
 * 파싱된 타임라인 항목의 클라이언트 뷰 타입 (단일 출처).
 * 라우트 응답(JSON 직렬화) 기준이며, TimelineParsingView/TimeVerificationSection/
 * timeVerification 유틸이 공통으로 사용한다.
 */
export interface ParsedTimelineItem {
  id: string;
  platform?: 'youtube' | 'chzzk';
  videoId: string;
  videoNo?: number;
  videoTitle: string;
  uploadedDate: string;
  originalDateString?: string;
  artist: string;
  songTitle: string;
  videoUrl: string;
  startTimeSeconds: number;
  endTimeSeconds?: number;
  duration?: number | null;
  isRelevant: boolean;
  isExcluded: boolean;
  matchedSong?: {
    songId: string;
    title: string;
    artist: string;
    confidence: number;
  };
  originalComment?: string; // 목록에서는 제외, 상세 보기 시 lazy-load
  commentAuthor: string;
  commentId: string;
  commentPublishedAt: string;
  // 수동 검증 관련 필드
  isTimeVerified?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  customDescription?: string; // 커스텀 설명 (라이브 클립 업로드용)
  specialTags?: string[];
  createdAt: string;
  updatedAt: string;
}
