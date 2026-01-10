/**
 * Type definitions for Chzzk channel sync operations
 */

export interface SyncStatistics {
  totalVideos: number;
  processedVideos: number;
  newVideos: number;
  totalComments: number;
  timelineComments: number;
  errors: SyncError[];
  retryStatistics: RetryStatistics;
}

export interface SyncError {
  videoNo: number;
  videoTitle: string;
  error: string;
  retryCount: number;
  wasRetryable: boolean;
}

export interface RetryStatistics {
  totalRetries: number;
  successfulRetries: number;
  failedAfterRetries: number;
}

export interface VideoSyncEvent {
  current: number;
  total: number;
  videoNo: number;
  videoTitle: string;
  thumbnailUrl?: string;
}

export interface VideoRetryEvent extends VideoSyncEvent {
  attempt: number;
  delay: number;
  reason: string;
}

export interface VideoCompleteEvent extends VideoSyncEvent {
  commentsCount: number;
  timelineCommentsCount: number;
  retryCount: number;
  stats: Partial<SyncStatistics>;
}
