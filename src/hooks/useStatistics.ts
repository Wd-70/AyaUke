import { useState, useEffect, useCallback } from 'react';

interface Statistics {
  totalVideos: number;
  totalTimelineComments: number;
  videosWithYoutubeUrl: number;
  videosWithTimeOffset: number;
  fullyConvertedVideos: number;
  mostRecentSync: string | null;
  avgTimelineComments: number;
  conversionHealthScore: number;
}

interface TopVideo {
  _id: string;
  videoNo: number;
  videoTitle: string;
  timelineComments: number;
  totalComments: number;
  publishDate: string;
  youtubeUrl?: string;
  timeOffset?: number;
  thumbnailImageUrl: string;
}

interface StatisticsData {
  statistics: Statistics;
  topVideos: TopVideo[];
  metadata: {
    dateFrom?: string | null;
    dateTo?: string | null;
    calculatedAt: string;
  };
}

export function useStatistics(dateFrom?: string, dateTo?: string) {
  const [data, setData] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchStatistics = useCallback(async (force = false) => {
    // Cache for 5 minutes
    const now = Date.now();
    if (!force && lastFetch && now - lastFetch < 5 * 60 * 1000) {
      return; // Use cached data
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ action: 'get-statistics' });
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const response = await fetch(`/api/chzzk-sync?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setLastFetch(now);
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, lastFetch]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return {
    data,
    loading,
    error,
    refresh: () => fetchStatistics(true)
  };
}
