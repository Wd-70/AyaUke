/** clip-workflow 탭의 DTO 타입 (클라이언트·서버 공용, 순수) */

export type Platform = 'chzzk' | 'youtube';

export interface WorkflowVideo {
  platform: Platform;
  /** chzzk=String(videoNo), youtube=videoId */
  videoId: string;
  title: string;
  /** 방송 날짜 (YYYY-MM-DD 표기) */
  date: string;
  thumbnailUrl: string;
  /** 수집된 타임라인 댓글 수 */
  timelineCommentCount: number;
  /** 파싱된 항목 수 */
  parsedCount: number;
  matchedCount: number;
  verifiedCount: number;
  /** 이미 생성된 클립(SongVideo) 수 */
  clipCount: number;
}

export interface WorkflowComment {
  author: string;
  publishedAt: string;
  /** 표시용 텍스트 (유튜브 HTML은 디코드·태그제거) */
  content: string;
}

export interface WorkflowItem {
  id: string;
  platform: Platform;
  videoId: string;
  /** 방송 날짜 (YYYY-MM-DD) — 클립 생성 sungDate용 */
  date?: string;
  videoTitle?: string;
  startTimeSeconds: number;
  endTimeSeconds?: number | null;
  duration?: number | null;
  artist: string;
  songTitle: string;
  isRelevant: boolean;
  isExcluded: boolean;
  isTimeVerified: boolean;
  matchedSongId?: string;
  customDescription?: string;
  commentAuthor: string;
  videoUrl: string;
}

export interface WorkflowSong {
  id: string;
  title: string;
  artist: string;
  titleAlias?: string;
  artistAlias?: string;
  searchTags?: string[];
  clipDuration?: number;
}

export interface ExistingClip {
  songId: string;
  startTime: number;
}

export interface VideoDetail {
  comments: WorkflowComment[];
  items: WorkflowItem[];
  /** 이 영상에 이미 생성된 클립 (항목별 생성 여부 표시용) */
  existingClips: ExistingClip[];
}
