'use client';

import React, { useState } from 'react';
import {
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  LinkIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import StatCard from './StatCard';
import DateRangeFilter from './DateRangeFilter';
import TopVideoCard from './TopVideoCard';
import ConversionHealthScore from './ConversionHealthScore';
import { useStatistics } from '@/hooks/useStatistics';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface StatisticsPanelProps {
  onVideoSelect?: (videoNo: number) => void;
}

export default function StatisticsPanel({ onVideoSelect }: StatisticsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [dateFrom, setDateFrom] = useState<string | undefined>();
  const [dateTo, setDateTo] = useState<string | undefined>();
  const [showTopVideos, setShowTopVideos] = useState(false);

  const { data, loading, error, refresh } = useStatistics(dateFrom, dateTo);

  const handleDateChange = (from?: string, to?: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  if (!isExpanded) {
    return (
      <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-4 border border-light-primary/20 dark:border-dark-primary/20">
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center justify-between text-light-text dark:text-dark-text hover:text-light-accent dark:hover:text-dark-accent transition-colors"
        >
          <span className="font-semibold">통계 대시보드</span>
          <ChevronDownIcon className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-light-text dark:text-dark-text">
            통계 대시보드
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={loading}
              className="p-2 bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent rounded-lg hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors disabled:opacity-50"
              title="통계 새로고침"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 text-light-text/60 dark:text-dark-text/60 hover:text-light-text dark:hover:text-dark-text transition-colors"
            >
              <ChevronUpIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <DateRangeFilter onDateChange={handleDateChange} />

        {data && (
          <div className="mt-3 text-xs text-light-text/50 dark:text-dark-text/50">
            마지막 업데이트: {formatDistanceToNow(new Date(data.metadata.calculatedAt), { addSuffix: true, locale: ko })}
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && !data && (
        <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-12 border border-light-primary/20 dark:border-dark-primary/20 text-center">
          <ArrowPathIcon className="w-12 h-12 text-light-accent dark:text-dark-accent mx-auto mb-4 animate-spin" />
          <p className="text-light-text/60 dark:text-dark-text/60">통계를 불러오는 중...</p>
        </div>
      )}

      {/* Statistics Grid */}
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="총 영상 수"
              value={data.statistics.totalVideos}
              subtitle="수집된 영상"
              icon={<VideoCameraIcon className="w-6 h-6" />}
            />
            <StatCard
              label="타임라인 댓글"
              value={data.statistics.totalTimelineComments}
              subtitle={`평균 ${data.statistics.avgTimelineComments}개/영상`}
              icon={<ChatBubbleLeftRightIcon className="w-6 h-6" />}
            />
            <StatCard
              label="유튜브 URL 설정"
              value={data.statistics.videosWithYoutubeUrl}
              subtitle={`전체의 ${Math.round((data.statistics.videosWithYoutubeUrl / data.statistics.totalVideos) * 100)}%`}
              icon={<LinkIcon className="w-6 h-6" />}
            />
            <StatCard
              label="시간차 설정"
              value={data.statistics.videosWithTimeOffset}
              subtitle={`전체의 ${Math.round((data.statistics.videosWithTimeOffset / data.statistics.totalVideos) * 100)}%`}
              icon={<ClockIcon className="w-6 h-6" />}
            />
          </div>

          {/* Conversion Health Score */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ConversionHealthScore
              score={data.statistics.conversionHealthScore}
              totalVideos={data.statistics.totalVideos}
              convertedVideos={data.statistics.fullyConvertedVideos}
            />
            <div className="lg:col-span-2">
              <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20 h-full">
                <div className="grid grid-cols-2 gap-6 h-full">
                  <div className="text-center">
                    <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <div className="text-3xl font-bold text-light-text dark:text-dark-text mb-1">
                      {data.statistics.fullyConvertedVideos}
                    </div>
                    <p className="text-sm text-light-text/60 dark:text-dark-text/60">
                      완전 변환 영상
                    </p>
                    <p className="text-xs text-light-text/50 dark:text-dark-text/50 mt-1">
                      URL과 시간차 모두 설정
                    </p>
                  </div>
                  <div className="text-center">
                    <ClockIcon className="w-12 h-12 text-light-accent dark:text-dark-accent mx-auto mb-3" />
                    <div className="text-lg font-semibold text-light-text dark:text-dark-text mb-1">
                      {data.statistics.mostRecentSync
                        ? formatDistanceToNow(new Date(data.statistics.mostRecentSync), { addSuffix: true, locale: ko })
                        : '없음'
                      }
                    </div>
                    <p className="text-sm text-light-text/60 dark:text-dark-text/60">
                      최근 동기화
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Videos Section */}
          <div className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-light-text dark:text-dark-text">
                타임라인 댓글이 많은 영상 Top 20
              </h4>
              <button
                onClick={() => setShowTopVideos(!showTopVideos)}
                className="text-sm font-medium text-light-accent dark:text-dark-accent hover:opacity-80 transition-opacity"
              >
                {showTopVideos ? '숨기기' : '보기'}
              </button>
            </div>

            {showTopVideos && (
              data.topVideos.length > 0 ? (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {data.topVideos.map((video, index) => (
                    <TopVideoCard
                      key={video.videoNo}
                      rank={index + 1}
                      videoNo={video.videoNo}
                      videoTitle={video.videoTitle}
                      timelineComments={video.timelineComments}
                      totalComments={video.totalComments}
                      publishDate={video.publishDate}
                      thumbnailImageUrl={video.thumbnailImageUrl}
                      hasYoutubeUrl={!!video.youtubeUrl}
                      hasTimeOffset={video.timeOffset !== null && video.timeOffset !== undefined}
                      onClick={() => onVideoSelect?.(video.videoNo)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-light-text/60 dark:text-dark-text/60 py-8">
                  타임라인 댓글이 있는 영상이 없습니다.
                </p>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
