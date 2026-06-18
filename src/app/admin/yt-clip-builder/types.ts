/** yt-clip-builder 도구의 워크셋/진행상태 타입 (클라이언트·서버 공용, 순수) */

export interface WorksetVideo {
  videoNo: number;
  publishDate: string;
  /** KST 기준 방송 날짜(다시보기=방종 기준) */
  chzzkDate: string;
  videoTitle: string;
  thumbnailUrl: string;
  youtubeVideoId?: string;
  timeOffset?: number | null;
}

export interface WorksetTimeline {
  id: string;
  videoNo: number;
  chzzkTime: number;
  endTimeSeconds?: number | null;
  artist: string;
  songTitle: string;
  isRelevant: boolean;
  matchedSongId?: string;
  commentAuthor?: string;
}

export interface WorksetYoutube {
  videoId: string;
  title: string;
  titleDate: string | null;
  publishedAt: string;
}

export interface WorksetComment {
  videoNo: number;
  author: string;
  publishedAt: string;
  content: string;
}

export interface WorksetSong {
  id: string;
  title: string;
  artist: string;
  titleAlias?: string;
  artistAlias?: string;
  searchTags?: string[];
  clipDuration?: number;
}

export interface Workset {
  generatedAt: string;
  range: { after: string; before: string };
  videos: WorksetVideo[];
  timelines: WorksetTimeline[];
  youtubeCandidates: WorksetYoutube[];
  songs: WorksetSong[];
  comments: WorksetComment[];
}

export interface VideoProgress {
  youtubeVideoId?: string;
  /** 앵커: 치지직 시각 → 유튜브 시각 */
  anchors?: { chzzkTime: number; ytTime: number }[];
  /** 타임라인 id → 곡 id */
  matches?: Record<string, string>;
  /** 클립 생성에서 제외할 타임라인 id */
  excluded?: string[];
  /** 클립 생성 완료 표시 */
  done?: boolean;
  skipped?: boolean;
}

export type ProgressFile = Record<string, VideoProgress>; // videoNo → progress
