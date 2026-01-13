import { useState, useCallback, useRef, useEffect } from 'react';

interface SyncProgress {
  isActive: boolean;
  stage: string;
  currentVideo: number;
  totalVideos: number;
  processedVideos: number;
  currentVideoTitle: string;
  currentVideoThumbnail: string;
  totalComments: number;
  timelineComments: number;
  errors: Array<{ videoNo: number; videoTitle: string; error: string }>;
  estimatedTimeRemaining: number | null;
}

interface SyncStats {
  totalVideos: number;
  newVideos: number;
  totalComments: number;
  timelineComments: number;
  errors: any[];
}

export function useSyncProgress() {
  const [progress, setProgress] = useState<SyncProgress>({
    isActive: false,
    stage: 'idle',
    currentVideo: 0,
    totalVideos: 0,
    processedVideos: 0,
    currentVideoTitle: '',
    currentVideoThumbnail: '',
    totalComments: 0,
    timelineComments: 0,
    errors: [],
    estimatedTimeRemaining: null,
  });

  const [finalStats, setFinalStats] = useState<SyncStats | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const startTimeRef = useRef<number>(0);

  const startSync = useCallback((force: boolean = false) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    startTimeRef.current = Date.now();

    // Reset all progress state to initial values
    setProgress({
      isActive: true,
      stage: 'connecting',
      currentVideo: 0,
      totalVideos: 0,
      processedVideos: 0,
      currentVideoTitle: '',
      currentVideoThumbnail: '',
      totalComments: 0,
      timelineComments: 0,
      errors: [],
      estimatedTimeRemaining: null,
    });
    setFinalStats(null);

    // Create EventSource for SSE
    const eventSource = new EventSource(
      `/api/chzzk-sync?action=sync-channel-stream&force=${force}`
    );

    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      setProgress(prev => ({
        ...prev,
        stage: data.stage,
        totalVideos: data.totalVideos || prev.totalVideos,
      }));
    });

    eventSource.addEventListener('video_start', (e) => {
      const data = JSON.parse(e.data);
      const elapsed = Date.now() - startTimeRef.current;
      const avgTimePerVideo = data.current > 0 ? elapsed / data.current : 0;
      const remaining = avgTimePerVideo * (data.total - data.current);

      setProgress(prev => ({
        ...prev,
        stage: 'processing_video',
        currentVideo: data.current,
        totalVideos: data.total,
        currentVideoTitle: data.videoTitle,
        currentVideoThumbnail: data.thumbnailUrl,
        estimatedTimeRemaining: remaining,
      }));
    });

    eventSource.addEventListener('video_skip', (e) => {
      const data = JSON.parse(e.data);
      setProgress(prev => ({
        ...prev,
        processedVideos: data.current,
      }));
    });

    eventSource.addEventListener('comments_start', (e) => {
      const data = JSON.parse(e.data);
      setProgress(prev => ({
        ...prev,
        stage: 'fetching_comments',
      }));
    });

    eventSource.addEventListener('video_complete', (e) => {
      const data = JSON.parse(e.data);
      setProgress(prev => ({
        ...prev,
        processedVideos: data.stats.processedVideos,
        totalComments: data.stats.totalComments,
        timelineComments: data.stats.timelineComments,
      }));
    });

    eventSource.addEventListener('video_error', (e) => {
      const data = JSON.parse(e.data);
      setProgress(prev => ({
        ...prev,
        errors: [...prev.errors, {
          videoNo: 0,
          videoTitle: data.videoTitle,
          error: data.error,
        }],
      }));
    });

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      setFinalStats(data.stats);
      setProgress(prev => ({
        ...prev,
        isActive: false,
        stage: 'complete',
      }));
      eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
      console.error('SSE error:', e);
      setProgress(prev => ({
        ...prev,
        isActive: false,
        stage: 'error',
      }));
      eventSource.close();
    });

    eventSourceRef.current = eventSource;
  }, []);

  const cancelSync = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setProgress(prev => ({
      ...prev,
      isActive: false,
      stage: 'cancelled',
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    progress,
    finalStats,
    startSync,
    cancelSync,
  };
}
